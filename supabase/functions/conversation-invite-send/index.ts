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

    // Revoke action
    if (action === "revoke") {
      return await handleRevoke(supabase, user, body);
    }

    // Resend action
    if (action === "resend") {
      return await handleResend(supabase, user, body);
    }

    // Default: send invite
    return await handleSendInvite(supabase, user, body);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getCallerAccount(supabase: any, authUserId: string) {
  const { data } = await supabase
    .from("user_accounts")
    .select("id")
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

// ── RATE LIMIT ───────────────────────────────────────────────
async function checkRateLimit(supabase: any, threadId: string, userId: string): Promise<string | null> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  // Thread rate limit: max 10 invites per thread per hour
  const { count: threadCount } = await supabase
    .from("conversation_thread_invites")
    .select("id", { count: "exact", head: true })
    .eq("thread_id", threadId)
    .gte("created_at", oneHourAgo);

  if ((threadCount ?? 0) >= 10) {
    return "Maks 10 invitasjoner per tråd per time. Prøv igjen senere.";
  }

  // User rate limit: max 20 invites per user per hour (by invited_by_participant_id lookup)
  // We use the user's auth id to find their participant records
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

// ── SEND INVITE ──────────────────────────────────────────────
async function handleSendInvite(supabase: any, user: any, body: any) {
  const { thread_id, invited_email, invited_name, invite_type, lock_thread } = body;

  if (!thread_id || !invited_email) {
    return json({ error: "thread_id and invited_email required" }, 400);
  }

  const email = invited_email.toLowerCase().trim();

  // Get thread
  const { data: thread } = await supabase
    .from("conversation_threads")
    .select("*")
    .eq("id", thread_id)
    .single();

  if (!thread) return json({ error: "Thread not found" }, 404);

  if (!thread.allow_participants_invite) {
    return json({ error: "Invitations disabled for this thread" }, 403);
  }

  // Rate limit check
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

  // Check if already a participant
  const { data: existingParticipant } = await supabase
    .from("conversation_thread_participants")
    .select("id")
    .eq("thread_id", thread_id)
    .eq("email", email)
    .maybeSingle();

  if (existingParticipant) {
    return json({ error: "already_participant", message: "Denne e-postadressen er allerede deltaker i tråden." }, 409);
  }

  // Check for existing pending invite → resend
  const { data: existing } = await supabase
    .from("conversation_thread_invites")
    .select("*")
    .eq("thread_id", thread_id)
    .eq("invited_email", email)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) {
    // Resend: update expires_at
    const newExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    await supabase
      .from("conversation_thread_invites")
      .update({ expires_at: newExpiry, updated_at: new Date().toISOString() })
      .eq("id", existing.id);

    const sent = await sendInviteEmail(supabase, thread, existing, email, invited_name || existing.invited_name);
    await logSystemPost(supabase, thread_id, thread.company_id,
      `📧 Invitasjon til ${invited_name || email} ble sendt på nytt.`);

    return json({ ok: true, invite_id: existing.id, email_sent: sent, resent: true });
  }

  // Optionally lock thread
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

  const sent = await sendInviteEmail(supabase, thread, invite, email, invited_name);

  await logSystemPost(supabase, thread_id, thread.company_id,
    `📧 ${invited_name || email} ble invitert til samtalen.`);

  return json({ ok: true, invite_id: invite.id, email_sent: sent });
}

// ── REVOKE ───────────────────────────────────────────────────
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

// ── RESEND ───────────────────────────────────────────────────
async function handleResend(supabase: any, user: any, body: any) {
  const { invite_id } = body;
  if (!invite_id) return json({ error: "invite_id required" }, 400);

  const { data: invite } = await supabase
    .from("conversation_thread_invites")
    .select("*, conversation_threads:thread_id(id, title, project_id, company_id)")
    .eq("id", invite_id)
    .maybeSingle();

  if (!invite) return json({ error: "Invite not found" }, 404);
  if (invite.status !== "pending") return json({ error: "Invite is not pending" }, 400);

  const thread = Array.isArray(invite.conversation_threads) ? invite.conversation_threads[0] : invite.conversation_threads;
  const isAdmin = await checkIsAdmin(supabase, user.id, thread.project_id);
  if (!isAdmin) return json({ error: "Only admin can resend" }, 403);

  const newExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  await supabase
    .from("conversation_thread_invites")
    .update({ expires_at: newExpiry, updated_at: new Date().toISOString() })
    .eq("id", invite_id);

  const sent = await sendInviteEmail(supabase, thread, invite, invite.invited_email, invite.invited_name);

  await logSystemPost(supabase, invite.thread_id, thread.company_id,
    `📧 Invitasjon til ${invite.invited_name || invite.invited_email} ble sendt på nytt.`);

  return json({ ok: true, email_sent: sent });
}

// ── EMAIL SENDER ─────────────────────────────────────────────
async function sendInviteEmail(
  supabase: any,
  thread: any,
  invite: any,
  email: string,
  name?: string
): Promise<boolean> {
  try {
    const azureTenantId = Deno.env.get("AZURE_TENANT_ID");
    const azureClientId = Deno.env.get("AZURE_CLIENT_ID");
    const azureClientSecret = Deno.env.get("AZURE_CLIENT_SECRET");

    if (!azureTenantId || !azureClientId || !azureClientSecret) return false;

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
    const { access_token } = await tokenResp.json();
    if (!access_token) return false;

    const systemUrl = "https://mcsressurs.lovable.app";
    const acceptLink = `${systemUrl}/invite/thread/${invite.invite_token}`;

    const bodyHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px;">
        <h2 style="color: #1a1a1a; font-size: 18px;">Du er invitert til en samtale</h2>
        <p style="color: #374151; font-size: 14px; line-height: 1.6;">
          Du har blitt invitert til samtalen <strong>"${thread.title}"</strong>.
        </p>
        <p style="color: #374151; font-size: 14px;">
          Klikk knappen under for å godta invitasjonen og få tilgang til samtalen.
        </p>
        <div style="margin: 24px 0;">
          <a href="${acceptLink}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
            Godta invitasjon
          </a>
        </div>
        <p style="font-size: 12px; color: #9ca3af;">
          Denne invitasjonen utløper om 48 timer. Invitasjonen gir kun tilgang til denne samtalen, ikke andre deler av prosjektet.
        </p>
      </div>
    `;

    const systemMailbox = "postkontoret@mcsservice.no";
    const draftResp = await fetch(
      `https://graph.microsoft.com/v1.0/users/${systemMailbox}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subject: `Invitasjon: ${thread.title}`,
          body: { contentType: "HTML", content: bodyHtml },
          toRecipients: [{ emailAddress: { address: email, name: name || email } }],
        }),
      }
    );

    if (!draftResp.ok) return false;
    const draft = await draftResp.json();

    const sendResp = await fetch(
      `https://graph.microsoft.com/v1.0/users/${systemMailbox}/messages/${draft.id}/send`,
      { method: "POST", headers: { Authorization: `Bearer ${access_token}` } }
    );

    return sendResp.ok;
  } catch {
    return false;
  }
}
