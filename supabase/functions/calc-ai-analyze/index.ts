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
  - scope_profile (se under — PÅKREVD; styrer hvor tunge defaults blir)
  - name (kort identifikator: 'EL1', 'Tavle 432.001 + 433.001', 'Hovedstigeskinne')
  - note (1 setning som forklarer hva delkalkylen dekker)
  - proposed_input (felt-spesifikke verdier — se under)
  - system_confidence (0-100)

──────────────────────────────────────────────────
SCOPE-KLASSIFISERING (kritisk — påvirker prisen direkte):

For TAVLEMONTASJE:
  • 'innmontering' (DEFAULT i tvil) — bære inn, oppretting/innfesting, mekanisk montasje, basis oppkobling, merking,
    enkel FDV. Ingen riv-ut, ingen full idriftsettelse, ingen full FDV-pakke.
    Positive signaler som tilsier 'innmontering':
      - underlaget snakker om "inntransport", "heising", "transportskjøt", "moduler", "tavlerom",
        "krevende logistikk", "bære inn", "løfteutstyr", "kran", "jekketralle"
      - kun ny tavle skal monteres (gammel tavle blir ikke nevnt)
      - ingen eksplisitt nevnt idriftsettelse, funksjonstest av hele anlegget eller riv-ut
      - oppkobling kun nevnt i begrenset omfang (innkommende + et fåtall utgående)
  • 'komplett' — full leveranse: riv ut gammel tavle, montere ny, full oppkobling alle utgående,
    funksjonstest, idriftsettelse, full FDV-pakke. Krever klare positive signaler i underlaget.

For STRØMSKINNE:
  • 'kort_tilkobling' (DEFAULT i tvil ved små leveranser) — kort koblingsskinne (typisk ≤10 m) mellom
    tavle og eksisterende anlegg, eller mellom to tavler. Lite materiell, én tilkoblingsende, ingen
    omfattende rigg eller dokumentasjonspakke.
    Positive signaler som tilsier 'kort_tilkobling':
      - lengde ≤ 10 m, ingen vinkler eller bare 1 vinkel
      - kun 1 tilkoblingsende (EL1, ingen EL2)
      - "tilkoblingsskinne", "stigeskinne", "kort skinne", "fra trafo til tavle"
      - ingen lange føringsveier nevnt
  • 'full_leveranse' — komplett skinneanlegg med flere tavler/avgreninger, lange strekk, omfattende
    dokumentasjon, kontroll og rigg. Krever klare signaler om størrelse.

──────────────────────────────────────────────────
STRØMSKINNE (package_slug = 'stromskinne-v2') — proposed_input MÅ inneholde:
  - leverandor: 'schneider' | 'eaton' | 'legrand' (Canalis=schneider, xEnergy/SCP/SB=eaton, LB/SCP=legrand)
  - serie, ledertype (kobber/aluminium), utforelse (epoxy/lakkert/ren)
  - stromklasse: én av '800','1000','1250','1600','2000','2500','3200','4000','5000','6300'
  - total_lengde_m, qty_oppheng, qty_straight_3 (default modul 3 m), qty_straight_2/1, qty_vinkel,
    qty_t_element, qty_term_std, qty_term_nonstd, qty_skjot, vertikal, qty_vertikal
  - arbeidstidstype, tilkomstniva, reisetid, riggtid, risiko
  - ENTREPRENØRLEVERANSE — driver mesteparten av prisen, MEN skalerer med scope_profile:
    KORT TILKOBLING (lite scope):
      • tavletilkobling_el1: 8–12 t (≤1600A: 8 t, 2000–2500A: 10 t, ≥3200A: 12 t)
      • tavletilkobling_el2: 0
      • kontroll_moment_timer: ~4–6 t (min 4 t)
      • dokumentasjon_hms_timer: 4–6 t
      • rigg_oppstart_timer: 3–5 t
      • smamateriell_belop: 5 000–10 000 kr
      • prosjektbuffer_pct: 3 %
      • usikkerhet_pct: 3 % (5–10 % ved åpne spørsmål)
    FULL LEVERANSE:
      • tavletilkobling_el1: 16 t ≤1600A, 24 t 2000–2500A, 40 t 3200–4000A, 60 t ≥5000A
      • tavletilkobling_el2: kun hvis to tavler / to ender
      • kontroll_moment_timer: ~0,25 t per skjøt + 4 t per terminal, min 8 t
      • dokumentasjon_hms_timer: 12–24 t
      • rigg_oppstart_timer: 8–24 t
      • smamateriell_belop: 15 000–40 000 kr
      • prosjektbuffer_pct: 5 %, usikkerhet_pct: 5 % (10–15 % ved åpne spørsmål)

REGLER MENGDER (skinne):
  - qty_straight_3 = Math.ceil(lengde / 3); kompensér rest med 1× straight_2 eller straight_1
  - qty_oppheng = Math.ceil(lengde / 2) + 1
  - qty_skjot ≈ totalt antall straight - 1

──────────────────────────────────────────────────
TAVLEMONTASJE (package_slug = 'tavlemontasje-v1') — proposed_input MÅ inneholde:
  - arbeidstidstype, tilkomstniva, inntransport, loftebehov
  - antall_felt, antall_seksjoner, antall_seksjonsskjoter
  - sammenstilling_pa_stedet, oppretting_innfesting, fundament_sokkel_montering
  - oppkoblingstype, antall_innkommende, antall_utgaende, antall_internkoblinger
  - merking_inkludert, funksjonstest_inkludert, idriftsettelse_inkludert
  - dokumentasjon_hms_inkludert + dokumentasjon_hms_timer
  - reisetid, riggtid, demontering_gammel_tavle
  - prosjektbuffer_pct, usikkerhet_pct, tilbudspris_override (bare hvis oppgitt)

REGLER MENGDER (tavle) skalerer med scope_profile:
  INNMONTERING (lite scope — typisk case):
    • IKKE sett demontering_gammel_tavle / idriftsettelse_inkludert / fundament_sokkel_montering / funksjonstest_inkludert
    • dokumentasjon_hms_timer: 3–5 t
    • antall_utgaende: bare det som faktisk skal kobles av montør (typisk 0 eller få)
    • riggtid: 2–4 t
    • prosjektbuffer_pct: 3 %, usikkerhet_pct: 3 %
    • 'krevende inntransport' i seg selv kan koste 6–10 t mer enn enkel — det dekker logistikkdelen
  KOMPLETT (full leveranse):
    • alle inkludert-flagg på når relevant
    • dokumentasjon_hms_timer: 12–20 t
    • antall_utgaende: alle utgående
    • riggtid: 6–12 t
    • prosjektbuffer_pct: 5 %, usikkerhet_pct: 5 %

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
              scope_profile: {
                type: "string",
                enum: ["innmontering", "komplett", "kort_tilkobling", "full_leveranse"],
                description: "Scope for delkalkylen. Tavle: 'innmontering' (default i tvil) eller 'komplett'. Skinne: 'kort_tilkobling' (default i tvil ved små leveranser) eller 'full_leveranse'. Styrer hvor tunge defaults blir.",
              },
              name: { type: "string", description: "Kort identifikator (f.eks. 'EL1', 'Tavle 432.001 + 433.001'). Brukes som tittel." },
              note: { type: "string", description: "Kort beskrivelse (1 setning) av hva denne delkalkylen dekker." },
              proposed_input: SYSTEM_FIELDS_SCHEMA,
              system_confidence: { type: "number", minimum: 0, maximum: 100 },
            },
            required: ["package_slug", "scope_profile", "name", "proposed_input"],
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
// Aldri overskriv noe AI har satt. Skalerer defaults ut fra scope_profile.
// ───────────────────────────────────────────────────────────────────────────────

/** Auto-detekter scope for strømskinne hvis AI ikke satte det. */
function detectStromskinneScope(input: Record<string, any>, sys: any): "kort_tilkobling" | "full_leveranse" {
  const lengde = Number(input.total_lengde_m?.value) || 0;
  const vinkel = Number(input.qty_vinkel?.value) || 0;
  const el2 = Number(input.tavletilkobling_el2?.value) || 0;
  const text = `${sys?.name ?? ""} ${sys?.note ?? ""}`.toLowerCase();
  const kortSignal = /tilkobling|stigeskinne|kort skinne|fra trafo|trafo til tavle|koblingsskinne/.test(text);
  // Liten lengde + 1 ende + få/ingen vinkler → kort
  if (lengde > 0 && lengde <= 10 && el2 === 0 && vinkel <= 1) return "kort_tilkobling";
  if (kortSignal && lengde <= 12 && el2 === 0) return "kort_tilkobling";
  if (lengde > 0 && lengde > 15) return "full_leveranse";
  // Default ved tvil: kort (jf. kalibreringsanker)
  return "kort_tilkobling";
}

/** Auto-detekter scope for tavlemontasje. */
function detectTavleScope(input: Record<string, any>, sys: any): "innmontering" | "komplett" {
  const text = `${sys?.name ?? ""} ${sys?.note ?? ""}`.toLowerCase();
  const rivut = input.demontering_gammel_tavle?.value === true
    || /riv-?ut|demonter|fjern gammel|skift ut tavle/.test(text);
  const idrift = input.idriftsettelse_inkludert?.value === true
    || /idriftsett|igangkjøring|igangkjor/.test(text);
  const funksjonstest = input.funksjonstest_inkludert?.value === true
    || /funksjonstest hele|sluttkontroll/.test(text);
  const fundament = input.fundament_sokkel_montering?.value === true;
  const utgaende = Number(input.antall_utgaende?.value) || 0;
  if (rivut || idrift || funksjonstest || fundament || utgaende >= 8) return "komplett";
  // Positive innmontering-signaler eller default
  return "innmontering";
}

function enrichStromskinne(sys: any): any {
  const input = { ...(sys?.proposed_input ?? {}) };
  const getNum = (k: string): number | null => {
    const v = input[k]?.value;
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const has = (k: string) => input[k]?.value != null && Number(input[k].value) > 0;

  const scope: "kort_tilkobling" | "full_leveranse" =
    (sys?.scope_profile === "kort_tilkobling" || sys?.scope_profile === "full_leveranse")
      ? sys.scope_profile
      : detectStromskinneScope(input, sys);
  const isKort = scope === "kort_tilkobling";

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
    let t: number;
    if (isKort) {
      // Kort tilkobling: én ende, redusert tid
      if (stromAmp >= 3200) t = 12;
      else if (stromAmp >= 2000) t = 10;
      else t = 8;
    } else {
      if (stromAmp >= 5000) t = 60;
      else if (stromAmp >= 3200) t = 40;
      else if (stromAmp >= 2000) t = 24;
      else if (stromAmp > 0) t = 16;
      else t = 24;
    }
    input.tavletilkobling_el1 = {
      value: t, confidence: 45,
      reason: `Auto (${scope}): ${t} t for tavletilkobling EL1 ut fra strømklasse ${stromAmp || "?"}A.`,
    };
  }
  if (isKort && !has("tavletilkobling_el2") && input.tavletilkobling_el2?.value == null) {
    input.tavletilkobling_el2 = { value: 0, confidence: 60, reason: "Kort tilkobling: kun én tavletilkobling (EL1)." };
  }
  if (!has("kontroll_moment_timer")) {
    const skjot = Number(input.qty_skjot?.value) || 0;
    const term = (Number(input.qty_term_std?.value) || 0) + (Number(input.qty_term_nonstd?.value) || 0);
    const calc = skjot * 0.25 + Math.max(term, 1) * 4;
    const t = isKort
      ? Math.max(4, Math.round(Math.min(calc, 6)))
      : Math.max(8, Math.round(calc));
    input.kontroll_moment_timer = {
      value: t, confidence: 50,
      reason: `Auto (${scope}): ${t} t kontroll/moment.`,
    };
  }
  if (!has("dokumentasjon_hms_timer")) {
    const t = isKort ? 5 : (lengde && lengde > 30 ? 20 : 16);
    input.dokumentasjon_hms_timer = {
      value: t, confidence: 45,
      reason: `Auto (${scope}): ${t} t FDV/HMS.`,
    };
  }
  if (!has("rigg_oppstart_timer")) {
    const t = isKort ? 4 : 12;
    input.rigg_oppstart_timer = {
      value: t, confidence: 45,
      reason: `Auto (${scope}): ${t} t rigg/oppstart.`,
    };
  }
  if (!has("smamateriell_belop")) {
    let belop: number;
    if (isKort) {
      belop = stromAmp >= 3200 ? 10000 : 7000;
    } else {
      belop = 15000;
      if (stromAmp >= 3200) belop = 25000;
      if (stromAmp >= 5000) belop = 40000;
    }
    input.smamateriell_belop = {
      value: belop, confidence: 45,
      reason: `Auto (${scope}): ${belop} kr småmateriell ut fra strømklasse ${stromAmp || "?"}A.`,
    };
  }
  if (!has("prosjektbuffer_pct")) {
    const p = isKort ? 3 : 5;
    input.prosjektbuffer_pct = { value: p, confidence: 50, reason: `Standard ${p} % prosjektbuffer (${scope}).` };
  }
  if (!has("usikkerhet_pct")) {
    const p = isKort ? 3 : 5;
    input.usikkerhet_pct = { value: p, confidence: 50, reason: `Standard ${p} % usikkerhet (${scope}).` };
  }

  return { ...sys, package_slug: "stromskinne-v2", scope_profile: scope, proposed_input: input };
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

  const scope: "innmontering" | "komplett" =
    (sys?.scope_profile === "innmontering" || sys?.scope_profile === "komplett")
      ? sys.scope_profile
      : detectTavleScope(input, sys);
  const isInn = scope === "innmontering";

  if (!has("arbeidstidstype")) set("arbeidstidstype", "dag", 60, "Default dagarbeid.");
  if (!has("tilkomstniva")) set("tilkomstniva", "normal", 45, "Default normal tilkomst.");
  if (!has("inntransport")) set("inntransport", "middels", 50, "Default middels inntransport.");
  if (!has("loftebehov")) set("loftebehov", "jekketralle", 45, "Default jekketralle.");

  const seksjoner = Number(input.antall_seksjoner?.value) || 0;
  if (!has("antall_seksjoner")) set("antall_seksjoner", 1, 40, "Default 1 fordeling.");
  if (!has("antall_felt")) {
    const felt = Math.max(2, (Number(input.antall_seksjoner?.value) || 1) * 2);
    set("antall_felt", felt, 35, `Auto: ${input.antall_seksjoner?.value || 1} seksjon(er) × 2 felt = ${felt}`);
  }
  if (!has("antall_seksjonsskjoter")) {
    const s = Math.max(0, (Number(input.antall_seksjoner?.value) || 1) - 1);
    set("antall_seksjonsskjoter", s, 40, `Auto: ${input.antall_seksjoner?.value || 1} seksjon(er) → ${s} skjøt(er).`);
  }

  if (!has("oppretting_innfesting")) set("oppretting_innfesting", isInn ? "enkel" : "middels", 45, `Default ${isInn ? "enkel" : "middels"} oppretting (${scope}).`);
  if (!has("oppkoblingstype")) set("oppkoblingstype", "middels", 45, "Default middels oppkobling.");

  if (!has("antall_innkommende")) set("antall_innkommende", Math.max(1, seksjoner || 1), 40, "Auto: 1 innkommende per seksjon.");
  // antall_utgaende skal ikke auto-settes for innmontering.
  if (!isInn && !has("antall_utgaende")) {
    const utg = Math.max(4, (Number(input.antall_seksjoner?.value) || 1) * 4);
    set("antall_utgaende", utg, 35, `Auto (komplett): ${utg} utgående kabler.`);
  }

  if (!has("merking_inkludert")) set("merking_inkludert", true, 60, "Default på — merking hører normalt med.");
  if (!has("dokumentasjon_hms_inkludert")) set("dokumentasjon_hms_inkludert", true, 60, "Default på — alltid noe FDV/HMS.");
  if (!has("dokumentasjon_hms_timer")) {
    const t = isInn ? 4 : 14;
    set("dokumentasjon_hms_timer", t, 45, `Auto (${scope}): ${t} t FDV/HMS.`);
  }

  // Komplett-flagg slås bare på når scope = komplett
  if (!isInn) {
    if (input.funksjonstest_inkludert?.value == null) set("funksjonstest_inkludert", true, 55, "Komplett: funksjonstest inkludert.");
    if (input.idriftsettelse_inkludert?.value == null) set("idriftsettelse_inkludert", true, 55, "Komplett: idriftsettelse inkludert.");
  }

  if (!has("reisetid")) set("reisetid", 2, 40, "Auto: 2 t reise t/r.");
  if (!has("riggtid")) {
    const t = isInn ? 3 : 8;
    set("riggtid", t, 40, `Auto (${scope}): ${t} t rigg/oppstart.`);
  }
  if (!has("prosjektbuffer_pct")) {
    const p = isInn ? 3 : 5;
    set("prosjektbuffer_pct", p, 50, `Standard ${p} % prosjektbuffer (${scope}).`);
  }
  if (!has("usikkerhet_pct")) {
    const p = isInn ? 3 : 5;
    set("usikkerhet_pct", p, 50, `Standard ${p} % usikkerhet (${scope}).`);
  }

  return { ...sys, package_slug: "tavlemontasje-v1", scope_profile: scope, proposed_input: input };
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
      scope_profile: s.scope_profile ?? null,
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
