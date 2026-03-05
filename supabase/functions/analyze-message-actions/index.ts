import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Heuristic fallback
function heuristicSuggestions(text: string, tags: string[]): any[] {
  const lower = text.toLowerCase();
  const suggestions: any[] = [];

  const deviationWords = ["feil", "mangler", "brent", "jordfeil", "varmgang", "løs", "lukt", "gnist", "skadet", "defekt", "lekk"];
  const taskWords = ["kan du", "må", "trenger", "husk", "fix", "sjekk", "bestill", "gjør", "ordne", "fikse"];
  const fdvWords = ["servicerapport", "fdv", "samsvar", "kontroll", "dokumentasjon", "protokoll", "testrapport"];

  if (deviationWords.some(w => lower.includes(w)) || tags.includes("avvik")) {
    suggestions.push({
      action_type: "deviation",
      title: text.split(/[.\n!?]/)[0]?.trim().substring(0, 80) || "Avvik",
      description: text,
      priority: "high",
      due_date_suggestion: null,
      confidence: 0.7,
      reasons: ["Teksten inneholder nøkkelord som indikerer avvik"],
    });
  }

  if (taskWords.some(w => lower.includes(w))) {
    suggestions.push({
      action_type: "task",
      title: text.split(/[.\n!?]/)[0]?.trim().substring(0, 80) || "Ny oppgave",
      description: text,
      priority: "medium",
      due_date_suggestion: null,
      confidence: 0.6,
      reasons: ["Teksten inneholder handlingsord"],
    });
  }

  if (fdvWords.some(w => lower.includes(w)) || tags.includes("fdv")) {
    suggestions.push({
      action_type: "fdv_note",
      title: "FDV-notat",
      description: text,
      priority: "low",
      due_date_suggestion: null,
      confidence: 0.5,
      reasons: ["Teksten refererer til FDV-relatert innhold"],
    });
  }

  return suggestions;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { post_id, message_text, context_tags } = await req.json();
    if (!post_id || !message_text) {
      return new Response(JSON.stringify({ error: "Missing post_id or message_text" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    let suggestions: any[] = [];

    // Try AI first
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (LOVABLE_API_KEY) {
      try {
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              {
                role: "system",
                content: `Du analyserer meldinger fra montører/prosjektledere i byggebransjen (elektro/service). 
Basert på meldingen, foreslå 0-3 handlinger. Returner kun relevante forslag.
Mulige handlingstyper:
- task: Oppgave som må utføres
- deviation: Avvik/feil som må registreres 
- fdv_note: FDV-dokumentasjon
- call_customer: Bør kontakte kunde
- order_parts: Deler/materiell må bestilles

Svar MED tool-kall.`,
              },
              {
                role: "user",
                content: `Melding: "${message_text}"${context_tags?.length ? `\nKontekst-tags: ${context_tags.join(", ")}` : ""}`,
              },
            ],
            tools: [{
              type: "function",
              function: {
                name: "suggest_actions",
                description: "Foreslå handlinger basert på meldingen",
                parameters: {
                  type: "object",
                  properties: {
                    suggestions: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          action_type: { type: "string", enum: ["task", "deviation", "fdv_note", "call_customer", "order_parts"] },
                          title: { type: "string" },
                          description: { type: "string" },
                          priority: { type: "string", enum: ["low", "medium", "high"] },
                          confidence: { type: "number" },
                          reasons: { type: "array", items: { type: "string" } },
                        },
                        required: ["action_type", "title", "priority", "confidence", "reasons"],
                      },
                    },
                  },
                  required: ["suggestions"],
                },
              },
            }],
            tool_choice: { type: "function", function: { name: "suggest_actions" } },
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall?.function?.arguments) {
            const parsed = JSON.parse(toolCall.function.arguments);
            suggestions = (parsed.suggestions || []).map((s: any) => ({
              ...s,
              due_date_suggestion: null,
              description: s.description || message_text,
            }));
          }
        }
      } catch (aiErr) {
        console.error("AI analysis failed, using heuristics:", aiErr);
      }
    }

    // Fallback to heuristics
    if (suggestions.length === 0) {
      suggestions = heuristicSuggestions(message_text, context_tags || []);
    }

    // Only store if there are suggestions
    if (suggestions.length > 0) {
      await sb.from("message_action_suggestions").upsert({
        post_id,
        suggested_actions: suggestions,
      }, { onConflict: "post_id" });
    }

    return new Response(JSON.stringify({ suggested_actions: suggestions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("analyze-message-actions error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
