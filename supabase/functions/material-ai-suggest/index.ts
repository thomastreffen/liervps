// AI material suggestion engine — context-driven and source-grounded.
//
// Rules (enforced via system prompt + post-validation):
//   * Prefer "Materialliste" section inside attached PDFs.
//   * Never invent elnr — leave null + lav confidence if not in source.
//   * Never propose generic small parts (PR-kabel, APK, AP9-bokser, Wago,
//     standard stikk, skruer) unless the user explicitly enabled `small_parts`
//     or the item literally exists in an attachment.
//   * Return empty list + note when no concrete grounding exists.

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

const GENERIC_BLACKLIST = [
  /\bpr[-\s]?kabel/i,
  /\bapk\b/i,
  /\bletti\b/i,
  /\bap9\b/i,
  /veggboks/i,
  /\bwago\b/i,
  /standard\s*stikk/i,
  /standard\s*bryter/i,
  /jordingsmuffe/i,
  /\bskruer\b/i,
  /strips/i,
];

function isGeneric(s: Suggestion): boolean {
  const text = `${s.description ?? ""} ${s.ai_reason ?? ""}`;
  return GENERIC_BLACKLIST.some((re) => re.test(text));
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

    // Cap at 8MB to avoid AI gateway limits
    if (bytes.byteLength > 8 * 1024 * 1024) {
      console.warn("attachment too big, skipping", att.name, bytes.byteLength);
      return null;
    }

    // base64
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
      "Return grounded material suggestions extracted strictly from the provided sources. Return an empty list when no concrete grounding exists.",
    parameters: {
      type: "object",
      properties: {
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
      required: ["suggestions"],
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

    // Fetch PDF attachments (limit 4) and serialize to base64 for multimodal input
    const pdfAttachments = attachments
      .filter((a) => /\.pdf$/i.test(a.name) || /pdf/i.test(a.mime ?? ""))
      .slice(0, 4);
    const fetched: Array<{ name: string; mime: string; base64: string }> = [];
    for (const a of pdfAttachments) {
      const f = await fetchAttachmentAsBase64(admin, a);
      if (f) fetched.push(f);
    }

    const systemPrompt = `Du er en kildebasert materialassistent for MCS (elektro/tavle).
Du foreslår KUN materiell du kan begrunne i ett av disse kildene, i prioritert rekkefølge:

A. "Materialliste"-seksjon i vedlagt PDF (komponentnavn, antall, beskrivelse, varedata, el-nummer, produsent).
B. Revisjonsskyer/bobler i tegningene hvis bestillingsbeskrivelsen sier at "alt i bobler/revisjonsskyer skal utføres".
C. Konkrete krav i jobbbeskrivelsen.
D. Eksisterende materiallinjer (kun for å komplettere f.eks. mangelende elnr).
E. Småmateriell — KUN hvis brukeren har valgt det (small_parts=${useSmallParts}).

Strenge regler:
1. Ikke finn på el-nummer. Hvis elnr ikke står i kilden: sett elnr=null, confidence="lav" eller "middels", og skriv i ai_reason at elnr må kontrolleres.
2. Ikke foreslå generelt installasjonsmateriell (PR-kabel, APK/Letti-klammer, AP9/veggbokser, Wago, standard stikk/bryter, jordingsmuffer, skruer, strips) MED MINDRE small_parts=true ELLER varen står konkret i et vedlegg.
3. For tavlejobber: bare tavlerelevante komponenter (vern, automater, jordfeil, måletrafoer, nettanalysator, rekkeklemmer, merking osv.).
4. Hver suggestion må ha source_type. Bruk "attachment_material_list" når raden er hentet fra en materialliste-side, og fyll source_file (filnavn), source_page (sidenummer eller "16 Materialliste"), source_label (kort tittel) og component_reference (komponentnavn i tegning, f.eks. "F1.1").
5. confidence="høy" kun når elnr + antall finnes konkret i kilden.
6. Hvis du ikke har konkret grunnlag: returner suggestions=[] og fyll note="Jeg fant ikke nok konkret grunnlag til å foreslå materiell.".
7. Aldri mer enn 40 linjer.
8. Bruk norsk i alle tekstfelt.`;

    const userText = `Bestillingsinformasjon:
Kunde: ${body.customer ?? "—"}
Adresse: ${body.address ?? "—"}
Beskrivelse: ${body.description ?? "—"}
Ekstra kontekst: ${body.extraContext ?? "—"}

Valgte grunnlag: ${Array.from(basis).join(", ") || "—"}
Småmateriell aktivert: ${useSmallParts ? "ja" : "nei"}

Vedlagte filer: ${fetched.length > 0 ? fetched.map((f) => f.name).join(", ") : "ingen"}

Trekk ut materialforslag etter reglene. Hvis ingen av kildene gir konkret grunnlag, returner tom liste og fyll "note".`;

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
    let parsed: { suggestions?: Suggestion[]; note?: string } = { suggestions: [] };
    if (toolCall?.function?.arguments) {
      try {
        parsed = JSON.parse(toolCall.function.arguments);
      } catch (e) {
        console.error("tool args parse failed", e);
      }
    }

    let suggestions = (parsed.suggestions ?? []) as Suggestion[];

    // Post-filter: drop generic items unless small_parts is on or item has a concrete attachment source
    suggestions = suggestions.filter((s) => {
      if (!s || !s.description || !s.quantity || !s.confidence) return false;
      const grounded =
        s.source_type === "attachment_material_list" ||
        s.source_type === "attachment_revision_cloud" ||
        s.source_type === "attachment_other";
      if (isGeneric(s) && !useSmallParts && !grounded) return false;
      return true;
    });

    suggestions = suggestions.slice(0, 40);

    const note =
      parsed.note ??
      (suggestions.length === 0
        ? "Jeg fant ikke nok konkret grunnlag til å foreslå materiell. Velg vedlegg, legg inn mer beskrivelse eller bruk standardpakke."
        : null);

    return new Response(
      JSON.stringify({
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
