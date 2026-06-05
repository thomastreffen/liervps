import { useEffect, useMemo } from "react";
import { X, FileText, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { isImageFile, formatBytes } from "./chat-attachments-util";

export type SelectedFileStatus = "pending" | "uploading" | "error";

export interface SelectedFileMeta {
  status?: SelectedFileStatus;
  progress?: number;
  error?: string;
}

interface SelectedFilesPreviewProps {
  files: File[];
  onRemove: (index: number) => void;
  meta?: Record<number, SelectedFileMeta>;
  className?: string;
}

/**
 * iMessage-style preview row shown above the composer textarea.
 * - Images: square thumbnails (3-4 per row on mobile) with X to remove
 * - Other files: compact chips with icon + name + size
 */
export function SelectedFilesPreview({ files, onRemove, meta, className }: SelectedFilesPreviewProps) {
  // Generate + revoke object URLs for image previews
  const previews = useMemo(() => {
    return files.map((f) => (isImageFile(f) ? URL.createObjectURL(f) : null));
  }, [files]);

  useEffect(() => {
    return () => {
      previews.forEach((url) => url && URL.revokeObjectURL(url));
    };
  }, [previews]);

  if (files.length === 0) return null;

  const images: { file: File; url: string; index: number }[] = [];
  const others: { file: File; index: number }[] = [];
  files.forEach((f, i) => {
    const url = previews[i];
    if (url) images.push({ file: f, url, index: i });
    else others.push({ file: f, index: i });
  });

  return (
    <div className={cn("space-y-2", className)}>
      {images.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {images.map(({ file, url, index }) => {
            const m = meta?.[index];
            const status = m?.status || "pending";
            return (
              <div
                key={index}
                className="relative aspect-square rounded-xl overflow-hidden border border-border/60 bg-muted group"
                title={file.name}
              >
                <img src={url} alt={file.name} className="w-full h-full object-cover" />
                {status === "uploading" && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-white" />
                  </div>
                )}
                {status === "error" && (
                  <div className="absolute inset-0 bg-destructive/70 flex items-center justify-center">
                    <AlertCircle className="h-5 w-5 text-destructive-foreground" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  disabled={status === "uploading"}
                  aria-label={`Fjern ${file.name}`}
                  className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/70 text-white flex items-center justify-center opacity-90 hover:opacity-100 disabled:opacity-30 cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
                <div className="absolute bottom-0 inset-x-0 px-1.5 py-0.5 text-[9px] text-white bg-black/40 truncate">
                  {formatBytes(file.size)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {others.length > 0 && (
        <div className="space-y-1.5">
          {others.map(({ file, index }) => {
            const m = meta?.[index];
            const status = m?.status || "pending";
            return (
              <div
                key={index}
                className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-2.5 py-1.5 text-xs"
              >
                {status === "uploading" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
                ) : status === "error" ? (
                  <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                ) : (
                  <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                )}
                <span className="truncate flex-1 font-medium">{file.name}</span>
                <span className="text-[10px] text-muted-foreground shrink-0">{formatBytes(file.size)}</span>
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  disabled={status === "uploading"}
                  className="text-muted-foreground hover:text-destructive disabled:opacity-30 cursor-pointer"
                  aria-label={`Fjern ${file.name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
