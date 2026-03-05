import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { post_id, file_url, file_id } = await req.json();
    if (!post_id || !file_url) {
      return new Response(JSON.stringify({ error: "post_id and file_url required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    // Use Gemini Flash for OCR
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
            content: `Du er en OCR-ekspert for elektriske installasjoner. Analyser bildet og ekstraher:
1. All synlig tekst (tavlenummer, betegnelser, romnummer, etc.)
2. Detekterte enheter som JSON-array: [{type: "board"|"field"|"room"|"component"|"label", value: "..."}]
Returner som JSON: {"extracted_text": "...", "detected_entities": [...]}
Hvis ingen tekst finnes, returner tomme verdier.`,
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Ekstraher tekst og enheter fra dette bildet:" },
              { type: "image_url", image_url: { url: file_url } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "ocr_result",
              description: "Return OCR results from the image",
              parameters: {
                type: "object",
                properties: {
                  extracted_text: { type: "string", description: "All visible text in the image" },
                  detected_entities: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        type: { type: "string", enum: ["board", "field", "room", "component", "label"] },
                        value: { type: "string" },
                      },
                      required: ["type", "value"],
                    },
                  },
                },
                required: ["extracted_text", "detected_entities"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "ocr_result" } },
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429 || status === 402) {
        return new Response(JSON.stringify({ error: status === 429 ? "Rate limit" : "Payment required" }), {
          status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiData = await aiResponse.json();
    let extracted_text = "";
    let detected_entities: any[] = [];

    try {
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        const parsed = JSON.parse(toolCall.function.arguments);
        extracted_text = parsed.extracted_text || "";
        detected_entities = parsed.detected_entities || [];
      }
    } catch {
      // Fallback: try to parse content
      const content = aiData.choices?.[0]?.message?.content || "";
      try {
        const parsed = JSON.parse(content);
        extracted_text = parsed.extracted_text || content;
        detected_entities = parsed.detected_entities || [];
      } catch {
        extracted_text = content;
      }
    }

    // Save to DB
    const { data, error } = await sb
      .from("image_text_extracts")
      .insert({
        post_id,
        file_id: file_id || null,
        extracted_text,
        detected_entities,
      })
      .select("*")
      .single();

    if (error) throw error;

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("extract-image-text error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
