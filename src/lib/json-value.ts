/**
 * Normalize a JS value so it is safe to insert into a JSON / JSONB column
 * via PostgREST (supabase-js).
 *
 * Rules:
 * - undefined → null (caller should usually drop the row instead)
 * - Date → ISO string
 * - File / Blob → null (handled separately as attachments)
 * - string / number / boolean / null → kept as-is
 * - array / object → JSON-roundtripped to strip non-serializable members
 * - anything else → String(value)
 *
 * Never returns `undefined`.
 */
export function normalizeJsonValue(
  value: unknown,
): string | number | boolean | null | object {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isFinite(t) ? value.toISOString() : null;
  }
  // File/Blob check (guarded for non-browser envs like tests)
  if (typeof File !== "undefined" && value instanceof File) return null;
  if (typeof Blob !== "undefined" && value instanceof Blob) return null;

  const t = typeof value;
  if (t === "string" || t === "number" || t === "boolean") {
    if (t === "number" && !Number.isFinite(value as number)) return null;
    return value as string | number | boolean;
  }

  if (Array.isArray(value) || t === "object") {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return String(value);
    }
  }
  return String(value);
}

/**
 * Returns true if the value should be persisted as a form submission value.
 * Filters undefined, null, empty string, and empty arrays.
 */
export function hasSubmissionValue(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string" && value.trim() === "") return false;
  if (Array.isArray(value) && value.length === 0) return false;
  if (typeof File !== "undefined" && value instanceof File) return false;
  return true;
}
