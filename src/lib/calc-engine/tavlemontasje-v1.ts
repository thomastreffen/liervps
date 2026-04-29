// Tavlemontasje v1 — manuell kalkylepakke for montasje av tavler.
// Bygger på samme mønster som strømskinne v2: norm-basert arbeid, tilleggsfaktorer,
// reise/rigg, prosjektbuffer/usikkerhet, avrunding og tilbudspris-override.
//
// Generell og fabrikatuavhengig: hovedtavler, underfordelinger, seksjonerte tavler,
// gulvstående og vegghengte. Skalerer på antall felt, seksjoner og kabler.

import type {
  CalcContext, CalcResult, CalcLine, NormRow, RateRow,
} from "./types";

function rateOf(rows: RateRow[], key: string, fallback = 0): number {
  return rows.find(r => r.rate_key === key)?.value ?? fallback;
}
function normHours(rows: NormRow[], key: string, fallback = 0): number {
  return rows.find(r => r.element_key === key)?.hours ?? fallback;
}
function r2(n: number): number { return Math.round(n * 100) / 100; }
function roundTo(value: number, step: number): number {
  if (step <= 0) return value;
  return Math.round(value / step) * step;
}

// Skalafaktor for kompleksitetsvalg
const COMPLEX_FACTOR: Record<string, number> = {
  enkel: 0.8,
  middels: 1.0,
  krevende: 1.4,
};

const TRANSPORT_HOURS: Record<string, number> = {
  enkel: 1,
  middels: 3,
  krevende: 6,
};

const LOFT_HOURS: Record<string, number> = {
  ingen: 0,
  jekketralle: 1.5,
  kran: 4,
  annet: 3,
};

const OPPKOBLING_MIN_PER_KABEL: Record<string, number> = {
  enkel: 12,    // minutter per kabel
  middels: 20,
  krevende: 35,
};

export function calculateTavlemontasjeV1(ctx: CalcContext): CalcResult {
  const { input, rateTable, normTable } = ctx;
  const rows = rateTable.rows;
  const norms = normTable.rows;

  const costMontor  = rateOf(rows, "cost_montor", 650);
  const salesMontor = rateOf(rows, "sales_montor", 1100);
  const costReise   = rateOf(rows, "cost_reise", 600);
  const salesReise  = rateOf(rows, "sales_reise", 950);
  const costRigg    = rateOf(rows, "cost_rigg", 600);
  const salesRigg   = rateOf(rows, "sales_rigg", 950);
  const costDok     = rateOf(rows, "cost_dokumentasjon", 750);
  const salesDok    = rateOf(rows, "sales_dokumentasjon", 1250);

  // --- Justeringsfaktorer (legges på montørtimer for kjernearbeid) ---
  const appliedFactors: { key: string; label: string; value: number }[] = [];
  let factorSum = 0;

  const arbType = String(input.arbeidstidstype ?? "dag");
  const arbMap: Record<string, { key: string; label: string }> = {
    kveld: { key: "factor_kveld", label: "Kveldsarbeid" },
    natt:  { key: "factor_natt",  label: "Nattarbeid" },
    helg:  { key: "factor_helg",  label: "Helgearbeid" },
  };
  if (arbMap[arbType]) {
    const v = rateOf(rows, arbMap[arbType].key);
    if (v) { appliedFactors.push({ ...arbMap[arbType], value: v }); factorSum += v; }
  }

  const tilkomst = String(input.tilkomstniva ?? "normal");
  const tilkomstMap: Record<string, { key: string; label: string }> = {
    hoyde:   { key: "factor_hoyde",   label: "Arbeid i høyde" },
    trang:   { key: "factor_trang",   label: "Trang adkomst" },
    i_drift: { key: "factor_i_drift", label: "Bygg i drift" },
  };
  if (tilkomstMap[tilkomst]) {
    const v = rateOf(rows, tilkomstMap[tilkomst].key);
    if (v) { appliedFactors.push({ ...tilkomstMap[tilkomst], value: v }); factorSum += v; }
  }

  // Bygg-i-drift / trang adkomst som eksplisitte tillegg (ja/nei) i tillegg til tilkomst
  if (input.bygg_i_drift_tillegg) {
    const v = rateOf(rows, "factor_i_drift", 0.15);
    appliedFactors.push({ key: "bygg_i_drift_tillegg", label: "Bygg i drift (tillegg)", value: v });
    factorSum += v;
  }
  if (input.trang_adkomst_tillegg) {
    const v = rateOf(rows, "factor_trang", 0.10);
    appliedFactors.push({ key: "trang_adkomst_tillegg", label: "Trang adkomst (tillegg)", value: v });
    factorSum += v;
  }

  const factor = 1 + factorSum;

  const lines: CalcLine[] = [];
  let order = 0;

  const antallFelt = Math.max(0, Number(input.antall_felt ?? 0));
  const antallSeksjoner = Math.max(0, Number(input.antall_seksjoner ?? 1));
  const antallSkjoter = Math.max(0, Number(input.antall_seksjonsskjoter ?? Math.max(0, antallSeksjoner - 1)));

  const pushHourLine = (key: string, label: string, hours: number, applyFactor: boolean, sourceType: CalcLine["source_type"] = "rule", qty?: number, unit?: string) => {
    if (!hours || hours <= 0) return;
    const adj = applyFactor ? hours * factor : hours;
    lines.push({
      line_key: key,
      source_type: sourceType,
      description: label,
      qty: qty ?? hours,
      unit: unit ?? "t",
      norm_hours: r2(hours),
      adjusted_hours: r2(adj),
      cost_amount: r2(adj * costMontor),
      sales_amount: r2(adj * salesMontor),
      is_internal_only: false,
      sort_order: order++,
    });
  };

  // --- 1) Inntransport ---
  const transportNiva = String(input.inntransport ?? "middels");
  const transportTimer = TRANSPORT_HOURS[transportNiva] ?? 3;
  pushHourLine("inntransport", `Inntransport (${transportNiva})`, transportTimer, true, "rule", 1, "post");

  // --- 2) Løft / håndtering ---
  const loftType = String(input.loftebehov ?? "ingen");
  const loftTimer = LOFT_HOURS[loftType] ?? 0;
  if (loftTimer > 0) {
    pushHourLine("loft_handtering", `Løft / håndtering (${loftType})`, loftTimer, true, "rule", 1, "post");
  }

  // --- 3) Sammenstilling av seksjoner ---
  if (input.sammenstilling_pa_stedet && antallSkjoter > 0) {
    const perSkjot = normHours(norms, "sammenstilling_per_skjot", 2.5);
    const totalNorm = antallSkjoter * perSkjot;
    pushHourLine("sammenstilling", `Sammenstilling seksjoner (${antallSkjoter} skjøt)`, totalNorm, true, "rule", antallSkjoter, "stk");
  }

  // --- 4) Mekanisk montasje (skalerer på antall felt) ---
  const perFelt = normHours(norms, "mek_per_felt", 0.6);
  const mekNorm = antallFelt * perFelt;
  if (mekNorm > 0) {
    pushHourLine("mek_montasje", `Mekanisk montasje (${antallFelt} felt)`, mekNorm, true, "rule", antallFelt, "felt");
  }

  // --- 5) Oppretting / innfesting ---
  const oppretting = String(input.oppretting_innfesting ?? "enkel");
  const opprettingBase = normHours(norms, "oppretting_base", 4);
  const opprettingHours = opprettingBase * (COMPLEX_FACTOR[oppretting] ?? 1);
  pushHourLine("oppretting", `Oppretting / innfesting (${oppretting})`, opprettingHours, true, "rule", 1, "post");

  // --- 6) Fundament / sokkel ---
  if (input.fundament_sokkel_montering) {
    const fundN = normHours(norms, "fundament_sokkel", 5);
    pushHourLine("fundament_sokkel", "Fundament / sokkel montering", fundN, true, "rule", 1, "post");
  }

  // --- 7) Oppkobling innkommende / utgående / intern ---
  const oppkType = String(input.oppkoblingstype ?? "middels");
  const minPerKabel = OPPKOBLING_MIN_PER_KABEL[oppkType] ?? 20;
  const innk = Math.max(0, Number(input.antall_innkommende ?? 0));
  const utg = Math.max(0, Number(input.antall_utgaende ?? 0));
  const intern = Math.max(0, Number(input.antall_internkoblinger ?? 0));

  if (innk > 0) {
    const h = (innk * minPerKabel) / 60;
    pushHourLine("oppkobling_innkommende", `Oppkobling innkommende (${innk} kabler, ${oppkType})`, h, true, "rule", innk, "stk");
  }
  if (utg > 0) {
    const h = (utg * minPerKabel) / 60;
    pushHourLine("oppkobling_utgaende", `Oppkobling utgående (${utg} kabler, ${oppkType})`, h, true, "rule", utg, "stk");
  }
  if (intern > 0) {
    // Internkoblinger normalt raskere
    const h = (intern * Math.max(6, minPerKabel * 0.5)) / 60;
    pushHourLine("oppkobling_intern", `Internkoblinger (${intern} stk)`, h, true, "rule", intern, "stk");
  }

  // --- 8) Merking ---
  if (input.merking_inkludert) {
    const mn = normHours(norms, "merking_base", 2) + (innk + utg + intern) * normHours(norms, "merking_per_kabel", 0.05);
    pushHourLine("merking", "Merking", mn, true, "rule", 1, "post");
  }

  // --- 9) Funksjonstest ---
  if (input.funksjonstest_inkludert) {
    const fn = normHours(norms, "funksjonstest_base", 3) + antallFelt * normHours(norms, "funksjonstest_per_felt", 0.25);
    pushHourLine("funksjonstest", "Funksjonstest", fn, true, "rule", 1, "post");
  }

  // --- 10) Idriftsettelse ---
  if (input.idriftsettelse_inkludert) {
    const idr = normHours(norms, "idriftsettelse_base", 4);
    pushHourLine("idriftsettelse", "Idriftsettelse", idr, true, "rule", 1, "post");
  }

  // --- 11) Dokumentasjon / HMS (egen sats) ---
  if (input.dokumentasjon_hms_inkludert) {
    const dokTimer = Number(input.dokumentasjon_hms_timer ?? normHours(norms, "dokumentasjon_hms_base", 6));
    if (dokTimer > 0) {
      lines.push({
        line_key: "dokumentasjon_hms",
        source_type: "rule",
        description: "Dokumentasjon / HMS",
        qty: dokTimer, unit: "t",
        norm_hours: r2(dokTimer), adjusted_hours: r2(dokTimer),
        cost_amount: r2(dokTimer * costDok),
        sales_amount: r2(dokTimer * salesDok),
        is_internal_only: false,
        sort_order: order++,
      });
    }
  }

  // --- 12) Reise (egen sats, ikke faktorisert) ---
  const reise = Number(input.reisetid ?? 0);
  if (reise > 0) {
    lines.push({
      line_key: "reise",
      source_type: "adjustment",
      description: "Reisetid (t/r)",
      qty: reise, unit: "t",
      norm_hours: r2(reise), adjusted_hours: r2(reise),
      cost_amount: r2(reise * costReise),
      sales_amount: r2(reise * salesReise),
      is_internal_only: false,
      sort_order: order++,
    });
  }

  // --- 13) Rigg / oppstart ---
  const rigg = Number(input.riggtid ?? 0);
  if (rigg > 0) {
    lines.push({
      line_key: "rigg",
      source_type: "adjustment",
      description: "Rigg / oppstart",
      qty: rigg, unit: "t",
      norm_hours: r2(rigg), adjusted_hours: r2(rigg),
      cost_amount: r2(rigg * costRigg),
      sales_amount: r2(rigg * salesRigg),
      is_internal_only: false,
      sort_order: order++,
    });
  }

  // --- 14) Demontering gammel tavle ---
  if (input.demontering_gammel_tavle) {
    const dn = normHours(norms, "demontering_base", 6) + antallFelt * normHours(norms, "demontering_per_felt", 0.25);
    pushHourLine("demontering", "Demontering gammel tavle", dn, true, "rule", 1, "post");
  }

  // --- 15) Subtotaler ---
  let total_norm_hours = r2(lines.reduce((s, l) => s + l.norm_hours, 0));
  let total_adjusted_hours = r2(lines.reduce((s, l) => s + l.adjusted_hours, 0));
  let baseCost = r2(lines.reduce((s, l) => s + l.cost_amount, 0));
  let baseSales = r2(lines.reduce((s, l) => s + l.sales_amount, 0));

  // --- 16) Kommersiell justering (buffer + usikkerhet) ---
  const bufferPct = Number(input.prosjektbuffer_pct ?? 0);
  const usikPct = Number(input.usikkerhet_pct ?? 0);
  const kommersiellPct = bufferPct + usikPct;
  if (kommersiellPct > 0) {
    const tillegg = baseSales * (kommersiellPct / 100);
    lines.push({
      line_key: "kommersiell_paslag",
      source_type: "adjustment",
      description: `Prosjektbuffer ${bufferPct}% + usikkerhet ${usikPct}% = ${kommersiellPct}%`,
      qty: 1, unit: "post",
      norm_hours: 0, adjusted_hours: 0,
      cost_amount: 0,
      sales_amount: r2(tillegg),
      is_internal_only: false,
      sort_order: order++,
      metadata: { buffer_pct: bufferPct, usikkerhet_pct: usikPct },
    });
    baseSales = r2(baseSales + tillegg);
  }

  // --- 17) Tilbudspris-override eller avrunding ---
  const override = Number(input.tilbudspris_override ?? 0);
  const avrundingStep = Number(input.avrunding_step ?? 0);
  let final_sales = baseSales;
  let offer_basis: "calculated" | "rounded" | "override" = "calculated";

  if (override > 0) {
    const diff = r2(override - baseSales);
    if (Math.abs(diff) > 0.5) {
      lines.push({
        line_key: "tilbud_override",
        source_type: "manual",
        description: `Tilbudsprisjustering (kalkulert ${baseSales.toLocaleString("nb-NO")} → tilbud ${override.toLocaleString("nb-NO")})`,
        qty: 1, unit: "post",
        norm_hours: 0, adjusted_hours: 0,
        cost_amount: 0,
        sales_amount: diff,
        is_internal_only: false,
        sort_order: order++,
        metadata: { calculated_sales: baseSales, offer_price: override },
      });
    }
    final_sales = override;
    offer_basis = "override";
  } else if (avrundingStep > 0) {
    const rounded = roundTo(baseSales, avrundingStep);
    const diff = r2(rounded - baseSales);
    if (Math.abs(diff) > 0.5) {
      lines.push({
        line_key: "avrunding",
        source_type: "adjustment",
        description: `Avrunding til nærmeste ${avrundingStep.toLocaleString("nb-NO")}`,
        qty: 1, unit: "post",
        norm_hours: 0, adjusted_hours: 0,
        cost_amount: 0,
        sales_amount: diff,
        is_internal_only: false,
        sort_order: order++,
      });
    }
    final_sales = rounded;
    offer_basis = "rounded";
  }

  const total_cost = baseCost;
  const total_sales = r2(final_sales);
  const margin_amount = r2(total_sales - total_cost);
  const margin_pct = total_sales > 0 ? r2((margin_amount / total_sales) * 100) : 0;

  return {
    lines,
    totals: {
      total_norm_hours,
      total_adjusted_hours,
      total_cost,
      total_sales,
      margin_amount,
      margin_pct,
      applied_factors: appliedFactors,
    },
    // @ts-expect-error — utvidet metadata
    meta: {
      calculated_sales: baseSales,
      offer_basis,
      offer_price: offer_basis === "override" ? override : total_sales,
    },
  };
}
