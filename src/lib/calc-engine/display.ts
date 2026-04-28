import type { PackageField } from "./types";

/**
 * Returnerer brukervennlig visningsverdi for et felt.
 * - select: bruker option.label hvis tilgjengelig (f.eks. "Schneider" istedenfor "schneider")
 * - boolean: "Ja" / "Nei"
 * - tom/null: "Må bekreftes"
 * - tall: lokalt formatert
 */
export function displayFieldValue(field: PackageField | undefined, value: any): string {
  if (value === null || value === undefined || value === "") return "Må bekreftes";
  if (value === true) return "Ja";
  if (value === false) return "Nei";

  if (field?.field_type === "select" || field?.field_type === "multiselect") {
    const opts = field.options ?? [];
    if (Array.isArray(value)) {
      return value.map(v => opts.find(o => o.value === String(v))?.label ?? prettify(String(v))).join(", ");
    }
    const opt = opts.find(o => o.value === String(value));
    return opt?.label ?? prettify(String(value));
  }

  if (typeof value === "number") {
    return new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 2 }).format(value);
  }

  if (typeof value === "string") {
    // Hvis verdien ser ut som en kode (kun små bokstaver/tall/_/-), gjør penere
    if (/^[a-z0-9_\-]+$/.test(value) && value.length < 30) return prettify(value);
    return value;
  }

  return String(value);
}

function prettify(s: string): string {
  // schneider -> Schneider, eaton -> Eaton, low_voltage -> Low Voltage
  return s
    .replace(/[_\-]+/g, " ")
    .replace(/\b\w/g, ch => ch.toUpperCase());
}

export function isMissingValue(value: any): boolean {
  return value === null || value === undefined || value === "";
}

/**
 * Bygg et ryddig prosjekttittel-forslag basert på systemnavn,
 * leverandør, strømklasse og lengde. Eksempel:
 *   "Strømskinne — EL1 (Schneider 3200A, 49m)"
 */
export function suggestProjectTitle(opts: {
  packageName?: string | null;
  systemName?: string | null;
  initialDescription?: string | null;
  inputs?: Record<string, any>;
  fields?: PackageField[];
}): string {
  const { packageName, systemName, initialDescription, inputs = {}, fields = [] } = opts;
  const fieldMap = new Map(fields.map(f => [f.field_key, f]));

  const parts: string[] = [];
  const lev = displayFieldValue(fieldMap.get("leverandor"), inputs.leverandor);
  const klasse = inputs.stromklasse ? `${inputs.stromklasse}A` : null;
  const lengde = inputs.total_lengde_m ? `${inputs.total_lengde_m}m` : null;

  if (lev && lev !== "Må bekreftes") parts.push(lev);
  if (klasse) parts.push(klasse);
  if (lengde) parts.push(lengde);

  const detail = parts.length ? ` (${parts.join(", ")})` : "";
  const base = systemName?.trim() || (initialDescription ? initialDescription.split(/[.\n]/)[0].slice(0, 40).trim() : packageName ?? "Kalkyle");
  const prefix = packageName && systemName ? `${packageName} — ` : "";
  return `${prefix}${base}${detail}`.slice(0, 100);
}
