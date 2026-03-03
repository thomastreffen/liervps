import { useState, useEffect } from "react";
import { X, Download, FolderOpen, ExternalLink, Loader2, FileText, File } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import type { DocFile, DocFolder } from "@/hooks/useDocsFiles";
import type { Attachment } from "@/lib/mock-data";

/* ── Types ── */

export type PreviewItem =
  | { kind: "doc"; file: DocFile }
  | { kind: "attachment"; attachment: Attachment; jobId: string };

interface FilePreviewPanelProps {
  item: PreviewItem;
  folders: DocFolder[];
  onClose: () => void;
  onMoveToFolder: (folderId: string | null) => void;
}

/* ── Helpers ── */

function isPreviewable(mime: string | null, name: string): "pdf" | "image" | null {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (mime?.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) return "image";
  if (mime?.includes("pdf") || ext === "pdf") return "pdf";
  return null;
}

function getTitle(item: PreviewItem): string {
  return item.kind === "doc" ? item.file.title : item.attachment.name;
}

function getMime(item: PreviewItem): string | null {
  if (item.kind === "doc") return item.file.mime_type;
  const ext = item.attachment.name.split(".").pop()?.toLowerCase() || "";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) return `image/${ext === "jpg" ? "jpeg" : ext}`;
  if (ext === "pdf") return "application/pdf";
  return null;
}

function getCurrentFolderId(item: PreviewItem): string | null {
  return item.kind === "doc" ? item.file.folder_id : null;
}

/** Extract bucket and file_path from a Supabase storage URL */
function extractStorageInfo(url: string): { bucket: string; path: string } | null {
  const match = url.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+?)(?:\?|$)/);
  if (!match) return null;
  return { bucket: match[1], path: decodeURIComponent(match[2]) };
}

/** Build a proxy URL that serves the file from our own edge function domain */
function buildProxyUrl(bucket: string, filePath: string): string {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const params = new URLSearchParams({ bucket, path: filePath });
  return `https://${projectId}.supabase.co/functions/v1/file-preview?${params.toString()}`;
}

/** Resolve storage info from a PreviewItem */
function resolveStorageInfo(item: PreviewItem): { bucket: string; path: string } | null {
  if (item.kind === "doc") {
    const meta = item.file.source_meta;
    if (meta?.bucket && meta?.file_path) {
      return { bucket: meta.bucket, path: meta.file_path };
    }
    if (meta?.public_url) {
      return extractStorageInfo(meta.public_url);
    }
    return null;
  }
  // Attachment
  return extractStorageInfo(item.attachment.url);
}

/* ── Component ── */

export function FilePreviewPanel({ item, folders, onClose, onMoveToFolder }: FilePreviewPanelProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [moveTarget, setMoveTarget] = useState<string>(getCurrentFolderId(item) ?? "__unsorted");

  const title = getTitle(item);
  const mime = getMime(item);
  const previewType = isPreviewable(mime, title);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPreviewUrl(null);
    setDownloadUrl(null);

    (async () => {
      // SharePoint files open externally
      if (item.kind === "doc" && item.file.source_type === "sharepoint") {
        const url = (item.file.source_meta as any)?.web_url || null;
        if (!cancelled) {
          setPreviewUrl(url);
          setDownloadUrl(url);
          setLoading(false);
        }
        return;
      }

      const storageInfo = resolveStorageInfo(item);

      if (storageInfo) {
        // Get auth token for the proxy request
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;

        if (token) {
          const proxyUrl = buildProxyUrl(storageInfo.bucket, storageInfo.path);
          // For the preview, we'll fetch via proxy with auth header and create a blob URL
          try {
            const response = await fetch(proxyUrl, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
              const blob = await response.blob();
              const blobUrl = URL.createObjectURL(blob);
              if (!cancelled) {
                setPreviewUrl(blobUrl);
                setDownloadUrl(blobUrl);
                setLoading(false);
              }
              return;
            }
          } catch (err) {
            console.warn("[FilePreviewPanel] Proxy fetch failed, falling back:", err);
          }
        }
      }

      // Fallback: use direct URL (for non-storage files or if proxy fails)
      const fallbackUrl = item.kind === "doc"
        ? (item.file.source_meta as any)?.public_url || null
        : item.attachment.url;

      if (!cancelled) {
        setPreviewUrl(fallbackUrl);
        setDownloadUrl(fallbackUrl);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      // Cleanup blob URLs
      if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    };
  }, [item]);

  const handleMove = () => {
    const folderId = moveTarget === "__unsorted" ? null : moveTarget;
    onMoveToFolder(folderId);
  };

  const handleDownload = () => {
    if (!downloadUrl) return;
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = title;
    a.click();
  };

  const isSharePoint = item.kind === "doc" && item.file.source_type === "sharepoint";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-background border-l border-border shadow-xl flex flex-col overflow-hidden animate-in slide-in-from-right-8 duration-200">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border px-5 py-4 shrink-0">
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-foreground truncate">{title}</h3>
            {previewType && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {previewType === "pdf" ? "PDF-dokument" : "Bilde"}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {downloadUrl && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDownload} title="Last ned">
                <Download className="h-4 w-4" />
              </Button>
            )}
            {isSharePoint && previewUrl && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.open(previewUrl, "_blank")} title="Åpne i SharePoint">
                <ExternalLink className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Preview area */}
        <div className="flex-1 overflow-auto bg-muted/30">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : previewType === "image" && previewUrl ? (
            <div className="flex items-center justify-center p-6 h-full">
              <img
                src={previewUrl}
                alt={title}
                className="max-w-full max-h-full object-contain rounded-lg shadow-md"
              />
            </div>
          ) : previewType === "pdf" && previewUrl ? (
            <object
              data={previewUrl}
              type="application/pdf"
              className="w-full h-full"
              aria-label={title}
            >
              {/* Fallback if object embedding fails */}
              <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground p-6">
                <FileText className="h-16 w-16 opacity-30" />
                <p className="text-sm text-center">
                  PDF-forhåndsvisning er ikke tilgjengelig i nettleseren.
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => window.open(previewUrl, "_blank")}>
                    <ExternalLink className="h-3.5 w-3.5" />
                    Åpne i ny fane
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2" onClick={handleDownload}>
                    <Download className="h-3.5 w-3.5" />
                    Last ned
                  </Button>
                </div>
              </div>
            </object>
          ) : previewUrl ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
              <File className="h-16 w-16 opacity-30" />
              <p className="text-sm">Forhåndsvisning er ikke tilgjengelig for denne filtypen.</p>
              <Button variant="outline" size="sm" className="gap-2" onClick={handleDownload}>
                <Download className="h-3.5 w-3.5" />
                Last ned fil
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
              <File className="h-16 w-16 opacity-30" />
              <p className="text-sm">Kunne ikke laste fil.</p>
            </div>
          )}
        </div>

        {/* Move to folder panel */}
        <div className="border-t border-border px-5 py-4 shrink-0 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <FolderOpen className="h-4 w-4 text-primary" />
            Flytt til mappe
          </div>
          <div className="flex items-center gap-2">
            <Select value={moveTarget} onValueChange={setMoveTarget}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Velg mappe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__unsorted">Usortert (Prosjektvedlegg)</SelectItem>
                {folders.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              onClick={handleMove}
              disabled={moveTarget === (getCurrentFolderId(item) ?? "__unsorted")}
            >
              Flytt
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
