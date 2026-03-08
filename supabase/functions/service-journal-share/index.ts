import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    // Public share view (GET with token)
    if (req.method === "GET" && token) {
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

      const { data: share } = await supabase
        .from("service_journal_shares")
        .select("*, service_journals(*)")
        .eq("token", token)
        .single();

      if (!share) {
        return new Response("<h1>Lenke ikke funnet</h1>", { status: 404, headers: { "Content-Type": "text/html" } });
      }

      if (share.expires_at && new Date(share.expires_at) < new Date()) {
        return new Response("<h1>Denne lenken har utløpt</h1>", { status: 410, headers: { "Content-Type": "text/html" } });
      }

      // Increment view count
      await supabase.from("service_journal_shares").update({ view_count: (share.view_count || 0) + 1 }).eq("id", share.id);

      const journal = share.service_journals;
      if (!journal) {
        return new Response("<h1>Journal ikke funnet</h1>", { status: 404, headers: { "Content-Type": "text/html" } });
      }

      // Get project info
      const { data: project } = await supabase
        .from("events")
        .select("title, internal_number, address, customers:customer_id(name)")
        .eq("id", journal.project_id)
        .single();

      const { data: company } = await supabase.from("company_settings").select("company_name, logo_url").limit(1).single();

      // Get blocks
      const { data: blocks } = await supabase
        .from("schedule_blocks")
        .select("start_at, end_at, technicians!inner(name)")
        .eq("project_id", journal.project_id)
        .is("deleted_at", null)
        .order("start_at", { ascending: true })
        .limit(100);

      const { data: deviations } = await supabase
        .from("job_tasks")
        .select("title, status")
        .eq("job_id", journal.project_id)
        .eq("category", "avvik")
        .limit(20);

      const content = journal.content || {};
      const sigs = journal.signatures || {};
      const customerName = Array.isArray(project?.customers) ? project.customers[0]?.name : (project?.customers as any)?.name || "";
      const completedBlocks = (blocks || []).filter((b: any) => new Date(b.end_at) < new Date());
      const totalMin = (blocks || []).reduce((s: number, b: any) => s + Math.round((new Date(b.end_at).getTime() - new Date(b.start_at).getTime()) / 60000), 0);

      const formatDate = (iso: string) => {
        const d = new Date(iso);
        return `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1).toString().padStart(2, "0")}.${d.getFullYear()}`;
      };
      const formatTime = (iso: string) => {
        const d = new Date(iso);
        return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
      };

      // Log view
      await supabase.from("activity_log").insert({
        entity_id: journal.project_id,
        entity_type: "job",
        action: "service_journal_link_viewed",
        type: "note",
        title: "Servicejournal åpnet via delt lenke",
      });

      // Build HTML
      let html = `<!DOCTYPE html><html lang="no"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${journal.report_type === "arbeidsrapport" ? "Arbeidsrapport" : "Servicejournal"} – ${project?.title || ""}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1f2937;background:#f9fafb;line-height:1.6}
.wrap{max-width:720px;margin:24px auto;background:#fff;border-radius:16px;box-shadow:0 1px 3px rgba(0,0,0,.08);padding:40px}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px}
.logo img{height:36px;width:auto}
.badge{display:inline-block;padding:2px 10px;border-radius:999px;font-size:11px;font-weight:600;background:#e8f5ef;color:#166534}
.meta-label{font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;font-weight:600}
.meta-val{font-size:14px;color:#1f2937;margin-bottom:8px}
.title{font-size:22px;font-weight:700;margin:8px 0 4px}
.type-label{font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.08em}
hr{border:none;border-top:1px solid #e5e7eb;margin:20px 0}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:16px 0}
.stat{background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:12px}
.stat-label{font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em}
.stat-val{font-size:22px;font-weight:700;color:#1f2937}
h2{font-size:15px;font-weight:700;color:#166534;border-bottom:1px solid #d1fae5;padding-bottom:4px;margin:24px 0 12px}
.session{display:flex;gap:12px;padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px}
.session-date{font-weight:600;min-width:80px}
.session-time{color:#6b7280}
.session-tech{color:#6b7280;margin-left:auto}
.dev{padding:6px 0;font-size:13px;display:flex;justify-content:space-between}
.sig-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:16px}
.sig-box{text-align:center}
.sig-box img{max-width:200px;height:60px;object-fit:contain}
.sig-line{border-top:1px solid #d1d5db;margin-top:8px;padding-top:4px;font-size:11px;color:#6b7280}
.footer{text-align:center;margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af}
p{margin:4px 0;font-size:14px}
</style></head><body><div class="wrap">`;

      // Header
      html += `<div class="header"><div class="logo">`;
      if (company?.logo_url) html += `<img src="${company.logo_url}" alt="Logo"/>`;
      else if (company?.company_name) html += `<strong>${company.company_name}</strong>`;
      html += `</div><span class="badge">${journal.status === "approved" ? "Godkjent" : journal.status === "sent" ? "Sendt" : "v" + journal.version}</span></div>`;

      html += `<div class="type-label">${journal.report_type === "arbeidsrapport" ? "Arbeidsrapport" : "Servicejournal"}</div>`;
      html += `<div class="title">${project?.title || ""}</div>`;

      // Meta
      html += `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px">`;
      const metaItems = [
        ["Kunde", customerName],
        ["Adresse", project?.address || ""],
        ["Prosjektnr.", project?.internal_number || ""],
        ["Dato", formatDate(new Date().toISOString())],
        ["Versjon", `v${journal.version}`],
      ].filter(m => m[1]);
      for (const [l, v] of metaItems) {
        html += `<div><div class="meta-label">${l}</div><div class="meta-val">${v}</div></div>`;
      }
      html += `</div><hr/>`;

      // Stats
      html += `<div class="stats">
        <div class="stat"><div class="stat-label">Timer</div><div class="stat-val">${(totalMin / 60).toFixed(1)}</div></div>
        <div class="stat"><div class="stat-label">Montører</div><div class="stat-val">${new Set((blocks || []).map((b: any) => b.technicians?.name).filter(Boolean)).size}</div></div>
        <div class="stat"><div class="stat-label">Avvik</div><div class="stat-val">${(deviations || []).length}</div></div>
      </div>`;

      // Oppdrag
      if (content.summaryText) {
        html += `<h2>Oppdrag</h2><p>${(content.summaryText || "").replace(/\n/g, "<br/>")}</p>`;
      }

      // Utført arbeid
      if (content.workDescription) {
        html += `<h2>Utført arbeid</h2><p>${(content.workDescription || "").replace(/\n/g, "<br/>")}</p>`;
      }

      // Arbeidsøkter
      if (completedBlocks.length > 0) {
        html += `<h2>Arbeidsøkter (${completedBlocks.length})</h2>`;
        for (const b of completedBlocks) {
          const dur = Math.round((new Date((b as any).end_at).getTime() - new Date((b as any).start_at).getTime()) / 60000);
          const durLabel = dur >= 60 ? `${Math.floor(dur / 60)}t ${dur % 60}m` : `${dur}m`;
          html += `<div class="session">
            <span class="session-date">${formatDate((b as any).start_at)}</span>
            <span class="session-time">${formatTime((b as any).start_at)} – ${formatTime((b as any).end_at)} (${durLabel})</span>
            <span class="session-tech">${(b as any).technicians?.name || ""}</span>
          </div>`;
        }
      }

      // Merknader
      if ((deviations || []).length > 0 || content.customerComment) {
        html += `<h2>Merknader</h2>`;
        for (const d of deviations || []) {
          html += `<div class="dev"><span>• ${(d as any).title}</span><span style="color:#6b7280">${(d as any).status === "completed" ? "Lukket" : "Åpen"}</span></div>`;
        }
        if (content.customerComment) {
          html += `<p style="margin-top:8px">${(content.customerComment || "").replace(/\n/g, "<br/>")}</p>`;
        }
      }

      // Signatur
      html += `<h2>Signatur</h2><div class="sig-grid">`;
      html += `<div class="sig-box">`;
      if (sigs.responsible) html += `<img src="${sigs.responsible}" alt="Signatur"/>`;
      else html += `<div style="height:60px"></div>`;
      html += `<div class="sig-line">${sigs.responsibleRole || "Ansvarlig montør"}<br/>${formatDate(new Date().toISOString())}</div></div>`;
      html += `<div class="sig-box">`;
      if (sigs.customer) html += `<img src="${sigs.customer}" alt="Signatur"/>`;
      else html += `<div style="height:60px"></div>`;
      html += `<div class="sig-line">${sigs.customerRole || "Kunde"}<br/>${formatDate(new Date().toISOString())}</div></div>`;
      html += `</div>`;

      // Footer
      html += `<div class="footer">${company?.company_name || ""} · Generert ${formatDate(new Date().toISOString())}</div>`;
      html += `</div></body></html>`;

      return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    // ═══ AUTHENTICATED ACTIONS (POST) ═══
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(supabaseUrl, serviceKey);
    const body = await req.json();
    const action = body.action; // "create_share" | "delete_share"

    if (action === "create_share") {
      const { journal_id, expires_days } = body;
      if (!journal_id) throw new Error("journal_id required");

      const { data: journal } = await supabase.from("service_journals").select("project_id, version").eq("id", journal_id).single();
      if (!journal) throw new Error("Journal not found");

      // Get user account
      const { data: ua } = await supabase.from("user_accounts").select("id").eq("auth_user_id", user.id).eq("is_active", true).single();

      const expiresAt = expires_days ? new Date(Date.now() + expires_days * 24 * 60 * 60 * 1000).toISOString() : null;

      const { data: share, error } = await supabase.from("service_journal_shares").insert({
        journal_id,
        expires_at: expiresAt,
        created_by: ua?.id || null,
      }).select().single();

      if (error) throw error;

      // Log
      await supabase.from("activity_log").insert({
        entity_id: journal.project_id,
        entity_type: "job",
        action: "service_journal_link_created",
        type: "note",
        title: `Delingslenke opprettet for servicejournal v${journal.version}`,
        performed_by: user.id,
      });

      const shareUrl = `${supabaseUrl}/functions/v1/service-journal-share?token=${share.token}`;

      return new Response(JSON.stringify({ success: true, share_url: shareUrl, token: share.token, expires_at: expiresAt }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete_share") {
      const { share_id } = body;
      await supabase.from("service_journal_shares").delete().eq("id", share_id);
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("service-journal-share error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
