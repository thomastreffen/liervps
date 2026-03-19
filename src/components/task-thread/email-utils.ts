import type { TaskMessageAttachment } from "@/hooks/useTaskThread";

/* ── Attachment Filtering ── */

const IGNORED_FILENAME_PREFIXES = ["outlook-", "image00", "image_"];
const SIGNATURE_CONTENT_IDS = ["image001", "image002", "image003"];
const MIN_RELEVANT_SIZE = 10 * 1024; // 10 KB

export interface FilteredAttachments {
  images: TaskMessageAttachment[];
  files: TaskMessageAttachment[];
  filteredCount: number;
}

export function filterAttachments(attachments: TaskMessageAttachment[]): FilteredAttachments {
  const images: TaskMessageAttachment[] = [];
  const files: TaskMessageAttachment[] = [];
  let filteredCount = 0;

  for (const att of attachments) {
    if (shouldFilterAttachment(att)) {
      filteredCount++;
      continue;
    }

    const isImage = att.mime_type?.startsWith("image/") ?? false;
    if (isImage) {
      images.push(att);
    } else {
      files.push(att);
    }
  }

  return { images, files, filteredCount };
}

function shouldFilterAttachment(att: TaskMessageAttachment): boolean {
  const name = (att.file_name || "").toLowerCase();

  // Filter by filename prefix (Outlook signature images)
  if (IGNORED_FILENAME_PREFIXES.some((p) => name.startsWith(p))) return true;

  // Filter tiny inline images (< 10KB, likely signature/decorative)
  const isImage = att.mime_type?.startsWith("image/") ?? false;
  if (isImage && att.file_size != null && att.file_size < MIN_RELEVANT_SIZE) return true;

  return false;
}

/* ── Email Body Cleanup ── */

const REPLY_SEPARATORS = [
  /^-{2,}\s*Original Message\s*-{2,}/im,
  /^_{2,}\s*$/m,
  /^Fra:\s/im,
  /^From:\s/im,
  /^Sendt:\s/im,
  /^Sent:\s/im,
  /^On .+ wrote:$/im,
  /^Den .+ skrev .+:$/im,
  /^>+\s/m,
  /^_{3,}$/m,
];

export function cleanEmailBody(raw: string | null): { cleaned: string; hasMore: boolean } {
  if (!raw) return { cleaned: "", hasMore: false };

  let text = raw;

  // Find earliest reply separator
  let cutIndex = text.length;
  for (const sep of REPLY_SEPARATORS) {
    const match = sep.exec(text);
    if (match && match.index < cutIndex) {
      cutIndex = match.index;
    }
  }

  const cleaned = text.slice(0, cutIndex).trim();
  const hasMore = cutIndex < text.length;

  return { cleaned, hasMore };
}
