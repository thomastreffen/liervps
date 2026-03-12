import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/* ── Get MS token for a user via refresh ── */
async function getAppToken(): Promise<string | null> {
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
  return tokenData.access_token || null;
}

/* ── Delete a single Outlook event by user email ── */
async function deleteOutlookEvent(
  token: string,
  userEmail: string,
  calendarEventId: string
): Promise<{ ok: boolean; status: number }> {
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${userEmail}/events/${calendarEventId}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
  );
  return { ok: res.ok || res.status === 404, status: res.status };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // ── Auth check ──
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

    // ── Permission check ──
    const { data: canDelete } = await supabase.rpc("check_permission_v2", {
      _auth_user_id: user.id,
      _perm: "calendar.delete_events",
    });
    if (!canDelete) {
      return new Response(JSON.stringify({ error: "Mangler rettighet: calendar.delete_events", error_code: "permission_denied" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { schedule_block_id, force_delete_outlook } = await req.json();
    if (!schedule_block_id) {
      return new Response(JSON.stringify({ error: "Missing schedule_block_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the block with technician info
    const { data: block, error: fetchErr } = await supabase
      .from("schedule_blocks")
      .select("*, technicians(user_id, name, email)")
      .eq("id", schedule_block_id)
      .is("deleted_at", null)
      .single();

    if (fetchErr || !block) {
      return new Response(JSON.stringify({ error: "Block not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isSystemBlock = block.source === "system" || block.source === "manual" || block.source === "linked_outlook";
    const isOutlookImported = block.source === "outlook";
    const shouldDeleteOutlook = isSystemBlock || (isOutlookImported && force_delete_outlook === true);

    let deletedInOutlook = false;
    let outlookError: string | null = null;
    const deletedOutlookEvents: string[] = [];

    if (shouldDeleteOutlook) {
      const appToken = await getAppToken();
      if (!appToken) {
        outlookError = "Failed to get Graph app token";
        console.error("[delete-schedule-block]", outlookError);
      } else {
        // Strategy 1: Delete via event_technicians.calendar_event_id (new flow)
        if (block.project_id) {
          const { data: eventTechs } = await supabase
            .from("event_technicians")
            .select("id, calendar_event_id, technician_id, technicians(email, name)")
            .eq("event_id", block.project_id);

          if (eventTechs && eventTechs.length > 0) {
            for (const et of eventTechs) {
              const calEventId = et.calendar_event_id as string | null;
              const techEmail = (et as any).technicians?.email;
              if (calEventId && !calEventId.startsWith("pending:") && techEmail) {
                console.log(`[delete-schedule-block] Deleting Outlook event ${calEventId.slice(0, 20)}... for ${techEmail}`);
                const result = await deleteOutlookEvent(appToken, techEmail, calEventId);
                if (result.ok) {
                  deletedOutlookEvents.push(calEventId);
                  // Clear the calendar_event_id
                  await supabase.from("event_technicians")
                    .update({ calendar_event_id: null } as any)
                    .eq("id", et.id);
                } else {
                  outlookError = `Graph DELETE failed for ${techEmail}: ${result.status}`;
                  console.error("[delete-schedule-block]", outlookError);
                }
              }
            }
          }

          // Also check job_calendar_links
          const { data: calLinks } = await supabase
            .from("job_calendar_links")
            .select("id, calendar_event_id, user_id, technician_id, technicians(email, name)")
            .eq("job_id", block.project_id)
            .eq("provider", "microsoft")
            .eq("sync_status", "linked");

          if (calLinks && calLinks.length > 0) {
            for (const link of calLinks) {
              const calEventId = link.calendar_event_id as string | null;
              if (calEventId && !deletedOutlookEvents.includes(calEventId)) {
                const techEmail = (link as any).technicians?.email;
                if (techEmail) {
                  console.log(`[delete-schedule-block] Deleting via job_calendar_links: ${calEventId.slice(0, 20)}... for ${techEmail}`);
                  const result = await deleteOutlookEvent(appToken, techEmail, calEventId);
                  if (result.ok) {
                    deletedOutlookEvents.push(calEventId);
                    await supabase.from("job_calendar_links")
                      .update({ sync_status: "unlinked", calendar_event_id: null, calendar_event_url: null } as any)
                      .eq("id", link.id);
                  } else {
                    outlookError = `Graph DELETE (link) failed: ${result.status}`;
                    console.error("[delete-schedule-block]", outlookError);
                  }
                }
              }
            }
          }
        }

        // Strategy 2: Fallback to schedule_blocks.outlook_event_id (legacy / direct)
        if (block.outlook_event_id && block.calendar_id && !deletedOutlookEvents.includes(block.outlook_event_id)) {
          console.log(`[delete-schedule-block] Legacy delete: ${block.outlook_event_id.slice(0, 20)}... via calendar_id ${block.calendar_id}`);
          const result = await deleteOutlookEvent(appToken, block.calendar_id, block.outlook_event_id);
          if (result.ok) {
            deletedOutlookEvents.push(block.outlook_event_id);
          } else {
            outlookError = `Graph DELETE (legacy) failed: ${result.status}`;
            console.error("[delete-schedule-block]", outlookError);
          }
        }

        deletedInOutlook = deletedOutlookEvents.length > 0;
      }
    }

    // Soft delete the block
    const { error: updateErr } = await supabase
      .from("schedule_blocks")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_reason: isSystemBlock ? "manual_delete" : (force_delete_outlook ? "manual_delete_with_outlook" : "removed_from_plan"),
      } as any)
      .eq("id", schedule_block_id);

    if (updateErr) {
      return new Response(JSON.stringify({ error: "Failed to soft-delete block" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Also soft-delete the linked event if it's a task (tasks have no existence outside the plan)
    if (isSystemBlock && block.project_id) {
      const { data: linkedEvent } = await supabase
        .from("events")
        .select("id, project_type")
        .eq("id", block.project_id)
        .is("deleted_at", null)
        .maybeSingle();

      if (linkedEvent?.project_type === "task") {
        await supabase.from("events")
          .update({ deleted_at: new Date().toISOString(), status: "cancelled" })
          .eq("id", linkedEvent.id);
        console.log(`[delete-schedule-block] Soft-deleted linked task event ${linkedEvent.id}`);
      }
    }

    // Log the action
    await supabase.from("activity_log").insert({
      entity_type: "schedule_block",
      entity_id: schedule_block_id,
      action: "deleted",
      type: "system",
      description: `Schedule block deleted (source: ${block.source}). Outlook events removed: ${deletedOutlookEvents.length}${outlookError ? ` Error: ${outlookError}` : ""}`,
    });

    return new Response(
      JSON.stringify({
        status: "ok",
        source: block.source,
        deleted_in_outlook: deletedInOutlook,
        outlook_events_removed: deletedOutlookEvents.length,
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
