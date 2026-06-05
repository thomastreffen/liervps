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
}

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|heic|heif|bmp|avif|svg)$/i;

export function isImageAttachment(att: { mime_type?: string | null; file_name?: string | null } | null | undefined): boolean {
  if (!att) return false;
  if (att.mime_type && att.mime_type.startsWith("image/")) return true;
  return IMAGE_EXT.test(att.file_name || "");
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
