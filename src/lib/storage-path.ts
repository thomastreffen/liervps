/**
 * Sanitize a filename for use in a Supabase Storage object path.
 *
 * Supabase Storage rejects keys with characters outside its allowed set
 * (notably brackets `[` `]` from iPhone photos like `IMG_4286[1].JPG`).
 * Uploads with rejected characters fail silently if the error isn't checked,
 * leaving orphan DB rows pointing at non-existent objects.
 *
 * Always pass the user's original filename through this helper before
 * concatenating it into a storage path. Keep the original name for display
 * (`file_name` in DB); only the storage path needs sanitization.
 */
export function sanitizeStorageFileName(name: string): string {
  // Normalize unicode, strip diacritics, then replace anything outside a
  // safe ASCII set with `_`. Collapse repeats, trim length.
  const cleaned = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining marks
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[._-]+|[._-]+$/g, "");
  return (cleaned || "file").slice(0, 180);
}
