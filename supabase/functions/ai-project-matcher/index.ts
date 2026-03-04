import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const supabase = createClient(supabaseUrl, serviceKey);

    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500, headers: corsHeaders,
      });
    }

    // Fetch blocks that need AI matching:
    // match_state = 'needs_confirmation' OR confidence 40-79
    const { data: blocks, error: blocksErr } = await supabase
      .from("schedule_blocks")
      .select("id, technician_id, company_id, title, location, outlook_subject, outlook_location, outlook_preview, outlook_organizer, start_at, end_at, match_confidence, match_state, project_id, match_reason, ai_confidence")
      .or("match_state.eq.needs_confirmation,and(match_confidence.gte.40,match_confidence.lt.80)")
      .is("ai_confidence", null) // Only process blocks not yet AI-matched
      .order("start_at", { ascending: true })
      .limit(20);

    if (blocksErr || !blocks?.length) {
      return new Response(JSON.stringify({ status: "ok", processed: 0 }), { headers: corsHeaders });
    }

    // Fetch candidate projects: active + last 90 days, with aliases
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString();
    const { data: projects } = await supabase
      .from("events")
      .select("id, job_number, title, customer, address, project_aliases, status")
      .or(`status.in.(planned,requested,scheduled,in_progress),start_time.gte.${ninetyDaysAgo}`)
      .is("deleted_at", null)
      .order("start_time", { ascending: false })
      .limit(200);

    if (!projects?.length) {
      return new Response(JSON.stringify({ status: "ok", processed: 0, reason: "no projects" }), { headers: corsHeaders });
    }

    // Compact project list for AI
    const projectList = projects.map(p => ({
      id: p.id,
      job_number: p.job_number,
      title: p.title,
      customer: p.customer,
      address: p.address,
      aliases: p.project_aliases || [],
    }));

    let totalProcessed = 0;
    let totalAutoMatched = 0;
    let totalSuggested = 0;

    for (const block of blocks) {
      const startTime = Date.now();

      try {
        const eventPayload = {
          subject: block.outlook_subject || block.title,
          location: block.outlook_location || block.location,
          organizer: block.outlook_organizer,
          bodyPreview: block.outlook_preview,
          start: block.start_at,
          end: block.end_at,
        };

        const systemPrompt = `Du er en prosjekt-matcher for et elektro/service-selskap. Gitt en Outlook-kalenderavtale og en liste med prosjekter, finn det mest sannsynlige prosjektet.

Bruk subject, lokasjon, organisator og bodyPreview for å matche mot prosjekt-titler, kundenavn, adresser og aliases.

Regler:
- Aliases er kallenavn montører bruker. "DC Odin" = "Datasenter Odin".
- Vekt: eksakt alias-match > tittel-match > kunde-match > adresse-match.
- Hvis usikker, returner null som project_id med lav confidence.
- Svar KUN med tool-kallet, ingen ekstra tekst.`;

        const userPrompt = `Outlook-event:
${JSON.stringify(eventPayload, null, 2)}

Montør ID: ${block.technician_id}

Kandidatprosjekter:
${JSON.stringify(projectList, null, 2)}`;

        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "match_project",
                  description: "Return the best matching project for this calendar event",
                  parameters: {
                    type: "object",
                    properties: {
                      suggested_project_id: {
                        type: "string",
                        description: "UUID of the matched project, or null if no match",
                        nullable: true,
                      },
                      confidence: {
                        type: "integer",
                        description: "Confidence 0-100",
                      },
                      reason: {
                        type: "string",
                        description: "One-sentence explanation",
                      },
                      extracted_signals: {
                        type: "array",
                        items: { type: "string" },
                        description: "Key signals used for matching",
                      },
                    },
                    required: ["suggested_project_id", "confidence", "reason", "extracted_signals"],
                    additionalProperties: false,
                  },
                },
              },
            ],
            tool_choice: { type: "function", function: { name: "match_project" } },
          }),
        });

        const latencyMs = Date.now() - startTime;

        if (!aiResponse.ok) {
          const errText = await aiResponse.text();
          console.error(`[ai-project-matcher] AI error ${aiResponse.status}:`, errText);
          
          // Log the failed attempt
          await supabase.from("ai_match_runs").insert({
            schedule_block_id: block.id,
            event_subject: block.outlook_subject || block.title,
            confidence: 0,
            reason: `AI error: ${aiResponse.status}`,
            outcome: "no_change",
            latency_ms: latencyMs,
          });
          continue;
        }

        const aiData = await aiResponse.json();
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        
        if (!toolCall?.function?.arguments) {
          await supabase.from("ai_match_runs").insert({
            schedule_block_id: block.id,
            event_subject: block.outlook_subject || block.title,
            confidence: 0,
            reason: "No tool call returned",
            outcome: "no_change",
            latency_ms: latencyMs,
          });
          continue;
        }

        const result = JSON.parse(toolCall.function.arguments);
        const aiConfidence = result.confidence ?? 0;
        const aiProjectId = result.suggested_project_id;
        const aiReason = result.reason ?? "";
        const signals = result.extracted_signals ?? [];

        // Decision logic
        let outcome = "no_change";
        const updates: Record<string, any> = {
          ai_confidence: aiConfidence,
          ai_match_reason: `AI: ${aiReason}`,
        };

        if (aiProjectId && aiConfidence >= 85) {
          // Auto-match
          updates.project_id = aiProjectId;
          updates.match_state = "auto";
          updates.match_confidence = aiConfidence;
          updates.match_reason = `AI: ${aiReason}`;
          outcome = "auto";
          totalAutoMatched++;
        } else if (aiProjectId && aiConfidence >= 60) {
          // Suggestion – keep needs_confirmation but update suggested project
          updates.project_id = aiProjectId;
          updates.match_confidence = aiConfidence;
          updates.match_reason = `AI: ${aiReason}`;
          outcome = "suggestion";
          totalSuggested++;
        }
        // < 60: no change to project or state

        await supabase
          .from("schedule_blocks")
          .update(updates)
          .eq("id", block.id);

        // Log the run
        await supabase.from("ai_match_runs").insert({
          schedule_block_id: block.id,
          event_subject: block.outlook_subject || block.title,
          chosen_project_id: aiProjectId || null,
          confidence: aiConfidence,
          reason: aiReason,
          extracted_signals: signals,
          outcome,
          latency_ms: latencyMs,
        });

        totalProcessed++;
      } catch (blockErr: any) {
        console.error(`[ai-project-matcher] Block ${block.id} error:`, blockErr.message);
      }
    }

    return new Response(
      JSON.stringify({
        status: "ok",
        processed: totalProcessed,
        auto_matched: totalAutoMatched,
        suggested: totalSuggested,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[ai-project-matcher] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
