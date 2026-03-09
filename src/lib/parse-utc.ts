/**
 * Parse a database timestamp string as UTC.
 * 
 * Supabase/PostgREST may return timestamptz values without timezone suffix
 * (e.g. "2026-03-09T07:30:00" instead of "2026-03-09T07:30:00+00:00").
 * Without a timezone indicator, `new Date()` treats the string as local time,
 * causing a shift equal to the browser's UTC offset.
 * 
 * This helper ensures the string is always interpreted as UTC.
 */
export function parseUtc(val: string): Date {
  if (!val) return new Date(val);
  // Already has timezone info → parse as-is
  if (val.endsWith("Z") || /[+-]\d{2}(:\d{2})?$/.test(val)) {
    return new Date(val);
  }
  // No timezone → append Z to treat as UTC
  return new Date(val + "Z");
}
