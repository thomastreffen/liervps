// Edge function: calc-ai-analyze
// Analyserer AI-utkast for kalkyler. Henter draft + meldinger + vedlegg,
// bygger en multimodal prompt mot Lovable AI Gateway, og oppdaterer drafts
// med strukturert forslag (systemer + linjer + confidence).
//
// Underlag kan inneholde BÅDE strømskinne og tavlemontasje. AI returnerer ett
// objekt per delkalkyle med eksplisitt 'package_slug' ('stromskinne-v2' eller
// 'tavlemontasje-v1'). Hver delkalkyle blir én separat kalkyle i samme sak.

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

const SYSTEM_PROMPT = `Du er en erfaren norsk elektroingeniør som lager førsteutkast til kalkyler for el-entreprise.
Din oppgave er å hjelpe en kalkulatør — IKKE å låse svaret. Du skal ALLTID konkretisere mengder og timer.

KRITISK: ETT UNDERLAG kan beskrive FLERE separate jobber som må kalkyleres hver for seg.
Vanligste deling i dette firmaet er:

  1) STRØMSKINNE (busbar, Canalis/xEnergy/SCP)  →  package_slug: 'stromskinne-v2'
  2) TAVLEMONTASJE (innmontering av tavler/fordelinger)  →  package_slug: 'tavlemontasje-v1'

Hvis underlaget nevner BÅDE skinne OG tavler (typisk: hovedstrømskinne + ny hovedtavle, eller skinne + 2 stk underfordelinger),
SKAL du returnere TO systemer — ett per package_slug — ikke prøve å presse alt inn i én kalkyle.

Hvert system blir én separat kalkyle. Sett ALLTID 'package_slug' på hvert system.

KALIBRERINGSANKERE (faktiske tilbudspriser fra dette firmaet — bruk som sanity-check):
  • Strømskinne, KORT TILKOBLINGSSKINNE (≤10 m, 1 tilkobling, lite materiell):  ca. kr 55 000 – 65 000  ← TYPISK CASE
  • Strømskinne, FULL LEVERANSE (lange skinneanlegg, flere tavler, store lengder): ca. kr 120 000 – 400 000+
  • Tavlemontasje, INNMONTERING (bære inn, oppretting, basis oppkobling, ingen riv-ut): ca. kr 40 000 – 55 000  ← TYPISK CASE
  • Tavlemontasje, KOMPLETT LEVERANSE (riv-ut + ny tavle + idriftsettelse + full FDV): ca. kr 80 000 – 200 000+

VIKTIG: De FLESTE casene er KORT TILKOBLING / INNMONTERING. Du SKAL aktivt vurdere scope og sette
'scope_profile' på hvert system. Default-tyngde skaleres automatisk ut fra denne.
Ikke pump opp små jobber til full leveranse uten klar kilde i underlaget.

──────────────────────────────────────────────────
PER SYSTEM — felles felter:
  - package_slug ('stromskinne-v2' | 'tavlemontasje-v1')   [PÅKREVD]
  - name (kort identifikator: 'EL1', 'Tavle 432.001 + 433.001', 'Hovedstigeskinne')
  - note (1 setning som forklarer hva delkalkylen dekker)
  - proposed_input (felt-spesifikke verdier — se under)
  - system_confidence (0-100)

──────────────────────────────────────────────────
STRØMSKINNE (package_slug = 'stromskinne-v2') — proposed_input MÅ inneholde:
  - leverandor: 'schneider' | 'eaton' | 'legrand' (Canalis=schneider, xEnergy/SCP/SB=eaton, LB/SCP=legrand)
  - serie, ledertype (kobber/aluminium), utforelse (epoxy/lakkert/ren)
  - stromklasse: én av '800','1000','1250','1600','2000','2500','3200','4000','5000','6300'
  - total_lengde_m, qty_oppheng, qty_straight_3 (default modul 3 m), qty_straight_2/1, qty_vinkel,
    qty_t_element, qty_term_std, qty_term_nonstd, qty_skjot, vertikal, qty_vertikal
  - arbeidstidstype, tilkomstniva, reisetid, riggtid, risiko
  - ENTREPRENØRLEVERANSE (driver mesteparten av prisen — fyll alltid):
    • tavletilkobling_el1 (16 t ≤1600A, 24 t 2000–2500A, 40 t 3200–4000A, 60 t ≥5000A)
    • tavletilkobling_el2 (kun hvis to tavler / to ender; ellers 0)
    • kontroll_moment_timer (~0,25 t per skjøt + 4 t per terminal, min 8 t)
    • dokumentasjon_hms_timer (12–24 t)
    • rigg_oppstart_timer (8–24 t)
    • smamateriell_belop (10 000–40 000 kr, høyere ved store skinner)
    • prosjektbuffer_pct (5 % default)
    • usikkerhet_pct (5 % default, 10–15 % ved åpne spørsmål)

REGLER MENGDER (skinne):
  - qty_straight_3 = Math.ceil(lengde / 3); kompensér rest med 1× straight_2 eller straight_1
  - qty_oppheng = Math.ceil(lengde / 2) + 1
  - qty_skjot ≈ totalt antall straight - 1

──────────────────────────────────────────────────
TAVLEMONTASJE (package_slug = 'tavlemontasje-v1') — proposed_input MÅ inneholde:
  - arbeidstidstype: 'dag' | 'kveld' | 'natt' | 'helg'
  - tilkomstniva: 'normal' | 'hoyde' | 'trang' | 'i_drift'
  - inntransport: 'enkel' | 'middels' | 'krevende'
      (krevende = trange korridorer, mange dører, lang vei fra bil, behov for spesialhåndtering)
  - loftebehov: 'ingen' | 'jekketralle' | 'kran' | 'annet'
  - antall_felt (totalt antall felt i alle tavlene som monteres — typisk 2–4 per fordeling)
  - antall_seksjoner (antall fysiske skap/tavler — 1 stor tavle = 1, to underfordelinger = 2)
  - antall_seksjonsskjoter (skjøter mellom seksjoner — typisk antall_seksjoner - 1, eller 0 om hver tavle står alene)
  - sammenstilling_pa_stedet (true hvis skap leveres delt og må skjøtes på stedet)
  - oppretting_innfesting: 'enkel' | 'middels' | 'krevende'
  - fundament_sokkel_montering (true hvis sokkel skal støpes/monteres som del av leveransen)
  - oppkoblingstype: 'enkel' | 'middels' | 'krevende' (krevende = store kabler, dårlig plass, stiv kabel)
  - antall_innkommende, antall_utgaende, antall_internkoblinger (antall kabler)
  - merking_inkludert, funksjonstest_inkludert, idriftsettelse_inkludert (true/false)
  - dokumentasjon_hms_inkludert + dokumentasjon_hms_timer (typisk 4–8 t for ren innmontering, 12+ t for full leveranse)
  - reisetid (timer t/r), riggtid (timer)
  - demontering_gammel_tavle (true bare hvis underlaget eksplisitt sier riv-ut)
  - prosjektbuffer_pct (5 % default), usikkerhet_pct (5 % default)
  - tilbudspris_override (kun hvis underlaget eksplisitt oppgir avtalt totalpris)

REGLER MENGDER (tavle):
  - REN INNMONTERING (vanlig scope: bære inn, oppretting, mekanisk innfesting, basis oppkobling, merking, dokumentasjon)
    → ikke sett demontering_gammel_tavle, idriftsettelse_inkludert eller fundament_sokkel_montering uten klar kilde
    → dokumentasjon_hms_timer 4–6 t, antall_utgaende kun det som faktisk skal kobles av montør
  - FULL LEVERANSE (riv ut + ny tavle + idrift + full FDV)
    → da slår alle inkludert-flaggene på, dokumentasjon_hms_timer 12–20 t
  - 'krevende inntransport' i seg selv kan koste 6–10 t mer enn enkel; det driver mye av prisforskjellen

──────────────────────────────────────────────────
GENERELT:
  - confidence 0-100 per felt (0 = ren gjetning, 100 = direkte avlest)
  - Skriv klare assumptions og open_questions
  - Det er BEDRE å foreslå et estimat med lav confidence enn å la et felt stå tomt
  - Returner ALLTID via tool-call 'submit_calc_proposal'.

KRITISK: Tomt 'proposed_input' er IKKE akseptabelt. Hvert system MÅ ha minst de feltene listet over for sin pakke.`;

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

// Felter som er gyldige for begge pakker — vi sender ett samlet skjema og lar
// AI fylle de feltene som er relevante for valgt package_slug.
const SYSTEM_FIELDS_SCHEMA = {
  type: "object",
  description: "Foreslåtte verdier per kalkyle-felt. Fyll feltene som er relevante for systemets package_slug.",
  properties: {
    // ── Strømskinne-felter ──
    leverandor: FIELD_VALUE({ type: "string", enum: ["schneider", "eaton", "legrand"] }, "Skinne: Leverandør"),
    serie: FIELD_VALUE({ type: "string" }, "Skinne: Produktserie, f.eks. 'Canalis KT'"),
    ledertype: FIELD_VALUE({ type: "string", enum: ["kobber", "aluminium"] }, "Skinne: Ledermateriale"),
    utforelse: FIELD_VALUE({ type: "string", enum: ["epoxy", "lakkert", "ren"] }, "Skinne: Overflate / utførelse"),
    stromklasse: FIELD_VALUE(
      { type: "string", enum: ["800", "1000", "1250", "1600", "2000", "2500", "3200", "4000", "5000", "6300"] },
      "Skinne: Strømklasse i ampere som streng."
    ),
    total_lengde_m: FIELD_VALUE({ type: "number" }, "Skinne: Total horisontal lengde i meter."),
    qty_oppheng: FIELD_VALUE({ type: "number" }, "Skinne: Antall oppheng (cc 2 m default)"),
    qty_straight_3: FIELD_VALUE({ type: "number" }, "Skinne: Antall rette 3 m elementer"),
    qty_straight_2: FIELD_VALUE({ type: "number" }, "Skinne: Antall rette 2 m elementer"),
    qty_straight_1: FIELD_VALUE({ type: "number" }, "Skinne: Antall rette 1 m elementer"),
    qty_vinkel: FIELD_VALUE({ type: "number" }, "Skinne: Antall vinkelelementer"),
    qty_t_element: FIELD_VALUE({ type: "number" }, "Skinne: Antall T-elementer"),
    qty_term_std: FIELD_VALUE({ type: "number" }, "Skinne: Antall standard endeavslutninger"),
    qty_term_nonstd: FIELD_VALUE({ type: "number" }, "Skinne: Antall ikke-standard endeavslutninger"),
    qty_skjot: FIELD_VALUE({ type: "number" }, "Skinne: Antall skjøter"),
    vertikal: FIELD_VALUE({ type: "boolean" }, "Skinne: Vertikal montasje"),
    qty_vertikal: FIELD_VALUE({ type: "number" }, "Skinne: Antall vertikale strekk"),
    risiko: FIELD_VALUE({ type: "number" }, "Skinne: Risikopåslag i %"),

    // Skinne entreprenør-felter
    tavletilkobling_el1: FIELD_VALUE({ type: "number" }, "Skinne: Timer for tilkobling i hovedtavle EL1. Typisk 16–60 t."),
    tavletilkobling_el2: FIELD_VALUE({ type: "number" }, "Skinne: Timer for tilkobling i sekundærtavle EL2 (0 hvis kun én tavle)."),
    kontroll_moment_timer: FIELD_VALUE({ type: "number" }, "Skinne: Kontroll og momenttrekking. ~0,25 t/skjøt + 4 t terminaler."),

    // ── Tavlemontasje-felter ──
    inntransport: FIELD_VALUE(
      { type: "string", enum: ["enkel", "middels", "krevende"] },
      "Tavle: Inntransport (krevende = trange korridorer, lang vei, spesialhåndtering)",
    ),
    loftebehov: FIELD_VALUE(
      { type: "string", enum: ["ingen", "jekketralle", "kran", "annet"] },
      "Tavle: Behov for løfteutstyr",
    ),
    antall_felt: FIELD_VALUE({ type: "number" }, "Tavle: Totalt antall felt på tvers av tavlene"),
    antall_seksjoner: FIELD_VALUE({ type: "number" }, "Tavle: Antall fysiske tavler/skap (2 fordelinger = 2)"),
    antall_seksjonsskjoter: FIELD_VALUE({ type: "number" }, "Tavle: Antall skjøter mellom seksjoner"),
    sammenstilling_pa_stedet: FIELD_VALUE({ type: "boolean" }, "Tavle: Skap leveres delt og skjøtes på stedet"),
    oppretting_innfesting: FIELD_VALUE(
      { type: "string", enum: ["enkel", "middels", "krevende"] },
      "Tavle: Oppretting og innfesting",
    ),
    fundament_sokkel_montering: FIELD_VALUE({ type: "boolean" }, "Tavle: Fundament/sokkel som del av leveransen"),
    oppkoblingstype: FIELD_VALUE(
      { type: "string", enum: ["enkel", "middels", "krevende"] },
      "Tavle: Oppkoblingstype (krevende = store kabler, dårlig plass)",
    ),
    antall_innkommende: FIELD_VALUE({ type: "number" }, "Tavle: Antall innkommende kabler"),
    antall_utgaende: FIELD_VALUE({ type: "number" }, "Tavle: Antall utgående kabler"),
    antall_internkoblinger: FIELD_VALUE({ type: "number" }, "Tavle: Antall internkoblinger"),
    merking_inkludert: FIELD_VALUE({ type: "boolean" }, "Tavle: Merking inkludert"),
    funksjonstest_inkludert: FIELD_VALUE({ type: "boolean" }, "Tavle: Funksjonstest inkludert"),
    idriftsettelse_inkludert: FIELD_VALUE({ type: "boolean" }, "Tavle: Idriftsettelse inkludert"),
    demontering_gammel_tavle: FIELD_VALUE({ type: "boolean" }, "Tavle: Demontering av gammel tavle"),
    bygg_i_drift_tillegg: FIELD_VALUE({ type: "boolean" }, "Tavle: Bygg i drift (eksplisitt tillegg)"),
    trang_adkomst_tillegg: FIELD_VALUE({ type: "boolean" }, "Tavle: Trang adkomst (eksplisitt tillegg)"),
    tilbudspris_override: FIELD_VALUE({ type: "number" }, "Tavle: Avtalt tilbudspris (kun hvis oppgitt i underlag)"),
    avrunding_step: FIELD_VALUE({ type: "number" }, "Tavle: Avrunding (f.eks. 100)"),

    // ── Felles ──
    arbeidstidstype: FIELD_VALUE({ type: "string", enum: ["dag", "kveld", "natt", "helg"] }, "Arbeidstidstype"),
    tilkomstniva: FIELD_VALUE({ type: "string", enum: ["normal", "hoyde", "trang", "i_drift"] }, "Tilkomst / høyde"),
    reisetid: FIELD_VALUE({ type: "number" }, "Reisetid t/r i timer"),
    riggtid: FIELD_VALUE({ type: "number" }, "Riggtid i timer"),
    dokumentasjon_hms_inkludert: FIELD_VALUE({ type: "boolean" }, "Dokumentasjon/HMS inkludert"),
    dokumentasjon_hms_timer: FIELD_VALUE({ type: "number" }, "FDV/HMS-timer. Typisk 4–8 t innmontering, 12–24 t full leveranse."),
    rigg_oppstart_timer: FIELD_VALUE({ type: "number" }, "Rigg/oppstart-timer (skinne). Typisk 8–24 t."),
    smamateriell_belop: FIELD_VALUE({ type: "number" }, "Småmateriell (kr) — primært strømskinne."),
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
        summary: { type: "string", description: "Kort oppsummering (2-4 setninger). Nevn hvor mange og hvilke delkalkyler du foreslår." },
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
          description: "Ett objekt per delkalkyle som skal opprettes. Sett alltid package_slug.",
          items: {
            type: "object",
            properties: {
              package_slug: {
                type: "string",
                enum: ["stromskinne-v2", "tavlemontasje-v1"],
                description: "Hvilken kalkylepakke denne delkalkylen tilhører.",
              },
              name: { type: "string", description: "Kort identifikator (f.eks. 'EL1', 'Tavle 432.001 + 433.001'). Brukes som tittel." },
              note: { type: "string", description: "Kort beskrivelse (1 setning) av hva denne delkalkylen dekker." },
              proposed_input: SYSTEM_FIELDS_SCHEMA,
              system_confidence: { type: "number", minimum: 0, maximum: 100 },
            },
            required: ["package_slug", "name", "proposed_input"],
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

// ───────────────────────────────────────────────────────────────────────────────
// ENRICHMENT — fyller inn fornuftige defaults når AI har glemt felter.
// Aldri overskriv noe AI har satt.
// ───────────────────────────────────────────────────────────────────────────────

function enrichStromskinne(sys: any): any {
  const input = { ...(sys?.proposed_input ?? {}) };
  const getNum = (k: string): number | null => {
    const v = input[k]?.value;
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const has = (k: string) => input[k]?.value != null && Number(input[k].value) > 0;

  const lengde = getNum("total_lengde_m");
  if (lengde && lengde > 0) {
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
    if (!has("qty_oppheng")) {
      const qO = Math.ceil(lengde / 2) + 1;
      input.qty_oppheng = {
        value: qO, confidence: 55,
        reason: `Auto-beregnet ut fra cc 2 m over ${lengde} m → ${qO} stk`,
      };
    }
    const totalStraight = (Number(input.qty_straight_1?.value) || 0)
      + (Number(input.qty_straight_2?.value) || 0)
      + (Number(input.qty_straight_3?.value) || 0);
    if (!has("qty_skjot") && totalStraight > 1) {
      input.qty_skjot = {
        value: totalStraight - 1, confidence: 45,
        reason: `Auto: ${totalStraight} straight-elementer → ${totalStraight - 1} skjøter`,
      };
    }
  }

  const stromAmp = (() => {
    const v = input.stromklasse?.value;
    const n = v == null ? 0 : Number(v);
    return Number.isFinite(n) ? n : 0;
  })();

  if (!has("tavletilkobling_el1")) {
    let t = 24;
    if (stromAmp >= 5000) t = 60;
    else if (stromAmp >= 3200) t = 40;
    else if (stromAmp >= 2000) t = 24;
    else if (stromAmp > 0) t = 16;
    input.tavletilkobling_el1 = {
      value: t, confidence: 45,
      reason: `Auto-estimert ut fra strømklasse ${stromAmp || "?"}A. Bekreft mot faktisk tavle.`,
    };
  }
  if (!has("kontroll_moment_timer")) {
    const skjot = Number(input.qty_skjot?.value) || 0;
    const term = (Number(input.qty_term_std?.value) || 0) + (Number(input.qty_term_nonstd?.value) || 0);
    const t = Math.max(8, Math.round(skjot * 0.25 + Math.max(term, 1) * 4));
    input.kontroll_moment_timer = {
      value: t, confidence: 50,
      reason: `Auto: ${skjot} skjøter × 0,25 t + ${Math.max(term, 1)} terminal(er) × 4 t = ${t} t`,
    };
  }
  if (!has("dokumentasjon_hms_timer")) {
    const t = lengde && lengde > 30 ? 20 : 16;
    input.dokumentasjon_hms_timer = {
      value: t, confidence: 45,
      reason: `Auto: ${t} t for FDV/HMS basert på prosjektstørrelse.`,
    };
  }
  if (!has("rigg_oppstart_timer")) {
    input.rigg_oppstart_timer = {
      value: 12, confidence: 45,
      reason: "Auto: 12 t for rigg/oppstart. Øk ved drift eller vanskelig tilkomst.",
    };
  }
  if (!has("smamateriell_belop")) {
    let belop = 15000;
    if (stromAmp >= 3200) belop = 25000;
    if (stromAmp >= 5000) belop = 40000;
    input.smamateriell_belop = {
      value: belop, confidence: 45,
      reason: `Auto: ${belop} kr småmateriell ut fra strømklasse ${stromAmp || "?"}A.`,
    };
  }
  if (!has("prosjektbuffer_pct")) {
    input.prosjektbuffer_pct = { value: 5, confidence: 50, reason: "Standard 5 % prosjektbuffer." };
  }
  if (!has("usikkerhet_pct")) {
    input.usikkerhet_pct = { value: 5, confidence: 50, reason: "Standard 5 % usikkerhet — øk hvis åpne spørsmål." };
  }

  return { ...sys, package_slug: "stromskinne-v2", proposed_input: input };
}

function enrichTavle(sys: any): any {
  const input = { ...(sys?.proposed_input ?? {}) };
  const has = (k: string) => {
    const v = input[k]?.value;
    if (v == null || v === "") return false;
    if (typeof v === "boolean") return true;
    const n = Number(v);
    return Number.isFinite(n) ? n > 0 : true;
  };
  const set = (k: string, value: any, confidence: number, reason: string) => {
    input[k] = { value, confidence, reason };
  };

  if (!has("arbeidstidstype")) set("arbeidstidstype", "dag", 60, "Default dagarbeid.");
  if (!has("tilkomstniva")) set("tilkomstniva", "normal", 45, "Default normal tilkomst.");
  if (!has("inntransport")) set("inntransport", "middels", 50, "Default middels inntransport.");
  if (!has("loftebehov")) set("loftebehov", "jekketralle", 45, "Default jekketralle.");

  const seksjoner = Number(input.antall_seksjoner?.value) || 0;
  if (!has("antall_seksjoner")) set("antall_seksjoner", 1, 40, "Default 1 fordeling.");
  if (!has("antall_felt")) {
    // Konservativt: 2 felt per seksjon hvis ukjent.
    const felt = Math.max(2, (Number(input.antall_seksjoner?.value) || 1) * 2);
    set("antall_felt", felt, 35, `Auto: ${input.antall_seksjoner?.value || 1} seksjon(er) × 2 felt = ${felt}`);
  }
  if (!has("antall_seksjonsskjoter")) {
    const s = Math.max(0, (Number(input.antall_seksjoner?.value) || 1) - 1);
    set("antall_seksjonsskjoter", s, 40, `Auto: ${input.antall_seksjoner?.value || 1} seksjon(er) → ${s} skjøt(er).`);
  }

  if (!has("oppretting_innfesting")) set("oppretting_innfesting", "middels", 45, "Default middels oppretting.");
  if (!has("oppkoblingstype")) set("oppkoblingstype", "middels", 45, "Default middels oppkobling.");

  if (!has("antall_innkommende")) set("antall_innkommende", Math.max(1, seksjoner || 1), 40, "Auto: 1 innkommende per seksjon.");
  // Vi setter IKKE antall_utgaende automatisk — det hører hjemme i full leveranse, ikke ren innmontering.

  if (!has("merking_inkludert")) set("merking_inkludert", true, 60, "Default på — merking hører normalt med.");
  if (!has("dokumentasjon_hms_inkludert")) set("dokumentasjon_hms_inkludert", true, 60, "Default på — alltid noe FDV/HMS.");
  if (!has("dokumentasjon_hms_timer")) set("dokumentasjon_hms_timer", 5, 45, "Auto: 5 t FDV/HMS for ren innmontering.");

  if (!has("reisetid")) set("reisetid", 2, 40, "Auto: 2 t reise t/r.");
  if (!has("riggtid")) set("riggtid", 4, 40, "Auto: 4 t rigg/oppstart.");
  if (!has("prosjektbuffer_pct")) set("prosjektbuffer_pct", 5, 50, "Standard 5 % prosjektbuffer.");
  if (!has("usikkerhet_pct")) set("usikkerhet_pct", 5, 50, "Standard 5 % usikkerhet.");

  return { ...sys, package_slug: "tavlemontasje-v1", proposed_input: input };
}

function enrichSystem(sys: any): any {
  // Backwards-compat: hvis package_slug mangler, anta strømskinne (gammel oppførsel).
  const slug = String(sys?.package_slug ?? "stromskinne-v2");
  if (slug === "tavlemontasje-v1") return enrichTavle(sys);
  return enrichStromskinne(sys);
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

    // Hint AI om hvilken pakke brukeren startet fra (men la AI overstyre om underlaget tilsier flere pakker).
    const startPkgSlug: string | null = (() => {
      // Vi har ikke pakke-slug direkte på draft, men startpakke kan tolkes fra previousSystems.
      const first = previousSystems?.[0];
      if (first?.package_slug) return String(first.package_slug);
      return null;
    })();

    const baseText = [
      draft.initial_description ? `Bruker-beskrivelse: ${draft.initial_description}` : "",
      user_message ? `Ny instruks fra bruker: ${user_message}` : "",
      startPkgSlug
        ? `Brukeren startet fra pakke '${startPkgSlug}', men du SKAL splitte i flere systemer hvis underlaget beskriver flere typer arbeid.`
        : "Vurder selv om underlaget beskriver én eller flere typer arbeid (skinne vs tavle).",
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

    // Enrich each system with derived/default fields when AI glemte dem.
    systems = systems.map((s: any, i: number) => enrichSystem({
      package_slug: s.package_slug || "stromskinne-v2",
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
      : `${summary}\n\nForeslår ${systems.length} separate delkalkyler:\n${systems.map((s: any, i: number) => `  ${i + 1}. ${s.name} [${s.package_slug}]`).join("\n")}`;

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
        package_slugs: systems.map((s: any) => s.package_slug),
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
