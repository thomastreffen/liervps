import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const KNOWLEDGE_BASE = `
Du er en AI-hjelpeassistent for MCS Ressurs, et norsk system for prosjektstyring, ressursplanlegging og feltarbeid. Svar alltid på norsk.

Systemets hovedmoduler:
- Ressursplan: Planlegg montører på prosjekter. Dra-og-slipp-kalender. Synkroniseres med Outlook.
- Min dag: Montørens mobile visning. Se dagens oppdrag, start arbeid, ta bilder, fyll ut sjekklister, marker ferdig.
- Prosjekter: Opprett og administrer prosjekter med kunde, adresse, samtaler, dokumenter og tidsplan.
- Skjema & maler: Admin lager sjekklister og kontrollskjema. Montører fyller ut i felt. Noen er obligatoriske.
- Servicejournal: Samler all dokumentasjon: bilder, sjekklister, notater. Kan deles med kunde.
- Kundeportal: Kunder logger inn for å se prosjektstatus, godkjenne arbeid, se sjekklister og bilder.
- Fakturagrunnlag: Samler ferdigstilte oppdrag for fakturering. Obligatoriske skjema må være fullført.
- Varsler: E-post og systemvarsler for endringer, nye oppdrag og godkjenninger.

Viktige regler:
- Obligatoriske skjema blokkerer ferdigmelding (required_before_completion) og fakturering (required_before_billing).
- Montører ser kun sine egne oppdrag. Admin/prosjektleder ser alt i sin avdeling/selskap.
- GPS-posisjon sjekkes automatisk ved oppstart av arbeid.
- Bilder og sjekklister lagres automatisk på prosjektet.

Instruksjoner:
- Svar kort og konkret.
- Bruk steg-for-steg når det gir mening.
- Henvis til riktig side/modul i systemet (f.eks. "Gå til Ressursplan" eller "Åpne Min dag").
- Hvis du er usikker, si det ærlig og foreslå at brukeren kontakter administrator.
- Ikke finn opp funksjoner som ikke finnes.
`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: KNOWLEDGE_BASE },
          ...messages.slice(-10), // Keep last 10 messages for context
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ reply: "For mange forespørsler akkurat nå. Prøv igjen om et øyeblikk." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ reply: "AI-tjenesten er midlertidig utilgjengelig. Søk i hjelpeartiklene i stedet." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "Beklager, jeg kunne ikke svare.";

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("help-chat error:", e);
    return new Response(
      JSON.stringify({ reply: "Beklager, noe gikk galt. Prøv igjen eller søk i hjelpeartiklene." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
