/**
 * Creates (or reuses) a Google Drive folder for a lead:
 *   Lier VPS / Leads / YYYY / [kundenavn] - [adresse eller lead-id]
 *
 * Body: { lead_id: string }
 * Returns: { status: "created" | "reused" | "no_token" | "error", folder_id?, folder_url? }
 *
 * Requires an authenticated internal user with a Google token that granted
 * drive.file. Never blocks the caller — "no_token" is a normal outcome.
 */
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { SCOPE_DRIVE_FILE, ensureFreshAccessToken, loadUserToken } from "../_shared/google-token.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FOLDER_MIME = "application/vnd.google-apps.folder";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function esc(name: string) {
  return name.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function ensureFolder(token: string, name: string, parentId: string | null): Promise<string> {
  const q = [
    `name = '${esc(name)}'`,
    `mimeType = '${FOLDER_MIME}'`,
    "trashed = false",
    parentId ? `'${esc(parentId)}' in parents` : null,
  ].filter(Boolean).join(" and ");

  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=1`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const searchData = await searchRes.json().catch(() => ({}));
  if (!searchRes.ok) throw new Error(`drive search ${searchRes.status}: ${searchData?.error?.message ?? "unknown"}`);
  if (searchData.files?.length) return searchData.files[0].id as string;

  const createRes = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: parentId ? [parentId] : undefined }),
  });
  const createData = await createRes.json().catch(() => ({}));
  if (!createRes.ok) throw new Error(`drive create ${createRes.status}: ${createData?.error?.message ?? "unknown"}`);
  return createData.id as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: authData } = jwt ? await admin.auth.getUser(jwt) : { data: null as any };
  const user = authData?.user ?? null;
  if (!user) return json({ status: "error", code: "unauthenticated" }, 401);

  let body: { lead_id?: string };
  try { body = await req.json(); } catch { return json({ status: "error", code: "bad_json" }, 400); }
  if (!UUID_RE.test(body.lead_id ?? "")) return json({ status: "error", code: "bad_id" }, 400);
  const leadId = body.lead_id!;

  const { data: lead } = await admin
    .from("leads")
    .select("id, company_name, contact_name, company_id, public_lead_id, drive_folder_id, drive_folder_url")
    .eq("id", leadId)
    .maybeSingle();
  if (!lead) return json({ status: "error", code: "lead_not_found" }, 404);

  // Authorization: the caller must be a member of the lead's company (superadmin passes).
  const { data: allowed } = await admin.rpc("is_super_admin", { _user_id: user.id }).then(
    (r: any) => ({ data: r.data }),
    () => ({ data: false }),
  );
  if (!allowed && lead.company_id) {
    const { data: membership } = await admin
      .from("user_memberships")
      .select("id")
      .eq("user_id", user.id)
      .eq("company_id", lead.company_id)
      .maybeSingle();
    if (!membership) return json({ status: "error", code: "forbidden" }, 403);
  }

  if (lead.drive_folder_id && lead.drive_folder_url) {
    return json({ status: "reused", folder_id: lead.drive_folder_id, folder_url: lead.drive_folder_url });
  }

  const tokenRow = await loadUserToken(admin, user.id, [SCOPE_DRIVE_FILE]);
  const accessToken = await ensureFreshAccessToken(admin, tokenRow);
  if (!tokenRow || !accessToken) {
    console.info("[google-drive-folder] Google Drive not connected, folder creation skipped");
    return json({ status: "no_token" });
  }

  let address: string | null = null;
  if (lead.public_lead_id) {
    const { data: pl } = await admin.from("public_leads").select("address").eq("id", lead.public_lead_id).maybeSingle();
    address = (pl?.address as string | null) ?? null;
  }

  const year = String(new Date().getFullYear());
  const customerName = (lead.company_name || lead.contact_name || "Ukjent kunde").slice(0, 80);
  const suffix = (address || lead.id).replace(/[\\/]/g, "-").slice(0, 80);
  const leafName = `${customerName} - ${suffix}`;

  try {
    const rootId = await ensureFolder(accessToken, "Lier VPS", null);
    const leadsId = await ensureFolder(accessToken, "Leads", rootId);
    const yearId = await ensureFolder(accessToken, year, leadsId);
    const folderId = await ensureFolder(accessToken, leafName, yearId);
    const folderUrl = `https://drive.google.com/drive/folders/${folderId}`;

    await admin.from("leads").update({ drive_folder_id: folderId, drive_folder_url: folderUrl }).eq("id", leadId);

    return json({ status: "created", folder_id: folderId, folder_url: folderUrl });
  } catch (e) {
    console.error("[google-drive-folder] failed", e);
    return json({ status: "error", code: "drive_failed", detail: String(e) });
  }
});
