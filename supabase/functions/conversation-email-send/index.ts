import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const body = await req.json();
    const { post_id, mode, thread_id, recipient_email } = body;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // ── Welcome mode: send history summary to newly added participant ──
    if (mode === "welcome_participant") {
      if (!thread_id || !recipient_email) {
        return new Response(JSON.stringify({ error: "thread_id and recipient_email required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: thread } = await supabase
        .from("conversation_threads")
        .select("*")
        .eq("id", thread_id)
        .single();

      if (!thread || !thread.email_enabled) {
        return new Response(
          JSON.stringify({ skipped: true, reason: "email_disabled_or_not_found" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get last 3 non-system posts
      const { data: recentPosts } = await supabase
        .from("conversation_posts")
        .select("body_text, body_html, from_name, created_at, author_id, post_type")
        .eq("thread_id", thread_id)
        .neq("post_type", "system")
        .order("created_at", { ascending: false })
        .limit(3);

      if (!recentPosts || recentPosts.length === 0) {
        return new Response(
          JSON.stringify({ skipped: true, reason: "no_posts" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Enrich author names
      const authorIds = [...new Set(recentPosts.filter(p => p.author_id).map(p => p.author_id))];
      const authorNames: Record<string, string> = {};
      if (authorIds.length > 0) {
        const { data: accounts } = await supabase
          .from("user_accounts")
          .select("id, people:person_id(full_name)")
          .in("id", authorIds);
        for (const a of (accounts || []) as any[]) {
          const person = Array.isArray(a.people) ? a.people[0] : a.people;
          if (person?.full_name) authorNames[a.id] = person.full_name;
        }
      }

      // Build summary HTML (oldest first)
      const orderedPosts = [...recentPosts].reverse();
      const summaryHtml = orderedPosts
        .map((p) => {
          const name = (p.author_id && authorNames[p.author_id]) || p.from_name || "Ukjent";
          const date = new Date(p.created_at).toLocaleString("nb-NO", {
            day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
          });
          const content = p.body_html || (p.body_text || "").replace(/\n/g, "<br/>");
          return `
            <div style="margin-bottom: 12px; padding: 10px; background: #f9fafb; border-radius: 6px; border-left: 3px solid #d1d5db;">
              <p style="margin: 0 0 4px; font-size: 12px; color: #6b7280;">
                <strong>${name}</strong> · ${date}
              </p>
              <div style="font-size: 13px; color: #374151; line-height: 1.5;">${content}</div>
            </div>`;
        })
        .join("");

      // Project info for subject
      const { data: project } = await supabase
        .from("events")
        .select("title, internal_number")
        .eq("id", thread.project_id)
        .single();

      const jobRef = project?.internal_number || "";
      const systemUrl = "https://mcsressurs.lovable.app";
      const threadLink = `${systemUrl}/projects/${thread.project_id}/conversations/${thread.id}`;

      const subject = `${jobRef ? `[${jobRef}] ` : ""}Du er lagt til i samtale: ${thread.title}`;

      const bodyHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px;">
          <p style="color: #374151; font-size: 14px; line-height: 1.6;">
            Du har blitt lagt til som deltaker i samtalen <strong>"${thread.title}"</strong>.
          </p>
          <p style="color: #6b7280; font-size: 13px; margin-bottom: 16px;">
            Her er et sammendrag av de siste meldingene:
          </p>
          ${summaryHtml}
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
          <p style="font-size: 12px; color: #9ca3af;">
            <a href="${threadLink}" style="color: #2563eb; text-decoration: none;">Åpne samtalen i systemet →</a>
          </p>
        </div>
      `;

      // Send via Graph
      const sendResult = await sendViaGraph(supabase, thread, subject, bodyHtml, [recipient_email]);

      if (sendResult.error) {
        return new Response(JSON.stringify({ error: sendResult.error }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Log system post
      await supabase.from("conversation_posts").insert({
        thread_id: thread.id,
        company_id: thread.company_id,
        post_type: "system",
        body_text: `📧 Historikk sendt til ${recipient_email}`,
      });

      return new Response(
        JSON.stringify({ sent: true, recipient: recipient_email }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Standard mode: send a specific post to all participants ──
    if (!post_id) {
      return new Response(JSON.stringify({ error: "post_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Get post
    const { data: post, error: postErr } = await supabase
      .from("conversation_posts")
      .select("*")
      .eq("id", post_id)
      .single();

    if (postErr || !post) {
      return new Response(JSON.stringify({ error: "Post not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Get thread
    const { data: thread } = await supabase
      .from("conversation_threads")
      .select("*")
      .eq("id", post.thread_id)
      .single();

    if (!thread || !thread.email_enabled) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "email_disabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Get participants with receive_email = true, excluding the author
    const { data: participants } = await supabase
      .from("conversation_thread_participants")
      .select("*, user_accounts:user_account_id(id, people:person_id(full_name, email))")
      .eq("thread_id", thread.id)
      .eq("receive_email", true);

    const recipientEmails: string[] = [];
    for (const p of participants || []) {
      if (p.user_account_id && p.user_account_id === post.author_id) continue;

      if (p.participant_type === "external" && p.email) {
        recipientEmails.push(p.email);
      } else if (p.user_accounts?.people?.email) {
        const person = Array.isArray(p.user_accounts.people)
          ? p.user_accounts.people[0]
          : p.user_accounts.people;
        if (person?.email) recipientEmails.push(person.email);
      }
    }

    if (recipientEmails.length === 0) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "no_recipients" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Get project info for subject line
    const { data: project } = await supabase
      .from("events")
      .select("title, internal_number, customer_id, customers:customer_id(name)")
      .eq("id", thread.project_id)
      .single();

    const jobRef = project?.internal_number || "";
    const customerName =
      (Array.isArray(project?.customers)
        ? project.customers[0]?.name
        : (project?.customers as any)?.name) || "";

    // Build subject with [JOB-XXXXXX] prefix for threading
    const subject =
      thread.email_subject ||
      `[${jobRef}] ${customerName ? customerName + " | " : ""}${thread.title}`;

    // 5. Build email body
    const systemUrl = "https://mcsressurs.lovable.app";
    const threadLink = `${systemUrl}/projects/${thread.project_id}/conversations/${thread.id}`;

    const bodyHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px;">
        <p style="color: #374151; font-size: 14px; line-height: 1.6;">
          ${post.body_html || (post.body_text || "").replace(/\n/g, "<br/>")}
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
        <p style="font-size: 12px; color: #9ca3af;">
          Denne meldingen ble sendt fra prosjektsamtalen "${thread.title}".
          <br/>
          <a href="${threadLink}" style="color: #2563eb;">Åpne i systemet →</a>
        </p>
      </div>
    `;

    // 6. Send via Graph
    const sendResult = await sendViaGraph(supabase, thread, subject, bodyHtml, recipientEmails);

    if (sendResult.error) {
      await supabase.from("conversation_email_messages").insert({
        company_id: thread.company_id,
        thread_id: thread.id,
        post_id: post.id,
        direction: "outbound",
        subject,
        to_emails: recipientEmails,
        status: "failed",
        error: sendResult.error,
      });
      return new Response(
        JSON.stringify({ error: sendResult.error }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log email message
    await supabase.from("conversation_email_messages").insert({
      company_id: thread.company_id,
      thread_id: thread.id,
      post_id: post.id,
      direction: "outbound",
      provider: "graph",
      outlook_message_id: sendResult.draft?.id,
      outlook_conversation_id: sendResult.draft?.conversationId || null,
      outlook_internet_message_id: sendResult.draft?.internetMessageId || null,
      subject,
      from_email: "postkontoret@mcsservice.no",
      to_emails: recipientEmails,
      status: sendResult.status,
      error: sendResult.sendError,
    });

    // Update thread
    await supabase
      .from("conversation_threads")
      .update({
        last_emailed_at: new Date().toISOString(),
        email_subject: subject,
        email_thread_id: sendResult.draft?.conversationId || thread.email_thread_id,
      })
      .eq("id", thread.id);

    return new Response(
      JSON.stringify({ sent: true, recipients: recipientEmails.length, status: sendResult.status }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ── Shared Graph send helper ──
async function sendViaGraph(
  supabase: any,
  thread: any,
  subject: string,
  bodyHtml: string,
  recipientEmails: string[]
): Promise<{ error?: string; draft?: any; status?: string; sendError?: string | null }> {
  const azureTenantId = Deno.env.get("AZURE_TENANT_ID");
  const azureClientId = Deno.env.get("AZURE_CLIENT_ID");
  const azureClientSecret = Deno.env.get("AZURE_CLIENT_SECRET");

  if (!azureTenantId || !azureClientId || !azureClientSecret) {
    return { error: "Missing Azure credentials" };
  }

  const tokenResp = await fetch(
    `https://login.microsoftonline.com/${azureTenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: azureClientId,
        client_secret: azureClientSecret,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
    }
  );
  const tokenData = await tokenResp.json();
  if (!tokenData.access_token) {
    return { error: "Token acquisition failed" };
  }

  const systemMailbox = "postkontoret@mcsservice.no";
  const inboundToken = thread.inbound_token || thread.id;

  const draftResp = await fetch(
    `https://graph.microsoft.com/v1.0/users/${systemMailbox}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subject,
        body: { contentType: "HTML", content: bodyHtml },
        toRecipients: recipientEmails.map((e) => ({
          emailAddress: { address: e },
        })),
        replyTo: [
          {
            emailAddress: {
              address: `thread+${inboundToken}@mcsservice.no`,
              name: thread.title,
            },
          },
        ],
        internetMessageHeaders: [
          { name: "X-MCS-Thread-Token", value: inboundToken },
          { name: "X-MCS-THREAD", value: thread.id },
          { name: "X-MCS-ENTITY", value: "CONVERSATION" },
          { name: "X-MCS-ID", value: thread.id },
        ],
        singleValueExtendedProperties: [
          {
            id: "String {00020386-0000-0000-C000-000000000046} Name X-MCS-THREAD",
            value: thread.id,
          },
        ],
      }),
    }
  );

  if (!draftResp.ok) {
    const errText = await draftResp.text();
    return { error: `Draft failed: ${errText}` };
  }

  const draft = await draftResp.json();

  const sendResp = await fetch(
    `https://graph.microsoft.com/v1.0/users/${systemMailbox}/messages/${draft.id}/send`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    }
  );

  return {
    draft,
    status: sendResp.ok ? "sent" : "failed",
    sendError: sendResp.ok ? null : await sendResp.text(),
  };
}
