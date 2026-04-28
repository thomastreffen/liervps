// Strømskinne v2 — komplett entreprenørleveranse.
// Utvider v1 med oppheng-materiell, tavletilkobling, kontroll, dokumentasjon,
// småmateriell, rigg, spesialposter og kommersiell justering (buffer/usikkerhet/avrunding).
// Skiller eksplisitt mellom kalkulert pris og tilbudspris (override).

import type {
  CalcContext, CalcResult, CalcLine, NormRow, RateRow,
} from "./types";

function rateOf(rows: RateRow[], key: string, fallback = 0): number {
  return rows.find(r => r.rate_key === key)?.value ?? fallback;
}
function normHours(rows: NormRow[], key: string): number {
  return rows.find(r => r.element_key === key)?.hours ?? 0;
}
function r2(n: number): number { return Math.round(n * 100) / 100; }
function roundTo(value: number, step: number): number {
  if (step <= 0) return value;
  return Math.round(value / step) * step;
}

const SKINNE_ELEMENTS: { qtyKey: string; normKey: string; label: string; unit: string }[] = [
  { qtyKey: "qty_straight_1",  normKey: "straight_1",  label: "Straight 1 m",          unit: "stk" },
  { qtyKey: "qty_straight_2",  normKey: "straight_2",  label: "Straight 2 m",          unit: "stk" },
  { qtyKey: "qty_straight_3",  normKey: "straight_3",  label: "Straight 3 m",          unit: "stk" },
  { qtyKey: "qty_vinkel",      normKey: "vinkel",      label: "Vinkel",                unit: "stk" },
  { qtyKey: "qty_t_element",   normKey: "t_element",   label: "T-element",             unit: "stk" },
  { qtyKey: "qty_term_std",    normKey: "term_std",    label: "Terminal standard",     unit: "stk" },
  { qtyKey: "qty_term_nonstd", normKey: "term_nonstd", label: "Terminal non-standard", unit: "stk" },
  { qtyKey: "qty_skjot",       normKey: "skjot",       label: "Skjøt",                 unit: "stk" },
  { qtyKey: "qty_oppheng",     normKey: "oppheng",     label: "Oppheng — montasje",    unit: "stk" },
];

export function calculateStromskinneV2(ctx: CalcContext): CalcResult {
  const { input, rateTable, normTable } = ctx;
  const rows = rateTable.rows;
  const norms = normTable.rows;

  const costMontor  = rateOf(rows, "cost_montor");
  const salesMontor = rateOf(rows, "sales_montor");
  const costReise   = rateOf(rows, "cost_reise");
  const salesReise  = rateOf(rows, "sales_reise");
  const costRigg    = rateOf(rows, "cost_rigg");
  const salesRigg   = rateOf(rows, "sales_rigg");

  // Materiell-rater (med fornuftige fallback om DB-rader mangler)
  const costOppMat   = rateOf(rows, "cost_oppheng_material", 350);
  const salesOppMat  = rateOf(rows, "sales_oppheng_material", 525);
  const costFesteMat = rateOf(rows, "cost_feste_material", 120);
  const salesFesteMat= rateOf(rows, "sales_feste_material", 180);
  const smaMatMarkup = rateOf(rows, "sales_smamateriell_markup", 1.5);
  const costDok      = rateOf(rows, "cost_dokumentasjon", 750);
  const salesDok     = rateOf(rows, "sales_dokumentasjon", 1250);

  // --- Justeringsfaktor (legges på montørtimer for skinne/oppheng) ---
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
    trang:   { key: "factor_trang",   label: "Trang tilkomst" },
    i_drift: { key: "factor_i_drift", label: "Bygg i drift" },
  };
  if (tilkomstMap[tilkomst]) {
    const v = rateOf(rows, tilkomstMap[tilkomst].key);
    if (v) { appliedFactors.push({ ...tilkomstMap[tilkomst], value: v }); factorSum += v; }
  }

  const risikoPct = Number(input.risiko ?? 0);
  if (risikoPct > 0) {
    appliedFactors.push({ key: "risiko", label: `Risikopåslag ${risikoPct}%`, value: risikoPct / 100 });
    factorSum += risikoPct / 100;
  }

  const factor = 1 + factorSum;

  const lines: CalcLine[] = [];
  let order = 0;

  // --- 1) Skinne + oppheng arbeid (norm-basert) ---
  for (const el of SKINNE_ELEMENTS) {
    const qty = Number(input[el.qtyKey] ?? 0);
    if (!qty) continue;
    const nh = normHours(norms, el.normKey);
    const totalNorm = qty * nh;
    const adj = totalNorm * factor;
    lines.push({
      line_key: el.normKey,
      source_type: "rule",
      source_ref: `norm:${el.normKey}`,
      description: el.label,
      qty,
      unit: el.unit,
      norm_hours: r2(totalNorm),
      adjusted_hours: r2(adj),
      cost_amount: r2(adj * costMontor),
      sales_amount: r2(adj * salesMontor),
      is_internal_only: false,
      metadata: { norm_per_unit: nh },
      sort_order: order++,
    });
  }

  // Vertikalt tillegg
  if (input.vertikal && Number(input.qty_vertikal ?? 0) > 0) {
    const qty = Number(input.qty_vertikal);
    const nh = normHours(norms, "vertikal");
    const totalNorm = qty * nh;
    const adj = totalNorm * factor;
    lines.push({
      line_key: "vertikal",
      source_type: "adjustment",
      source_ref: "norm:vertikal",
      description: "Vertikalt tillegg",
      qty, unit: "stk",
      norm_hours: r2(totalNorm),
      adjusted_hours: r2(adj),
      cost_amount: r2(adj * costMontor),
      sales_amount: r2(adj * salesMontor),
      is_internal_only: false,
      sort_order: order++,
    });
  }

  // --- 2) Oppheng materiell + festemateriell ---
  const opphengQty = Number(input.qty_oppheng ?? 0);
  const svinnPct = Number(input.oppheng_svinn_pct ?? 0);
  const svinnFactor = 1 + (svinnPct / 100);
  if (opphengQty > 0) {
    const opMatPrisInput = Number(input.oppheng_material_pris ?? costOppMat);
    // Salg = input-pris * markup-forhold fra rates (enkelt: bruk salesOppMat-forhold om input matcher cost)
    const opMatRatio = costOppMat > 0 ? salesOppMat / costOppMat : 1.5;
    const opMatCost = opMatPrisInput * opphengQty * svinnFactor;
    const opMatSales = opMatPrisInput * opMatRatio * opphengQty * svinnFactor;
    lines.push({
      line_key: "oppheng_material",
      source_type: "component",
      source_ref: "rate:oppheng_material",
      description: `Oppheng materiell (svinn ${svinnPct}%)`,
      qty: r2(opphengQty * svinnFactor), unit: "stk",
      norm_hours: 0, adjusted_hours: 0,
      cost_amount: r2(opMatCost),
      sales_amount: r2(opMatSales),
      is_internal_only: false,
      sort_order: order++,
    });

    const festeInput = Number(input.feste_material_pris ?? costFesteMat);
    const festeRatio = costFesteMat > 0 ? salesFesteMat / costFesteMat : 1.5;
    const festeCost = festeInput * opphengQty * svinnFactor;
    const festeSales = festeInput * festeRatio * opphengQty * svinnFactor;
    lines.push({
      line_key: "feste_material",
      source_type: "component",
      source_ref: "rate:feste_material",
      description: `Festemateriell oppheng (svinn ${svinnPct}%)`,
      qty: r2(opphengQty * svinnFactor), unit: "stk",
      norm_hours: 0, adjusted_hours: 0,
      cost_amount: r2(festeCost),
      sales_amount: r2(festeSales),
      is_internal_only: false,
      sort_order: order++,
    });
  }

  // --- 3) Entreprenørleveranse: tavletilkobling EL1/EL2, kontroll, dokumentasjon, rigg, småmateriell ---
  const pushHourLine = (key: string, label: string, hours: number, applyFactor: boolean) => {
    if (!hours || hours <= 0) return;
    const adj = applyFactor ? hours * factor : hours;
    lines.push({
      line_key: key,
      source_type: "adjustment",
      description: label,
      qty: hours, unit: "t",
      norm_hours: r2(hours),
      adjusted_hours: r2(adj),
      cost_amount: r2(adj * costMontor),
      sales_amount: r2(adj * salesMontor),
      is_internal_only: false,
      sort_order: order++,
    });
  };

  pushHourLine("tavle_el1", "Tavletilkobling EL1", Number(input.tavletilkobling_el1 ?? 0), true);
  pushHourLine("tavle_el2", "Tavletilkobling EL2", Number(input.tavletilkobling_el2 ?? 0), true);
  pushHourLine("kontroll_moment", "Kontroll og momenttrekking", Number(input.kontroll_moment_timer ?? 0), true);

  // Dokumentasjon/HMS — egen sats
  const dokTimer = Number(input.dokumentasjon_hms_timer ?? 0);
  if (dokTimer > 0) {
    lines.push({
      line_key: "dokumentasjon_hms",
      source_type: "adjustment",
      description: "Dokumentasjon / HMS",
      qty: dokTimer, unit: "t",
      norm_hours: r2(dokTimer), adjusted_hours: r2(dokTimer),
      cost_amount: r2(dokTimer * costDok),
      sales_amount: r2(dokTimer * salesDok),
      is_internal_only: false,
      sort_order: order++,
    });
  }

  // Rigg / oppstart (egen sats riggsats, ikke faktorisert)
  const riggOpp = Number(input.rigg_oppstart_timer ?? 0);
  if (riggOpp > 0) {
    lines.push({
      line_key: "rigg_oppstart",
      source_type: "adjustment",
      description: "Rigg / oppstart",
      qty: riggOpp, unit: "t",
      norm_hours: r2(riggOpp), adjusted_hours: r2(riggOpp),
      cost_amount: r2(riggOpp * costRigg),
      sales_amount: r2(riggOpp * salesRigg),
      is_internal_only: false,
      sort_order: order++,
    });
  }

  // Småmateriell — beløp i kr, salg = markup * kost
  const smaBelop = Number(input.smamateriell_belop ?? 0);
  if (smaBelop > 0) {
    lines.push({
      line_key: "smamateriell",
      source_type: "component",
      description: "Småmateriell",
      qty: 1, unit: "post",
      norm_hours: 0, adjusted_hours: 0,
      cost_amount: r2(smaBelop),
      sales_amount: r2(smaBelop * smaMatMarkup),
      is_internal_only: false,
      sort_order: order++,
    });
  }

  // --- 4) Spesialposter ---
  const overgangQty = Number(input.qty_overgang ?? 0);
  if (overgangQty > 0) {
    // Bruk T-element norm som proxy
    const nh = normHours(norms, "t_element") || 3;
    const adj = overgangQty * nh * factor;
    lines.push({
      line_key: "overgang",
      source_type: "rule",
      description: "Overgangselementer",
      qty: overgangQty, unit: "stk",
      norm_hours: r2(overgangQty * nh), adjusted_hours: r2(adj),
      cost_amount: r2(adj * costMontor),
      sales_amount: r2(adj * salesMontor),
      is_internal_only: false,
      sort_order: order++,
    });
  }
  const spesAvslQty = Number(input.qty_spesialavslutning ?? 0);
  if (spesAvslQty > 0) {
    const nh = normHours(norms, "term_nonstd") || 2.6;
    const adj = spesAvslQty * nh * factor;
    lines.push({
      line_key: "spesialavslutning",
      source_type: "rule",
      description: "Spesialavslutninger",
      qty: spesAvslQty, unit: "stk",
      norm_hours: r2(spesAvslQty * nh), adjusted_hours: r2(adj),
      cost_amount: r2(adj * costMontor),
      sales_amount: r2(adj * salesMontor),
      is_internal_only: false,
      sort_order: order++,
    });
  }
  pushHourLine("spesial_timer", "Spesialtilpasningstimer", Number(input.spesial_timer ?? 0), true);

  // --- 5) Reise (egen sats, ikke faktorisert) ---
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

  // Riggtid montasje (gammelt felt — beholdes for kompatibilitet)
  const riggMont = Number(input.riggtid ?? 0);
  if (riggMont > 0) {
    lines.push({
      line_key: "rigg_montasje",
      source_type: "adjustment",
      description: "Rigg & interntransport (montasje)",
      qty: riggMont, unit: "t",
      norm_hours: r2(riggMont), adjusted_hours: r2(riggMont),
      cost_amount: r2(riggMont * costRigg),
      sales_amount: r2(riggMont * salesRigg),
      is_internal_only: false,
      sort_order: order++,
    });
  }

  // --- 6) Subtotaler før kommersiell justering ---
  let total_norm_hours = r2(lines.reduce((s, l) => s + l.norm_hours, 0));
  let total_adjusted_hours = r2(lines.reduce((s, l) => s + l.adjusted_hours, 0));
  let baseCost = r2(lines.reduce((s, l) => s + l.cost_amount, 0));
  let baseSales = r2(lines.reduce((s, l) => s + l.sales_amount, 0));

  // --- 7) Kommersiell justering (prosjektbuffer + usikkerhet) — kun på salg ---
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

  // --- 8) Tilbudspris-overstyring eller avrunding ---
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

  // --- 9) Endelige totaler ---
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
    // @ts-expect-error — utvidet metadata for v2; ignorert av eksisterende konsumenter
    meta: {
      calculated_sales: baseSales,
      offer_basis,
      offer_price: offer_basis === "override" ? override : total_sales,
    },
  };
}
