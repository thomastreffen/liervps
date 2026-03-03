import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

function graphErrorMessage(status: number, _code?: string): string {
  if (status === 401) return "Microsoft-token feilet. Sjekk client secret og tenant.";
  if (status === 403) return "Appen mangler rettigheter til SharePoint-området eller drive.";
  if (status === 404) return "Fant ikke mappen i SharePoint. Sjekk at koblingen er riktig.";
  if (status === 429) return "For mange forespørsler mot Microsoft. Prøv igjen om litt.";
  if (status >= 500) return "Microsoft/Graph midlertidig feil. Prøv igjen.";
  return `SharePoint-feil (HTTP ${status})`;
}

async function getAppToken(): Promise<string> {
  const res = await fetch(
    `https://login.microsoftonline.com/${Deno.env.get("AZURE_TENANT_ID")}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: Deno.env.get("AZURE_CLIENT_ID")!,
        client_secret: Deno.env.get("AZURE_CLIENT_SECRET")!,
        grant_type: "client_credentials",
        scope: "https://graph.microsoft.com/.default",
      }),
    }
  );
  if (!res.ok) throw new Error(`Token failed: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  const respond = (data: any, status = 200) =>
    new Response(JSON.stringify({ ...data, request_id: requestId }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return respond({ error: "Unauthorized" }, 401);

    const jwt = authHeader.replace("Bearer ", "");
    const supabaseAnon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userErr } = await supabaseAnon.auth.getUser(jwt);
    if (userErr || !userData?.user) return respond({ error: "Invalid session" }, 401);
    const authUserId = userData.user.id;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const body = await req.json().catch(() => ({}));
    const { job_id, view_mode, category_key, folder_id: subfolderId, query, sort } = body;

    if (!job_id) return respond({ error: "job_id required" }, 400);

    // ── Auto-detect: scan root folder and suggest mappings ──
    if (view_mode === "auto_detect") {
      const { data: job } = await supabaseAdmin
        .from("events")
        .select("id, company_id, department_id, created_by, sharepoint_drive_id, sharepoint_folder_id")
        .eq("id", job_id)
        .single();
      if (!job?.sharepoint_drive_id || !job?.sharepoint_folder_id) {
        return respond({ error: "Ikke koblet til SharePoint", step: "not_linked" }, 409);
      }

      // RBAC
      const { data: hasAccess } = await supabaseAdmin.rpc("can_access_record_v2", {
        _auth_user_id: authUserId, _record_company_id: job.company_id,
        _record_department_id: job.department_id || null, _record_created_by: job.created_by || null, _record_id: job.id,
      });
      if (!hasAccess) return respond({ error: "Mangler tilgang", step: "rbac" }, 403);

      let msToken: string;
      try { msToken = await getAppToken(); } catch { return respond({ error: "Token feilet", step: "token" }, 502); }

      const childrenUrl = `${GRAPH_BASE}/drives/${job.sharepoint_drive_id}/items/${job.sharepoint_folder_id}/children?$top=50&$select=id,name,folder,webUrl`;
      const res = await fetch(childrenUrl, { headers: { Authorization: `Bearer ${msToken}` } });
      if (!res.ok) { await res.text(); return respond({ error: graphErrorMessage(res.status), step: "auto_detect" }, 502); }
      const data = await res.json();
      const folders = (data.value || []).filter((i: any) => !!i.folder).map((i: any) => ({
        id: i.id,
        name: i.name,
        web_url: i.webUrl,
        child_count: i.folder?.childCount || 0,
      }));
      return respond({ mode: "auto_detect", folders, drive_id: job.sharepoint_drive_id });
    }

    // Job lookup — server-side only
    const { data: job, error: jobErr } = await supabaseAdmin
      .from("events")
      .select("id, company_id, department_id, created_by, sharepoint_drive_id, sharepoint_folder_id, sharepoint_folder_web_url, sharepoint_project_code")
      .eq("id", job_id)
      .single();

    if (jobErr || !job) return respond({ error: "Jobb ikke funnet", step: "lookup" }, 404);

    // RBAC: scope access
    const { data: hasAccess } = await supabaseAdmin.rpc("can_access_record_v2", {
      _auth_user_id: authUserId,
      _record_company_id: job.company_id,
      _record_department_id: job.department_id || null,
      _record_created_by: job.created_by || null,
      _record_id: job.id,
    });
    if (!hasAccess) return respond({ error: "Du mangler tilgang til SharePoint for dette selskapet.", step: "rbac" }, 403);

    // RBAC: permission
    const { data: canView } = await supabaseAdmin.rpc("check_permission_v2", {
      _auth_user_id: authUserId,
      _perm: "sharepoint.view",
    });
    if (!canView) return respond({ error: "Du mangler SharePoint-leserettigheter.", step: "rbac" }, 403);

    if (!job.sharepoint_drive_id || !job.sharepoint_folder_id) {
      return respond({
        error: "Jobben er ikke koblet til SharePoint. Koble først via Dokumenter-fanen.",
        step: "not_linked",
      }, 409);
    }

    const driveId = job.sharepoint_drive_id;
    const rootFolderId = job.sharepoint_folder_id;

    console.log(`[sharepoint-list] request_id=${requestId} job_id=${job_id} view_mode=${view_mode || "curated"} category=${category_key || ""}`);

    let msToken: string;
    try {
      msToken = await getAppToken();
    } catch (e: any) {
      console.error(`[sharepoint-list] request_id=${requestId} step=token error=${e.message}`);
      return respond({ error: "Microsoft-token feilet.", graph_status: 401, step: "token" }, 502);
    }

    // ── Helper: resolve folder for a category using project mappings first, then company mappings ──
    async function resolveCategoryFolder(catKey: string): Promise<{
      folderId: string | null;
      folderWebUrl: string | null;
      folderPath: string | null;
      readOnly: boolean;
      displayName: string;
      source: "project" | "company" | null;
      notMapped: boolean;
    }> {
      // 1. Check project-level mapping first
      const { data: projMapping } = await supabaseAdmin
        .from("project_sharepoint_category_mappings")
        .select("folder_id, folder_web_url, folder_path, display_name, drive_id")
        .eq("project_id", job_id)
        .eq("category_key", catKey)
        .maybeSingle();

      if (projMapping?.folder_id) {
        return {
          folderId: projMapping.folder_id,
          folderWebUrl: projMapping.folder_web_url,
          folderPath: projMapping.folder_path,
          readOnly: false,
          displayName: projMapping.display_name,
          source: "project",
          notMapped: false,
        };
      }

      // 2. Fall back to company-level mapping
      const { data: compMapping } = await supabaseAdmin
        .from("document_category_mappings")
        .select("sharepoint_relative_path, read_only, display_name")
        .eq("company_id", job.company_id)
        .eq("category_key", catKey)
        .maybeSingle();

      if (!compMapping) {
        return { folderId: null, folderWebUrl: null, folderPath: null, readOnly: false, displayName: catKey, source: null, notMapped: true };
      }

      // Resolve company mapping to actual folder ID via Graph
      const catPath = compMapping.sharepoint_relative_path;
      const folderUrl = `${GRAPH_BASE}/drives/${driveId}/items/${rootFolderId}:/${encodeURIComponent(catPath).replace(/%2F/g, "/")}`;
      const folderRes = await fetch(folderUrl, { headers: { Authorization: `Bearer ${msToken}` } });

      if (folderRes.ok) {
        const folderData = await folderRes.json();
        return {
          folderId: folderData.id,
          folderWebUrl: folderData.webUrl,
          folderPath: catPath,
          readOnly: compMapping.read_only,
          displayName: compMapping.display_name,
          source: "company",
          notMapped: false,
        };
      }
      await folderRes.text();
      return {
        folderId: null,
        folderWebUrl: null,
        folderPath: catPath,
        readOnly: compMapping.read_only,
        displayName: compMapping.display_name,
        source: "company",
        notMapped: false,
      };
    }

    // ── CURATED MODE (default): Return category tiles with counts ──
    if ((view_mode || "curated") === "curated" && !category_key && !subfolderId && !query) {
      // Load company-level category mappings for tile list
      const { data: mappings } = await supabaseAdmin
        .from("document_category_mappings")
        .select("category_key, display_name, sharepoint_relative_path, read_only, icon, sort_order")
        .eq("company_id", job.company_id)
        .order("sort_order", { ascending: true });

      // Load project-level overrides
      const { data: projMappings } = await supabaseAdmin
        .from("project_sharepoint_category_mappings")
        .select("category_key, display_name, folder_id, folder_web_url, folder_path, drive_id")
        .eq("project_id", job_id);

      const projMap = new Map((projMappings || []).map(m => [m.category_key, m]));
      const categories = mappings || [];
      const tiles: any[] = [];

      for (const cat of categories) {
        const projOverride = projMap.get(cat.category_key);

        if (projOverride?.folder_id) {
          // Use project-level mapping directly
          const childrenUrl = `${GRAPH_BASE}/drives/${driveId}/items/${projOverride.folder_id}/children?$top=1&$orderby=lastModifiedDateTime desc&$select=lastModifiedDateTime,lastModifiedBy`;
          const folderMetaUrl = `${GRAPH_BASE}/drives/${driveId}/items/${projOverride.folder_id}?$select=id,folder,webUrl,lastModifiedDateTime`;

          const [metaRes, childrenRes] = await Promise.all([
            fetch(folderMetaUrl, { headers: { Authorization: `Bearer ${msToken}` } }),
            fetch(childrenUrl, { headers: { Authorization: `Bearer ${msToken}` } }),
          ]);

          if (metaRes.ok) {
            const metaData = await metaRes.json();
            let fileCount = metaData.folder?.childCount || 0;
            let lastModified: string | null = metaData.lastModifiedDateTime;
            let lastModifiedBy: string | null = null;

            if (childrenRes.ok) {
              const childrenData = await childrenRes.json();
              if (childrenData.value?.[0]) {
                lastModified = childrenData.value[0].lastModifiedDateTime;
                lastModifiedBy = childrenData.value[0].lastModifiedBy?.user?.displayName || null;
              }
            } else { await childrenRes.text(); }

            console.log(`[sharepoint-list] request_id=${requestId} category=${cat.category_key} source=project folder_id=${projOverride.folder_id} folder_path=${projOverride.folder_path} file_count=${fileCount}`);

            tiles.push({
              category_key: cat.category_key,
              display_name: projOverride.display_name || cat.display_name,
              read_only: cat.read_only,
              icon: cat.icon,
              folder_id: projOverride.folder_id,
              web_url: projOverride.folder_web_url || metaData.webUrl,
              file_count: fileCount,
              last_modified: lastModified,
              last_modified_by: lastModifiedBy,
              exists: true,
              mapping_source: "project",
              folder_path: projOverride.folder_path,
            });
          } else {
            await metaRes.text();
            console.log(`[sharepoint-list] request_id=${requestId} category=${cat.category_key} source=project folder_id=${projOverride.folder_id} NOT_FOUND`);
            tiles.push({
              category_key: cat.category_key,
              display_name: projOverride.display_name || cat.display_name,
              read_only: cat.read_only,
              icon: cat.icon,
              folder_id: projOverride.folder_id,
              web_url: projOverride.folder_web_url,
              file_count: 0,
              last_modified: null,
              last_modified_by: null,
              exists: false,
              mapping_source: "project",
              folder_path: projOverride.folder_path,
            });
          }
        } else {
          // Use company-level mapping (original logic)
          const catPath = cat.sharepoint_relative_path;
          const folderUrl = `${GRAPH_BASE}/drives/${driveId}/items/${rootFolderId}:/${encodeURIComponent(catPath).replace(/%2F/g, "/")}`;

          const folderRes = await fetch(folderUrl, { headers: { Authorization: `Bearer ${msToken}` } });

          if (folderRes.ok) {
            const folderData = await folderRes.json();
            const childrenUrl = `${GRAPH_BASE}/drives/${driveId}/items/${folderData.id}/children?$top=1&$orderby=lastModifiedDateTime desc&$select=lastModifiedDateTime,lastModifiedBy`;
            const childrenRes = await fetch(childrenUrl, { headers: { Authorization: `Bearer ${msToken}` } });
            let fileCount = folderData.folder?.childCount || 0;
            let lastModified: string | null = folderData.lastModifiedDateTime;
            let lastModifiedBy: string | null = null;

            if (childrenRes.ok) {
              const childrenData = await childrenRes.json();
              if (childrenData.value?.[0]) {
                lastModified = childrenData.value[0].lastModifiedDateTime;
                lastModifiedBy = childrenData.value[0].lastModifiedBy?.user?.displayName || null;
              }
            } else { await childrenRes.text(); }

            console.log(`[sharepoint-list] request_id=${requestId} category=${cat.category_key} source=company folder_id=${folderData.id} folder_path=${catPath} file_count=${fileCount}`);

            tiles.push({
              category_key: cat.category_key,
              display_name: cat.display_name,
              read_only: cat.read_only,
              icon: cat.icon,
              folder_id: folderData.id,
              web_url: folderData.webUrl,
              file_count: fileCount,
              last_modified: lastModified,
              last_modified_by: lastModifiedBy,
              exists: true,
              mapping_source: "company",
              folder_path: catPath,
            });
          } else {
            await folderRes.text();
            console.log(`[sharepoint-list] request_id=${requestId} category=${cat.category_key} source=company folder_path=${catPath} NOT_FOUND`);
            tiles.push({
              category_key: cat.category_key,
              display_name: cat.display_name,
              read_only: cat.read_only,
              icon: cat.icon,
              folder_id: null,
              web_url: null,
              file_count: 0,
              last_modified: null,
              last_modified_by: null,
              exists: false,
              mapping_source: "company",
              folder_path: catPath,
            });
          }
        }
      }

      return respond({
        mode: "curated",
        tiles,
        project_code: job.sharepoint_project_code,
        root_web_url: job.sharepoint_folder_web_url,
      });
    }

    // ── CATEGORY MODE: List files within a specific category folder ──
    if (category_key && !subfolderId) {
      const resolved = await resolveCategoryFolder(category_key);

      console.log(`[sharepoint-list] request_id=${requestId} category=${category_key} resolved source=${resolved.source} folder_id=${resolved.folderId} folder_path=${resolved.folderPath} not_mapped=${resolved.notMapped}`);

      if (resolved.notMapped) {
        return respond({ error: "Kategori ikke mappet. Velg mappe i mappinginnstillinger.", step: "not_mapped" }, 400);
      }

      if (!resolved.folderId) {
        return respond({
          items: [],
          category_key,
          read_only: resolved.readOnly,
          folder_missing: true,
          mapping_source: resolved.source,
          folder_path: resolved.folderPath,
        });
      }

      const listUrl = query
        ? `${GRAPH_BASE}/drives/${driveId}/items/${resolved.folderId}/search(q='${encodeURIComponent(query)}')`
        : `${GRAPH_BASE}/drives/${driveId}/items/${resolved.folderId}/children?$top=200&$orderby=lastModifiedDateTime desc`;

      const graphRes = await fetch(listUrl, { headers: { Authorization: `Bearer ${msToken}` } });

      if (!graphRes.ok) {
        const errBody = await graphRes.json().catch(() => ({}));
        return respond({
          error: graphErrorMessage(graphRes.status, errBody?.error?.code),
          graph_status: graphRes.status,
          step: "category_list",
        }, 502);
      }

      const graphData = await graphRes.json();
      const items = (graphData.value || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        isFolder: !!item.folder,
        size: item.size || 0,
        mimeType: item.file?.mimeType || null,
        webUrl: item.webUrl,
        lastModified: item.lastModifiedDateTime,
        lastModifiedBy: item.lastModifiedBy?.user?.displayName || null,
        childCount: item.folder?.childCount || 0,
      }));

      if (sort === "name") items.sort((a: any, b: any) => a.name.localeCompare(b.name, "nb"));
      else if (sort === "size") items.sort((a: any, b: any) => b.size - a.size);

      console.log(`[sharepoint-list] request_id=${requestId} category=${category_key} file_count=${items.length}`);

      return respond({
        mode: "category",
        items,
        category_key,
        read_only: resolved.readOnly,
        folder_id: resolved.folderId,
        web_url: resolved.folderWebUrl,
        mapping_source: resolved.source,
        folder_path: resolved.folderPath,
      });
    }

    // ── RAW MODE / subfolder browsing (legacy explorer) ──
    const folderId = subfolderId || rootFolderId;
    let url: string;
    if (query) {
      url = `${GRAPH_BASE}/drives/${driveId}/items/${folderId}/search(q='${encodeURIComponent(query)}')`;
    } else {
      url = `${GRAPH_BASE}/drives/${driveId}/items/${folderId}/children?$top=200&$orderby=lastModifiedDateTime desc`;
    }

    const graphRes = await fetch(url, { headers: { Authorization: `Bearer ${msToken}` } });

    if (!graphRes.ok) {
      const errBody = await graphRes.json().catch(() => ({}));
      const errCode = errBody?.error?.code || "";
      return respond({
        error: graphErrorMessage(graphRes.status, errCode),
        graph_status: graphRes.status,
        graph_error_code: errCode,
        step: "list",
      }, 502);
    }

    const graphData = await graphRes.json();
    const rawItems = graphData.value || [];

    const items = rawItems.map((item: any) => ({
      id: item.id,
      name: item.name,
      isFolder: !!item.folder,
      size: item.size || 0,
      mimeType: item.file?.mimeType || null,
      webUrl: item.webUrl,
      lastModified: item.lastModifiedDateTime,
      lastModifiedBy: item.lastModifiedBy?.user?.displayName || null,
      childCount: item.folder?.childCount || 0,
    }));

    if (sort === "name") items.sort((a: any, b: any) => a.name.localeCompare(b.name, "nb"));
    else if (sort === "size") items.sort((a: any, b: any) => b.size - a.size);

    return respond({ mode: "raw", items });
  } catch (err: any) {
    console.error(`[sharepoint-list] request_id=${requestId} unhandled error:`, err.message);
    return respond({ error: err.message || "Internal error", step: "unknown" }, 500);
  }
});
