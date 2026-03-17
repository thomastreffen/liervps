import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, Printer } from "lucide-react";
import { OfferHtmlPreview } from "@/components/offer/OfferHtmlPreview";
import type { OrderLine } from "@/components/offer/OrderLineEditor";
import { useRef} from "react";

interface CompanyInfo {
  company_name?: string;
  logo_url?: string | null;
  address?: string | null;
  postal_code?: string | null;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
  org_number?: string | null;
  website?: string | null;
  bank_account?: string | null;
}

interface OfferPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectTitle: string;
  customerName: string;
  customerEmail?: string | null;
  contactPersonName?: string | null;
  contactPersonEmail?: string | null;
  contactPersonPhone?: string | null;
  description?: string | null;
  lines: OrderLine[];
  showDiscount?: boolean;
  company?: CompanyInfo | null;
  offerNumber?: string | null;
  validUntil?: string | null;
  createdAt?: string;
}

export function OfferPreviewDialog({
  open,
  onOpenChange,
  ...previewProps
}: OfferPreviewDialogProps) {
  const previewRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (!previewRef.current) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Tilbud – ${previewProps.projectTitle}</title>
        <style>
          body { margin: 0; padding: 0; font-family: 'Inter', system-ui, sans-serif; }
          @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        </style>
        <link href="https://cdn.jsdelivr.net/npm/tailwindcss@3/dist/tailwind.min.css" rel="stylesheet">
      </head>
      <body>${previewRef.current.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border/40 shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base">Forhåndsvisning av tilbud</DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 rounded-lg"
                onClick={handlePrint}
              >
                <Printer className="h-3.5 w-3.5" />
                Skriv ut
              </Button>
            </div>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto bg-muted/30 p-6 min-h-0">
          <div ref={previewRef}>
            <OfferHtmlPreview {...previewProps} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
