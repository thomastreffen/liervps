import { useMemo, useState } from "react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Mail, CheckCircle2, FileDown, ExternalLink, RefreshCw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { calcSummaryRows } from "@/lib/calc-summary";
import { buildOfferPdf, offerContentHash, offerPdfBase64, offerPdfFilename, type OfferPdfInput } from "@/lib/offer-pdf";


export const COMPANY = {
  name: "Lier Varmepumpeservice AS",
  phone: "32 24 20 00",
  email: "post@liervarmepumpeservice.no",
  web: "liervps.no",
};

export const VALIDITY_TEXT =
  "Tilbudet er gyldig i 14 dager med forbehold om tilgjengelighet og endelig teknisk vurdering.";

export const ASSUMPTIONS = [
  "Prisen forutsetter normal montasjesituasjon og tilgjengelig strømkurs på monteringsstedet.",
  "Eventuelt elektrikerarbeid, stillas eller ekstra rørføring kommer i tillegg etter avtale.",
  "Endelig løsning og pris bekreftes etter befaring og teknisk vurdering.",
];

export interface OfferRow {
  id: string;
  project_title: string;
  status: string;
  total_price: number | null;
  created_at: string;
  offer_sent_at?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  description?: string | null;
  input_snapshot?: any;
  pdf_drive_file_id?: string | null;
  pdf_drive_url?: string | null;
  pdf_generated_at?: string | null;
  pdf_content_hash?: string | null;
}


interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  offer: OfferRow;
  lead: { id: string; company_name: string; contact_name: string | null; email: string | null; phone: string | null; public_lead_id?: string | null };
  onUpdated?: () => void;
}

const nok = (v: number) => `kr ${Number(v).toLocaleString("nb-NO")}`;

/** Interne blokker som aldri skal vises til kunden. */
const INTERNAL_BLOCK = /^(notater fra henvendelsen|interne notater|internt|kundens melding|fra befaringen)\b/i;

/**
 * Fjerner interne avsnitt fra omfangsteksten før den vises/sendes til kunden.
 * Interne blokker legges alltid til sist, så alt fra første interne overskrift kuttes –
 * det dekker også notater som selv inneholder blanke linjer.
 */
export function sanitizeScope(text?: string | null): string {
  if (!text) return "";
  const lines = text.split("\n");
  const cut = lines.findIndex(l => INTERNAL_BLOCK.test(l.trim()));
  const kept = cut === -1 ? lines : lines.slice(0, cut);
  return kept
    .join("\n")
    .split(/\n\s*\n/)
    .filter(block => !INTERNAL_BLOCK.test(block.trim()))
    .join("\n\n")
    .trim();

}

/** Produktnavn: eksplisitt valgt produkt, ellers merke + modell fra snapshot. */
export function productLabel(snap: any): string | null {
  if (snap?.selected_product) return String(snap.selected_product);
  const bm = [snap?.brand, snap?.model].filter(Boolean).join(" ");
  return bm || null;
}

/** Ren, kundevendt tekstversjon av tilbudet — ingen interne notater eller JSON. */
export function buildOfferText(offer: OfferRow, contact: string, address: string | null) {
  const snap = offer.input_snapshot || {};
  const rows = calcSummaryRows(snap.calculator_summary);
  const scope = sanitizeScope(offer.description);
  const product = productLabel(snap);
  const lines: string[] = [];
  lines.push(`${COMPANY.name}`);
  lines.push("");
  lines.push(offer.project_title);
  lines.push("");
  if (contact) lines.push(`Til: ${contact}`);
  if (address) lines.push(`Adresse: ${address}`);
  lines.push("");
  if (snap.recommended_solution) lines.push(`Anbefalt løsning: ${snap.recommended_solution}`);
  if (product) lines.push(`Produkt: ${product}`);
  if (offer.total_price) lines.push(`Estimert pris: ${nok(offer.total_price)} eks. mva`);
  if (scope) {
    lines.push("", "Omfang:", scope);
  }

  if (rows.length) {
    lines.push("", "Grunnlag fra sparekalkulator:");
    rows.forEach(r => lines.push(`- ${r.label}: ${r.value}`));
  }
  lines.push("", "Forbehold:");
  ASSUMPTIONS.forEach(a => lines.push(`- ${a}`));
  lines.push("", VALIDITY_TEXT);
  lines.push("", `${COMPANY.name} · Tlf ${COMPANY.phone} · ${COMPANY.email}`);
  return lines.join("\n");
}

export function OfferPreviewDialog({ open, onOpenChange, offer, lead, onUpdated }: Props) {
  const { user } = useAuth();
  const [sending, setSending] = useState(false);
  const [marking, setMarking] = useState(false);
  const [confirmManual, setConfirmManual] = useState(false);

  const snap = offer.input_snapshot || {};
  const address: string | null = snap.address || null;
  const contact = offer.customer_name || lead.company_name;
  const contactPerson = snap.contact_name || lead.contact_name || "";
  const recipient = (offer.customer_email || lead.email || "").trim();
  const calcRows = useMemo(() => calcSummaryRows(snap.calculator_summary), [snap.calculator_summary]);
  const isSent = offer.status === "sent" || Boolean(offer.offer_sent_at);
  const scopeText = useMemo(() => sanitizeScope(offer.description), [offer.description]);
  const product = productLabel(snap);

  const pdfInput: OfferPdfInput = useMemo(() => ({
    offerId: offer.id,
    title: offer.project_title,
    createdAt: offer.created_at,
    customerName: contact,
    contactPerson: contactPerson || null,
    customerEmail: recipient || null,
    address,
    recommendedSolution: snap.recommended_solution || null,
    product,
    scope: scopeText,
    calculatorSummary: snap.calculator_summary,
    totalPrice: offer.total_price,
    company: COMPANY,
    validityText: VALIDITY_TEXT,
    assumptions: ASSUMPTIONS,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [offer.id, offer.project_title, offer.created_at, offer.total_price, contact, contactPerson, recipient, address, scopeText, product, snap.recommended_solution, snap.calculator_summary]);

  const currentHash = useMemo(() => offerContentHash(pdfInput), [pdfInput]);
  const [pdfBusy, setPdfBusy] = useState(false);
  // Lokal PDF-status så lenker og advarsel oppdateres uten å lukke dialogen.
  const [localPdf, setLocalPdf] = useState<{ url: string | null; hash: string | null } | null>(null);
  const pdfUrl = localPdf ? localPdf.url : (offer.pdf_drive_url ?? null);
  const pdfHash = localPdf ? localPdf.hash : (offer.pdf_content_hash ?? null);
  const hasPdf = Boolean(pdfUrl);
  const pdfEverGenerated = hasPdf || Boolean(localPdf) || Boolean(offer.pdf_generated_at);
  const pdfOutdated = pdfEverGenerated && Boolean(pdfHash) && pdfHash !== currentHash;

  /** Genererer PDF lokalt og laster den opp til Drive-mappen når Drive er koblet til. */
  const generatePdf = async (): Promise<{ base64: string; filename: string; driveStatus: string; fileUrl: string | null }> => {
    const doc = buildOfferPdf(pdfInput);
    const base64 = offerPdfBase64(doc);
    const filename = offerPdfFilename(pdfInput);
    let driveStatus = "skipped";
    let fileUrl: string | null = null;
    try {
      const { data, error } = await supabase.functions.invoke("offer-pdf-upload", {
        body: { calculation_id: offer.id, lead_id: lead.id, filename, pdf_base64: base64 },
      });
      driveStatus = error ? "error" : ((data as any)?.status ?? "error");
      fileUrl = (data as any)?.file_url ?? null;
    } catch (e) {
      console.error("[OfferPreview] pdf upload", e);
      driveStatus = "error";
    }
    await supabase.from("calculations")
      .update({ pdf_generated_at: new Date().toISOString(), pdf_content_hash: currentHash } as any)
      .eq("id", offer.id);
    setLocalPdf({ url: fileUrl ?? offer.pdf_drive_url ?? null, hash: currentHash });
    return { base64, filename, driveStatus, fileUrl };
  };

  const handleRegenerate = async () => {
    if (pdfBusy || sending) return;
    setPdfBusy(true);
    try {
      const res = await generatePdf();
      if (res.driveStatus === "uploaded") toast.success("PDF oppdatert i Google Drive");
      else if (res.driveStatus === "no_token") toast.message("PDF laget uten Drive-lagring", { description: "Google Drive er ikke koblet til." });
      else toast.message("PDF laget", { description: "Kunne ikke lagre i Google Drive." });
    } finally {
      setPdfBusy(false);
    }
  };


  const handleDownloadPdf = () => {
    const doc = buildOfferPdf(pdfInput);
    doc.save(offerPdfFilename(pdfInput));
  };



  const markSent = async (mode: "email" | "manual") => {
    const stamp = format(new Date(), "dd.MM.yyyy HH:mm");
    await supabase.from("calculations")
      .update({ status: "sent" as any, offer_sent_at: new Date().toISOString() } as any)
      .eq("id", offer.id);
    await supabase.from("leads").update({ status: "tilbud_sendt" as any }).eq("id", lead.id);
    const note = mode === "email"
      ? `Tilbud sendt: ${stamp}`
      : `Tilbud markert som sendt manuelt: ${stamp}`;
    await supabase.from("lead_history").insert({
      lead_id: lead.id,
      action: "offer_sent",
      description: note,
      performed_by: user?.id,
      metadata: { calculation_id: offer.id, mode },
    } as any);
    await supabase.from("activity_log").insert({
      entity_type: "lead",
      entity_id: lead.id,
      action: "offer_sent",
      type: "note",
      title: offer.project_title,
      description: note,
      performed_by: user?.id || null,
      metadata: { calculation_id: offer.id, mode },
    } as any);
    onUpdated?.();
  };

  const handleSend = async () => {
    if (sending || isSent) return;
    if (!recipient) {
      toast.error("Mangler e-postadresse på kunden");
      return;
    }
    setSending(true);

    try {
      // 1) PDF: generer (og lagre i Drive når mulig). Feiler den, sendes e-posten som før.
      let pdf: { base64: string; filename: string; driveStatus: string } | null = null;
      try {
        pdf = await generatePdf();
      } catch (e) {
        console.error("[OfferPreview] pdf generate", e);
        pdf = null;
      }

      const greeting = contactPerson ? `Hei ${contactPerson},` : "Hei,";
      const text = pdf
        ? [
            greeting,
            "",
            `Takk for henvendelsen til ${COMPANY.name}. Tilbudet ligger vedlagt som PDF.`,
            "",
            offer.project_title,
            product ? `Produkt: ${product}` : "",
            Number(offer.total_price) > 0 ? `Estimert pris: ${nok(Number(offer.total_price))} eks. mva` : "",
            "",
            VALIDITY_TEXT,
            "",
            "Har du spørsmål kan du svare direkte på denne e-posten, så hjelper vi deg videre.",
            "",
            `${COMPANY.name} · Tlf ${COMPANY.phone} · ${COMPANY.email}`,
          ].filter(l => l !== "").join("\n")
        : [
            greeting,
            "",
            `Takk for henvendelsen til ${COMPANY.name}. Her er tilbudet vårt.`,
            "",
            buildOfferText(offer, contactPerson || contact, address),
            "",
            "Har du spørsmål kan du svare direkte på denne e-posten, så hjelper vi deg videre.",
          ].join("\n");

      const { data, error } = await supabase.functions.invoke("gmail-send", {
        body: {
          to: recipient,
          subject: "Tilbud fra Lier Varmepumpeservice",
          text,
          html: `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1f2937;white-space:pre-wrap">${text
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`,
          attachments: pdf
            ? [{ filename: pdf.filename, mime_type: "application/pdf", content_base64: pdf.base64 }]
            : undefined,
        },
      });

      const status = (data as any)?.status;
      if (error || status !== "sent") {
        if (status === "no_token") {
          toast.error("Tilbudet ble ikke sendt fordi Gmail ikke er koblet til.");
        } else {
          toast.error("Tilbudet ble ikke sendt", { description: (data as any)?.message || error?.message });
        }
        return; // Tilbudet forblir utkast, lead-status uendret
      }

      await markSent("email");
      if (!pdf) {
        toast.success("Tilbud sendt uten PDF", { description: recipient });
      } else if (pdf.driveStatus === "uploaded") {
        toast.success("Tilbud sendt med PDF", { description: `${recipient} · lagret i Google Drive` });
      } else if (pdf.driveStatus === "no_token") {
        toast.success("Tilbud sendt med PDF", { description: recipient });
        toast.message("Tilbud sendt uten Drive-lagring fordi Google Drive ikke er koblet til.");
      } else {
        toast.success("Tilbud sendt med PDF", { description: recipient });
        toast.message("PDF-en ble ikke lagret i Google Drive.");
      }
      onOpenChange(false);

    } catch (e: any) {
      console.error("[OfferPreview] send", e);
      toast.error("Tilbudet ble ikke sendt fordi Gmail ikke er koblet til.");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Forhåndsvisning av tilbud</DialogTitle>
            <DialogDescription>Slik ser tilbudet ut for kunden.</DialogDescription>
          </DialogHeader>

          <div className="rounded-2xl border border-border/60 bg-card p-6 space-y-4 text-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-base">{COMPANY.name}</p>
                <p className="text-xs text-muted-foreground">Tlf {COMPANY.phone} · {COMPANY.email}</p>
              </div>
              {isSent && <Badge variant="secondary" className="text-[10px]">Sendt</Badge>}
            </div>

            <Separator />

            <div>
              <h3 className="text-base font-semibold">{offer.project_title}</h3>
              <p className="text-xs text-muted-foreground">
                {format(new Date(offer.created_at), "d. MMMM yyyy", { locale: nb })}
              </p>
            </div>

            <div className="space-y-0.5">
              <p className="font-medium">{contact}</p>
              {contactPerson && contactPerson !== contact && <p>{contactPerson}</p>}
              {address && <p className="text-muted-foreground">{address}</p>}
              {recipient && <p className="text-muted-foreground">{recipient}</p>}
            </div>

            {(snap.recommended_solution || product) && (
              <div className="space-y-1">
                <p className="font-medium">Anbefalt løsning</p>
                {snap.recommended_solution && <p>{snap.recommended_solution}</p>}
                {product && <p className="text-muted-foreground">Produkt: {product}</p>}
              </div>
            )}

            {scopeText && (
              <div className="space-y-1">
                <p className="font-medium">Omfang</p>
                <p className="whitespace-pre-wrap text-muted-foreground">{scopeText}</p>
              </div>

            )}

            {calcRows.length > 0 && (
              <div className="space-y-1">
                <p className="font-medium">Grunnlag fra sparekalkulator</p>
                <ul className="text-muted-foreground space-y-0.5">
                  {calcRows.map(r => <li key={r.label}>{r.label}: {r.value}</li>)}
                </ul>
              </div>
            )}

            {Number(offer.total_price) > 0 && (
              <div>
                <p className="font-medium">Estimert pris</p>
                <p className="text-lg font-semibold">{nok(Number(offer.total_price))} <span className="text-xs font-normal text-muted-foreground">eks. mva</span></p>
              </div>
            )}

            <div className="space-y-1">
              <p className="font-medium">Forbehold</p>
              <ul className="list-disc pl-4 text-muted-foreground space-y-0.5">
                {ASSUMPTIONS.map(a => <li key={a}>{a}</li>)}
              </ul>
            </div>

            <p className="text-xs text-muted-foreground">{VALIDITY_TEXT}</p>

            <Separator />
            <p className="text-xs text-muted-foreground">
              {COMPANY.name} · Tlf {COMPANY.phone} · {COMPANY.email} · {COMPANY.web}
            </p>
          </div>

          {pdfOutdated && (
            <p className="flex items-center gap-1.5 text-xs text-amber-600">
              <AlertTriangle className="h-3.5 w-3.5" /> Tilbudet er endret etter PDF ble generert.
            </p>
          )}

          <DialogFooter className="gap-2 sm:gap-2 flex-wrap">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Lukk</Button>
            <Button variant="outline" className="gap-1.5" onClick={handleDownloadPdf}>
              <FileDown className="h-4 w-4" /> Last ned PDF
            </Button>
            {hasPdf && (
              <Button variant="outline" className="gap-1.5" asChild>
                <a href={pdfUrl!} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" /> Åpne PDF
                </a>
              </Button>
            )}
            {pdfEverGenerated && (
              <Button variant="outline" className="gap-1.5" onClick={handleRegenerate} disabled={pdfBusy}>
                {pdfBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Regenerer PDF
              </Button>
            )}
            <Button variant="outline" className="gap-1.5" onClick={() => setConfirmManual(true)} disabled={isSent}>
              <CheckCircle2 className="h-4 w-4" /> Marker som sendt
            </Button>

            <Button className="gap-1.5" onClick={handleSend} disabled={sending || pdfBusy || isSent || !recipient}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Send tilbud
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmManual} onOpenChange={setConfirmManual}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marker tilbudet som sendt?</AlertDialogTitle>
            <AlertDialogDescription>
              Bruk dette kun hvis tilbudet er sendt utenfor systemet. Tilbudet settes til «sendt» og henvendelsen får status «tilbud sendt».
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={marking}>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              disabled={marking || isSent}
              onClick={async (e) => {
                e.preventDefault();
                if (marking || isSent) return;
                setMarking(true);
                try {
                  await markSent("manual");
                  toast.success("Tilbud markert som sendt");
                  setConfirmManual(false);
                  onOpenChange(false);
                } finally {
                  setMarking(false);
                }
              }}
            >
              {marking ? "Markerer …" : "Marker som sendt"}
            </AlertDialogAction>

          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
