import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Download, ImageOff, X, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type ChatAttachment,
  isImageAttachment,
  formatBytes,
  attachmentLabel,
} from "./chat-attachments-util";

export type AttachmentUrlResolver = (att: ChatAttachment) => Promise<string | null>;

interface ChatMediaGridProps {
  attachments: ChatAttachment[];
  bucket: string;
  /** Called with the global index in the `attachments` array of the clicked image. */
  onPreview?: (att: ChatAttachment, indexInImages: number, images: ChatAttachment[]) => void;
  /** Constrain bubble width; defaults to true. */
  compact?: boolean;
  /** Override how signed URLs are obtained (e.g. tracking-token edge function). */
  urlResolver?: AttachmentUrlResolver;
  /** Show a remove (X) affordance on each attachment. */
  canDelete?: boolean;
  /** Called when the user confirms removing an attachment. */
  onDelete?: (att: ChatAttachment) => void;
  /** Show a rename (pencil) affordance on each attachment. */
  canRename?: boolean;
  /** Called when the user clicks the rename affordance. */
  onRename?: (att: ChatAttachment) => void;
}

/**
 * Renders chat attachments inside a message bubble:
 *  - Images as thumbnail grid (1 large / 2-4 grid / 4+ with +N overlay)
 *  - Non-images as compact file chips with download
 */
export function ChatMediaGrid({
  attachments,
  bucket,
  onPreview,
  compact = true,
  urlResolver,
  canDelete,
  onDelete,
  canRename,
  onRename,
}: ChatMediaGridProps) {
  if (!attachments || attachments.length === 0) return null;

  const images = attachments.filter(isImageAttachment);
  const files = attachments.filter((a) => !isImageAttachment(a));

  return (
    <div className="mt-2 space-y-2">
      {images.length > 0 && (
        <ImageGrid
          images={images}
          bucket={bucket}
          onPreview={onPreview}
          compact={compact}
          urlResolver={urlResolver}
          canDelete={canDelete}
          onDelete={onDelete}
          canRename={canRename}
          onRename={onRename}
        />
      )}
      {files.length > 0 && (
        <div className="space-y-1.5">
          {files.map((f) => (
            <FileChip
              key={f.id}
              attachment={f}
              bucket={bucket}
              urlResolver={urlResolver}
              canDelete={canDelete}
              onDelete={onDelete}
              canRename={canRename}
              onRename={onRename}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ImageGrid({
  images,
  bucket,
  onPreview,
  compact,
  urlResolver,
  canDelete,
  onDelete,
  canRename,
  onRename,
}: {
  images: ChatAttachment[];
  bucket: string;
  onPreview?: ChatMediaGridProps["onPreview"];
  compact: boolean;
  urlResolver?: AttachmentUrlResolver;
  canDelete?: boolean;
  onDelete?: (att: ChatAttachment) => void;
  canRename?: boolean;
  onRename?: (att: ChatAttachment) => void;
}) {
  const visible = images.slice(0, 4);
  const overflow = images.length - visible.length;

  const layout =
    visible.length === 1
      ? "grid-cols-1"
      : visible.length === 2
      ? "grid-cols-2"
      : visible.length === 3
      ? "grid-cols-3"
      : "grid-cols-2";

  return (
    <div
      className={cn(
        "grid gap-1.5",
        layout,
        compact && (visible.length === 1 ? "max-w-[280px]" : "max-w-[320px]")
      )}
    >
      {visible.map((img, idx) => {
        const label = attachmentLabel(img);
        const originalName = img.original_filename || img.file_name;
        const showOriginal = !!img.display_name && originalName && originalName !== label;
        const tooltip = showOriginal ? `${label}\nOriginalfil: ${originalName}` : label;
        return (
          <div
            key={img.id}
            className={cn(
              "relative overflow-hidden rounded-xl bg-muted/60 border border-border/40 group",
              visible.length === 1 ? "aspect-[4/3]" : "aspect-square"
            )}
          >
            <button
              type="button"
              onClick={() => onPreview?.(img, idx, images)}
              className="w-full h-full cursor-pointer block"
              title={tooltip}
            >
              <SignedImage
                attachment={img}
                bucket={bucket}
                alt={label}
                urlResolver={urlResolver}
              />
              {idx === visible.length - 1 && overflow > 0 && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-lg font-bold">
                  +{overflow}
                </div>
              )}
            </button>
            {/* Caption with display name */}
            <div className="absolute bottom-0 inset-x-0 px-2 py-1 text-[10px] text-white bg-gradient-to-t from-black/70 to-transparent truncate pointer-events-none">
              {label}
            </div>
            <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {canRename && onRename && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRename(img);
                  }}
                  aria-label={`Endre navn på ${label}`}
                  className="h-6 w-6 rounded-full bg-black/70 hover:bg-primary text-white flex items-center justify-center cursor-pointer"
                  title="Endre navn"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              )}
              {canDelete && onDelete && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(img);
                  }}
                  aria-label={`Fjern ${label}`}
                  className="h-6 w-6 rounded-full bg-black/70 hover:bg-destructive text-white flex items-center justify-center cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Local in-memory cache to avoid re-signing on re-render
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

function cacheKey(bucket: string, path: string) {
  return `${bucket}::${path}`;
}

export async function getSignedUrl(bucket: string, path: string, expiresIn = 3600): Promise<string | null> {
  const key = cacheKey(bucket, path);
  const cached = signedUrlCache.get(key);
  const now = Date.now();
  if (cached && cached.expiresAt > now + 60_000) return cached.url;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) return null;
  signedUrlCache.set(key, { url: data.signedUrl, expiresAt: now + expiresIn * 1000 });
  return data.signedUrl;
}

async function resolveAttachmentUrl(
  att: ChatAttachment,
  bucket: string,
  resolver?: AttachmentUrlResolver,
): Promise<string | null> {
  if (resolver) {
    const key = `resolver::${att.id}`;
    const cached = signedUrlCache.get(key);
    const now = Date.now();
    if (cached && cached.expiresAt > now + 60_000) return cached.url;
    const url = await resolver(att);
    if (url) signedUrlCache.set(key, { url, expiresAt: now + 9 * 60_000 });
    return url;
  }
  return getSignedUrl(bucket, att.file_path);
}

function SignedImage({
  attachment,
  bucket,
  alt,
  urlResolver,
}: {
  attachment: ChatAttachment;
  bucket: string;
  alt: string;
  urlResolver?: AttachmentUrlResolver;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!attachment.file_path && !urlResolver) return;
    setErr(false);
    setUrl(null);
    resolveAttachmentUrl(attachment, bucket, urlResolver)
      .then((u) => {
        if (cancelled) return;
        if (!u) setErr(true);
        else setUrl(u);
      })
      .catch(() => {
        if (!cancelled) setErr(true);
      });
    return () => {
      cancelled = true;
    };
  }, [attachment, bucket, urlResolver]);

  if (err) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full text-muted-foreground gap-1">
        <ImageOff className="h-5 w-5" />
        <span className="text-[10px]">Kunne ikke laste</span>
      </div>
    );
  }

  if (!url) {
    return <div className="w-full h-full bg-muted animate-pulse" />;
  }

  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
    />
  );
}

function FileChip({
  attachment,
  bucket,
  urlResolver,
  canDelete,
  onDelete,
  canRename,
  onRename,
}: {
  attachment: ChatAttachment;
  bucket: string;
  urlResolver?: AttachmentUrlResolver;
  canDelete?: boolean;
  onDelete?: (att: ChatAttachment) => void;
  canRename?: boolean;
  onRename?: (att: ChatAttachment) => void;
}) {
  const [downloading, setDownloading] = useState(false);
  const label = attachmentLabel(attachment);
  const originalName = attachment.original_filename || attachment.file_name;
  const showOriginal = !!attachment.display_name && originalName && originalName !== label;

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDownloading(true);
    const url = await resolveAttachmentUrl(attachment, bucket, urlResolver);
    setDownloading(false);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="relative group max-w-[280px]">
      <button
        type="button"
        onClick={handleDownload}
        disabled={downloading}
        className="flex items-center gap-2 rounded-xl bg-background/70 hover:bg-background border border-border/60 px-2.5 py-2 text-left w-full transition-colors cursor-pointer"
        title={showOriginal ? `Originalfil: ${originalName}` : label}
      >
        <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <FileText className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold truncate text-foreground">{label}</p>
          <p className="text-[10px] text-muted-foreground truncate">
            {showOriginal ? originalName : null}
            {showOriginal && attachment.file_size != null ? " · " : null}
            {attachment.file_size != null ? formatBytes(attachment.file_size) : null}
          </p>
        </div>
        <Download className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      </button>
      <div className="absolute -top-1.5 -right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {canRename && onRename && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRename(attachment);
            }}
            aria-label={`Endre navn på ${label}`}
            className="h-5 w-5 rounded-full bg-background border border-border text-muted-foreground hover:text-primary hover:border-primary flex items-center justify-center cursor-pointer shadow-sm"
            title="Endre navn"
          >
            <Pencil className="h-3 w-3" />
          </button>
        )}
        {canDelete && onDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(attachment);
            }}
            aria-label={`Fjern ${label}`}
            className="h-5 w-5 rounded-full bg-background border border-border text-muted-foreground hover:text-destructive hover:border-destructive flex items-center justify-center cursor-pointer shadow-sm"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}
