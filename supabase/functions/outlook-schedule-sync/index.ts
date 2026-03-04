import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GraphEvent {
  id: string;
  subject: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  location?: { displayName?: string };
  lastModifiedDateTime?: string;
  body?: { content?: string };
  bodyPreview?: string;
  webLink?: string;
  organizer?: { emailAddress?: { name?: string; address?: string } };
  categories?: string[];
}

const BATCH_SIZE = 10; // max technicians per run

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const { action = "sync", continuation_after } = body;

    if (action !== "sync") {
      return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: corsHeaders });
    }

    const runId = crypto.randomUUID();
    
    // Log run start
    await supabase.from("schedule_sync_runs").insert({
      run_id: runId,
      status: "running",
    });

    // Get Graph app token
    const tenantId = Deno.env.get("AZURE_TENANT_ID")!;
    const clientId = Deno.env.get("AZURE_CLIENT_ID")!;
    const clientSecret = Deno.env.get("AZURE_CLIENT_SECRET")!;

    const tokenRes = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
        scope: "https://graph.microsoft.com/.default",
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      await supabase.from("schedule_sync_runs").update({
        status: "error", finished_at: new Date().toISOString(),
        errors: ["Failed to get Graph token"],
      }).eq("run_id", runId);
      return new Response(JSON.stringify({ error: "Failed to get Graph token" }), { status: 500, headers: corsHeaders });
    }
    const graphToken = tokenData.access_token;

    // Get technicians with user accounts
    let techQuery = supabase
      .from("technicians")
      .select("id, user_id, name")
      .not("user_id", "is", null)
      .order("name", { ascending: true })
      .limit(BATCH_SIZE);

    if (continuation_after) {
      techQuery = techQuery.gt("name", continuation_after);
    }

    const { data: techs } = await techQuery;

    if (!techs?.length) {
      await supabase.from("schedule_sync_runs").update({
        status: "complete", finished_at: new Date().toISOString(),
        techs_processed: 0, events_fetched: 0, upserts: 0, needs_confirmation: 0,
      }).eq("run_id", runId);
      return new Response(JSON.stringify({ status: "ok", synced: 0, message: "No technicians to sync" }), { headers: corsHeaders });
    }

    let totalEvents = 0;
    let totalUpserts = 0;
    let totalNeedsConfirmation = 0;
    const errors: string[] = [];

    for (const tech of techs) {
      try {
        // Get user email
        const { data: ua } = await supabase
          .from("user_accounts")
          .select("id, auth_user_id, people(email)")
          .eq("auth_user_id", tech.user_id)
          .eq("is_active", true)
          .single();

        const email = (ua as any)?.people?.email;
        if (!email) continue;

        // Get company_id
        const { data: scope } = await supabase
          .from("user_scopes")
          .select("company_id")
          .eq("user_account_id", ua!.id)
          .limit(1)
          .single();

        const companyId = scope?.company_id;
        if (!companyId) continue;

        // Get or create sync state (deltaLink tracking)
        const { data: syncState } = await supabase
          .from("schedule_sync_state")
          .select("*")
          .eq("technician_id", tech.id)
          .eq("calendar_id", email)
          .single();

        let calUrl: string;
        const now = new Date();
        const fourWeeks = new Date(now.getTime() + 28 * 86400000);

        if (syncState?.delta_link) {
          // Use deltaLink for efficient sync
          calUrl = syncState.delta_link;
        } else {
          // Full sync - calendarView
          calUrl = `https://graph.microsoft.com/v1.0/users/${email}/calendarView/delta?startDateTime=${now.toISOString()}&endDateTime=${fourWeeks.toISOString()}&$select=id,subject,start,end,location,lastModifiedDateTime,body,bodyPreview,webLink,organizer,categories`;
        }

        // Fetch events (follow @odata.nextLink for pagination)
        let events: GraphEvent[] = [];
        let nextDeltaLink: string | null = null;
        let currentUrl: string | null = calUrl;

        while (currentUrl) {
          const calRes = await fetch(currentUrl, {
            headers: { Authorization: `Bearer ${graphToken}` },
          });

          if (!calRes.ok) {
            // If deltaLink is stale (410 Gone), reset and do full sync
            if (calRes.status === 410 && syncState?.delta_link) {
              const fullUrl = `https://graph.microsoft.com/v1.0/users/${email}/calendarView/delta?startDateTime=${now.toISOString()}&endDateTime=${fourWeeks.toISOString()}&$select=id,subject,start,end,location,lastModifiedDateTime,body,bodyPreview,webLink,organizer,categories`;
              const retryRes = await fetch(fullUrl, {
                headers: { Authorization: `Bearer ${graphToken}` },
              });
              if (!retryRes.ok) {
                errors.push(`${tech.name}: Graph ${retryRes.status} on full resync`);
                break;
              }
              const retryData = await retryRes.json();
              events.push(...(retryData.value || []));
              nextDeltaLink = retryData["@odata.deltaLink"] || null;
              currentUrl = retryData["@odata.nextLink"] || null;
              continue;
            }
            errors.push(`${tech.name}: Graph ${calRes.status}`);
            break;
          }

          const calData = await calRes.json();
          events.push(...(calData.value || []));
          nextDeltaLink = calData["@odata.deltaLink"] || nextDeltaLink;
          currentUrl = calData["@odata.nextLink"] || null;
        }

        totalEvents += events.length;

        // Process events
        for (const ev of events) {
          if (ev.categories?.includes("MCS")) continue;

          const startAt = new Date(ev.start.dateTime + "Z");
          const endAt = new Date(ev.end.dateTime + "Z");

          const bodyContent = ev.body?.content || "";
          const mcsMatch = bodyContent.match(/MCS_BLOCK_ID:([a-f0-9-]+)/);
          const existingBlockId = mcsMatch?.[1] || null;

          // Project matching
          let projectId: string | null = null;
          let matchConfidence = 0;
          let matchReason = "";
          let matchState: "auto" | "needs_confirmation" | "external" = "external";

          // 1. MCS_BLOCK_ID link
          if (existingBlockId) {
            const { data: existingBlock } = await supabase
              .from("schedule_blocks")
              .select("project_id")
              .eq("id", existingBlockId)
              .single();
            if (existingBlock?.project_id) {
              projectId = existingBlock.project_id;
              matchConfidence = 100;
              matchReason = "MCS_BLOCK_ID link";
              matchState = "auto";
            }
          }

          // 2. Fuzzy match on subject
          if (!projectId && ev.subject) {
            const firstWord = ev.subject.split(/[\s–\-,]+/).filter(w => w.length > 2)[0];
            if (firstWord) {
              const { data: matchedProjects } = await supabase
                .from("events")
                .select("id, title, customer, address")
                .or(`title.ilike.%${firstWord}%,customer.ilike.%${firstWord}%`)
                .limit(5);

              if (matchedProjects?.length) {
                const subject = ev.subject.toLowerCase();
                let bestMatch = matchedProjects[0];
                let bestScore = 0;

                for (const p of matchedProjects) {
                  let score = 0;
                  const title = (p.title || "").toLowerCase();
                  const customer = (p.customer || "").toLowerCase();

                  if (subject.includes(title) || title.includes(subject)) score += 50;
                  else {
                    const words = subject.split(/[\s–\-,]+/).filter(w => w.length > 2);
                    for (const w of words) {
                      if (title.includes(w)) score += 15;
                      if (customer.includes(w)) score += 10;
                    }
                  }

                  if (ev.location?.displayName && p.address) {
                    const loc = ev.location.displayName.toLowerCase();
                    const addr = p.address.toLowerCase();
                    if (loc.includes(addr) || addr.includes(loc)) score += 25;
                  }

                  if (score > bestScore) {
                    bestScore = score;
                    bestMatch = p;
                  }
                }

                if (bestScore >= 80) {
                  projectId = bestMatch.id;
                  matchConfidence = Math.min(bestScore, 100);
                  matchReason = `Subject/location match: ${bestMatch.title}`;
                  matchState = "auto";
                } else if (bestScore >= 50) {
                  projectId = bestMatch.id;
                  matchConfidence = bestScore;
                  matchReason = `Partial match: ${bestMatch.title}`;
                  matchState = "needs_confirmation";
                }
              }
            }
          }

          // 3. Recent affinity
          if (!projectId && matchConfidence < 50) {
            const { data: recentBlocks } = await supabase
              .from("schedule_blocks")
              .select("project_id, events(title)")
              .eq("technician_id", tech.id)
              .not("project_id", "is", null)
              .order("start_at", { ascending: false })
              .limit(5);

            if (recentBlocks?.length) {
              const subject = ev.subject?.toLowerCase() || "";
              for (const rb of recentBlocks) {
                const projTitle = (rb as any).events?.title?.toLowerCase() || "";
                if (projTitle && subject.includes(projTitle.split(" ")[0])) {
                  projectId = rb.project_id;
                  matchConfidence = 60;
                  matchReason = `Recent affinity: ${(rb as any).events?.title}`;
                  matchState = "needs_confirmation";
                  break;
                }
              }
            }
          }

          if (matchState === "needs_confirmation") totalNeedsConfirmation++;

          // Upsert schedule_block
          const { error: upsertError } = await supabase
            .from("schedule_blocks")
            .upsert(
              {
                outlook_event_id: ev.id,
                calendar_id: email,
                company_id: companyId,
                technician_id: tech.id,
                project_id: projectId,
                source: "outlook",
                start_at: startAt.toISOString(),
                end_at: endAt.toISOString(),
                title: ev.subject || "",
                location: ev.location?.displayName || null,
                match_confidence: matchConfidence,
                match_reason: matchReason || null,
                match_state: matchState,
                last_modified: ev.lastModifiedDateTime || null,
                mcs_block_id: existingBlockId,
                // Outlook detail fields
                outlook_subject: ev.subject || null,
                outlook_location: ev.location?.displayName || null,
                outlook_preview: ev.bodyPreview || null,
                outlook_weblink: ev.webLink || null,
                outlook_organizer: ev.organizer?.emailAddress?.name || null,
              },
              { onConflict: "outlook_event_id,calendar_id" }
            );

          if (upsertError) {
            errors.push(`${tech.name}/${ev.subject}: ${upsertError.message}`);
          } else {
            totalUpserts++;
          }
        }

        // Save deltaLink
        if (nextDeltaLink) {
          await supabase
            .from("schedule_sync_state")
            .upsert(
              {
                technician_id: tech.id,
                calendar_id: email,
                delta_link: nextDeltaLink,
                last_synced_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              { onConflict: "technician_id,calendar_id" }
            );
        }
      } catch (techErr: any) {
        errors.push(`${tech.name}: ${techErr.message}`);
      }
    }

    // Determine if there are more techs to process (continuation)
    const lastTechName = techs[techs.length - 1]?.name;
    const continuationToken = techs.length >= BATCH_SIZE ? lastTechName : null;

    // Log run completion
    await supabase.from("schedule_sync_runs").update({
      status: "complete",
      finished_at: new Date().toISOString(),
      techs_processed: techs.length,
      events_fetched: totalEvents,
      upserts: totalUpserts,
      needs_confirmation: totalNeedsConfirmation,
      errors: errors.length > 0 ? errors : null,
      continuation_token: continuationToken,
    }).eq("run_id", runId);

    return new Response(
      JSON.stringify({
        status: "ok",
        run_id: runId,
        techs_processed: techs.length,
        events_fetched: totalEvents,
        upserts: totalUpserts,
        needs_confirmation: totalNeedsConfirmation,
        continuation_token: continuationToken,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[outlook-schedule-sync] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
