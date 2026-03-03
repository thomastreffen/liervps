import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const MAILBOX = "postkontoret@mcsservice.no";

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
      console.log("EMAIL TEST START", { test_recipient, mailbox: MAILBOX });
      if (!test_recipient) return json({ error: "test_recipient required" }, 400);

      const tokenResult = await getGraphToken();
      if (tokenResult.error) {
        console.error("EMAIL TEST FAILED: token error", tokenResult.error);
        return json({ success: false, error: tokenResult.error });
      }

      const result = await sendMailViaGraph(tokenResult.token!, {
        subject: "Testmail fra MCS Ressurs",
        bodyHtml: `<div style="font-family:sans-serif;padding:20px;">
          <h2>✅ Test e-post</h2>
          <p>Microsoft Graph-integrasjonen fungerer korrekt.</p>
          <p>Sendt fra: <strong>${MAILBOX}</strong></p>
          <p>Endepunkt: <code>/users/${MAILBOX}/sendMail</code></p>
          <p style="color:#6b7280;font-size:12px;">Sendt: ${new Date().toISOString()}</p>
        </div>`,
        recipients: [test_recipient],
        mailbox: MAILBOX,
        saveToSentItems: true,
      });

      if (result.error) {
        console.error("EMAIL TEST FAILED", { error: result.error, statusCode: result.statusCode });
        return json({ success: false, error: result.error, status_code: result.statusCode });
      }
      console.log("EMAIL TEST SUCCESS", { mailbox: MAILBOX, recipient: test_recipient });
      return json({ success: true, mailbox: MAILBOX });
    }

    // ── Validate thread ──
    if (!thread_id) return json({ error: "thread_id required" }, 400);

    const { data: thread } = await supabase
      .from("conversation_threads")
      .select("*")
      .eq("id", thread_id)
      .single();

    if (!thread) {
      console.log("EMAIL SEND SKIP", { thread_id, reason: "thread_not_found" });
      return json({ error: "Thread not found" }, 404);
    }

    // ── Fetch participants ──
    const { data: allParticipants } = await supabase
      .from("conversation_thread_participants")
      .select("*, user_accounts:user_account_id(id, people:person_id(full_name, email))")
      .eq("thread_id", thread.id)
      .eq("receive_email", true);

    const participantCount = (allParticipants || []).length;

    console.log("EMAIL SEND START", {
      thread_id,
      reason: reason || "unknown",
      post_id: post_id || null,
      recipient_email: recipient_email || null,
      email_enabled: thread.email_enabled,
      thread_closed: !!thread.closed_at,
      mailbox: MAILBOX,
      participants_receive_email: participantCount,
    });

    if (!thread.email_enabled) {
      console.log("EMAIL SEND SKIP", { thread_id, reason: "email_disabled" });
      await logEmailAttempt(supabase, {
        company_id: thread.company_id, thread_id: thread.id, post_id,
        direction: "outbound", status: "skipped", reason: reason || "unknown",
        from_email: MAILBOX, to_emails: [], error: "email_enabled=false",
      });
      return json({ skipped: true, reason: "email_disabled" });
    }
    if (thread.closed_at) {
      console.log("EMAIL SEND SKIP", { thread_id, reason: "thread_closed" });
      await logEmailAttempt(supabase, {
        company_id: thread.company_id, thread_id: thread.id, post_id,
        direction: "outbound", status: "skipped", reason: reason || "unknown",
        from_email: MAILBOX, to_emails: [], error: "thread_closed",
      });
      return json({ skipped: true, reason: "thread_closed" });
    }

    // ── Graph token ──
    const tokenResult = await getGraphToken();
    if (tokenResult.error) {
      console.error("EMAIL SEND FAILED: token error", tokenResult.error);
      await logEmailAttempt(supabase, {
        company_id: thread.company_id, thread_id: thread.id, post_id,
        direction: "outbound", status: "failed", reason: reason || "unknown",
        from_email: MAILBOX, to_emails: [], error: `Graph token: ${tokenResult.error}`,
      });
      await insertSystemPost(supabase, thread, `❌ Kunne ikke sende e-post: Graph-autentisering feilet. Se e-postlogg.`);
      return json({ sent: false, error: tokenResult.error }, 500);
    }

    // ── Project info ──
    const { data: project } = await supabase
      .from("events")
      .select("title, internal_number, customer_id, customers:customer_id(name)")
      .eq("id", thread.project_id)
      .single();

    const jobRef = project?.internal_number || "";
    const customerName = (Array.isArray(project?.customers)
      ? project.customers[0]?.name
      : (project?.customers as any)?.name) || "";
    const systemUrl = "https://mcsressurs.lovable.app";
    const threadLink = `${systemUrl}/projects/${thread.project_id}/conversations/${thread.id}`;
    const inboundToken = thread.inbound_token || thread.id;

    // ══════════════════════════════════════════════════════════════
    // REASON: participant_added → send history to new participant
    // ══════════════════════════════════════════════════════════════
    if (reason === "participant_added") {
      if (!recipient_email) return json({ error: "recipient_email required" }, 400);

      const { data: recentPosts } = await supabase
        .from("conversation_posts")
        .select("body_text, body_html, from_name, created_at, author_id, post_type")
        .eq("thread_id", thread_id)
        .neq("post_type", "system")
        .order("created_at", { ascending: false })
        .limit(3);

      if (!recentPosts || recentPosts.length === 0) {
        console.log("EMAIL SEND SKIP", { thread_id, reason: "no_posts_for_welcome" });
        await logEmailAttempt(supabase, {
          company_id: thread.company_id, thread_id: thread.id,
          direction: "outbound", status: "skipped", reason: "participant_added",
          from_email: MAILBOX, to_emails: [recipient_email], error: "no_posts",
        });
        return json({ skipped: true, reason: "no_posts" });
      }

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
      const bodyHtml = buildWelcomeHtml(thread.title, summaryHtml, threadLink);

      // 1. Log attempted
      const logId = await logEmailAttempt(supabase, {
        company_id: thread.company_id, thread_id: thread.id,
        direction: "outbound", status: "attempted", reason: "participant_added",
        from_email: MAILBOX, to_emails: [recipient_email], subject,
      });

      // 2. Send via Graph (sendMail with saveToSentItems)
      const result = await sendMailViaGraph(tokenResult.token!, {
        subject,
        bodyHtml,
        recipients: [recipient_email],
        mailbox: MAILBOX,
        saveToSentItems: true,
        replyTo: `thread+${inboundToken}@mcsservice.no`,
        replyToName: thread.title,
        headers: [
          { name: "X-MCS-Thread-Token", value: inboundToken },
          { name: "X-MCS-THREAD", value: thread.id },
          { name: "X-MCS-ENTITY", value: "CONVERSATION" },
          { name: "X-MCS-ID", value: thread.id },
        ],
      });

      // 3. Update log
      if (logId) {
        await supabase.from("conversation_email_messages").update({
          status: result.error ? "failed" : "sent",
          error: result.error || null,
          processed_at: new Date().toISOString(),
          processing_duration_ms: result.durationMs,
        }).eq("id", logId);
      }

      // 4. System post
      if (result.error) {
        console.error("EMAIL SEND FAILED", {
          thread_id, recipient_email, error: result.error, statusCode: result.statusCode,
        });
        await insertSystemPost(supabase, thread, `❌ Kunne ikke sende historikk til ${recipient_email}. Feil: ${truncate(result.error, 80)}. Se e-postlogg.`);
        return json({ sent: false, error: result.error });
      }

      console.log("EMAIL SEND SUCCESS", {
        thread_id, recipient_email, mailbox: MAILBOX,
        saveToSentItems: true, durationMs: result.durationMs,
      });
      await insertSystemPost(supabase, thread, `📧 Historikk sendt til ${recipient_email}`);
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

    // Resolve recipient emails (exclude author)
    const recipientEmails: string[] = [];
    for (const p of allParticipants || []) {
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
      console.log("EMAIL SEND SKIP", { thread_id, reason: "no_recipients", participantCount });
      await logEmailAttempt(supabase, {
        company_id: thread.company_id, thread_id: thread.id, post_id: post.id,
        direction: "outbound", status: "skipped", reason: reason || "new_post",
        from_email: MAILBOX, to_emails: [], error: "no_recipients_with_receive_email",
      });
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
    const logId = await logEmailAttempt(supabase, {
      company_id: thread.company_id, thread_id: thread.id, post_id: post.id,
      direction: "outbound", status: "attempted", reason: reason || "new_post",
      from_email: MAILBOX, to_emails: recipientEmails, subject,
    });

    // 2. Send via Graph
    const result = await sendMailViaGraph(tokenResult.token!, {
      subject,
      bodyHtml,
      recipients: recipientEmails,
      mailbox: MAILBOX,
      saveToSentItems: true,
      replyTo: `thread+${inboundToken}@mcsservice.no`,
      replyToName: thread.title,
      headers: [
        { name: "X-MCS-Thread-Token", value: inboundToken },
        { name: "X-MCS-THREAD", value: thread.id },
        { name: "X-MCS-ENTITY", value: "CONVERSATION" },
        { name: "X-MCS-ID", value: thread.id },
      ],
    });

    // 3. Update log
    if (logId) {
      await supabase.from("conversation_email_messages").update({
        status: result.error ? "failed" : "sent",
        error: result.error || null,
        processed_at: new Date().toISOString(),
        processing_duration_ms: result.durationMs,
      }).eq("id", logId);
    }

    if (result.error) {
      console.error("EMAIL SEND FAILED", {
        thread_id, post_id, error: result.error,
        statusCode: result.statusCode, recipients: recipientEmails,
      });
      return json({ sent: false, error: result.error }, 500);
    }

    console.log("EMAIL SEND SUCCESS", {
      thread_id, post_id, mailbox: MAILBOX,
      recipients: recipientEmails.length,
      saveToSentItems: true,
      durationMs: result.durationMs,
    });

    // Update thread metadata
    await supabase.from("conversation_threads").update({
      last_emailed_at: new Date().toISOString(),
      email_subject: subject,
    }).eq("id", thread.id);

    return json({ sent: true, recipients: recipientEmails.length });
  } catch (err) {
    console.error("EMAIL SEND UNHANDLED ERROR", String(err), (err as any)?.stack);
    return json({ error: String(err) }, 500);
  }
});

// ═══════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders });
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function buildWelcomeHtml(title: string, summaryHtml: string, threadLink: string): string {
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;">
    <p style="color:#374151;font-size:14px;line-height:1.6;">Du har blitt lagt til som deltaker i samtalen <strong>"${title}"</strong>.</p>
    <p style="color:#6b7280;font-size:13px;margin-bottom:16px;">Her er et sammendrag av de siste meldingene:</p>
    ${summaryHtml}
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;" />
    <p style="font-size:12px;color:#9ca3af;"><a href="${threadLink}" style="color:#2563eb;text-decoration:none;">Åpne samtalen i systemet →</a></p>
  </div>`;
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

async function insertSystemPost(supabase: any, thread: any, text: string) {
  await supabase.from("conversation_posts").insert({
    thread_id: thread.id,
    company_id: thread.company_id,
    post_type: "system",
    body_text: text,
  });
}

interface EmailLogInput {
  company_id: string;
  thread_id: string;
  post_id?: string;
  direction: string;
  status: string;
  reason: string;
  from_email: string;
  to_emails: string[];
  subject?: string;
  error?: string;
}

async function logEmailAttempt(supabase: any, input: EmailLogInput): Promise<string | null> {
  const { data } = await supabase.from("conversation_email_messages").insert({
    company_id: input.company_id,
    thread_id: input.thread_id,
    post_id: input.post_id || null,
    direction: input.direction,
    provider: "graph",
    status: input.status,
    subject: input.subject || null,
    from_email: input.from_email,
    to_emails: input.to_emails,
    error: input.error || null,
    processing_status: input.reason,
  }).select("id").single();
  return data?.id || null;
}

// ═══════════════════════════════════════════════════
// Graph API - using /sendMail with saveToSentItems
// ═══════════════════════════════════════════════════

async function getGraphToken(): Promise<{ token?: string; error?: string }> {
  const azureTenantId = Deno.env.get("AZURE_TENANT_ID");
  const azureClientId = Deno.env.get("AZURE_CLIENT_ID");
  const azureClientSecret = Deno.env.get("AZURE_CLIENT_SECRET");

  if (!azureTenantId || !azureClientId || !azureClientSecret) {
    const missing = [
      !azureTenantId && "AZURE_TENANT_ID",
      !azureClientId && "AZURE_CLIENT_ID",
      !azureClientSecret && "AZURE_CLIENT_SECRET",
    ].filter(Boolean).join(", ");
    return { error: `Missing Azure credentials: ${missing}` };
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
  if (!data.access_token) {
    return { error: `Token request failed (${resp.status}): ${data.error_description || data.error || JSON.stringify(data)}` };
  }
  return { token: data.access_token };
}

interface SendMailOptions {
  subject: string;
  bodyHtml: string;
  recipients: string[];
  mailbox: string;
  saveToSentItems: boolean;
  replyTo?: string;
  replyToName?: string;
  headers?: Array<{ name: string; value: string }>;
}

interface SendMailResult {
  error?: string;
  statusCode?: number;
  durationMs: number;
}

/**
 * Uses /users/{mailbox}/sendMail endpoint.
 * This is simpler than draft+send and explicitly supports saveToSentItems.
 * 
 * Required Graph Application Permissions:
 * - Mail.Send (to send as the mailbox user)
 * 
 * If saveToSentItems=true, the email appears in mailbox's "Sent Items".
 */
async function sendMailViaGraph(token: string, opts: SendMailOptions): Promise<SendMailResult> {
  const start = Date.now();
  const endpoint = `https://graph.microsoft.com/v1.0/users/${opts.mailbox}/sendMail`;

  console.log("GRAPH API CALL", {
    endpoint,
    mailbox: opts.mailbox,
    recipients: opts.recipients,
    saveToSentItems: opts.saveToSentItems,
    subject: opts.subject,
  });

  const messagePayload: any = {
    subject: opts.subject,
    body: { contentType: "HTML", content: opts.bodyHtml },
    toRecipients: opts.recipients.map(e => ({ emailAddress: { address: e } })),
  };

  if (opts.replyTo) {
    messagePayload.replyTo = [{
      emailAddress: { address: opts.replyTo, name: opts.replyToName || opts.replyTo },
    }];
  }

  if (opts.headers && opts.headers.length > 0) {
    messagePayload.internetMessageHeaders = opts.headers;
  }

  const requestBody = {
    message: messagePayload,
    saveToSentItems: opts.saveToSentItems,
  };

  try {
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const durationMs = Date.now() - start;

    if (resp.status === 202 || resp.ok) {
      console.log("GRAPH API SUCCESS", {
        status: resp.status,
        durationMs,
        mailbox: opts.mailbox,
        recipientCount: opts.recipients.length,
      });
      return { durationMs };
    }

    // Error
    const errBody = await resp.text();
    let parsedError = errBody;
    try {
      const errJson = JSON.parse(errBody);
      parsedError = errJson?.error?.message || errJson?.error?.code || errBody;
    } catch { /* use raw */ }

    console.error("GRAPH API ERROR", {
      status: resp.status,
      error: parsedError,
      endpoint,
      mailbox: opts.mailbox,
      durationMs,
    });

    // Provide helpful hints for common errors
    let hint = "";
    if (resp.status === 403) {
      hint = " [HINT: App mangler sannsynligvis Mail.Send permission i Azure AD]";
    } else if (resp.status === 404) {
      hint = ` [HINT: Postboks '${opts.mailbox}' finnes ikke eller appen har ikke tilgang]`;
    } else if (resp.status === 401) {
      hint = " [HINT: Graph-token er ugyldig eller utløpt]";
    }

    return {
      error: `Graph ${resp.status}: ${parsedError}${hint}`,
      statusCode: resp.status,
      durationMs,
    };
  } catch (networkErr) {
    const durationMs = Date.now() - start;
    console.error("GRAPH API NETWORK ERROR", { error: String(networkErr), durationMs });
    return { error: `Network error: ${String(networkErr)}`, durationMs };
  }
}
