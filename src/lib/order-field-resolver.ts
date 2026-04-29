// Shared helpers for resolving values out of order_form_submission_values + summary jsonb.
// Extracted from OrderConvertPage so the briefing card and other consumers share logic.

export function normalizeFieldText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(normalizeFieldText).filter(Boolean).join(", ");
  if (typeof value === "object") {
    // Common shapes: { value: "..." } or { label: "..." }
    const v = value as Record<string, unknown>;
    if (typeof v.value === "string") return v.value.trim();
    if (typeof v.label === "string") return v.label.trim();
  }
  return "";
}

export function matchesFieldPrefix(fieldKey: string, prefix: string): boolean {
  const k = fieldKey.toLowerCase();
  const p = prefix.toLowerCase();
  return k === p || k.startsWith(`${p}_`);
}

export function uniqueTexts(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((v) => {
    const n = v.trim().toLowerCase();
    if (!n || seen.has(n)) return false;
    seen.add(n);
    return true;
  });
}

export interface ResolvedEntry {
  fieldKey: string;
  value: string;
}

export function buildEntries(values: Array<{ field_key: string; value: unknown }>): ResolvedEntry[] {
  return values
    .map((v) => ({ fieldKey: String(v.field_key ?? ""), value: normalizeFieldText(v.value) }))
    .filter((e) => e.fieldKey && e.value);
}

export function findValuesIn(
  entries: ResolvedEntry[],
  summary: Record<string, unknown> | null | undefined,
  ...prefixes: string[]
): string[] {
  const out: string[] = [];
  for (const prefix of prefixes) {
    for (const e of entries) {
      if (matchesFieldPrefix(e.fieldKey, prefix)) out.push(e.value);
    }
    if (summary) {
      for (const [k, raw] of Object.entries(summary)) {
        if (matchesFieldPrefix(k, prefix)) {
          const v = normalizeFieldText(raw);
          if (v) out.push(v);
        }
      }
    }
  }
  return uniqueTexts(out);
}

export function findValueIn(
  entries: ResolvedEntry[],
  summary: Record<string, unknown> | null | undefined,
  ...prefixes: string[]
): string {
  return findValuesIn(entries, summary, ...prefixes)[0] ?? "";
}
