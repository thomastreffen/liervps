import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Auth check
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const {
      thread_id, company_id, project_id,
      participant_type, // "internal" | "external"
      user_account_id,  // for internal
      email,            // for external
      display_name,     // for external
    } = body;

    if (!thread_id || !company_id || !project_id || !participant_type) {
      return json({ error: "Missing required fields" }, 400);
    }

    // Get caller's user_account_id for added_by
    const { data: callerUa } = await supabase
      .from("user_accounts")
      .select("id")
      .eq("auth_user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (!callerUa) return json({ error: "No active user account" }, 403);

    // Check if participant already exists
    if (participant_type === "external" && email) {
      const { data: existing } = await (supabase as any)
        .from("conversation_thread_participants")
        .select("id")
        .eq("thread_id", thread_id)
        .eq("email", email)
        .maybeSingle();
      if (existing) {
        console.log("PARTICIPANT ALREADY EXISTS", { thread_id, email });
        return json({ ok: true, participant_id: existing.id, already_exists: true });
      }
    } else if (participant_type === "internal" && user_account_id) {
      const { data: existing } = await (supabase as any)
        .from("conversation_thread_participants")
        .select("id")
        .eq("thread_id", thread_id)
        .eq("user_account_id", user_account_id)
        .maybeSingle();
      if (existing) {
        console.log("PARTICIPANT ALREADY EXISTS", { thread_id, user_account_id });
        return json({ ok: true, participant_id: existing.id, already_exists: true });
      }
    }

    // Insert participant
    const insertPayload: any = {
      company_id,
      project_id,
      thread_id,
      participant_type,
      added_by: callerUa.id,
    };

    if (participant_type === "internal") {
      if (!user_account_id) return json({ error: "user_account_id required for internal" }, 400);
      insertPayload.user_account_id = user_account_id;
    } else {
      if (!email) return json({ error: "email required for external" }, 400);
      insertPayload.email = email;
      insertPayload.display_name = display_name || email;
      insertPayload.receive_email = true;
    }

    const { data: participant, error: insertErr } = await (supabase as any)
      .from("conversation_thread_participants")
      .insert(insertPayload)
      .select()
      .single();

    if (insertErr) {
      // Handle race condition duplicate
      if (insertErr.code === "23505") {
        console.log("PARTICIPANT DUPLICATE (race)", { thread_id, email, user_account_id });
        return json({ ok: true, already_exists: true });
      }
      console.error("INSERT PARTICIPANT ERROR", insertErr);
      return json({ error: insertErr.message }, 500);
    }

    console.log("PARTICIPANT ADDED", {
      thread_id,
      participant_type,
      email: email || null,
      user_account_id: user_account_id || null,
    });

    // For external participants: trigger welcome email server-side
    let emailResult: any = null;
    if (participant_type === "external" && email) {
      try {
        // Check thread email_enabled
        const { data: thread } = await supabase
          .from("conversation_threads")
          .select("email_enabled, closed_at")
          .eq("id", thread_id)
          .single();

        if (!thread?.email_enabled) {
          console.log("WELCOME SKIP", { thread_id, reason: "email_disabled" });
          emailResult = { skipped: true, reason: "email_disabled" };
        } else if (thread?.closed_at) {
          console.log("WELCOME SKIP", { thread_id, reason: "thread_closed" });
          emailResult = { skipped: true, reason: "thread_closed" };
        } else {
          // Check post count
          const { count } = await supabase
            .from("conversation_posts")
            .select("id", { count: "exact", head: true })
            .eq("thread_id", thread_id)
            .neq("post_type", "system");

          if (!count || count === 0) {
            console.log("WELCOME SKIP", { thread_id, reason: "no_posts" });
            emailResult = { skipped: true, reason: "no_posts" };
          } else {
            // Call conversation-email-send internally
            console.log("WELCOME TRIGGER", { thread_id, email, post_count: count });
            const emailResp = await fetch(
              `${supabaseUrl}/functions/v1/conversation-email-send`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${serviceKey}`,
                },
                body: JSON.stringify({
                  thread_id,
                  reason: "participant_added",
                  recipient_email: email,
                }),
              }
            );
            emailResult = await emailResp.json();
            console.log("WELCOME RESULT", emailResult);
          }
        }
      } catch (err) {
        console.error("WELCOME EMAIL ERROR", String(err));
        emailResult = { error: String(err) };
      }
    }

    return json({
      ok: true,
      participant_id: participant.id,
      email_result: emailResult,
    });
  } catch (err) {
    console.error("ADD-PARTICIPANT UNHANDLED", String(err));
    return json({ error: String(err) }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders });
}
