import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, ChevronLeft, ChevronRight, ExternalLink, Download, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Attachment {
  id: string;
  file_name: string;
  file_path: string;
  file_size?: number | null;
  mime_type?: string | null;
  category?: string | null;
}

interface AttachmentPreviewDrawerProps {
  open: boolean;
  onClose: () => void;
  attachments: Attachment[];
  initialIndex: number;
}

export function AttachmentPreviewDrawer({
  open, onClose, attachments, initialIndex,
}: AttachmentPreviewDrawerProps) {
  const [index, setIndex] = useState(initialIndex);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = attachments[index];
  const isImage = current?.mime_type?.startsWith("image/") || 
    /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(current?.file_name || "");
  const isPdf = current?.mime_type === "application/pdf" || 
    /\.pdf$/i.test(current?.file_name || "");

  const loadUrl = useCallback(async () => {
    if (!current) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.storage
        .from("order-form-attachments")
        .createSignedUrl(current.file_path, 600);
      if (err || !data?.signedUrl) throw new Error("Kunne ikke hente fil");
      setSignedUrl(data.signedUrl);
    } catch (e: any) {
      setError(e.message || "Feil ved henting av fil");
    } finally {
      setLoading(false);
    }
  }, [current]);

  useEffect(() => {
    if (open && current) loadUrl();
  }, [open, index, loadUrl]);

  useEffect(() => {
    if (open) setIndex(initialIndex);
  }, [open, initialIndex]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && index > 0) setIndex(i => i - 1);
      if (e.key === "ArrowRight" && index < attachments.length - 1) setIndex(i => i + 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, index, attachments.length, onClose]);

  if (!open || !current) return null;

  const canPreview = isImage || isPdf;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex">
      {/* Overlay click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Drawer from right */}
      <div className="ml-auto relative w-full max-w-3xl bg-card border-l border-border shadow-xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{current.file_name}</p>
              <p className="text-[10px] text-muted-foreground">
                {current.category && <span className="mr-2">{current.category}</span>}
                {current.file_size && (
                  current.file_size < 1024 * 1024
                    ? `${Math.round(current.file_size / 1024)} KB`
                    : `${(current.file_size / 1024 / 1024).toFixed(1)} MB`
                )}
                {attachments.length > 1 && ` · ${index + 1} av ${attachments.length}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {signedUrl && (
              <>
                <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                  <a href={signedUrl} download={current.file_name} title="Last ned">
                    <Download className="h-4 w-4" />
                  </a>
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                  <a href={signedUrl} target="_blank" rel="noopener noreferrer" title="Åpne i nytt vindu">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex items-center justify-center relative overflow-hidden">
          {loading && (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-sm">Laster forhåndsvisning...</span>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center gap-2 text-muted-foreground p-6 text-center">
              <FileText className="h-10 w-10" />
              <p className="text-sm font-medium">Kunne ikke laste filen</p>
              <p className="text-xs">{error}</p>
              {signedUrl && (
                <Button size="sm" variant="outline" asChild className="mt-2">
                  <a href={signedUrl} target="_blank" rel="noopener noreferrer">
                    Åpne i nytt vindu
                  </a>
                </Button>
              )}
            </div>
          )}

          {!loading && !error && signedUrl && (
            <>
              {isImage && (
                <img
                  src={signedUrl}
                  alt={current.file_name}
                  className="max-w-full max-h-full object-contain p-4"
                />
              )}
              {isPdf && (
                <iframe
                  src={signedUrl}
                  className="w-full h-full border-0"
                  title={current.file_name}
                />
              )}
              {!canPreview && (
                <div className="flex flex-col items-center gap-3 text-muted-foreground p-6 text-center">
                  <FileText className="h-12 w-12" />
                  <p className="text-sm font-medium">{current.file_name}</p>
                  <p className="text-xs">Forhåndsvisning er ikke tilgjengelig for denne filtypen</p>
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" variant="outline" asChild>
                      <a href={signedUrl} download={current.file_name}>
                        <Download className="h-3.5 w-3.5 mr-1" /> Last ned
                      </a>
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <a href={signedUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5 mr-1" /> Åpne
                      </a>
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Navigation arrows */}
          {attachments.length > 1 && (
            <>
              {index > 0 && (
                <button
                  onClick={() => setIndex(i => i - 1)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background/90 border border-border shadow flex items-center justify-center hover:bg-muted transition-colors"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}
              {index < attachments.length - 1 && (
                <button
                  onClick={() => setIndex(i => i + 1)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background/90 border border-border shadow flex items-center justify-center hover:bg-muted transition-colors"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              )}
            </>
          )}
        </div>

        {/* Bottom thumbnails */}
        {attachments.length > 1 && (
          <div className="shrink-0 border-t border-border px-4 py-2 flex gap-2 overflow-x-auto">
            {attachments.map((att, i) => (
              <button
                key={att.id}
                onClick={() => setIndex(i)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                  i === index
                    ? "bg-primary/10 text-primary font-medium border border-primary/20"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
              >
                {att.file_name.length > 25
                  ? att.file_name.substring(0, 22) + "..."
                  : att.file_name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
