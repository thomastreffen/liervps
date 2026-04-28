// Hardkodet kalkulator for Strømskinne-pakken (MVP).
// Bygger linjer fra mengder × normtid, justerer med arbeidstidstype og tilkomstnivå,
// og priser med satstabellen. Alt er datadrevet (rates + norms kommer fra DB).

import type {
  CalcContext, CalcResult, CalcLine, NormRow, RateRow,
} from "./types";

function rateOf(rows: RateRow[], key: string): number {
  return rows.find(r => r.rate_key === key)?.value ?? 0;
}

function normHours(rows: NormRow[], key: string): number {
  return rows.find(r => r.element_key === key)?.hours ?? 0;
}

const ELEMENTS: { qtyKey: string; normKey: string; label: string; unit: string }[] = [
  { qtyKey: "qty_straight_1",  normKey: "straight_1",  label: "Straight 1 m",          unit: "stk" },
  { qtyKey: "qty_straight_2",  normKey: "straight_2",  label: "Straight 2 m",          unit: "stk" },
  { qtyKey: "qty_straight_3",  normKey: "straight_3",  label: "Straight 3 m",          unit: "stk" },
  { qtyKey: "qty_vinkel",      normKey: "vinkel",      label: "Vinkel",                unit: "stk" },
  { qtyKey: "qty_t_element",   normKey: "t_element",   label: "T-element",             unit: "stk" },
  { qtyKey: "qty_term_std",    normKey: "term_std",    label: "Terminal standard",     unit: "stk" },
  { qtyKey: "qty_term_nonstd", normKey: "term_nonstd", label: "Terminal non-standard", unit: "stk" },
  { qtyKey: "qty_skjot",       normKey: "skjot",       label: "Skjøt",                 unit: "stk" },
  { qtyKey: "qty_oppheng",     normKey: "oppheng",     label: "Oppheng",               unit: "stk" },
];

export function calculateStromskinne(ctx: CalcContext): CalcResult {
  const { input, rateTable, normTable } = ctx;
  const rows = rateTable.rows;
  const norms = normTable.rows;

  const costRate  = rateOf(rows, "cost_montor");
  const salesRate = rateOf(rows, "sales_montor");
  const costReise  = rateOf(rows, "cost_reise");
  const salesReise = rateOf(rows, "sales_reise");
  const costRigg  = rateOf(rows, "cost_rigg");
  const salesRigg = rateOf(rows, "sales_rigg");

  // --- Bygg justeringsfaktor (legges på montørtimer, ikke reise/rigg) ---
  const appliedFactors: { key: string; label: string; value: number }[] = [];
  let factorSum = 0;

  const arbType = String(input.arbeidstidstype ?? "dag");
  const arbMap: Record<string, { key: string; label: string }> = {
    kveld: { key: "factor_kveld",  label: "Kveldsarbeid" },
    natt:  { key: "factor_natt",   label: "Nattarbeid" },
    helg:  { key: "factor_helg",   label: "Helgearbeid" },
  };
  if (arbMap[arbType]) {
    const v = rateOf(rows, arbMap[arbType].key);
    if (v) { appliedFactors.push({ ...arbMap[arbType], value: v }); factorSum += v; }
  }

  const tilkomst = String(input.tilkomstniva ?? "normal");
  const tilkomstMap: Record<string, { key: string; label: string }> = {
    hoyde:    { key: "factor_hoyde",   label: "Arbeid i høyde" },
    trang:    { key: "factor_trang",   label: "Trang tilkomst" },
    i_drift:  { key: "factor_i_drift", label: "Bygg i drift" },
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

  // --- Bygg linjer ---
  const lines: CalcLine[] = [];
  let order = 0;

  for (const el of ELEMENTS) {
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
      norm_hours: round2(totalNorm),
      adjusted_hours: round2(adj),
      cost_amount: round2(adj * costRate),
      sales_amount: round2(adj * salesRate),
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
      qty,
      unit: "stk",
      norm_hours: round2(totalNorm),
      adjusted_hours: round2(adj),
      cost_amount: round2(adj * costRate),
      sales_amount: round2(adj * salesRate),
      is_internal_only: false,
      sort_order: order++,
    });
  }

  // Reisetid (ikke faktorisert)
  const reise = Number(input.reisetid ?? 0);
  if (reise > 0) {
    lines.push({
      line_key: "reise",
      source_type: "adjustment",
      description: "Reisetid (t/r)",
      qty: reise, unit: "t",
      norm_hours: round2(reise),
      adjusted_hours: round2(reise),
      cost_amount: round2(reise * costReise),
      sales_amount: round2(reise * salesReise),
      is_internal_only: false,
      sort_order: order++,
    });
  }

  // Riggtid (ikke faktorisert)
  const rigg = Number(input.riggtid ?? 0);
  if (rigg > 0) {
    lines.push({
      line_key: "rigg",
      source_type: "adjustment",
      description: "Rigg & interntransport",
      qty: rigg, unit: "t",
      norm_hours: round2(rigg),
      adjusted_hours: round2(rigg),
      cost_amount: round2(rigg * costRigg),
      sales_amount: round2(rigg * salesRigg),
      is_internal_only: false,
      sort_order: order++,
    });
  }

  // --- Totaler ---
  const total_norm_hours = round2(lines.reduce((s, l) => s + l.norm_hours, 0));
  const total_adjusted_hours = round2(lines.reduce((s, l) => s + l.adjusted_hours, 0));
  const total_cost = round2(lines.reduce((s, l) => s + l.cost_amount, 0));
  const total_sales = round2(lines.reduce((s, l) => s + l.sales_amount, 0));
  const margin_amount = round2(total_sales - total_cost);
  const margin_pct = total_sales > 0 ? round2((margin_amount / total_sales) * 100) : 0;

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
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
