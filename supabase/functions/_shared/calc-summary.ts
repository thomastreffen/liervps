// Shared, human-readable formatting of calculator summaries from public leads.
// Never expose raw JSON in internal notes, e-mails or customer-facing text.

const CALC_LABELS: Record<string, string> = {
  estimatedSavings: "Estimert besparelse",
  estimatedSavingsNok: "Estimert besparelse",
  estimatedSavingsKwh: "Estimert besparelse (kWh)",
  savingsLow: "Besparelse (lavt)",
  savingsExpected: "Besparelse (forventet)",
  savingsHigh: "Besparelse (høyt)",
  annualKwh: "Årlig strømforbruk",
  annualConsumptionKwh: "Årlig strømforbruk",
  area: "Areal",
  areaM2: "Oppvarmet areal",
  electricityPrice: "Strømpris",
  pumpType: "Varmepumpetype",
  heatPumpType: "Varmepumpetype",
  coverageSolution: "Dekningsløsning",
  standard: "Boligstandard",
  segment: "Segment",
  paybackYears: "Nedbetalingstid",
  installedPrice: "Installert pris",
};

function labelFor(key: string): string {
  if (CALC_LABELS[key]) return CALC_LABELS[key];
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function formatValue(key: string, value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "number") {
    if (/kwh/i.test(key)) return `${value.toLocaleString("nb-NO")} kWh`;
    if (/area/i.test(key)) return `${value.toLocaleString("nb-NO")} m²`;
    if (/electricityprice/i.test(key)) return `${value.toLocaleString("nb-NO")} kr/kWh`;
    if (/price|savings|kr|nok/i.test(key)) return `kr ${value.toLocaleString("nb-NO")}`;
    if (/years/i.test(key)) return `${value.toLocaleString("nb-NO")} år`;
    return value.toLocaleString("nb-NO");
  }
  if (typeof value === "boolean") return value ? "Ja" : "Nei";
  if (Array.isArray(value)) return value.map(v => (typeof v === "object" ? "" : String(v))).filter(Boolean).join(", ");
  if (typeof value === "object") {
    // Flatten one level instead of dumping JSON
    return Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== null && v !== undefined && v !== "" && typeof v !== "object")
      .map(([k, v]) => `${labelFor(k)}: ${formatValue(k, v)}`)
      .join(", ");
  }
  return String(value);
}

export function calcSummaryRows(summary: unknown): { label: string; value: string }[] {
  if (!summary || typeof summary !== "object") return [];
  return Object.entries(summary as Record<string, unknown>)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => ({ label: labelFor(k), value: formatValue(k, v) }))
    .filter(r => r.value !== "");
}

/** Multi-line, indented block — for notes and context fields. */
export function calcSummaryBlock(summary: unknown, indent = "  "): string {
  return calcSummaryRows(summary).map(r => `${indent}${r.label}: ${r.value}`).join("\n");
}

/** Single-line version — for compact summaries copied to clipboard. */
export function calcSummaryLine(summary: unknown): string {
  return calcSummaryRows(summary).map(r => `${r.label} ${r.value}`).join(", ");
}
