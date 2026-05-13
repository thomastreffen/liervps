// Generates/improves a handbook chapter draft for MCS Kontrollsenter.
// Output is markdown intended to REPLACE the chapter body. Always saved as
// draft until admin publishes a new version.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface Body {
  handbookKind: "hms_handbook" | "employee_handbook" | "procedure" | "safety_rule";
  handbookTitle: string;
  chapterTitle: string;
  currentBody?: string;
  mode?: "draft" | "simplify" | "leader" | "short" | "checklist";
  extraInstructions?: string;
}

const MODE_PROMPTS: Record<NonNullable<Body["mode"]>, string> = {
  draft: "Skriv et komplett, internt UTKAST til kapittelet. Bruk strukturen Formål, Omfang, Ansvar, Rutine, Dokumentasjon i MCS Kontrollsenter, Avvik og oppfølging, Henvisninger, og om relevant Bekreftelse / opplæring.",
  simplify: "Omskriv eksisterende tekst til enklere språk for montører i felt. Korte setninger, aktiv form, konkret. Behold faglig presisjon på FSE/NEK/AML.",
  leader: "Omskriv som lederversjon med fokus på ansvar, oppfølging, beslutningspunkter og rapportering.",
  short: "Lag en kortversjon på maks 10 punkter som dekker det viktigste. Egnet til mobil i felt.",
  checklist: "Foreslå konkrete sjekkpunkter og SJA-koblinger som passer dette kapittelet. Returner som markdown med en kort intro og deretter en punktliste.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "AI gateway not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: Body = await req.json();
    if (!body?.chapterTitle || !body?.handbookTitle) {
      return new Response(JSON.stringify({ error: "Missing chapterTitle or handbookTitle" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mode = body.mode ?? "draft";
    const modeInstr = MODE_PROMPTS[mode];

    const systemPrompt = [
      "Du er HMS- og fagrådgiver for MCS Service, et norsk elektroentreprenørselskap som jobber med tavler, strømskinner, datacenter og næringsbygg.",
      "Du skriver interne UTKAST til Arbeidshåndbok og HMS-håndbok som kvalitetssikres av HMS-leder før publisering.",
      "Krav:",
      "- Skriv på norsk bokmål.",
      "- Bruk markdown med ## overskrifter for delseksjoner.",
      "- Start med en kort merknad om at innholdet er internt utkast som må kvalitetssikres.",
      "- Vis til relevante norske lover/forskrifter (f.eks. arbeidsmiljøloven, internkontrollforskriften, FSE, NEK 400, NEK 439) når det er naturlig, men IKKE kopier tekst fra Arbeidstilsynet, NHO eller andre kilder.",
      "- Tilpass til MCS Kontrollsenter (HMS-modul, AML-modul, Tripletex-import, Ressursplan, activity_log).",
      "- Vær konkret. Unngå generiske fraser. Unngå juridisk fasit.",
    ].join("\n");

    const userPrompt = [
      `Håndbok: ${body.handbookTitle} (${body.handbookKind})`,
      `Kapittel: ${body.chapterTitle}`,
      ``,
      `Oppgave: ${modeInstr}`,
      body.extraInstructions ? `\nEkstra instruks fra admin: ${body.extraInstructions}` : "",
      body.currentBody ? `\nEksisterende tekst (tilpass eller bygg videre):\n---\n${body.currentBody}\n---` : "",
    ].filter(Boolean).join("\n");

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (resp.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit overskredet, prøv igjen om litt." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (resp.status === 402) {
      return new Response(JSON.stringify({ error: "Lovable AI er tom for kreditter. Fyll på i Workspace." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI gateway error:", resp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway feil" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    return new Response(JSON.stringify({ content, mode }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("hms-handbook-ai-draft error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
