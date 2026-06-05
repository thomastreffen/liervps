import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Download, ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type ChatAttachment,
  isImageAttachment,
  formatBytes,
} from "./chat-attachments-util";

interface ChatMediaGridProps {
  attachments: ChatAttachment[];
  bucket: string;
  /** Called with the global index in the `attachments` array of the clicked image. */
  onPreview?: (att: ChatAttachment, indexInImages: number, images: ChatAttachment[]) => void;
  /** Constrain bubble width; defaults to true. */
  compact?: boolean;
}

/**
 * Renders chat attachments inside a message bubble:
 *  - Images as thumbnail grid (1 large / 2-4 grid / 4+ with +N overlay)
 *  - Non-images as compact file chips with download
 */
export function ChatMediaGrid({ attachments, bucket, onPreview, compact = true }: ChatMediaGridProps) {
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
        />
      )}
      {files.length > 0 && (
        <div className="space-y-1.5">
          {files.map((f) => (
            <FileChip key={f.id} attachment={f} bucket={bucket} />
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
}: {
  images: ChatAttachment[];
  bucket: string;
  onPreview?: ChatMediaGridProps["onPreview"];
  compact: boolean;
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
      {visible.map((img, idx) => (
        <button
          key={img.id}
          type="button"
          onClick={() => onPreview?.(img, idx, images)}
          className={cn(
            "relative overflow-hidden rounded-xl bg-muted/60 border border-border/40 cursor-pointer group",
            visible.length === 1 ? "aspect-[4/3]" : "aspect-square"
          )}
        >
          <SignedImage path={img.file_path} bucket={bucket} alt={img.file_name} />
          {idx === visible.length - 1 && overflow > 0 && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-lg font-bold">
              +{overflow}
            </div>
          )}
        </button>
      ))}
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

function SignedImage({ path, bucket, alt }: { path: string; bucket: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!path) return;
    setErr(false);
    getSignedUrl(bucket, path)
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
  }, [path, bucket]);

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

function FileChip({ attachment, bucket }: { attachment: ChatAttachment; bucket: string }) {
  const [downloading, setDownloading] = useState(false);
  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDownloading(true);
    const url = await getSignedUrl(bucket, attachment.file_path, 600);
    setDownloading(false);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={downloading}
      className="flex items-center gap-2 rounded-xl bg-background/70 hover:bg-background border border-border/60 px-2.5 py-2 text-left w-full max-w-[280px] transition-colors cursor-pointer"
    >
      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <FileText className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold truncate text-foreground">{attachment.file_name}</p>
        {attachment.file_size != null && (
          <p className="text-[10px] text-muted-foreground">{formatBytes(attachment.file_size)}</p>
        )}
      </div>
      <Download className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
    </button>
  );
}

