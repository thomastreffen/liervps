import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink, RefreshCw, AlertCircle } from "lucide-react";

interface PdfPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pdfUrl: string | null;
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export function PdfPreviewDialog({ open, onOpenChange, pdfUrl, loading, error, onRetry }: PdfPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <div className="flex items-center justify-between">
            <DialogTitle>Forhåndsvisning av tilbud</DialogTitle>
            {pdfUrl && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 rounded-lg"
                onClick={() => window.open(pdfUrl, "_blank")}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Åpne i nytt vindu
              </Button>
            )}
          </div>
        </DialogHeader>
        <div className="flex-1 px-6 pb-6 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                <p className="text-sm text-muted-foreground">Genererer forhåndsvisning...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-4 max-w-sm">
                <AlertCircle className="h-10 w-10 text-destructive/60 mx-auto" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Kunne ikke generere forhåndsvisning akkurat nå</p>
                  <p className="text-xs text-muted-foreground">Prøv igjen, eller kontroller at tilbudet har ordrelinjer.</p>
                </div>
                {onRetry && (
                  <Button variant="outline" size="sm" className="gap-1.5 rounded-lg" onClick={onRetry}>
                    <RefreshCw className="h-3.5 w-3.5" />
                    Prøv igjen
                  </Button>
                )}
              </div>
            </div>
          ) : pdfUrl ? (
            <iframe
              src={pdfUrl}
              className="w-full h-full rounded-lg border"
              title="PDF forhåndsvisning"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-4 max-w-sm">
                <AlertCircle className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                <p className="text-sm text-muted-foreground">Kunne ikke laste forhåndsvisning</p>
                {onRetry && (
                  <Button variant="outline" size="sm" className="gap-1.5 rounded-lg" onClick={onRetry}>
                    <RefreshCw className="h-3.5 w-3.5" />
                    Prøv igjen
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
