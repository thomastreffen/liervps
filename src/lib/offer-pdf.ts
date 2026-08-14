import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { calcSummaryRows } from "@/lib/calc-summary";

/** Kundevendt PDF for tilbud — inneholder aldri interne notater, JSON eller lead_context. */

export interface OfferPdfInput {
  offerId: string;
  title: string;
  createdAt: string;
  customerName: string;
  contactPerson?: string | null;
  customerEmail?: string | null;
  address?: string | null;
  recommendedSolution?: string | null;
  product?: string | null;
  scope?: string | null; // MÅ være sanitizeScope-filtrert
  calculatorSummary?: unknown;
  totalPrice?: number | null;
  company: { name: string; phone: string; email: string; web: string };
  validityText: string;
  assumptions: string[];
}

const NAVY: [number, number, number] = [16, 33, 63];
const RED: [number, number, number] = [193, 39, 45];
const GREY: [number, number, number] = [90, 98, 112];

const nok = (v: number) => `kr ${Number(v).toLocaleString("nb-NO")}`;

/** Stabil signatur av kundevendt innhold — brukes til «endret etter PDF». */
export function offerContentHash(input: OfferPdfInput): string {
  const src = JSON.stringify([
    input.title, input.customerName, input.contactPerson ?? "", input.address ?? "",
    input.recommendedSolution ?? "", input.product ?? "", input.scope ?? "",
    input.totalPrice ?? null, calcSummaryRows(input.calculatorSummary),
  ]);
  let h = 5381;
  for (let i = 0; i < src.length; i++) h = ((h << 5) + h + src.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

export function offerPdfFilename(input: OfferPdfInput): string {
  // ASCII-only: filnavnet brukes i MIME-headere for Gmail-vedlegg.
  const ascii = input.title
    .replace(/[æÆ]/g, "ae").replace(/[øØ]/g, "oe").replace(/[åÅ]/g, "aa")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const safe = ascii.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 60);
  return `Tilbud-${safe || "Lier-VPS"}-${input.offerId.slice(0, 8)}.pdf`;
}


export function buildOfferPdf(input: OfferPdfInput): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const M = 18;
  const W = 210;
  const maxW = W - M * 2;
  let y = 20;

  const ensureSpace = (needed: number) => {
    if (y + needed > 275) { doc.addPage(); y = 20; }
  };

  const heading = (text: string) => {
    ensureSpace(14);
    y += 4;
    doc.setFont("helvetica", "bold").setFontSize(10.5).setTextColor(...NAVY);
    doc.text(text.toUpperCase(), M, y);
    y += 5;
  };

  const body = (text: string, color: [number, number, number] = [40, 44, 52]) => {
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(...color);
    const lines = doc.splitTextToSize(text, maxW) as string[];
    lines.forEach((line) => {
      ensureSpace(6);
      doc.text(line, M, y);
      y += 5;
    });
  };

  // Header
  doc.setFont("helvetica", "bold").setFontSize(16).setTextColor(...NAVY);
  doc.text(input.company.name, M, y);
  y += 6;
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...GREY);
  doc.text(`Tlf ${input.company.phone} · ${input.company.email} · ${input.company.web}`, M, y);
  y += 4;
  doc.setDrawColor(...RED).setLineWidth(1.1);
  doc.line(M, y, W - M, y);
  y += 10;

  // Tittel + dato/ref
  doc.setFont("helvetica", "bold").setFontSize(14).setTextColor(...NAVY);
  const titleLines = doc.splitTextToSize(input.title, maxW) as string[];
  titleLines.forEach((l) => { doc.text(l, M, y); y += 7; });
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...GREY);
  doc.text(
    `${format(new Date(input.createdAt), "d. MMMM yyyy", { locale: nb })} · Ref. ${input.offerId.slice(0, 8).toUpperCase()}`,
    M, y,
  );
  y += 8;

  // Kunde
  heading("Tilbud til");
  body(input.customerName);
  if (input.contactPerson && input.contactPerson !== input.customerName) body(input.contactPerson);
  if (input.address) body(input.address, GREY);
  if (input.customerEmail) body(input.customerEmail, GREY);

  if (input.recommendedSolution || input.product) {
    heading("Anbefalt løsning");
    if (input.recommendedSolution) body(input.recommendedSolution);
    if (input.product) body(`Produkt: ${input.product}`, GREY);
  }

  if (input.scope?.trim()) {
    heading("Omfang");
    input.scope.trim().split("\n").forEach((line) => body(line || " "));
  }

  const rows = calcSummaryRows(input.calculatorSummary);
  if (rows.length) {
    heading("Grunnlag fra sparekalkulator");
    rows.forEach((r) => body(`${r.label}: ${r.value}`, GREY));
  }

  if (Number(input.totalPrice) > 0) {
    heading("Estimert pris");
    ensureSpace(12);
    doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(...NAVY);
    doc.text(`${nok(Number(input.totalPrice))} eks. mva`, M, y);
    y += 7;
  }

  heading("Forbehold");
  input.assumptions.forEach((a) => body(`•  ${a}`, GREY));

  y += 3;
  body(input.validityText, GREY);

  // Footer på alle sider
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(220, 224, 230).setLineWidth(0.3);
    doc.line(M, 283, W - M, 283);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...GREY);
    doc.text(
      `${input.company.name} · Tlf ${input.company.phone} · ${input.company.email} · ${input.company.web}`,
      M, 288,
    );
    doc.text(`Side ${p} av ${pages}`, W - M, 288, { align: "right" });
  }

  return doc;
}

/** Base64 (uten data-URI-prefiks) for e-postvedlegg og Drive-opplasting. */
export function offerPdfBase64(doc: jsPDF): string {
  const uri = doc.output("datauristring");
  return uri.slice(uri.indexOf(",") + 1);
}
