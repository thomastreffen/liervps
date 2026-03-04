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
  categories?: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Validate caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const body = await req.json();
    const { action } = body;

    if (action === "sync") {
      // Sync Outlook calendars for all technicians with MS tokens
      const tenantId = Deno.env.get("AZURE_TENANT_ID")!;
      const clientId = Deno.env.get("AZURE_CLIENT_ID")!;
      const clientSecret = Deno.env.get("AZURE_CLIENT_SECRET")!;

      // Get app token
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
        return new Response(JSON.stringify({ error: "Failed to get Graph token", details: tokenData }), { status: 500, headers: corsHeaders });
      }
      const graphToken = tokenData.access_token;

      // Get technicians with user accounts that have Microsoft connections
      const { data: techs } = await supabase
        .from("technicians")
        .select("id, user_id, name")
        .not("user_id", "is", null);

      if (!techs?.length) {
        return new Response(JSON.stringify({ status: "ok", synced: 0, message: "No technicians with user accounts" }), { headers: corsHeaders });
      }

      // Get user emails from auth
      let totalSynced = 0;
      const errors: string[] = [];

      for (const tech of techs) {
        try {
          // Get user email from user_accounts
          const { data: ua } = await supabase
            .from("user_accounts")
            .select("id, auth_user_id, people(email)")
            .eq("auth_user_id", tech.user_id)
            .eq("is_active", true)
            .single();

          const email = (ua as any)?.people?.email;
          if (!email) continue;

          // Get company_id from user_scopes
          const { data: scope } = await supabase
            .from("user_scopes")
            .select("company_id")
            .eq("user_account_id", ua!.id)
            .limit(1)
            .single();

          const companyId = scope?.company_id;
          if (!companyId) continue;

          // Fetch calendar events for next 4 weeks
          const now = new Date();
          const fourWeeks = new Date(now.getTime() + 28 * 86400000);
          const calUrl = `https://graph.microsoft.com/v1.0/users/${email}/calendarView?startDateTime=${now.toISOString()}&endDateTime=${fourWeeks.toISOString()}&$top=100&$select=id,subject,start,end,location,lastModifiedDateTime,body,categories`;

          const calRes = await fetch(calUrl, {
            headers: { Authorization: `Bearer ${graphToken}` },
          });

          if (!calRes.ok) {
            errors.push(`${tech.name}: Graph ${calRes.status}`);
            continue;
          }

          const calData = await calRes.json();
          const events: GraphEvent[] = calData.value || [];

          for (const ev of events) {
            // Skip events already created by MCS (has MCS category)
            if (ev.categories?.includes("MCS")) continue;

            const startAt = new Date(ev.start.dateTime + "Z");
            const endAt = new Date(ev.end.dateTime + "Z");

            // Check if body contains MCS_BLOCK_ID (already linked)
            const bodyContent = ev.body?.content || "";
            const mcsMatch = bodyContent.match(/MCS_BLOCK_ID:([a-f0-9-]+)/);
            const existingBlockId = mcsMatch?.[1] || null;

            // Project matching
            let projectId: string | null = null;
            let matchConfidence = 0;
            let matchReason = "";
            let matchState: "auto" | "needs_confirmation" | "external" = "external";

            // If already linked via MCS_BLOCK_ID
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

            // Fuzzy match on subject
            if (!projectId && ev.subject) {
              const { data: matchedProjects } = await supabase
                .from("events")
                .select("id, title, customer, address")
                .or(`title.ilike.%${ev.subject.split(" ")[0]}%,customer.ilike.%${ev.subject.split(" ")[0]}%`)
                .limit(5);

              if (matchedProjects?.length) {
                // Simple scoring
                const subject = ev.subject.toLowerCase();
                let bestMatch = matchedProjects[0];
                let bestScore = 0;

                for (const p of matchedProjects) {
                  let score = 0;
                  const title = (p.title || "").toLowerCase();
                  const customer = (p.customer || "").toLowerCase();

                  // Title match
                  if (subject.includes(title) || title.includes(subject)) score += 50;
                  else {
                    const words = subject.split(/[\s–\-,]+/).filter(w => w.length > 2);
                    for (const w of words) {
                      if (title.includes(w)) score += 15;
                      if (customer.includes(w)) score += 10;
                    }
                  }

                  // Location match
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

            // Recent affinity: check if tech recently worked on a project
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
                },
                { onConflict: "outlook_event_id,calendar_id" }
              );

            if (upsertError) {
              errors.push(`${tech.name}/${ev.subject}: ${upsertError.message}`);
            } else {
              totalSynced++;
            }
          }
        } catch (techErr: any) {
          errors.push(`${tech.name}: ${techErr.message}`);
        }
      }

      return new Response(
        JSON.stringify({ status: "ok", synced: totalSynced, errors: errors.length > 0 ? errors : undefined }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: corsHeaders });
  } catch (err: any) {
    console.error("[outlook-schedule-sync] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
