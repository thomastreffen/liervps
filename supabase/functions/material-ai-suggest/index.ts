import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface ReqBody {
  jobId?: string;
  customer?: string;
  address?: string;
  description?: string;
  extraContext?: string;
}

interface Suggestion {
  elnr: string | null;
  description: string;
  quantity: number;
  unit: string;
  reason: string;
  confidence: "høy" | "middels" | "lav";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as ReqBody;

    const systemPrompt = `Du er en erfaren elektriker som hjelper MCS Service med å foreslå materiell for en servicejobb.
Returner kun et JSON-objekt: { "suggestions": Suggestion[] } hvor hver Suggestion har:
- elnr (string|null) — norsk EL-nummer hvis sikkert kjent, ellers null
- description (string) — kort norsk varebeskrivelse
- quantity (number)
- unit (string) — stk, m, pk, sett
- reason (string) — kort begrunnelse
- confidence ("høy"|"middels"|"lav")

Vær konservativ. Foreslå maks 12 linjer. Aldri foreslå bestilling — kun forslag som montør må godkjenne.`;

    const userPrompt = `Jobb:
Kunde: ${body.customer ?? "—"}
Adresse: ${body.address ?? "—"}
Beskrivelse: ${body.description ?? "—"}
Ekstra kontekst: ${body.extraContext ?? "—"}

Foreslå materiell.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (aiRes.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit. Prøv igjen om litt." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiRes.status === 402) {
      return new Response(JSON.stringify({ error: "AI-kreditter oppbrukt." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiRes.ok) {
      const t = await aiRes.text();
      return new Response(JSON.stringify({ error: "AI-feil", detail: t }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ai = await aiRes.json();
    const content = ai?.choices?.[0]?.message?.content ?? "{}";
    let parsed: { suggestions?: Suggestion[] } = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { suggestions: [] };
    }
    const suggestions = (parsed.suggestions ?? []).slice(0, 12);

    return new Response(JSON.stringify({ suggestions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
