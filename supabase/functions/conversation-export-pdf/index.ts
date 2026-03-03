import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// Simple PDF generation using text rendering
// jsPDF is not available in Deno, so we generate a basic HTML-to-text export

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { thread_id } = await req.json();
    if (!thread_id) {
      return new Response(JSON.stringify({ error: "thread_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Validate user
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Get thread
    const { data: thread } = await supabase
      .from("conversation_threads")
      .select("*")
      .eq("id", thread_id)
      .single();

    if (!thread) {
      return new Response(JSON.stringify({ error: "Thread not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get project
    const { data: project } = await supabase
      .from("events")
      .select("title, internal_number, customers:customer_id(name)")
      .eq("id", thread.project_id)
      .single();

    // Get posts
    const { data: posts } = await supabase
      .from("conversation_posts")
      .select("*, conversation_attachments(*)")
      .eq("thread_id", thread_id)
      .order("created_at", { ascending: true });

    // Get participants
    const { data: participants } = await supabase
      .from("conversation_thread_participants")
      .select("*")
      .eq("thread_id", thread_id);

    // Build HTML for PDF
    const customerName = Array.isArray(project?.customers)
      ? project.customers[0]?.name
      : (project?.customers as any)?.name || "";

    const categoryLabels: Record<string, string> = {
      normal: "Normal",
      risk: "Risiko",
      change: "Endring",
    };

    const statusLabels: Record<string, string> = {
      open: "Åpen",
      closed: "Lukket",
    };

    let html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 40px auto; color: #1f2937; font-size: 13px; line-height: 1.6; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  .meta { color: #6b7280; font-size: 11px; margin-bottom: 20px; }
  .meta span { margin-right: 12px; }
  .decision-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px; margin-bottom: 20px; }
  .decision-box h3 { font-size: 13px; color: #2563eb; margin: 0 0 4px; }
  .post { border-top: 1px solid #e5e7eb; padding: 16px 0; }
  .post-author { font-weight: 600; font-size: 13px; }
  .post-time { color: #9ca3af; font-size: 11px; margin-left: 8px; }
  .post-body { margin-top: 8px; }
  .system-post { color: #9ca3af; font-style: italic; text-align: center; padding: 8px 0; border-top: 1px solid #e5e7eb; }
  .attachment { display: inline-block; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 6px; padding: 4px 8px; margin: 2px; font-size: 11px; }
  .participants { margin-bottom: 20px; }
  .participants span { display: inline-block; background: #f3f4f6; border-radius: 4px; padding: 2px 8px; margin: 2px; font-size: 11px; }
</style>
</head>
<body>
<h1>${thread.title}</h1>
<div class="meta">
  <span>Prosjekt: ${project?.internal_number || ""} ${project?.title || ""}</span>
  <span>Kunde: ${customerName}</span>
  <span>Status: ${statusLabels[thread.status] || thread.status}</span>
  <span>Type: ${categoryLabels[thread.thread_category] || "Normal"}</span>
  ${thread.is_formal_decision ? '<span style="color:#2563eb;font-weight:600;">✓ Beslutning</span>' : ""}
</div>
`;

    if (thread.is_formal_decision && thread.decision_summary) {
      html += `
<div class="decision-box">
  <h3>Formell beslutning</h3>
  <p>${thread.decision_summary}</p>
</div>`;
    }

    // Participants
    if (participants && participants.length > 0) {
      html += '<div class="participants"><strong>Deltakere:</strong> ';
      for (const p of participants) {
        const name = p.display_name || p.email || p.user_account_id || "Ukjent";
        html += `<span>${name}</span>`;
      }
      html += "</div>";
    }

    // Posts
    for (const post of posts || []) {
      if (post.post_type === "system") {
        html += `<div class="system-post">${post.body_text || "Systemhendelse"}</div>`;
        continue;
      }

      const author = post.from_name || post.from_email || "Intern bruker";
      const time = new Date(post.sent_at || post.created_at).toLocaleString("nb-NO");
      const typeLabel = post.post_type === "email" ? " (E-post)" : "";

      html += `
<div class="post">
  <span class="post-author">${author}${typeLabel}</span>
  <span class="post-time">${time}</span>
  <div class="post-body">${post.body_html || (post.body_text || "").replace(/\n/g, "<br/>")}</div>`;

      const attachments = post.conversation_attachments || [];
      if (attachments.length > 0) {
        html += '<div style="margin-top:8px;">';
        for (const a of attachments) {
          html += `<span class="attachment">📎 ${a.file_name}</span>`;
        }
        html += "</div>";
      }

      html += "</div>";
    }

    html += `
<div style="margin-top:30px;padding-top:12px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:10px;">
  Eksportert ${new Date().toLocaleString("nb-NO")} • Samtale-ID: ${thread.id}
</div>
</body></html>`;

    return new Response(html, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="samtale-${thread.id.slice(0, 8)}.html"`,
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
