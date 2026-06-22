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

// Deterministic enforcer for the NS800 + tilkoblingsklemmer special rule.
// Runs after AI to guarantee the rule even if the model normalizes/merges lines.
function enforceNs800Rules(suggestions: Suggestion[], fullText: string): Suggestion[] {
  const t = fullText.toLowerCase();
  const hasNs800 = /\bns\s?800\b|compact\s*ns\s?800/i.test(fullText);
  if (!hasNs800) return suggestions;

  const mentionsKlemmer = /(tilkoblings|koblings)?klemmer|tilkoblingsstykker/i.test(fullText);
  const bothSides = /begge\s+sider|p[aå]\s+begge\s+sider|topp\s+og\s+bunn|oppe\s+og\s+nede/i.test(fullText);
  const is4P = /\b4\s*-?\s*pol(et|t)?\b|\b4P\b/i.test(fullText);
  const poles = is4P ? "4P" : "3P";

  // 1) Full NS800 breaker description — expand any short variant.
  for (const s of suggestions) {
    if (/ns\s?800/i.test(s.description) && /(effektbryter|bryter|compact)/i.test(s.description)) {
      const hasMicro = /micrologic/i.test(s.description) || /micrologic/i.test(fullText);
      const isFast = /\bfast\b|fastmontert|fast\s+front/i.test(s.description) || /\bfast\b|fastmontert|fast\s+front/i.test(fullText);
      s.description = `Schneider Compact NS800N ${poles} ${isFast ? "fast " : ""}effektbryter${hasMicro ? " Micrologic 2.0" : ""}`.replace(/\s+/g, " ").trim();
      s.manufacturer = s.manufacturer ?? "Schneider Electric";
    }
  }

  // 2) Tilkoblingsklemmer — replace generic merged line OR add missing line.
  if (mentionsKlemmer) {
    const expectedDesc = `Tilkoblingsklemmer ${poles} for Schneider Compact NS800`;
    const qty = bothSides ? 2 : 1;
    const reason = bothSides
      ? "Teksten sier tilkoblingsklemmer på begge sider. Tolket som ett sett for topp og ett sett for bunn. Verifiser eksakt Schneider-nummer/elnr mot grossist."
      : "Teksten nevner tilkoblingsklemmer til NS800. Verifiser eksakt Schneider-nummer/elnr mot grossist.";

    // Find any existing line that looks like generic tilkobling/klemmer
    const idx = suggestions.findIndex((s) =>
      /tilkobling|klemme/i.test(s.description) && !/^tilkoblingsklemmer\s+\dP\s+for\s+schneider\s+compact\s+ns800$/i.test(s.description),
    );
    const enforced: Suggestion = {
      elnr: null,
      description: expectedDesc,
      quantity: qty,
      unit: "sett",
      manufacturer: "Schneider Electric",
      confidence: "middels",
      ai_reason: reason,
      source_type: "job_description",
      source_label: "Jobbbeskrivelse",
    };
    if (idx >= 0) {
      suggestions[idx] = { ...suggestions[idx], ...enforced };
    } else {
      suggestions.push(enforced);
    }
  }

  return suggestions;
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

    const systemPrompt = `Du er materiellassistent for MCS Service / MCS Elektrotavler — en erfaren norsk serviceelektriker/tavlemontør som lager forslag til materiell for videre kontroll. Du er IKKE en generell chatbot.

STEG 1 — KLASSIFISER JOBBEN.
Sett job_type til ett av:
- tavle_hoystrom: tavlearbeid, hovedtavle, hovedfordeling, samleskinne, inntak, trafo, effektbryter/lastbryter/kompaktbryter, ≥100A, Schneider NS/NSX/Masterpact, ABB Tmax/Emax/SACE, 3P/4P høystrøm
- tavle_standard, service_smajobb, installasjon_bygg, feilsoking, dokumentasjon_fdv, ukjent

Heuristisk gjettet: ${heuristicType} (${JOB_TYPE_LABEL[heuristicType]}).
${isTavleJob ? "MERK: Sannsynlig tavle/høystrøm-jobb." : ""}

STEG 2 — FORSLAG (kildebasert).
Kilder i prioritert rekkefølge: A) "Materialliste"-seksjon i vedlagt PDF. B) Revisjonsskyer i tegninger. C) Konkrete produkter/krav i jobbbeskrivelse. D) Småmateriell KUN hvis small_parts=${useSmallParts}.

═══ ANTI-NULL-REGEL (VIKTIGST) ═══
Hvis jobbbeskrivelsen inneholder konkrete produktnavn, fabrikat, strømstyrke, kabeltype, vern, bryter, armatur, uttak, tavle eller annet tydelig materiell:
- Du SKAL alltid returnere minst én materiallinje.
- Hvis elnr ikke kan bestemmes: returner linjen med elnr=null/tomt og sikkerhet "middels" eller "lav".
- Returner ALDRI tom liste bare fordi elnr mangler.
- Svar ALDRI "ingen forslag" når jobben inneholder konkrete komponenter, vern, brytere, kabel, tavle, kurs, uttak, armaturer eller montasje.
- Bruk avklaringer aktivt for det som må verifiseres.
- Ikke fyll inn tilfeldig småmateriell bare for å lage en liste.

═══ ELNR-REGEL ═══
Aldri dikt opp el-nummer. Elnr brukes kun når det finnes i godkjent produktbase, grossistdata eller eksplisitt i tekst/vedlegg. Hvis usikker: elnr=null + ai_reason "Elnr må kontrolleres".

═══ TAVLE/HØYSTRØM-REGLER (${isTavleJob ? "AKTIVE NÅ" : "ikke aktive"}) ═══
Når job_type er tavle/høystrøm:
- Foreslå hovedkomponenter eksplisitt nevnt + naturlig tilbehør teksten tydelig krever.
- Typiske linjer: effektbryter/lastbryter/vern, tilkoblingsklemmer, kabelsko/presskabelsko, samleskinneforbindelse/overgang/lask, berøringsvern/deksel, skilleplate/avdekning, DIN-/montasjeskinne (kun hvis relevant), merking/kursmerking/advarselsmerking, festemateriell for tavlemontasje.
- IKKE foreslå vanlig installasjonssmåmateriell: PR-kabel, Wago, AP9, stikk, Letti, APK, tape, klammer, standard servicepakke — MED MINDRE det står ORDRETT i tekst/vedlegg.
- Bruk lav/middels sikkerhet når eksakt type/elnr mangler. Sett elnr=null hvis usikker.
- Legg avklaringer for: kabeldimensjon, poltall (3P/4P), bryteevne, verninnstilling, tilkoblingsretning, plassforhold, tilkobling på samleskinne/inntak/trafo, om MCS skal levere bryteren eller kun tilkoblingsmateriell, behov for berøringsvern.

═══ SPESIALREGEL: SCHNEIDER NS800 ═══
Hvis teksten inneholder "NS800", "NS 800" eller "Compact NS800":
- Foreslå 1 stk effektbryter med full lesbar beskrivelse (ikke forkort): "Schneider Compact NS800N 3P fast effektbryter Micrologic 2.0". Tilpass 3P/4P, N/H, fast/uttrekkbar og Micrologic-variant hvis teksten spesifiserer noe annet. Sett manufacturer="Schneider Electric".
- Hvis teksten nevner tilkoblingsklemmer / koblingsklemmer / tilkoblingsstykker / klemmer SAMMEN MED NS800:
  * Lag en EGEN linje (aldri slått sammen med generisk "tilkoblingsmateriell").
  * Beskrivelse EKSAKT: "Tilkoblingsklemmer 3P for Schneider Compact NS800" (bytt til 4P hvis 4-polt).
  * Enhet="sett", sikkerhet="middels", source_type="job_description".
  * Hvis teksten nevner "begge sider" / "på begge sider" / "topp og bunn" / "oppe og nede": antall=2.
    Ellers antall=1.
  * ai_reason: "Teksten sier tilkoblingsklemmer på begge sider. Tolket som ett sett for topp og ett sett for bunn. Verifiser eksakt Schneider-nummer/elnr mot grossist." (juster siste del hvis ikke "begge sider").
- Ikke gjett elnr med mindre produktbase/grossistdata bekrefter det.

═══ SPESIALREGEL: KABELSKO / PRESSKABELSKO (TAVLE/HØYSTRØM) ═══
Hvis teksten nevner kabeltilkobling, hovedkabel, tilkobling på samleskinne/inntak/trafo og kabeldimensjon, antall kabler per fase eller ledermateriale IKKE er kjent:
- Lag linje: beskrivelse="Presskabelsko/kabelsko til hovedkabler", antall=1, enhet="sett", sikkerhet="lav", source_type="job_description".
- ai_reason: "Antall og type avhenger av kabeldimensjon, ledermateriale og antall kabler per fase. Må avklares før bestilling."
- Ikke sett fast antall eller eksakt type før dette er avklart.

═══ SIKKERHETSNIVÅ ═══
- "høy": elnr eller eksakt produkt er i godkjent produktbase/grossistdata, eller står eksplisitt i tekst/vedlegg.
- "middels": produktet er tydelig beskrevet, men elnr/eksakt variant må bekreftes.
- "lav": materiellet er sannsynlig nødvendig, avhenger av montasjemetode/dimensjon/plassforhold.

═══ AVKLARINGER ═══
Lag korte, praktiske avklaringer for det som påvirker materiell: Skal MCS levere bryteren eller kun tilkobling? Kabeldimensjon og antall kabler per fase? Tilkobling på samleskinne/inntak/trafo? Krav til bryteevne og verninnstilling? 3P/4P? Behov for berøringsvern? Plassforhold i tavle?

═══ ØVRIG ═══
- Småmateriell utenfor tavlejobb: blokkert med mindre small_parts=${useSmallParts} ELLER står konkret i vedlegg.
- ai_reason skal være spesifikk ("Jobbbeskrivelsen nevner Schneider NS800 3P 800A"), ikke generisk.
- KILDEFELT: source_type alltid satt. "attachment_material_list" + source_file/source_page når hentet fra materialliste. component_reference for tegningsreferanse (f.eks. "F1.1").
- Maks 30 linjer. Norsk på alle tekstfelt.
- Returner tom suggestions=[] KUN når beskrivelsen er helt tom eller bare inneholder uspesifikk fyllinformasjon (ikke konkrete komponenter).`;

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

    suggestions = enforceNs800Rules(suggestions, fullText);

    // ─── Produktbase-match (kun for linjer uten elnr) ───
    try {
      let companyId: string | null = null;
      if (body.jobId) {
        const { data } = await admin.from("events").select("company_id").eq("id", body.jobId).maybeSingle();
        companyId = (data as { company_id?: string } | null)?.company_id ?? null;
      }
      if (!companyId && body.orderId) {
        const { data } = await admin
          .from("order_form_submissions")
          .select("company_id")
          .eq("id", body.orderId)
          .maybeSingle();
        companyId = (data as { company_id?: string } | null)?.company_id ?? null;
      }
      if (companyId) {
        const needsLookup = suggestions.some((s) => !s.elnr);
        if (needsLookup) {
          const { data: products } = await admin
            .from("material_products")
            .select("elnr, description, supplier, unit")
            .eq("company_id", companyId)
            .eq("active", true)
            .limit(5000);
          const list = (products ?? []) as Array<{ elnr: string | null; description: string | null; supplier: string | null; unit: string | null }>;
          if (list.length > 0) {
            const tokenize = (s: string) =>
              s
                .toLowerCase()
                .replace(/[^a-z0-9æøå\s]/gi, " ")
                .split(/\s+/)
                .filter((t) => t.length >= 3);
            const productTokens = list.map((p) => ({
              p,
              tokens: new Set(tokenize(`${p.description ?? ""} ${p.supplier ?? ""}`)),
            }));
            for (const s of suggestions) {
              if (s.elnr) continue;
              const sugTokens = tokenize(`${s.description} ${s.manufacturer ?? ""}`);
              if (sugTokens.length === 0) continue;
              let best: { p: typeof list[number]; score: number } | null = null;
              for (const { p, tokens } of productTokens) {
                let score = 0;
                for (const t of sugTokens) if (tokens.has(t)) score++;
                if (score >= 2 && (!best || score > best.score)) best = { p, score };
              }
              if (best && best.p.elnr) {
                s.elnr = best.p.elnr;
                s.source_type = "product_database";
                s.source_label = "Produktdatabase";
                s.confidence = s.confidence === "lav" ? "middels" : s.confidence;
                s.ai_reason = `Matchet mot produktbase: ${best.p.description ?? best.p.elnr}. ${s.ai_reason}`.trim();
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn("product_database match failed", e);
    }

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
