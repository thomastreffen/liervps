import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth client to get user
    const authClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await authClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const db = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const {
      client_request_id,
      schedule_block_id,
      title,
      address,
      description,
      start_time,
      end_time,
      technician_id,
      company_id,
    } = body;

    if (!client_request_id || !schedule_block_id) {
      return new Response(
        JSON.stringify({ error: "client_request_id and schedule_block_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Check if already processed (idempotency)
    const { data: existing } = await db
      .from("events")
      .select("id")
      .eq("client_request_id", client_request_id)
      .maybeSingle();

    if (existing) {
      // Already created – ensure schedule_block is linked
      await db
        .from("schedule_blocks")
        .update({
          project_id: existing.id,
          match_state: "confirmed",
          match_reason: "Manuelt opprettet fra Outlook-blokk (idempotent)",
        })
        .eq("id", schedule_block_id);

      return new Response(
        JSON.stringify({
          status: "ok",
          event_id: existing.id,
          idempotent: true,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Create event
    const { data: created, error: insertErr } = await db
      .from("events")
      .insert({
        title: title || "Ny jobb",
        address: address || null,
        description: description || null,
        start_time,
        end_time,
        technician_id,
        company_id: company_id || null,
        status: "requested",
        created_by: user.id,
        client_request_id,
      })
      .select("id")
      .single();

    if (insertErr) {
      // Unique constraint race – fetch existing
      if (insertErr.code === "23505" && insertErr.message?.includes("client_request_id")) {
        const { data: raced } = await db
          .from("events")
          .select("id")
          .eq("client_request_id", client_request_id)
          .single();

        if (raced) {
          await db
            .from("schedule_blocks")
            .update({
              project_id: raced.id,
              match_state: "confirmed",
              match_reason: "Manuelt opprettet fra Outlook-blokk (race recovered)",
            })
            .eq("id", schedule_block_id);

          return new Response(
            JSON.stringify({ status: "ok", event_id: raced.id, idempotent: true }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
      throw insertErr;
    }

    // 3. Assign technician
    await db.from("event_technicians").insert({
      event_id: created.id,
      technician_id,
    });

    // 4. Link schedule_block
    await db
      .from("schedule_blocks")
      .update({
        project_id: created.id,
        match_state: "confirmed",
        match_reason: "Manuelt opprettet fra Outlook-blokk",
      })
      .eq("id", schedule_block_id);

    return new Response(
      JSON.stringify({ status: "ok", event_id: created.id, idempotent: false }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("create-job-from-schedule-block error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
