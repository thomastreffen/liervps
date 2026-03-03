import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const MAILBOX = "postkontoret@mcsservice.no";
const SYSTEM_URL = "https://mcsressurs.lovable.app";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const body = await req.json();
    const { action } = body;

    if (action === "revoke") return await handleRevoke(supabase, user, body);
    if (action === "resend") return await handleResend(supabase, user, body);
    return await handleSendInvite(supabase, user, body);
  } catch (err) {
    console.error("INVITE UNHANDLED ERROR", String(err));
    return json({ error: String(err) }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders });
}

// ── Helpers ──────────────────────────────────────────

async function getCallerAccount(supabase: any, authUserId: string) {
  const { data } = await supabase
    .from("user_accounts")
    .select("id, company_id, people:person_id(full_name, email)")
    .eq("auth_user_id", authUserId)
    .eq("is_active", true)
    .maybeSingle();
  return data;
}

async function checkIsAdmin(supabase: any, authUserId: string, projectId: string): Promise<boolean> {
  const { data } = await supabase.rpc("is_project_admin", {
    _auth_user_id: authUserId,
    _project_id: projectId,
  });
  return !!data;
}

async function logSystemPost(supabase: any, threadId: string, companyId: string, message: string) {
  await supabase.from("conversation_posts").insert({
    thread_id: threadId,
    company_id: companyId,
    post_type: "system",
    body_text: message,
  });
}

async function resolveInviterInfo(
  supabase: any,
  callerParticipant: any,
  ua: any,
): Promise<{ display_name: string; email: string; type: "internal" | "external" }> {
  // Internal user with user_account
  if (ua) {
    const person = Array.isArray(ua.people) ? ua.people[0] : ua.people;
    return {
      display_name: person?.full_name || "Ukjent",
      email: person?.email || "",
      type: "internal",
    };
  }
  // External participant
  if (callerParticipant) {
    return {
      display_name: callerParticipant.display_name || callerParticipant.email || "Ukjent",
      email: callerParticipant.email || "",
      type: "external",
    };
  }
  return { display_name: "Ukjent", email: "", type: "internal" };
}

// ── Rate Limit ──────────────────────────────────────

async function checkRateLimit(supabase: any, threadId: string, userId: string): Promise<string | null> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { count: threadCount } = await supabase
    .from("conversation_thread_invites")
    .select("id", { count: "exact", head: true })
    .eq("thread_id", threadId)
    .gte("created_at", oneHourAgo);

  if ((threadCount ?? 0) >= 10) {
    return "Maks 10 invitasjoner per tråd per time. Prøv igjen senere.";
  }

  const { data: userAccounts } = await supabase
    .from("user_accounts")
    .select("id")
    .eq("auth_user_id", userId)
    .eq("is_active", true);

  const uaIds = (userAccounts ?? []).map((u: any) => u.id);
  if (uaIds.length > 0) {
    const { data: participantIds } = await supabase
      .from("conversation_thread_participants")
      .select("id")
      .in("user_account_id", uaIds);

    const pIds = (participantIds ?? []).map((p: any) => p.id);
    if (pIds.length > 0) {
      const { count: userCount } = await supabase
        .from("conversation_thread_invites")
        .select("id", { count: "exact", head: true })
        .in("invited_by_participant_id", pIds)
        .gte("created_at", oneHourAgo);

      if ((userCount ?? 0) >= 20) {
        return "Du har sendt for mange invitasjoner siste time (maks 20). Prøv igjen senere.";
      }
    }
  }

  return null;
}

// ── Graph helpers (shared with conversation-email-send) ──

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

async function sendMailViaGraph(token: string, opts: SendMailOptions): Promise<SendMailResult> {
  const start = Date.now();
  const endpoint = `https://graph.microsoft.com/v1.0/users/${opts.mailbox}/sendMail`;

  console.log("GRAPH API CALL (invite)", {
    endpoint, mailbox: opts.mailbox,
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

  try {
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: messagePayload, saveToSentItems: opts.saveToSentItems }),
    });

    const durationMs = Date.now() - start;

    if (resp.status === 202 || resp.ok) {
      console.log("GRAPH API SUCCESS (invite)", { status: resp.status, durationMs, mailbox: opts.mailbox });
      return { durationMs };
    }

    const errBody = await resp.text();
    let parsedError = errBody;
    try {
      const errJson = JSON.parse(errBody);
      parsedError = errJson?.error?.message || errJson?.error?.code || errBody;
    } catch { /* use raw */ }

    let hint = "";
    if (resp.status === 403) hint = " [App mangler Mail.Send permission]";
    else if (resp.status === 404) hint = ` [Postboks '${opts.mailbox}' finnes ikke]`;
    else if (resp.status === 401) hint = " [Token ugyldig/utløpt]";

    console.error("GRAPH API ERROR (invite)", { status: resp.status, error: parsedError, durationMs });
    return { error: `Graph ${resp.status}: ${parsedError}${hint}`, statusCode: resp.status, durationMs };
  } catch (networkErr) {
    const durationMs = Date.now() - start;
    console.error("GRAPH API NETWORK ERROR (invite)", { error: String(networkErr), durationMs });
    return { error: `Network error: ${String(networkErr)}`, durationMs };
  }
}

// ── Email logging ───────────────────────────────────

async function logEmailAttempt(supabase: any, input: {
  company_id: string; thread_id: string; status: string;
  from_email: string; to_emails: string[]; subject?: string;
  error?: string;
}): Promise<string | null> {
  const { data } = await supabase.from("conversation_email_messages").insert({
    company_id: input.company_id,
    thread_id: input.thread_id,
    direction: "outbound",
    provider: "graph",
    status: input.status,
    subject: input.subject || null,
    from_email: input.from_email,
    to_emails: input.to_emails,
    error: input.error || null,
    processing_status: "invite",
  }).select("id").single();
  return data?.id || null;
}

// ── Build invite email HTML ─────────────────────────

function buildInviteHtml(opts: {
  threadTitle: string;
  acceptLink: string;
  inviterName: string;
  inviterType: "internal" | "external";
}): string {
  const inviterLabel = opts.inviterType === "external"
    ? `${opts.inviterName} (ekstern deltaker)`
    : opts.inviterName;

  return `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px;">
    <p style="color:#6b7280;font-size:13px;margin:0 0 16px;">Invitert av: <strong style="color:#374151;">${inviterLabel}</strong></p>
    <h2 style="color: #1a1a1a; font-size: 18px; margin: 0 0 12px;">Du er invitert til en samtale</h2>
    <p style="color: #374151; font-size: 14px; line-height: 1.6;">
      Du har blitt invitert til samtalen <strong>"${opts.threadTitle}"</strong>.
    </p>
    <p style="color: #374151; font-size: 14px;">
      Klikk knappen under for å godta invitasjonen og få tilgang til samtalen.
    </p>
    <div style="margin: 24px 0;">
      <a href="${opts.acceptLink}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
        Godta invitasjon
      </a>
    </div>
    <p style="font-size: 12px; color: #9ca3af;">
      Denne invitasjonen utløper om 48 timer. Invitasjonen gir kun tilgang til denne samtalen.
    </p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;" />
    <p style="font-size:11px;color:#9ca3af;">Sendt fra ${MAILBOX}</p>
  </div>`;
}

// ── SEND INVITE ─────────────────────────────────────

async function handleSendInvite(supabase: any, user: any, body: any) {
  const { thread_id, invited_email, invited_name, invite_type, lock_thread } = body;

  if (!thread_id || !invited_email) {
    return json({ error: "thread_id and invited_email required" }, 400);
  }

  const email = invited_email.toLowerCase().trim();

  const { data: thread } = await supabase
    .from("conversation_threads")
    .select("*")
    .eq("id", thread_id)
    .single();

  if (!thread) return json({ error: "Thread not found" }, 404);

  if (!thread.allow_participants_invite) {
    return json({ error: "Invitations disabled for this thread" }, 403);
  }

  // Rate limit
  const rateLimitMsg = await checkRateLimit(supabase, thread_id, user.id);
  if (rateLimitMsg) {
    await logSystemPost(supabase, thread_id, thread.company_id,
      `⚠️ Invitasjoner begrenset pga. rate limit.`);
    return json({ error: "rate_limited", message: rateLimitMsg }, 429);
  }

  const ua = await getCallerAccount(supabase, user.id);
  if (!ua) return json({ error: "No active user account" }, 403);

  const isAdmin = await checkIsAdmin(supabase, user.id, thread.project_id);

  // Permission check
  const { data: callerParticipant } = await supabase
    .from("conversation_thread_participants")
    .select("*")
    .eq("thread_id", thread_id)
    .eq("user_account_id", ua.id)
    .maybeSingle();

  const isExternal = invite_type === "external";
  const permKey = isExternal ? "can_invite_external" : "can_invite_internal";

  if (!isAdmin) {
    if (!callerParticipant) return json({ error: "Not a participant" }, 403);
    if (!callerParticipant[permKey]) return json({ error: `No ${permKey} permission` }, 403);
  }

  // Duplicate check
  const { data: existingParticipant } = await supabase
    .from("conversation_thread_participants")
    .select("id")
    .eq("thread_id", thread_id)
    .eq("email", email)
    .maybeSingle();

  if (existingParticipant) {
    return json({ error: "already_participant", message: "Denne e-postadressen er allerede deltaker i tråden." }, 409);
  }

  // Resolve inviter info
  const inviterInfo = await resolveInviterInfo(supabase, callerParticipant, ua);

  console.log("INVITE SEND START", {
    thread_id, invited_email: email, invited_name,
    invited_by: inviterInfo.display_name,
    invited_by_type: inviterInfo.type,
    sender_mailbox: MAILBOX,
  });

  // Check existing pending invite → resend
  const { data: existing } = await supabase
    .from("conversation_thread_invites")
    .select("*")
    .eq("thread_id", thread_id)
    .eq("invited_email", email)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) {
    const newExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    await supabase
      .from("conversation_thread_invites")
      .update({ expires_at: newExpiry, updated_at: new Date().toISOString() })
      .eq("id", existing.id);

    const sent = await sendInviteEmail(supabase, thread, existing, email, invited_name || existing.invited_name, inviterInfo);
    await logSystemPost(supabase, thread_id, thread.company_id,
      `📧 Invitasjon til ${invited_name || email} ble sendt på nytt av ${inviterInfo.display_name}.`);

    return json({ ok: true, invite_id: existing.id, email_sent: sent, resent: true });
  }

  // Lock thread
  if (lock_thread === true && !thread.participants_only) {
    await supabase
      .from("conversation_threads")
      .update({ participants_only: true })
      .eq("id", thread_id);
  }

  // Create invite
  const { data: invite, error: insertErr } = await supabase
    .from("conversation_thread_invites")
    .insert({
      thread_id,
      invited_email: email,
      invited_name: invited_name || null,
      invited_by_participant_id: callerParticipant?.id || ua.id,
      company_id: thread.company_id,
    })
    .select()
    .single();

  if (insertErr) return json({ error: insertErr.message }, 500);

  const sent = await sendInviteEmail(supabase, thread, invite, email, invited_name, inviterInfo);

  await logSystemPost(supabase, thread_id, thread.company_id,
    `📧 ${invited_name || email} ble invitert til samtalen av ${inviterInfo.display_name}.`);

  return json({ ok: true, invite_id: invite.id, email_sent: sent });
}

// ── REVOKE ──────────────────────────────────────────

async function handleRevoke(supabase: any, user: any, body: any) {
  const { invite_id } = body;
  if (!invite_id) return json({ error: "invite_id required" }, 400);

  const { data: invite } = await supabase
    .from("conversation_thread_invites")
    .select("*, conversation_threads:thread_id(project_id, company_id)")
    .eq("id", invite_id)
    .maybeSingle();

  if (!invite) return json({ error: "Invite not found" }, 404);

  const thread = Array.isArray(invite.conversation_threads) ? invite.conversation_threads[0] : invite.conversation_threads;
  const isAdmin = await checkIsAdmin(supabase, user.id, thread.project_id);
  if (!isAdmin) return json({ error: "Only admin can revoke" }, 403);

  await supabase
    .from("conversation_thread_invites")
    .update({ status: "revoked", updated_at: new Date().toISOString() })
    .eq("id", invite_id);

  await logSystemPost(supabase, invite.thread_id, thread.company_id,
    `🚫 Invitasjon til ${invite.invited_name || invite.invited_email} ble trukket tilbake.`);

  return json({ ok: true });
}

// ── RESEND ──────────────────────────────────────────

async function handleResend(supabase: any, user: any, body: any) {
  const { invite_id } = body;
  if (!invite_id) return json({ error: "invite_id required" }, 400);

  const { data: invite } = await supabase
    .from("conversation_thread_invites")
    .select("*, conversation_threads:thread_id(id, title, project_id, company_id, inbound_token)")
    .eq("id", invite_id)
    .maybeSingle();

  if (!invite) return json({ error: "Invite not found" }, 404);
  if (invite.status !== "pending") return json({ error: "Invite is not pending" }, 400);

  const thread = Array.isArray(invite.conversation_threads) ? invite.conversation_threads[0] : invite.conversation_threads;
  const isAdmin = await checkIsAdmin(supabase, user.id, thread.project_id);
  if (!isAdmin) return json({ error: "Only admin can resend" }, 403);

  // Resolve inviter info for resend
  const ua = await getCallerAccount(supabase, user.id);
  const inviterInfo = await resolveInviterInfo(supabase, null, ua);

  const newExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  await supabase
    .from("conversation_thread_invites")
    .update({ expires_at: newExpiry, updated_at: new Date().toISOString() })
    .eq("id", invite_id);

  const sent = await sendInviteEmail(supabase, thread, invite, invite.invited_email, invite.invited_name, inviterInfo);

  await logSystemPost(supabase, invite.thread_id, thread.company_id,
    `📧 Invitasjon til ${invite.invited_name || invite.invited_email} ble sendt på nytt av ${inviterInfo.display_name}.`);

  return json({ ok: true, email_sent: sent });
}

// ── SEND INVITE EMAIL (unified via sendMailViaGraph) ──

async function sendInviteEmail(
  supabase: any,
  thread: any,
  invite: any,
  email: string,
  name: string | undefined | null,
  inviterInfo: { display_name: string; email: string; type: "internal" | "external" },
): Promise<boolean> {
  const acceptLink = `${SYSTEM_URL}/invite/thread/${invite.invite_token}`;
  const inboundToken = thread.inbound_token || thread.id;

  const subject = `Invitasjon: ${thread.title}`;
  const bodyHtml = buildInviteHtml({
    threadTitle: thread.title,
    acceptLink,
    inviterName: inviterInfo.display_name,
    inviterType: inviterInfo.type,
  });

  // 1. Log attempted
  const logId = await logEmailAttempt(supabase, {
    company_id: thread.company_id,
    thread_id: thread.id,
    status: "attempted",
    from_email: MAILBOX,
    to_emails: [email],
    subject,
  });

  // 2. Get Graph token
  const tokenResult = await getGraphToken();
  if (tokenResult.error) {
    console.error("INVITE EMAIL FAILED: token error", tokenResult.error);
    if (logId) {
      await supabase.from("conversation_email_messages").update({
        status: "failed", error: tokenResult.error,
        processed_at: new Date().toISOString(),
      }).eq("id", logId);
    }
    return false;
  }

  // 3. Send via Graph
  const result = await sendMailViaGraph(tokenResult.token!, {
    subject,
    bodyHtml,
    recipients: [email],
    mailbox: MAILBOX,
    saveToSentItems: true,
    replyTo: `thread+${inboundToken}@mcsservice.no`,
    replyToName: thread.title,
    headers: [
      { name: "X-MCS-Thread-Token", value: inboundToken },
      { name: "X-MCS-Invite-Token", value: invite.invite_token || "" },
      { name: "X-MCS-Reason", value: "invite" },
    ],
  });

  if (result.error) {
    console.error("INVITE EMAIL FAILED", { email, error: result.error, statusCode: result.statusCode });
    if (logId) {
      await supabase.from("conversation_email_messages").update({
        status: "failed", error: result.error,
        processed_at: new Date().toISOString(),
        processing_duration_ms: result.durationMs,
      }).eq("id", logId);
    }
    return false;
  }

  // 4. Verify in Sent Items
  const verification = await verifySentItems(tokenResult.token!, MAILBOX, subject, [email]);

  if (logId) {
    await supabase.from("conversation_email_messages").update({
      status: verification.verified ? "sent" : "failed",
      error: verification.verified ? null : "SendMail 202 OK but invite not found in Sent Items",
      processed_at: new Date().toISOString(),
      processing_duration_ms: result.durationMs,
      verified: verification.verified,
      outlook_weblink: verification.webLink || null,
      outlook_internet_message_id: verification.internetMessageId || null,
    }).eq("id", logId);
  }

  if (!verification.verified) {
    console.error("INVITE DELIVERY_PROOF_FAILED", { email });
    return false;
  }

  console.log("INVITE DELIVERY_PROOF_SENTITEMS_FOUND", {
    email, mailbox: MAILBOX, webLink: verification.webLink,
    internetMessageId: verification.internetMessageId,
  });
  return true;
}

// ── Sent Items verification ─────────────────────────

interface VerificationResult {
  verified: boolean;
  webLink?: string;
  internetMessageId?: string;
}

async function verifySentItems(
  token: string,
  mailbox: string,
  subject: string,
  recipients: string[],
): Promise<VerificationResult> {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 2500));

    try {
      const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      const filter = `subject eq '${subject.replace(/'/g, "''")}' and sentDateTime ge ${twoMinAgo}`;
      const endpoint = `https://graph.microsoft.com/v1.0/users/${mailbox}/mailFolders/SentItems/messages?$filter=${encodeURIComponent(filter)}&$top=5&$select=id,subject,internetMessageId,webLink,sentDateTime`;

      const resp = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!resp.ok) {
        console.error("INVITE DELIVERY_PROOF_SEARCH_ERROR", { status: resp.status });
        continue;
      }

      const data = await resp.json();
      const messages = data?.value || [];

      if (messages.length > 0) {
        const msg = messages[0];
        return {
          verified: true,
          webLink: msg.webLink || undefined,
          internetMessageId: msg.internetMessageId || undefined,
        };
      }
    } catch (err) {
      console.error("INVITE DELIVERY_PROOF_ERROR", { attempt: attempt + 1, error: String(err) });
    }
  }
  return { verified: false };
}
