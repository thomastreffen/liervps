import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Download, ZoomIn, ZoomOut, X, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { ImageAnnotator } from "./ImageAnnotator";

interface ImagePreviewModalProps {
  url: string | null;
  alt?: string;
  onClose: () => void;
  postId?: string;
  fileId?: string;
  projectId?: string;
  companyId?: string;
  onAnnotationSaved?: () => void;
}

export function ImagePreviewModal({
  url, alt = "Vedlegg", onClose, postId, fileId, projectId, companyId, onAnnotationSaved,
}: ImagePreviewModalProps) {
  const [zoom, setZoom] = useState(1);
  const [annotating, setAnnotating] = useState(false);

  if (!url) return null;

  if (annotating && postId && projectId && companyId) {
    return (
      <ImageAnnotator
        imageUrl={url}
        postId={postId}
        fileId={fileId}
        projectId={projectId}
        companyId={companyId}
        onSave={() => {
          setAnnotating(false);
          onAnnotationSaved?.();
        }}
        onClose={() => setAnnotating(false)}
      />
    );
  }

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = url;
    a.download = alt || "image";
    a.target = "_blank";
    a.click();
  };

  return (
    <Dialog open={!!url} onOpenChange={() => { setZoom(1); onClose(); }}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-none overflow-hidden [&>button]:hidden">
        {/* Toolbar */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/60 to-transparent">
          <span className="text-white/70 text-xs truncate max-w-[50%]">{alt}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
              className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 transition-colors cursor-pointer"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="text-white/60 text-xs w-12 text-center">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom(z => Math.min(3, z + 0.25))}
              className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 transition-colors cursor-pointer"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              onClick={handleDownload}
              className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 transition-colors cursor-pointer ml-2"
            >
              <Download className="h-4 w-4" />
            </button>
            {postId && projectId && (
              <button
                onClick={() => setAnnotating(true)}
                className="h-8 w-8 rounded-full bg-primary/80 hover:bg-primary flex items-center justify-center text-white transition-colors cursor-pointer ml-1"
                title="Annoter"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => { setZoom(1); onClose(); }}
              className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 transition-colors cursor-pointer ml-1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Image */}
        <div className="flex items-center justify-center w-full h-[85vh] overflow-auto p-8">
          <img
            src={url}
            alt={alt}
            className="max-w-full max-h-full object-contain rounded transition-transform duration-200"
            style={{ transform: `scale(${zoom})` }}
            onClick={() => setZoom(z => z === 1 ? 2 : 1)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
