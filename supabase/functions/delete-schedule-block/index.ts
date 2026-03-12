import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // ── Auth check (was missing!) ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await anonClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Permission check: calendar.delete_events ──
    const { data: canDelete } = await supabase.rpc("check_permission_v2", {
      _auth_user_id: user.id,
      _perm: "calendar.delete_events",
    });
    if (!canDelete) {
      console.log(`[delete-schedule-block] DENIED: User ${user.id} lacks calendar.delete_events`);
      return new Response(JSON.stringify({ error: "Mangler rettighet: calendar.delete_events", error_code: "permission_denied" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { schedule_block_id } = await req.json();
    if (!schedule_block_id) {
      return new Response(JSON.stringify({ error: "Missing schedule_block_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the block
    const { data: block, error: fetchErr } = await supabase
      .from("schedule_blocks")
      .select("*, technicians(user_id, name)")
      .eq("id", schedule_block_id)
      .is("deleted_at", null)
      .single();

    if (fetchErr || !block) {
      return new Response(JSON.stringify({ error: "Block not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let deletedInOutlook = false;
    let outlookError: string | null = null;

    // Only delete from Outlook if source is system/manual (not outlook-synced)
    const isSystemBlock = block.source === "system" || block.source === "manual" || block.source === "linked_outlook";
    
    if (isSystemBlock && block.outlook_event_id && block.calendar_id) {
      const tenantId = Deno.env.get("AZURE_TENANT_ID")!;
      const clientId = Deno.env.get("AZURE_CLIENT_ID")!;
      const clientSecret = Deno.env.get("AZURE_CLIENT_SECRET")!;

      const tokenRes = await fetch(
        `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "client_credentials",
            client_id: clientId,
            client_secret: clientSecret,
            scope: "https://graph.microsoft.com/.default",
          }),
        }
      );
      const tokenData = await tokenRes.json();

      if (tokenData.access_token) {
        const delRes = await fetch(
          `https://graph.microsoft.com/v1.0/users/${block.calendar_id}/events/${block.outlook_event_id}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
          }
        );

        if (delRes.ok || delRes.status === 404) {
          deletedInOutlook = true;
        } else {
          outlookError = `Graph DELETE failed: ${delRes.status}`;
          console.error("[delete-schedule-block]", outlookError);
        }
      } else {
        outlookError = "Failed to get Graph token";
      }
    }

    // Soft delete the block with reason
    const deleteReason = isSystemBlock ? "manual_delete" : "manual_delete";
    const { error: updateErr } = await supabase
      .from("schedule_blocks")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_reason: deleteReason,
      } as any)
      .eq("id", schedule_block_id);

    if (updateErr) {
      return new Response(JSON.stringify({ error: "Failed to soft-delete block" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log the action
    await supabase.from("activity_log").insert({
      entity_type: "schedule_block",
      entity_id: schedule_block_id,
      action: "deleted",
      type: "system",
      description: `Schedule block deleted. Outlook: ${deletedInOutlook ? "removed" : "skipped"}${outlookError ? ` (${outlookError})` : ""}`,
    });

    return new Response(
      JSON.stringify({
        status: "ok",
        deleted_in_outlook: deletedInOutlook,
        outlook_error: outlookError,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[delete-schedule-block] Exception:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
