import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Centralized email trigger.
 * 
 * Modes:
 * - { thread_id, post_id, reason: "new_post" }           → send post to all participants
 * - { thread_id, recipient_email, reason: "participant_added" } → send welcome/history
 * - { thread_id, post_id, reason: "resend" }              → resend a failed email
 * - { test_mode: true, test_recipient: "..." }             → test Graph config
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { thread_id, post_id, reason, recipient_email, test_mode, test_recipient } = body;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // ── Test mode ──
    if (test_mode) {
      console.log("EMAIL TEST START", test_recipient);
      if (!test_recipient) {
        return json({ error: "test_recipient required" }, 400);
      }
      const result = await sendViaGraphRaw(
        "Testmail fra MCS Ressurs",
        `<div style="font-family:sans-serif;padding:20px;">
          <h2>✅ Test e-post</h2>
          <p>Microsoft Graph-integrasjonen fungerer korrekt.</p>
          <p style="color:#6b7280;font-size:12px;">Sendt: ${new Date().toISOString()}</p>
        </div>`,
        [test_recipient]
      );
      if (result.error) {
        console.error("EMAIL TEST FAILED", result.error);
      } else {
        console.log("EMAIL TEST SUCCESS", result.draft?.id);
      }
      return json({
        success: !result.error,
        error: result.error || null,
        status: result.status || null,
        graph_message_id: result.draft?.id || null,
      });
    }

    // ── Validate thread ──
    if (!thread_id) return json({ error: "thread_id required" }, 400);

    console.log("EMAIL SEND START", { thread_id, reason, post_id, recipient_email });

    const { data: thread } = await supabase
      .from("conversation_threads")
      .select("*")
      .eq("id", thread_id)
      .single();

    if (!thread) return json({ error: "Thread not found" }, 404);
    if (!thread.email_enabled) {
      console.log("EMAIL SEND SKIP: email_disabled", thread_id);
      return json({ skipped: true, reason: "email_disabled" });
    }
    if (thread.closed_at) {
      console.log("EMAIL SEND SKIP: thread_closed", thread_id);
      return json({ skipped: true, reason: "thread_closed" });
    }

    // ── Project info ──
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
    const systemUrl = "https://mcsressurs.lovable.app";
    const threadLink = `${systemUrl}/projects/${thread.project_id}/conversations/${thread.id}`;

    // ══════════════════════════════════════════════════════════════
    // REASON: participant_added → send history to new participant
    // ══════════════════════════════════════════════════════════════
    if (reason === "participant_added") {
      if (!recipient_email) return json({ error: "recipient_email required" }, 400);

      // Get last 3 non-system posts
      const { data: recentPosts } = await supabase
        .from("conversation_posts")
        .select("body_text, body_html, from_name, created_at, author_id, post_type")
        .eq("thread_id", thread_id)
        .neq("post_type", "system")
        .order("created_at", { ascending: false })
        .limit(3);

      if (!recentPosts || recentPosts.length === 0) {
        console.log("EMAIL SEND SKIP: no_posts for welcome", thread_id);
        return json({ skipped: true, reason: "no_posts" });
      }

      // Enrich author names
      const authorNames = await enrichAuthorNames(supabase, recentPosts);

      const orderedPosts = [...recentPosts].reverse();
      const summaryHtml = orderedPosts.map((p) => {
        const name = (p.author_id && authorNames[p.author_id]) || p.from_name || "Ukjent";
        const date = new Date(p.created_at).toLocaleString("nb-NO", {
          day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
        });
        const content = p.body_html || (p.body_text || "").replace(/\n/g, "<br/>");
        return `<div style="margin-bottom:12px;padding:10px;background:#f9fafb;border-radius:6px;border-left:3px solid #d1d5db;">
          <p style="margin:0 0 4px;font-size:12px;color:#6b7280;"><strong>${name}</strong> · ${date}</p>
          <div style="font-size:13px;color:#374151;line-height:1.5;">${content}</div>
        </div>`;
      }).join("");

      const subject = `${jobRef ? `[${jobRef}] ` : ""}Du er lagt til i samtale: ${thread.title}`;
      const bodyHtml = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;">
        <p style="color:#374151;font-size:14px;line-height:1.6;">Du har blitt lagt til som deltaker i samtalen <strong>"${thread.title}"</strong>.</p>
        <p style="color:#6b7280;font-size:13px;margin-bottom:16px;">Her er et sammendrag av de siste meldingene:</p>
        ${summaryHtml}
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;" />
        <p style="font-size:12px;color:#9ca3af;"><a href="${threadLink}" style="color:#2563eb;text-decoration:none;">Åpne samtalen i systemet →</a></p>
      </div>`;

      // 1. Log attempted
      const { data: emailLog } = await supabase.from("conversation_email_messages").insert({
        company_id: thread.company_id,
        thread_id: thread.id,
        direction: "outbound",
        provider: "graph",
        subject,
        from_email: "postkontoret@mcsservice.no",
        to_emails: [recipient_email],
        status: "attempted",
      }).select("id").single();

      // 2. Send via Graph
      const sendResult = await sendViaGraph(thread, subject, bodyHtml, [recipient_email]);

      // 3. Update log
      if (emailLog) {
        await supabase.from("conversation_email_messages").update({
          status: sendResult.error ? "failed" : (sendResult.status || "sent"),
          error: sendResult.error || sendResult.sendError || null,
          outlook_message_id: sendResult.draft?.id || null,
          outlook_conversation_id: sendResult.draft?.conversationId || null,
          outlook_internet_message_id: sendResult.draft?.internetMessageId || null,
          processed_at: new Date().toISOString(),
        }).eq("id", emailLog.id);
      }

      // 4. System post
      if (sendResult.error) {
        console.error("EMAIL SEND FAILED (welcome)", { thread_id, recipient_email, error: sendResult.error });
        await supabase.from("conversation_posts").insert({
          thread_id: thread.id,
          company_id: thread.company_id,
          post_type: "system",
          body_text: `❌ Kunne ikke sende historikk til ${recipient_email}. Se e-postlogg.`,
        });
        return json({ sent: false, error: sendResult.error });
      }

      console.log("EMAIL SEND SUCCESS (welcome)", { thread_id, recipient_email, messageId: sendResult.draft?.id });
      await supabase.from("conversation_posts").insert({
        thread_id: thread.id,
        company_id: thread.company_id,
        post_type: "system",
        body_text: `📧 Historikk sendt til ${recipient_email}`,
      });

      return json({ sent: true, recipient: recipient_email });
    }

    // ══════════════════════════════════════════════════════════════
    // REASON: new_post / resend → send a specific post
    // ══════════════════════════════════════════════════════════════
    if (!post_id) return json({ error: "post_id required for new_post/resend" }, 400);

    const { data: post, error: postErr } = await supabase
      .from("conversation_posts")
      .select("*")
      .eq("id", post_id)
      .single();

    if (postErr || !post) return json({ error: "Post not found" }, 404);

    // Get participants with receive_email = true, excluding the author
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
      } else if (p.user_accounts?.people) {
        const person = Array.isArray(p.user_accounts.people)
          ? p.user_accounts.people[0]
          : p.user_accounts.people;
        if (person?.email) recipientEmails.push(person.email);
      }
    }

    if (recipientEmails.length === 0) {
      console.log("EMAIL SEND SKIP: no_recipients", thread_id);
      return json({ skipped: true, reason: "no_recipients" });
    }

    const subject = thread.email_subject ||
      `[${jobRef}] ${customerName ? customerName + " | " : ""}${thread.title}`;

    const bodyHtml = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;">
      <p style="color:#374151;font-size:14px;line-height:1.6;">
        ${post.body_html || (post.body_text || "").replace(/\n/g, "<br/>")}
      </p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;" />
      <p style="font-size:12px;color:#9ca3af;">
        Denne meldingen ble sendt fra prosjektsamtalen "${thread.title}".
        <br/><a href="${threadLink}" style="color:#2563eb;">Åpne i systemet →</a>
      </p>
    </div>`;

    // 1. Log attempted
    const { data: emailLog } = await supabase.from("conversation_email_messages").insert({
      company_id: thread.company_id,
      thread_id: thread.id,
      post_id: post.id,
      direction: "outbound",
      provider: "graph",
      subject,
      from_email: "postkontoret@mcsservice.no",
      to_emails: recipientEmails,
      status: "attempted",
    }).select("id").single();

    // 2. Send via Graph
    const sendResult = await sendViaGraph(thread, subject, bodyHtml, recipientEmails);

    // 3. Update log
    if (emailLog) {
      await supabase.from("conversation_email_messages").update({
        status: sendResult.error ? "failed" : (sendResult.status || "sent"),
        error: sendResult.error || sendResult.sendError || null,
        outlook_message_id: sendResult.draft?.id || null,
        outlook_conversation_id: sendResult.draft?.conversationId || null,
        outlook_internet_message_id: sendResult.draft?.internetMessageId || null,
        processed_at: new Date().toISOString(),
      }).eq("id", emailLog.id);
    }

    if (sendResult.error) {
      console.error("EMAIL SEND FAILED", { thread_id, post_id, error: sendResult.error });
      return json({ sent: false, error: sendResult.error }, 500);
    }

    console.log("EMAIL SEND SUCCESS", { thread_id, post_id, messageId: sendResult.draft?.id, recipients: recipientEmails.length });

    // Update thread metadata
    await supabase.from("conversation_threads").update({
      last_emailed_at: new Date().toISOString(),
      email_subject: subject,
      email_thread_id: sendResult.draft?.conversationId || thread.email_thread_id,
    }).eq("id", thread.id);

    return json({ sent: true, recipients: recipientEmails.length, status: sendResult.status });
  } catch (err) {
    console.error("EMAIL SEND UNHANDLED ERROR", String(err));
    return json({ error: String(err) }, 500);
  }
});

// ── Helpers ──

function json(data: any, status = 200) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json",
  };
  return new Response(JSON.stringify(data), { status, headers: corsHeaders });
}

async function enrichAuthorNames(supabase: any, posts: any[]): Promise<Record<string, string>> {
  const authorIds = [...new Set(posts.filter(p => p.author_id).map(p => p.author_id))];
  const names: Record<string, string> = {};
  if (authorIds.length === 0) return names;
  const { data: accounts } = await supabase
    .from("user_accounts")
    .select("id, people:person_id(full_name)")
    .in("id", authorIds);
  for (const a of (accounts || []) as any[]) {
    const person = Array.isArray(a.people) ? a.people[0] : a.people;
    if (person?.full_name) names[a.id] = person.full_name;
  }
  return names;
}

async function getGraphToken(): Promise<{ token?: string; error?: string }> {
  const azureTenantId = Deno.env.get("AZURE_TENANT_ID");
  const azureClientId = Deno.env.get("AZURE_CLIENT_ID");
  const azureClientSecret = Deno.env.get("AZURE_CLIENT_SECRET");
  if (!azureTenantId || !azureClientId || !azureClientSecret) {
    return { error: "Missing Azure credentials" };
  }
  const resp = await fetch(
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
  const data = await resp.json();
  if (!data.access_token) return { error: `Token failed: ${JSON.stringify(data)}` };
  return { token: data.access_token };
}

async function sendViaGraphRaw(
  subject: string, bodyHtml: string, recipientEmails: string[]
): Promise<{ error?: string; draft?: any; status?: string; sendError?: string | null }> {
  const { token, error } = await getGraphToken();
  if (error) return { error };

  const mailbox = "postkontoret@mcsservice.no";
  const draftResp = await fetch(`https://graph.microsoft.com/v1.0/users/${mailbox}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      subject,
      body: { contentType: "HTML", content: bodyHtml },
      toRecipients: recipientEmails.map(e => ({ emailAddress: { address: e } })),
    }),
  });
  if (!draftResp.ok) {
    const errText = await draftResp.text();
    return { error: `Draft failed (${draftResp.status}): ${errText}` };
  }
  const draft = await draftResp.json();
  const sendResp = await fetch(`https://graph.microsoft.com/v1.0/users/${mailbox}/messages/${draft.id}/send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!sendResp.ok) {
    const sendErr = await sendResp.text();
    return { draft, status: "failed", sendError: sendErr };
  }
  return { draft, status: "sent", sendError: null };
}

async function sendViaGraph(
  thread: any, subject: string, bodyHtml: string, recipientEmails: string[]
): Promise<{ error?: string; draft?: any; status?: string; sendError?: string | null }> {
  const { token, error } = await getGraphToken();
  if (error) return { error };

  const mailbox = "postkontoret@mcsservice.no";
  const inboundToken = thread.inbound_token || thread.id;

  const draftResp = await fetch(`https://graph.microsoft.com/v1.0/users/${mailbox}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      subject,
      body: { contentType: "HTML", content: bodyHtml },
      toRecipients: recipientEmails.map(e => ({ emailAddress: { address: e } })),
      replyTo: [{
        emailAddress: {
          address: `thread+${inboundToken}@mcsservice.no`,
          name: thread.title,
        },
      }],
      internetMessageHeaders: [
        { name: "X-MCS-Thread-Token", value: inboundToken },
        { name: "X-MCS-THREAD", value: thread.id },
        { name: "X-MCS-ENTITY", value: "CONVERSATION" },
        { name: "X-MCS-ID", value: thread.id },
      ],
      singleValueExtendedProperties: [{
        id: "String {00020386-0000-0000-C000-000000000046} Name X-MCS-THREAD",
        value: thread.id,
      }],
    }),
  });

  if (!draftResp.ok) {
    const errText = await draftResp.text();
    return { error: `Draft failed: ${errText}` };
  }
  const draft = await draftResp.json();
  const sendResp = await fetch(`https://graph.microsoft.com/v1.0/users/${mailbox}/messages/${draft.id}/send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  return {
    draft,
    status: sendResp.ok ? "sent" : "failed",
    sendError: sendResp.ok ? null : await sendResp.text(),
  };
}
