// Edge function: calc-ai-analyze
// Analyserer AI-utkast for kalkyler. Henter draft + meldinger + vedlegg,
// bygger en multimodal prompt mot Lovable AI Gateway, og oppdaterer drafts
// med strukturert forslag (systemer + linjer + confidence).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const MODEL = "google/gemini-2.5-pro";

const SYSTEM_PROMPT = `Du er en erfaren norsk elektroingeniør som analyserer underlag for STRØMSKINNE-prosjekter (busbar).
Din oppgave er å hjelpe en kalkulatør med å lage et førsteutkast — IKKE å låse svaret.

KRITISK: Resultatet ditt MÅ kunne brukes direkte til å fylle ut kalkyle-felter. Det holder IKKE å bare beskrive — du MÅ
konkretisere mengder, lengder og strømklasser per system.

ETT UNDERLAG KAN INNEHOLDE FLERE SYSTEMER (f.eks. EL1 og EL2). Returner ett objekt per system i 'systems'.
Hvert system blir én separat kalkyle. Hvis det egentlig er ett system, returner én entry.

For HVERT system MÅ du estimere:
- name: kort identifikator (f.eks. "EL1", "EL2", "Hovedstigeskinne", "Tavlerom 2.etg")
- leverandor: 'schneider' | 'eaton' | 'legrand' (gjett ut fra serienavn hvis ikke spesifisert; Canalis=schneider, xEnergy/SCP/SB=eaton, LB/SCP=legrand)
- serie: kort tekst (f.eks. 'Canalis KT', 'xEnergy XPR', 'SCP')
- ledertype: 'kobber' | 'aluminium' (default kobber hvis ukjent, lav confidence)
- utforelse: 'epoxy' | 'lakkert' | 'ren' (default 'lakkert', lav confidence)
- stromklasse: én av '800','1000','1250','1600','2000','2500','3200','4000','5000','6300'
- total_lengde_m: total horisontal lengde i meter
- qty_oppheng: BEREGN basert på cc-avstand (default cc 2 m → ceil(lengde/2)+1) hvis underlaget sier oppheng skal med
- qty_straight_3: foretrukket; ceil(lengde / 3) hvis ingen annen info, ELLER bruk straight_2 / straight_1 hvis underlaget tilsier kortere modulstørrelser
- qty_vinkel, qty_t_element, qty_term_std, qty_term_nonstd, qty_skjot: kun hvis underlaget eller vanlig praksis tilsier det (skjøter ~ antall straight - 1)
- vertikal: boolean, qty_vertikal: antall vertikale strekk
- arbeidstidstype, tilkomstniva, reisetid (timer t/r), riggtid (timer), risiko (% påslag)
- ENTREPRENØRLEVERANSE (MÅ foreslås — disse driver mesteparten av prisen):
  - tavletilkobling_el1: timer for tilkobling i hovedtavle. Skaler med strømklasse: ≤1600A → 16 t, 2000–2500A → 24 t, 3200–4000A → 40 t, ≥5000A → 60 t. Juster opp ved trang tilkomst.
  - tavletilkobling_el2: kun hvis underlaget viser to tavler / to ender; ellers 0.
  - kontroll_moment_timer: ~0,25 t per skjøt + 4 t for terminaler (min 8 t).
  - dokumentasjon_hms_timer: 12 t lite prosjekt, 16–20 t normalt, 24+ t komplekst.
  - rigg_oppstart_timer: 8 t for korte oppdrag, 16 t normalt, 24 t ved drift / vanskelig tilkomst.
  - smamateriell_belop (kr): 10 000–15 000 normalt, 20 000–40 000 ved store skinner / mange terminaler.
  - prosjektbuffer_pct: 5 % default, 8–10 % når underlaget er ufullstendig.
  - usikkerhet_pct: 5 % default, 10–15 % ved mange åpne spørsmål.

REGLER FOR MENGDER:
- Hvis du har 'total_lengde_m' MÅ du også foreslå konkret antall straight-elementer (qty_straight_1/2/3).
- Default modul = 3 m. qty_straight_3 = Math.ceil(lengde / 3). Sett qty_straight_2 og qty_straight_1 til 0 om ikke nødvendig som "rest".
- Hvis straight_3 ikke gir helt jevn lengde, kompensér med 1 stk straight_2 eller straight_1 (markér med assumption).
- qty_oppheng = Math.ceil(lengde / cc) + 1 (default cc=2 m). Hvis underlaget eksplisitt sier "oppheng skal med", confidence ≥ 70.
- qty_skjot ≈ totalt antall straight-elementer - 1 (lav confidence hvis ikke tegning viser tydelig).

Returner ALLTID via tool-call 'submit_calc_proposal'. Vær ærlig om usikkerhet:
- Bruk confidence 0-100 per felt (0 = bare gjetning, 100 = direkte avlest).
- Skriv klare assumptions og open_questions.
- For entreprenørfelter: bruk confidence 40–60 (estimat) og legg dem ALLTID inn — kalkulatøren bekrefter eller justerer.
- Det er BEDRE å foreslå et estimat med lav confidence enn å la et felt stå tomt.

KRITISK: For HVERT system MÅ 'proposed_input' inneholde MINST 'stromklasse', 'total_lengde_m', 'tavletilkobling_el1', 'kontroll_moment_timer', 'dokumentasjon_hms_timer', 'rigg_oppstart_timer' og 'smamateriell_belop'.
Tomt 'proposed_input' er IKKE akseptabelt. Hvis du er usikker, sett confidence lavt — men FYLL FELTENE.`;

// Konkret skjema med eksplisitte felter — Gemini fyller dette mye mer pålitelig
// enn et abstract additionalProperties-skjema.
const FIELD_VALUE = (valueSchema: any, desc: string) => ({
  type: "object",
  description: desc,
  properties: {
    value: valueSchema,
    confidence: { type: "number", minimum: 0, maximum: 100 },
    reason: { type: "string" },
  },
  required: ["value", "confidence"],
});

const SYSTEM_FIELDS_SCHEMA = {
  type: "object",
  description: "Foreslåtte verdier per kalkyle-felt. Fyll så mange som mulig — minimum stromklasse og total_lengde_m.",
  properties: {
    leverandor: FIELD_VALUE({ type: "string", enum: ["schneider", "eaton", "legrand"] }, "Leverandør"),
    serie: FIELD_VALUE({ type: "string" }, "Produktserie, f.eks. 'Canalis KT'"),
    ledertype: FIELD_VALUE({ type: "string", enum: ["kobber", "aluminium"] }, "Ledermateriale"),
    utforelse: FIELD_VALUE({ type: "string", enum: ["epoxy", "lakkert", "ren"] }, "Overflate / utførelse"),
    stromklasse: FIELD_VALUE(
      { type: "string", enum: ["800", "1000", "1250", "1600", "2000", "2500", "3200", "4000", "5000", "6300"] },
      "Strømklasse i ampere som streng. PÅKREVD per system."
    ),
    total_lengde_m: FIELD_VALUE({ type: "number" }, "Total horisontal lengde i meter. PÅKREVD per system."),
    qty_oppheng: FIELD_VALUE({ type: "number" }, "Antall oppheng (cc 2 m default)"),
    qty_straight_3: FIELD_VALUE({ type: "number" }, "Antall rette 3 m elementer"),
    qty_straight_2: FIELD_VALUE({ type: "number" }, "Antall rette 2 m elementer"),
    qty_straight_1: FIELD_VALUE({ type: "number" }, "Antall rette 1 m elementer"),
    qty_vinkel: FIELD_VALUE({ type: "number" }, "Antall vinkelelementer"),
    qty_t_element: FIELD_VALUE({ type: "number" }, "Antall T-elementer"),
    qty_term_std: FIELD_VALUE({ type: "number" }, "Antall standard endeavslutninger"),
    qty_term_nonstd: FIELD_VALUE({ type: "number" }, "Antall ikke-standard endeavslutninger"),
    qty_skjot: FIELD_VALUE({ type: "number" }, "Antall skjøter"),
    vertikal: FIELD_VALUE({ type: "boolean" }, "Vertikal montasje"),
    qty_vertikal: FIELD_VALUE({ type: "number" }, "Antall vertikale strekk"),
    arbeidstidstype: FIELD_VALUE({ type: "string" }, "Arbeidstidstype"),
    tilkomstniva: FIELD_VALUE({ type: "string" }, "Tilkomst / høyde"),
    reisetid: FIELD_VALUE({ type: "number" }, "Reisetid t/r i timer"),
    riggtid: FIELD_VALUE({ type: "number" }, "Riggtid i timer"),
    risiko: FIELD_VALUE({ type: "number" }, "Risikopåslag i %"),

    // Entreprenørleveranse — MÅ bekreftes før tilbud kan opprettes
    tavletilkobling_el1: FIELD_VALUE({ type: "number" }, "Timer for tilkobling i hovedtavle EL1. Typisk 16–60 t."),
    tavletilkobling_el2: FIELD_VALUE({ type: "number" }, "Timer for tilkobling i sekundærtavle EL2 (0 hvis kun én tavle)."),
    kontroll_moment_timer: FIELD_VALUE({ type: "number" }, "Kontroll og momenttrekking. Tommelfingerregel ~0,25 t/skjøt + 4 t terminaler."),
    dokumentasjon_hms_timer: FIELD_VALUE({ type: "number" }, "FDV-dokumentasjon, sluttkontroll, HMS. Typisk 12–24 t."),
    rigg_oppstart_timer: FIELD_VALUE({ type: "number" }, "Rigg, oppstart, sikring av arbeidssted. Typisk 8–24 t."),
    smamateriell_belop: FIELD_VALUE({ type: "number" }, "Forbruksmateriell, kabelsko, merking, småjern (kr)."),
    prosjektbuffer_pct: FIELD_VALUE({ type: "number" }, "Prosjektbuffer i %. Typisk 3–8 % normalt, 8–15 % komplekst."),
    usikkerhet_pct: FIELD_VALUE({ type: "number" }, "Usikkerhetspåslag i % når underlaget har åpne spørsmål."),
  },
};

const TOOL = {
  type: "function",
  function: {
    name: "submit_calc_proposal",
    description: "Send strukturert kalkyleforslag tilbake. Hvert element i 'systems' = en separat kalkyle.",
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string", description: "Kort oppsummering (2-4 setninger) av hva du har tolket fra underlaget. Nevn antall systemer." },
        assumptions: {
          type: "array", items: { type: "string" },
          description: "Antakelser du har gjort der underlaget er uklart.",
        },
        open_questions: {
          type: "array", items: { type: "string" },
          description: "Spørsmål brukeren bør svare på for å øke kvaliteten.",
        },
        systems: {
          type: "array",
          description: "Ett objekt per system / kalkyle som skal opprettes. Returner alltid minst ett system.",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Kort identifikator (f.eks. 'EL1', 'EL2'). Brukes som tittel på kalkylen." },
              note: { type: "string", description: "Kort beskrivelse av hva systemet dekker." },
              proposed_input: SYSTEM_FIELDS_SCHEMA,
              system_confidence: { type: "number", minimum: 0, maximum: 100 },
            },
            required: ["name", "proposed_input"],
          },
        },
        overall_confidence: { type: "number", minimum: 0, maximum: 100 },
      },
      required: ["summary", "systems", "overall_confidence"],
    },
  },
};

const MAX_INLINE_BYTES = 18 * 1024 * 1024;

async function buildAttachmentParts(
  supabase: ReturnType<typeof createClient>,
  attachments: any[],
): Promise<any[]> {
  const parts: any[] = [];
  for (const att of attachments ?? []) {
    if (!att.path) continue;
    const mime = att.mime_type ?? "application/octet-stream";
    if (!mime.startsWith("image/") && mime !== "application/pdf") {
      console.log("[calc-ai-analyze] skipping unsupported mime", mime);
      continue;
    }
    try {
      const { data, error } = await supabase.storage
        .from(att.bucket ?? "calc-ai-drafts")
        .download(att.path);
      if (error || !data) {
        console.warn("[calc-ai-analyze] download failed", att.path, error?.message);
        continue;
      }
      const buf = new Uint8Array(await data.arrayBuffer());
      if (buf.byteLength > MAX_INLINE_BYTES) {
        console.warn("[calc-ai-analyze] file too large, skipping", att.path, buf.byteLength);
        continue;
      }
      const base64 = encodeBase64(buf);
      parts.push({
        type: "image_url",
        image_url: { url: `data:${mime};base64,${base64}` },
      });
      console.log("[calc-ai-analyze] attached", att.path, mime, buf.byteLength, "bytes");
    } catch (e) {
      console.warn("[calc-ai-analyze] error preparing attachment", att.path, e);
    }
  }
  return parts;
}

// Sørg for at hvert system har auto-beregnede stk-felter når lengde finnes
// men AI har glemt å fylle ut. Aldri overskriv noe AI har satt.
function enrichSystem(sys: any): any {
  const input = { ...(sys?.proposed_input ?? {}) };
  const getNum = (k: string): number | null => {
    const v = input[k]?.value;
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const lengde = getNum("total_lengde_m");
  if (lengde && lengde > 0) {
    const has = (k: string) => input[k]?.value != null && Number(input[k].value) > 0;
    // Straight-3 hvis ingen straight-felter er satt
    if (!has("qty_straight_1") && !has("qty_straight_2") && !has("qty_straight_3")) {
      const qty3 = Math.floor(lengde / 3);
      const rest = lengde - qty3 * 3;
      input.qty_straight_3 = {
        value: qty3,
        confidence: 50,
        reason: `Auto-beregnet: ${lengde} m / 3 m modul = ${qty3} stk`,
      };
      if (rest >= 1.5) {
        input.qty_straight_2 = { value: 1, confidence: 45, reason: `Restlengde ${rest.toFixed(1)} m → 1 stk straight 2 m` };
      } else if (rest > 0) {
        input.qty_straight_1 = { value: 1, confidence: 40, reason: `Restlengde ${rest.toFixed(1)} m → 1 stk straight 1 m` };
      }
    }
    // Oppheng cc 2 m hvis ikke satt
    if (!has("qty_oppheng")) {
      const qO = Math.ceil(lengde / 2) + 1;
      input.qty_oppheng = {
        value: qO,
        confidence: 55,
        reason: `Auto-beregnet ut fra cc 2 m over ${lengde} m → ${qO} stk`,
      };
    }
    // Skjøt ≈ totalt straight - 1
    const totalStraight = (Number(input.qty_straight_1?.value) || 0)
      + (Number(input.qty_straight_2?.value) || 0)
      + (Number(input.qty_straight_3?.value) || 0);
    if (!has("qty_skjot") && totalStraight > 1) {
      input.qty_skjot = {
        value: totalStraight - 1,
        confidence: 45,
        reason: `Auto: ${totalStraight} straight-elementer → ${totalStraight - 1} skjøter`,
      };
    }
  }
  return { ...sys, proposed_input: input };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userResp } = await userClient.auth.getUser();
    if (!userResp?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { draft_id, user_message } = await req.json();
    if (!draft_id) {
      return new Response(JSON.stringify({ error: "draft_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: draft, error: draftErr } = await admin
      .from("calc_ai_drafts")
      .select("*")
      .eq("id", draft_id)
      .maybeSingle();
    if (draftErr || !draft) {
      return new Response(JSON.stringify({ error: "Draft not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (draft.user_id !== userResp.user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await admin.from("calc_ai_drafts")
      .update({ status: "analyzing" }).eq("id", draft_id);

    const { data: history } = await admin
      .from("calc_ai_draft_messages")
      .select("role, content")
      .eq("draft_id", draft_id)
      .order("created_at", { ascending: true });

    if (user_message && typeof user_message === "string" && user_message.trim()) {
      await admin.from("calc_ai_draft_messages").insert({
        draft_id,
        role: "user",
        content: user_message.trim(),
      });
    }

    const attachmentParts = await buildAttachmentParts(admin, draft.attachments ?? []);
    const previousSystems = Array.isArray((draft as any).ai_proposed_lines)
      ? (draft as any).ai_proposed_lines
      : [];
    const baseText = [
      draft.initial_description ? `Bruker-beskrivelse: ${draft.initial_description}` : "",
      user_message ? `Ny instruks fra bruker: ${user_message}` : "",
      previousSystems.length
        ? `Tidligere forslag (skal forbedres ut fra ny info):\n${JSON.stringify(previousSystems, null, 2)}`
        : "",
    ].filter(Boolean).join("\n\n");

    const userContent: any[] = [{ type: "text", text: baseText || "Analyser vedlagt underlag." }];
    userContent.push(...attachmentParts);

    const messages: any[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...(history ?? []).filter(m => m.role !== "system").map(m => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      })),
      { role: "user", content: userContent },
    ];

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "submit_calc_proposal" } },
      }),
    });

    if (!aiResp.ok) {
      const txt = await aiResp.text();
      console.error("AI gateway error", aiResp.status, txt);
      await admin.from("calc_ai_drafts").update({ status: "draft" }).eq("id", draft_id);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit. Prøv igjen om litt." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "AI-kreditt brukt opp. Legg til kreditter i workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("Missing tool call", JSON.stringify(aiJson).slice(0, 500));
      await admin.from("calc_ai_drafts").update({ status: "draft" }).eq("id", draft_id);
      return new Response(JSON.stringify({ error: "AI returned no proposal" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let proposal: any;
    try {
      proposal = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      console.error("Tool args parse failed", e);
      await admin.from("calc_ai_drafts").update({ status: "draft" }).eq("id", draft_id);
      return new Response(JSON.stringify({ error: "AI returned malformed proposal" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const summary = String(proposal.summary ?? "");
    const assumptions = Array.isArray(proposal.assumptions) ? proposal.assumptions : [];
    const openQuestions = Array.isArray(proposal.open_questions) ? proposal.open_questions : [];
    const overall = Number(proposal.overall_confidence ?? 0);
    let systems = Array.isArray(proposal.systems) ? proposal.systems : [];

    // Enrich each system with derived qty fields when AI glemte dem
    systems = systems.map((s: any, i: number) => enrichSystem({
      name: s.name || `System ${i + 1}`,
      note: s.note ?? null,
      proposed_input: s.proposed_input ?? {},
      system_confidence: typeof s.system_confidence === "number" ? s.system_confidence : null,
    }));

    // Bakoverkompatibel: ai_proposed_input = første systems felter
    const firstInput = systems[0]?.proposed_input ?? {};

    await admin.from("calc_ai_drafts").update({
      status: "ready",
      ai_summary: summary,
      ai_assumptions: assumptions,
      ai_open_questions: openQuestions,
      ai_proposed_input: firstInput,
      ai_proposed_lines: systems,
      overall_confidence: overall,
      model_used: MODEL,
    }).eq("id", draft_id);

    const sysSummary = systems.length === 1
      ? summary || "Forslag oppdatert."
      : `${summary}\n\nForeslår ${systems.length} separate kalkyler: ${systems.map((s: any) => s.name).join(", ")}.`;

    await admin.from("calc_ai_draft_messages").insert({
      draft_id,
      role: "assistant",
      content: sysSummary,
      proposal_diff: { systems },
      metadata: {
        overall_confidence: overall,
        assumptions,
        open_questions: openQuestions,
        system_count: systems.length,
      },
    });

    return new Response(JSON.stringify({
      ok: true,
      summary, assumptions, open_questions: openQuestions,
      systems, overall_confidence: overall,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("calc-ai-analyze error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
