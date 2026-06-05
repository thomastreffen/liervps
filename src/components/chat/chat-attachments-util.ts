// Shared helpers for chat-style attachment rendering.

export interface ChatAttachment {
  id: string;
  file_name: string;
  file_path: string;
  file_size?: number | null;
  mime_type?: string | null;
  message_id?: string | null;
  category?: string | null;
  field_key?: string | null;
  display_name?: string | null;
  original_filename?: string | null;
  description?: string | null;
}

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|heic|heif|bmp|avif|svg)$/i;

export function isImageAttachment(att: { mime_type?: string | null; file_name?: string | null; original_filename?: string | null } | null | undefined): boolean {
  if (!att) return false;
  if (att.mime_type && att.mime_type.startsWith("image/")) return true;
  if (IMAGE_EXT.test(att.file_name || "")) return true;
  return IMAGE_EXT.test(att.original_filename || "");
}

export function isImageFile(file: File): boolean {
  if (file.type && file.type.startsWith("image/")) return true;
  return IMAGE_EXT.test(file.name);
}

export function formatBytes(bytes?: number | null): string {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Visningsnavn: brukerens display_name hvis satt, ellers teknisk filnavn. */
export function attachmentLabel(att: {
  display_name?: string | null;
  file_name?: string | null;
  original_filename?: string | null;
}): string {
  const dn = att.display_name?.trim();
  if (dn) return dn;
  return att.file_name || att.original_filename || "Vedlegg";
}

/** Filendelse inkl. punktum, eller tom streng. */
export function fileExtension(name?: string | null): string {
  if (!name) return "";
  const m = name.match(/\.[a-zA-Z0-9]+$/);
  return m ? m[0] : "";
}

/** Filnavn uten extension – brukes som forhåndsutfylt visningsnavn. */
export function stripExtension(name?: string | null): string {
  if (!name) return "";
  return name.replace(/\.[a-zA-Z0-9]+$/, "");
}

/** Filnavn brukt ved nedlasting. Tar display_name + original extension hvis bruker ikke skrev en. */
export function downloadFilename(att: {
  display_name?: string | null;
  file_name?: string | null;
  original_filename?: string | null;
}): string {
  const label = att.display_name?.trim() || "";
  const source = att.file_name || att.original_filename || "";
  if (!label) return source || "vedlegg";
  if (/\.[a-zA-Z0-9]{2,5}$/.test(label)) return label;
  const ext = fileExtension(source);
  return ext ? `${label}${ext}` : label;
}
