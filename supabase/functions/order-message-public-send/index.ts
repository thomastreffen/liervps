// Server-authoritative endpoint for messages sent from the public order
// tracking page (/bestilling/status/:token). Frontend cannot dictate
// sender_type/sender_name — those are resolved here based on the JWT.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

interface Body {
  tracking_token?: string;
  body?: string;
  has_attachments?: boolean;
  client_request_id?: string;
}

function json(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  let payload: Body;
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const token = (payload.tracking_token || "").trim();
  const body = (payload.body || "").trim();
  const hasAttachments = !!payload.has_attachments;

  if (!token) return json(400, { error: "tracking_token kreves" });
  if (!body && !hasAttachments) {
    return json(400, { error: "Melding kan ikke være tom" });
  }
  if (body.length > 8000) {
    return json(400, { error: "Meldingen er for lang" });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Resolve submission via tracking token (security definer RPC)
  const { data: subRows, error: subErr } = await admin.rpc(
    "get_submission_by_tracking_token",
    { _token: token },
  );
  if (subErr) {
    console.error("submission_lookup_failed", subErr);
    return json(500, { error: "Kunne ikke slå opp bestilling" });
  }
  const submission = Array.isArray(subRows) ? subRows[0] : subRows;
  if (!submission?.id) {
    return json(404, { error: "Ugyldig sporingslenke" });
  }

  if (["closed", "rejected"].includes(String(submission.status))) {
    return json(409, { error: "Denne bestillingen er lukket" });
  }

  // 2. Check authenticated user (optional)
  const authHeader = req.headers.get("Authorization");
  let isInternal = false;
  let internalUserId: string | null = null;
  let internalName: string | null = null;
  let internalEmail: string | null = null;

  if (authHeader?.startsWith("Bearer ") && authHeader !== `Bearer ${ANON_KEY}`) {
    try {
      const userClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: userData, error: userErr } = await userClient.auth.getUser(
        authHeader.replace("Bearer ", ""),
      );
      if (userErr) {
        console.warn("auth_getuser_failed", userErr.message);
      }
      const uid = userData?.user?.id;
      if (uid) {
        // Authoritative internal check: must be active membership in submission's company,
        // and must NOT be a customer_user role.
        const { data: memberships } = await admin
          .from("user_memberships")
          .select("id, role_id, is_active")
          .eq("user_id", uid)
          .eq("is_active", true);

        const hasInternalMembership = (memberships?.length ?? 0) > 0;

        // Pull display name + role from auth metadata (cheap & reliable)
        const { data: authUserRes } = await admin.auth.admin.getUserById(uid);
        const meta = authUserRes?.user?.user_metadata || {};
        const role = (meta.app_role as string | undefined) || "";
        const isCustomerRole = role === "customer_user";

        if (hasInternalMembership && !isCustomerRole) {
          isInternal = true;
          internalUserId = uid;
          internalEmail = authUserRes?.user?.email || null;

          // Prefer people.full_name via user_accounts
          const { data: ua } = await admin
            .from("user_accounts")
            .select("person:people(full_name)")
            .eq("auth_user_id", uid)
            .eq("is_active", true)
            .maybeSingle();
          internalName =
            // deno-lint-ignore no-explicit-any
            (ua as any)?.person?.full_name ||
            (meta.full_name as string | undefined) ||
            internalEmail ||
            "MCS Service";
        }
      }
    } catch (e) {
      // If anything goes wrong with auth, fall back to anonymous customer.
      console.warn("auth_resolve_failed", (e as Error).message);
    }
  }

  // 3. Build sender fields server-side
  const senderType = isInternal ? "internal" : "customer";
  const senderName = isInternal
    ? (internalName || "MCS Service")
    : (submission.submitter_name ||
       submission.notification_recipient_name ||
       "Bestiller");
  const source = isInternal
    ? "public_tracking_internal"
    : "public_tracking_customer";

  const clientRequestId = (payload.client_request_id || "").trim() || null;

  // 3b. Idempotency: if this client_request_id already produced a row, return it.
  if (clientRequestId) {
    const { data: existing } = await admin
      .from("order_form_messages")
      .select("id, created_at, sender_type, sender_name, sender_user_id, source")
      .eq("submission_id", submission.id)
      .eq("client_request_id", clientRequestId)
      .maybeSingle();
    if (existing) {
      return json(200, {
        ok: true,
        message: existing,
        sender_type: existing.sender_type,
        is_internal: isInternal,
        idempotent: true,
      });
    }
  }

  // 4. Insert message
  const { data: inserted, error: msgErr } = await admin
    .from("order_form_messages")
    .insert({
      submission_id: submission.id,
      sender_type: senderType,
      sender_user_id: isInternal ? internalUserId : null,
      sender_name: senderName,
      message_type: "message",
      body: body || "(Vedlegg sendt)",
      is_visible_to_customer: true,
      requires_reply: false,
      visibility: "shared",
      source,
      client_request_id: clientRequestId,
    })
    .select("id, created_at, sender_type, sender_name, sender_user_id, source")
    .single();

  if (msgErr) {
    // Unique-violation on (submission_id, client_request_id) → another concurrent
    // request already inserted this exact submit. Fetch & return it.
    if (msgErr.code === "23505" && clientRequestId) {
      const { data: dup } = await admin
        .from("order_form_messages")
        .select("id, created_at, sender_type, sender_name, sender_user_id, source")
        .eq("submission_id", submission.id)
        .eq("client_request_id", clientRequestId)
        .maybeSingle();
      if (dup) {
        return json(200, {
          ok: true,
          message: dup,
          sender_type: dup.sender_type,
          is_internal: isInternal,
          idempotent: true,
        });
      }
    }
    console.error("message_insert_failed", msgErr);
    return json(500, {
      error: "Kunne ikke lagre meldingen",
      detail: msgErr.message,
      code: msgErr.code,
    });
  }

  // 5. Mirror to legacy comments table for backward compatibility
  if (body) {
    await admin.from("order_form_comments").insert({
      submission_id: submission.id,
      body,
      comment_type: isInternal ? "internal_note" : "customer_reply",
      visibility: "shared",
      is_customer_reply: !isInternal,
      author_name: senderName,
      created_by: isInternal ? internalUserId : null,
    });
  }

  // 6. Update submission timestamps
  const nowIso = new Date().toISOString();
  // deno-lint-ignore no-explicit-any
  const updates: any = { last_activity_at: nowIso };
  if (isInternal) {
    updates.last_admin_message_at = nowIso;
  } else {
    updates.last_customer_message_at = nowIso;
    updates.customer_last_reply_at = nowIso;
    updates.awaiting_customer_reply = false;
  }
  await admin
    .from("order_form_submissions")
    .update(updates)
    .eq("id", submission.id);

  return json(200, {
    ok: true,
    message: inserted,
    sender_type: senderType,
    is_internal: isInternal,
  });
});
