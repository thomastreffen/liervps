import { useEffect, useMemo } from "react";
import { X, FileText, Loader2, AlertCircle, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { isImageFile, formatBytes, stripExtension } from "./chat-attachments-util";

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
  /**
   * Når satt: viser et redigerbart "Gi bilde et navn"-felt per fil.
   * Verdier mappes på index. Tom string = bruk originalt filnavn.
   */
  displayNames?: Record<number, string>;
  onDisplayNameChange?: (index: number, value: string) => void;
}

/**
 * iMessage-style preview row shown above the composer textarea.
 * - Images: square thumbnails (3-4 per row on mobile) with X to remove + valgfritt navnfelt
 * - Other files: compact chips with icon + name + size + valgfritt navnfelt
 */
export function SelectedFilesPreview({
  files,
  onRemove,
  meta,
  className,
  displayNames,
  onDisplayNameChange,
}: SelectedFilesPreviewProps) {
  const previews = useMemo(() => {
    return files.map((f) => (isImageFile(f) ? URL.createObjectURL(f) : null));
  }, [files]);

  useEffect(() => {
    return () => {
      previews.forEach((url) => url && URL.revokeObjectURL(url));
    };
  }, [previews]);

  if (files.length === 0) return null;

  const editable = !!onDisplayNameChange;

  const images: { file: File; url: string; index: number }[] = [];
  const others: { file: File; index: number }[] = [];
  files.forEach((f, i) => {
    const url = previews[i];
    if (url) images.push({ file: f, url, index: i });
    else others.push({ file: f, index: i });
  });

  const placeholderFor = (file: File) => stripExtension(file.name) || file.name;

  return (
    <div className={cn("space-y-2", className)}>
      {images.length > 0 && (
        <div
          className={cn(
            "grid gap-2",
            editable ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-3 sm:grid-cols-4",
          )}
        >
          {images.map(({ file, url, index }) => {
            const m = meta?.[index];
            const status = m?.status || "pending";
            const name = displayNames?.[index] ?? "";
            return (
              <div
                key={index}
                className={cn(
                  "rounded-xl border border-border/60 bg-muted/40 overflow-hidden",
                  editable && "flex flex-col",
                )}
              >
                <div className="relative aspect-square bg-muted group" title={file.name}>
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
                  {!editable && (
                    <div className="absolute bottom-0 inset-x-0 px-1.5 py-0.5 text-[9px] text-white bg-black/40 truncate">
                      {formatBytes(file.size)}
                    </div>
                  )}
                </div>
                {editable && (
                  <div className="p-1.5 space-y-1">
                    <div className="relative">
                      <Pencil className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
                      <Input
                        value={name}
                        onChange={(e) => onDisplayNameChange?.(index, e.target.value)}
                        placeholder={placeholderFor(file)}
                        disabled={status === "uploading"}
                        className="h-7 pl-6 text-[11px]"
                        aria-label={`Visningsnavn for ${file.name}`}
                      />
                    </div>
                    <p className="text-[9px] text-muted-foreground truncate" title={file.name}>
                      {file.name} · {formatBytes(file.size)}
                    </p>
                  </div>
                )}
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
            const name = displayNames?.[index] ?? "";
            return (
              <div
                key={index}
                className="rounded-lg border border-border/60 bg-muted/40 px-2.5 py-1.5 text-xs space-y-1"
              >
                <div className="flex items-center gap-2">
                  {status === "uploading" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
                  ) : status === "error" ? (
                    <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                  ) : (
                    <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  )}
                  <span className="truncate flex-1 font-medium" title={file.name}>{file.name}</span>
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
                {editable && (
                  <div className="relative">
                    <Pencil className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
                    <Input
                      value={name}
                      onChange={(e) => onDisplayNameChange?.(index, e.target.value)}
                      placeholder={placeholderFor(file)}
                      disabled={status === "uploading"}
                      className="h-7 pl-6 text-[11px]"
                      aria-label={`Visningsnavn for ${file.name}`}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
