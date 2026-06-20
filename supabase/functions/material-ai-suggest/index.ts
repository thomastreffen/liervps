// AI material suggestion engine — job-classified, context-driven, source-grounded.
//
// Flow:
//   1. Classify job_type from description + attachments (heuristic + AI).
//   2. Build suggestions strictly grounded in attachments, description, or
//      explicit small_parts opt-in.
//   3. Filter out generic installation small parts unless small_parts=true OR
//      they are literally present in an attachment.
//   4. For tavle/høystrøm jobs, an even stricter filter blocks PR-kabel, Wago,
//      AP9, Letti/APK, stikk/bryter, skruer/plugger, tape — unless explicitly
//      named in description/attachment.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface AttachmentRef {
  name: string;
  url?: string | null;
  path?: string | null;
  bucket?: string | null;
  mime?: string | null;
}

interface ReqBody {
  jobId?: string | null;
  orderId?: string | null;
  customer?: string;
  address?: string;
  description?: string;
  extraContext?: string;
  basis?: string[];
  attachments?: AttachmentRef[];
}

type JobType =
  | "tavle_hoystrom"
  | "tavle_standard"
  | "service_smajobb"
  | "installasjon_bygg"
  | "feilsoking"
  | "dokumentasjon_fdv"
  | "ukjent";

interface Suggestion {
  elnr: string | null;
  description: string;
  quantity: number;
  unit: string;
  unit_price?: number | null;
  manufacturer?: string | null;
  supplier?: string | null;
  provided_by?: string | null;
  confidence: "høy" | "middels" | "lav";
  ai_reason: string;
  source_type:
    | "attachment_material_list"
    | "attachment_revision_cloud"
    | "attachment_other"
    | "job_description"
    | "existing_lines"
    | "product_database"
    | "small_parts"
    | "none";
  source_file?: string | null;
  source_page?: string | null;
  source_label?: string | null;
  component_reference?: string | null;
}

// Keywords that signal tavle / høystrøm
const TAVLE_KEYWORDS = [
  /\btavle\b/i,
  /hovedtavle/i,
  /hovedfordeling/i,
  /samleskinne/i,
  /\binntak\b/i,
  /\btrafo\b/i,
  /utkobling\s+av\s+trafo/i,
  /\beffektbryter/i,
  /lastbryter/i,
  /kompaktbryter/i,
  /\bns\s?\d{2,4}\b/i, // NS800, NS 250 osv.
  /schneider/i,
  /\b\d{3,4}\s?a\b/i, // 250A, 800A osv.
  /\b\d-?\s?polt\b/i, // 3-polt
  /tilkoblingsklemmer?/i,
  /presskabelsko/i,
];

// Generic small parts: should NOT appear unless small_parts=true or grounded in attachment
const GENERIC_BLACKLIST: RegExp[] = [
  /\bpr[-\s]?kabel/i,
  /\bapk\b/i,
  /\bletti\b/i,
  /\bap\s?9\b/i,
  /veggboks/i,
  /\bwago\b/i,
  /koblingsklemme(?!.*ns\s?\d{2,4})/i, // generic koblingsklemme, but allow when paired with NSxxx
  /standard\s*stikk/i,
  /standard\s*bryter/i,
  /\bstikk\b/i,
  /jordingsmuffe/i,
  /\bskruer?\b/i,
  /\bplugger?\b/i,
  /\bstrips\b/i,
  /isolasjonstape/i,
  /\bph[-\s]?skruer?\b/i,
  /festemateriell/i,
];

// Extra-strict blacklist for tavle jobs (in addition to GENERIC_BLACKLIST)
const TAVLE_EXTRA_BLACKLIST: RegExp[] = [
  /\bvanlig\s+kabel/i,
  /\bdownlight/i,
  /\bstikkontakt/i,
];

function classifyJobHeuristic(text: string): JobType {
  const hits = TAVLE_KEYWORDS.reduce((acc, re) => acc + (re.test(text) ? 1 : 0), 0);
  if (hits >= 2) return "tavle_hoystrom";
  if (/\btavle\b/i.test(text)) return "tavle_standard";
  if (/feilsøk|feilsok/i.test(text)) return "feilsoking";
  if (/\bfdv\b|dokumentasjon/i.test(text)) return "dokumentasjon_fdv";
  if (/installasjon|nybygg|leilighet|rehab/i.test(text)) return "installasjon_bygg";
  if (text.trim().length > 0) return "service_smajobb";
  return "ukjent";
}

const JOB_TYPE_LABEL: Record<JobType, string> = {
  tavle_hoystrom: "Tavlearbeid / høystrøm",
  tavle_standard: "Tavlearbeid",
  service_smajobb: "Service / småjobb",
  installasjon_bygg: "Installasjon / bygg",
  feilsoking: "Feilsøking",
  dokumentasjon_fdv: "Dokumentasjon / FDV",
  ukjent: "Ukjent",
};

function isGeneric(s: Suggestion): boolean {
  const text = `${s.description ?? ""} ${s.ai_reason ?? ""}`;
  return GENERIC_BLACKLIST.some((re) => re.test(text));
}

function isTavleBlocked(s: Suggestion): boolean {
  const text = `${s.description ?? ""} ${s.ai_reason ?? ""}`;
  return TAVLE_EXTRA_BLACKLIST.some((re) => re.test(text));
}

function mentionedInText(needle: string, haystack: string): boolean {
  const n = needle.toLowerCase().trim();
  if (!n) return false;
  // Tokenize: first 2-3 words of description
  const tokens = n.split(/\s+/).slice(0, 3).join(" ");
  return haystack.toLowerCase().includes(tokens);
}

async function fetchAttachmentAsBase64(
  admin: ReturnType<typeof createClient>,
  att: AttachmentRef,
): Promise<{ name: string; mime: string; base64: string } | null> {
  try {
    let bytes: Uint8Array | null = null;
    let mime = att.mime ?? "application/pdf";

    if (att.path && att.bucket) {
      const { data, error } = await admin.storage.from(att.bucket).download(att.path);
      if (error || !data) {
        console.warn("storage download failed", att.path, error?.message);
        return null;
      }
      bytes = new Uint8Array(await data.arrayBuffer());
      mime = data.type || mime;
    } else if (att.url) {
      const res = await fetch(att.url);
      if (!res.ok) return null;
      bytes = new Uint8Array(await res.arrayBuffer());
      mime = res.headers.get("content-type") || mime;
    }
    if (!bytes) return null;

    if (bytes.byteLength > 8 * 1024 * 1024) {
      console.warn("attachment too big, skipping", att.name, bytes.byteLength);
      return null;
    }

    let bin = "";
    for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
    const b64 = btoa(bin);
    return { name: att.name, mime, base64: b64 };
  } catch (e) {
    console.error("fetch attachment failed", e);
    return null;
  }
}

const SUGGEST_TOOL = {
  type: "function",
  function: {
    name: "return_material_suggestions",
    description:
      "Classify the job and return grounded material suggestions strictly from provided sources. Return empty list when no concrete grounding exists.",
    parameters: {
      type: "object",
      properties: {
        job_type: {
          type: "string",
          enum: [
            "tavle_hoystrom",
            "tavle_standard",
            "service_smajobb",
            "installasjon_bygg",
            "feilsoking",
            "dokumentasjon_fdv",
            "ukjent",
          ],
        },
        job_type_reason: { type: "string" },
        clarifications: {
          type: "array",
          items: { type: "string" },
          description: "Spørsmål bruker bør avklare før bestilling, hvis AI er usikker.",
        },
        note: { type: "string" },
        suggestions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              elnr: { type: ["string", "null"] },
              description: { type: "string" },
              quantity: { type: "number" },
              unit: { type: "string" },
              unit_price: { type: ["number", "null"] },
              manufacturer: { type: ["string", "null"] },
              supplier: { type: ["string", "null"] },
              provided_by: { type: ["string", "null"] },
              confidence: { type: "string", enum: ["høy", "middels", "lav"] },
              ai_reason: { type: "string" },
              source_type: {
                type: "string",
                enum: [
                  "attachment_material_list",
                  "attachment_revision_cloud",
                  "attachment_other",
                  "job_description",
                  "existing_lines",
                  "product_database",
                  "small_parts",
                  "none",
                ],
              },
              source_file: { type: ["string", "null"] },
              source_page: { type: ["string", "null"] },
              source_label: { type: ["string", "null"] },
              component_reference: { type: ["string", "null"] },
            },
            required: ["description", "quantity", "unit", "confidence", "ai_reason", "source_type"],
            additionalProperties: false,
          },
        },
      },
      required: ["job_type", "suggestions"],
      additionalProperties: false,
    },
  },
};

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

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const body = (await req.json()) as ReqBody;
    const basis = new Set(body.basis ?? []);
    const useAttachments = basis.has("attachments");
    const useSmallParts = basis.has("small_parts") || basis.has("spare");
    const attachments = useAttachments ? (body.attachments ?? []).filter((a) => a) : [];

    // Heuristic classification (used as guard + hint to AI)
    const fullText = [body.description ?? "", body.extraContext ?? ""].join("\n");
    const heuristicType = classifyJobHeuristic(fullText);
    const isTavleJob = heuristicType === "tavle_hoystrom" || heuristicType === "tavle_standard";

    const pdfAttachments = attachments
      .filter((a) => /\.pdf$/i.test(a.name) || /pdf/i.test(a.mime ?? ""))
      .slice(0, 4);
    const fetched: Array<{ name: string; mime: string; base64: string }> = [];
    for (const a of pdfAttachments) {
      const f = await fetchAttachmentAsBase64(admin, a);
      if (f) fetched.push(f);
    }

    const systemPrompt = `Du er en kildebasert materialassistent for MCS (elektro/tavle).

STEG 1 — KLASSIFISER JOBBEN.
Bruk beskrivelse + vedlegg til å sette job_type til ett av:
- tavle_hoystrom: tavlearbeid, hovedtavle, hovedfordeling, samleskinne, inntak, trafo, utkobling av trafo, effektbryter/lastbryter/kompaktbryter, høy ampere (≥ 100A), Schneider NS-serie, ABB Tmax/Emax, 3-polt/4-polt høystrøm
- tavle_standard: vanlig tavle-arbeid uten høystrøm
- service_smajobb: små serviceoppdrag
- installasjon_bygg: kursopplegg/installasjon i bygg
- feilsoking
- dokumentasjon_fdv
- ukjent

Heuristisk gjettet jobbtype basert på nøkkelord: ${heuristicType} (${JOB_TYPE_LABEL[heuristicType]}).
${isTavleJob ? "MERK: Dette er sannsynligvis tavle/høystrøm-jobb." : ""}

STEG 2 — FORSLAG.
Foreslå KUN materiell som er begrunnet i en av disse kildene, i prioritert rekkefølge:
A. "Materialliste"-seksjon i vedlagt PDF.
B. Revisjonsskyer/bobler i tegningene hvis beskrivelsen sier alt i bobler/revisjonsskyer skal utføres.
C. Konkrete krav/produkter nevnt i jobbbeskrivelsen.
D. Småmateriell — KUN hvis small_parts=${useSmallParts} er aktivert.

STRENGE REGLER:

1. ELNR: Aldri finn på el-nummer. Hvis elnr ikke står i kilden: sett elnr=null, confidence ≤ "middels", og skriv i ai_reason at "Elnr må kontrolleres".

2. TAVLE/HØYSTRØM-JOBBER (${isTavleJob ? "GJELDER NÅ" : "gjelder ikke nå"}):
   - Foreslå KUN tavlerelaterte komponenter: effektbryter/lastbryter, automater, jordfeil, måletrafo, terminalblokker/tilkoblingsklemmer for konkret bryter, kabelsko/presskabelsko, kobberforbindelser/samleskinne-tilkobling, berøringsvern/avdekking, merking/skilt, montasjeplate/adapter, dokumentasjon.
   - ABSOLUTT IKKE foreslå: PR-kabel, APK/Letti-klammer, AP9/veggbokser, Wago, standard stikk/bryter, jordingsmuffer, PH-skruer, plugger, strips, isolasjonstape, downlight — MED MINDRE varen STÅR ORDRETT i en materialliste i vedlegg.
   - For Schneider NS-serie (NS800 osv): foreslå tilkoblingsklemmer/terminalsett for konkret bryter, kabelsko, kobberforbindelse mot samleskinne, berøringsvern. Marker confidence="middels" eller "lav" og forklar at eksakt artikkel må verifiseres.

3. GENERELT SMÅMATERIELL: Foreslå aldri generisk småmateriell (PR-kabel, Wago, stikk, skruer, klammer, tape) MED MINDRE small_parts=${useSmallParts} ER TRUE ELLER varen står konkret i vedlegg.

4. KONFIDENS:
   - "høy": kun når elnr + antall finnes konkret i kilden (vedlegg materialliste, produktdatabase).
   - "middels": funksjon/produkt er direkte nevnt i beskrivelse, men elnr ikke verifisert.
   - "lav": antakelse basert på jobbtype.

5. BEGRUNNELSE (ai_reason): Vær spesifikk. Ikke skriv "standard festemateriell for serviceoppdrag". Skriv heller "Jobbbeskrivelsen nevner Schneider NS800 3P 800A" eller "Jobbbeskrivelsen nevner tilkoblingsklemmer på begge sider".

6. AVKLARINGER: Hvis du ikke har nok info til å velge eksakt vare, returner suggestions med lav konfidens + fyll clarifications[] med konkrete spørsmål brukeren bør avklare (montasjetype, tilkoblingsretning, kabeldimensjon, vern/utløserenhet, tavlesystem osv.).

7. KILDEFELT: source_type alltid satt. Bruk "attachment_material_list" + source_file + source_page når raden er hentet fra materialliste-side. component_reference brukes for komponentnavn fra tegning (f.eks. "F1.1").

8. Maks 30 linjer. Norsk på alle tekstfelt. Hvis ingen konkret grunnlag finnes: suggestions=[] og fyll note.`;

    const userText = `Bestillingsinformasjon:
Kunde: ${body.customer ?? "—"}
Adresse: ${body.address ?? "—"}
Beskrivelse:
${body.description ?? "—"}

Ekstra kontekst: ${body.extraContext ?? "—"}
Valgte grunnlag: ${Array.from(basis).join(", ") || "—"}
Småmateriell aktivert: ${useSmallParts ? "ja" : "nei"}
Vedlagte filer: ${fetched.length > 0 ? fetched.map((f) => f.name).join(", ") : "ingen"}

Klassifiser jobben først, så trekk ut materialforslag etter reglene.`;

    const userContent: unknown[] = [{ type: "text", text: userText }];
    for (const f of fetched) {
      userContent.push({
        type: "file",
        file: {
          filename: f.name,
          file_data: `data:${f.mime};base64,${f.base64}`,
        },
      });
    }

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        tools: [SUGGEST_TOOL],
        tool_choice: { type: "function", function: { name: "return_material_suggestions" } },
      }),
    });

    if (aiRes.status === 429) {
      return new Response(JSON.stringify({ error: "AI er overbelastet. Prøv igjen om litt." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiRes.status === 402) {
      return new Response(JSON.stringify({ error: "AI-kreditter er oppbrukt." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("AI gateway error", aiRes.status, t);
      return new Response(JSON.stringify({ error: "AI-feil", detail: t.slice(0, 500) }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ai = await aiRes.json();
    const toolCall = ai?.choices?.[0]?.message?.tool_calls?.[0];
    let parsed: {
      suggestions?: Suggestion[];
      note?: string;
      job_type?: JobType;
      job_type_reason?: string;
      clarifications?: string[];
    } = { suggestions: [] };
    if (toolCall?.function?.arguments) {
      try {
        parsed = JSON.parse(toolCall.function.arguments);
      } catch (e) {
        console.error("tool args parse failed", e);
      }
    }

    const aiJobType = parsed.job_type ?? heuristicType;
    const effectiveTavle =
      aiJobType === "tavle_hoystrom" || aiJobType === "tavle_standard" || isTavleJob;

    let suggestions = (parsed.suggestions ?? []) as Suggestion[];

    // Post-filter
    suggestions = suggestions.filter((s) => {
      if (!s || !s.description || !s.quantity || !s.confidence) return false;
      const grounded =
        s.source_type === "attachment_material_list" ||
        s.source_type === "attachment_revision_cloud" ||
        s.source_type === "attachment_other";
      const mentionedInDescription = mentionedInText(s.description, fullText);

      // Block generic small parts unless small_parts or grounded in attachment / mentioned in desc
      if (isGeneric(s) && !useSmallParts && !grounded && !mentionedInDescription) return false;

      // Extra-strict block for tavle jobs
      if (effectiveTavle && isTavleBlocked(s) && !grounded && !mentionedInDescription) return false;

      // Never allow "høy" confidence without a concrete grounded source
      if (s.confidence === "høy" && !grounded && s.source_type !== "product_database") {
        s.confidence = "middels";
      }

      // Force elnr=null if AI gave one but source isn't grounded/product_database
      if (s.elnr && !grounded && s.source_type !== "product_database") {
        // Keep AI-suggested elnr but add warning to reason
        if (!/kontroller/i.test(s.ai_reason)) {
          s.ai_reason = `${s.ai_reason} Elnr må kontrolleres.`;
        }
      }

      return true;
    });

    suggestions = suggestions.slice(0, 30);

    const note =
      parsed.note ??
      (suggestions.length === 0
        ? "Jeg fant ikke nok konkret grunnlag til å foreslå materiell. Velg vedlegg, legg inn mer beskrivelse eller bruk standardpakke."
        : null);

    return new Response(
      JSON.stringify({
        job_type: aiJobType,
        job_type_label: JOB_TYPE_LABEL[aiJobType] ?? JOB_TYPE_LABEL.ukjent,
        job_type_reason: parsed.job_type_reason ?? null,
        clarifications: parsed.clarifications ?? [],
        suggestions,
        note,
        attachments_used: fetched.map((f) => f.name),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("material-ai-suggest fatal", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
