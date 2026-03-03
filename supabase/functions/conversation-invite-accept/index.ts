import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { token } = await req.json();
    if (!token) return json({ error: "token required" }, 400);

    // Fetch invite
    const { data: invite } = await supabase
      .from("conversation_thread_invites")
      .select("*, conversation_threads:thread_id(id, title, project_id, company_id)")
      .eq("invite_token", token)
      .maybeSingle();

    if (!invite) return json({ error: "not_found" }, 404);
    if (invite.status === "accepted") return json({ error: "already_accepted" }, 400);
    if (invite.status === "revoked") return json({ error: "revoked" }, 400);
    if (new Date(invite.expires_at) < new Date()) return json({ error: "expired" }, 400);

    const thread = Array.isArray(invite.conversation_threads)
      ? invite.conversation_threads[0]
      : invite.conversation_threads;

    if (!thread) return json({ error: "Thread not found" }, 404);

    // Check if caller is authenticated (internal) or not (external magic-link accept)
    const authHeader = req.headers.get("Authorization") || "";
    let userAccountId: string | null = null;
    let participantType = "external";
    let authUserId: string | null = null;

    if (authHeader && authHeader !== "Bearer ") {
      const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (user) {
        authUserId = user.id;
        const { data: ua } = await supabase
          .from("user_accounts")
          .select("id")
          .eq("auth_user_id", user.id)
          .eq("is_active", true)
          .maybeSingle();
        if (ua) {
          userAccountId = ua.id;
          participantType = "internal";
        }
      }
    }

    // Check if already a participant
    const participantFilter = supabase
      .from("conversation_thread_participants")
      .select("id")
      .eq("thread_id", thread.id)
      .eq("email", invite.invited_email);

    const { data: existingPart } = await participantFilter.maybeSingle();
    if (existingPart) {
      // Already participant, just mark accepted
      await supabase
        .from("conversation_thread_invites")
        .update({ status: "accepted", updated_at: new Date().toISOString() })
        .eq("id", invite.id);

      return json({
        ok: true,
        already_participant: true,
        project_id: thread.project_id,
        thread_id: thread.id,
      });
    }

    // Create participant
    await supabase.from("conversation_thread_participants").insert({
      thread_id: thread.id,
      company_id: thread.company_id,
      project_id: thread.project_id,
      participant_type: participantType,
      user_account_id: userAccountId,
      email: invite.invited_email,
      display_name: invite.invited_name || invite.invited_email,
      added_by: invite.invited_by_participant_id,
    });

    // Mark invite accepted
    await supabase
      .from("conversation_thread_invites")
      .update({ status: "accepted", updated_at: new Date().toISOString() })
      .eq("id", invite.id);

    // System log
    await supabase.from("conversation_posts").insert({
      thread_id: thread.id,
      company_id: thread.company_id,
      post_type: "system",
      body_text: `✅ ${invite.invited_name || invite.invited_email} godtok invitasjonen og ble lagt til som deltaker.`,
    });

    return json({
      ok: true,
      project_id: thread.project_id,
      thread_id: thread.id,
      participant_type: participantType,
    });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
