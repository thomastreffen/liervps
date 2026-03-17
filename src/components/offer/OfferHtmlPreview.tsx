import { useMemo } from "react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import type { OrderLine } from "@/components/offer/OrderLineEditor";
import { calcTotals } from "@/components/offer/OrderLineEditor";

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

interface OfferHtmlPreviewProps {
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

const fmtCurrency = (v: number) =>
  `kr ${v.toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtQty = (v: number, unit: string) => {
  const intUnits = new Set(["stk", "pakke", "sett"]);
  if (intUnits.has(unit) && Number.isInteger(v)) return v.toString();
  return v.toLocaleString("nb-NO", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

export function OfferHtmlPreview({
  projectTitle,
  customerName,
  customerEmail,
  contactPersonName,
  contactPersonEmail,
  contactPersonPhone,
  description,
  lines,
  showDiscount = false,
  company,
  offerNumber,
  validUntil,
  createdAt,
}: OfferHtmlPreviewProps) {
  const totals = useMemo(() => calcTotals(lines), [lines]);
  const productLines = lines.filter((l) => l.line_type === "product");
  const textLines = lines.filter((l) => l.line_type === "text");

  const dateStr = createdAt
    ? format(new Date(createdAt), "d. MMMM yyyy", { locale: nb })
    : format(new Date(), "d. MMMM yyyy", { locale: nb });

  const validStr = validUntil
    ? format(new Date(validUntil), "d. MMMM yyyy", { locale: nb })
    : null;

  return (
    <div className="bg-white text-gray-900 max-w-[210mm] mx-auto shadow-sm" style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: "13px", lineHeight: "1.5" }}>
      {/* Header */}
      <div className="px-10 pt-10 pb-6 flex justify-between items-start">
        <div>
          {company?.logo_url ? (
            <img src={company.logo_url} alt={company.company_name || "Logo"} className="h-12 mb-3 object-contain" />
          ) : (
            <div className="text-xl font-bold text-gray-900 mb-3">{company?.company_name || "Firma"}</div>
          )}
          <div className="text-xs text-gray-500 space-y-0.5">
            {company?.address && <div>{company.address}</div>}
            {(company?.postal_code || company?.city) && (
              <div>{[company.postal_code, company.city].filter(Boolean).join(" ")}</div>
            )}
            {company?.phone && <div>Tlf: {company.phone}</div>}
            {company?.email && <div>{company.email}</div>}
            {company?.org_number && <div>Org.nr: {company.org_number}</div>}
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-gray-900 mb-2">TILBUD</div>
          {offerNumber && <div className="text-xs text-gray-500">Nr: {offerNumber}</div>}
          <div className="text-xs text-gray-500">Dato: {dateStr}</div>
          {validStr && <div className="text-xs text-gray-500">Gyldig til: {validStr}</div>}
        </div>
      </div>

      {/* Divider */}
      <div className="mx-10 border-t-2 border-gray-800" />

      {/* Customer info */}
      <div className="px-10 py-6">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Kunde</div>
        <div className="font-semibold text-base">{customerName}</div>
        {contactPersonName && <div className="text-sm text-gray-600">v/ {contactPersonName}</div>}
        {(contactPersonEmail || customerEmail) && (
          <div className="text-sm text-gray-500">{contactPersonEmail || customerEmail}</div>
        )}
        {contactPersonPhone && <div className="text-sm text-gray-500">Tlf: {contactPersonPhone}</div>}
      </div>

      {/* Project title */}
      <div className="px-10 pb-4">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Prosjekt</div>
        <div className="text-lg font-bold">{projectTitle}</div>
        {description && (
          <div className="mt-2 text-sm text-gray-600 whitespace-pre-wrap">{description}</div>
        )}
      </div>

      {/* Text lines as notes above table */}
      {textLines.length > 0 && (
        <div className="px-10 pb-4 space-y-1">
          {textLines.map((tl) => (
            <div key={tl.id} className="text-sm text-gray-600 italic">{tl.description}</div>
          ))}
        </div>
      )}

      {/* Order lines table */}
      {productLines.length > 0 && (
        <div className="px-10 pb-6">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-800">
                <th className="text-left py-2 font-semibold text-gray-700">Beskrivelse</th>
                <th className="text-right py-2 font-semibold text-gray-700 w-16">Antall</th>
                <th className="text-left py-2 font-semibold text-gray-700 w-14 pl-2">Enhet</th>
                <th className="text-right py-2 font-semibold text-gray-700 w-24">Enhetspris</th>
                {showDiscount && (
                  <th className="text-right py-2 font-semibold text-gray-700 w-16">Rabatt</th>
                )}
                <th className="text-right py-2 font-semibold text-gray-700 w-28">Sum</th>
              </tr>
            </thead>
            <tbody>
              {productLines.map((line, idx) => {
                const lineTotal = Math.round(line.quantity * line.unit_price * (1 - line.discount_percent / 100) * 100) / 100;
                return (
                  <tr key={line.id} className={idx % 2 === 0 ? "bg-gray-50" : ""}>
                    <td className="py-1.5 pr-2">{line.description}</td>
                    <td className="py-1.5 text-right tabular-nums">{fmtQty(line.quantity, line.unit)}</td>
                    <td className="py-1.5 pl-2 text-gray-500">{line.unit}</td>
                    <td className="py-1.5 text-right tabular-nums">{fmtCurrency(line.unit_price)}</td>
                    {showDiscount && (
                      <td className="py-1.5 text-right tabular-nums">{line.discount_percent > 0 ? `${line.discount_percent}%` : ""}</td>
                    )}
                    <td className="py-1.5 text-right font-medium tabular-nums">{fmtCurrency(lineTotal)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Totals */}
      <div className="px-10 pb-8">
        <div className="border-t-2 border-gray-800 pt-3 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Sum eks. mva</span>
            <span className="font-medium tabular-nums">{fmtCurrency(totals.totalExVat)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">MVA (25%)</span>
            <span className="tabular-nums">{fmtCurrency(totals.totalVat)}</span>
          </div>
          <div className="flex justify-between text-base font-bold pt-1 border-t border-gray-300">
            <span>Totalt inkl. mva</span>
            <span className="tabular-nums">{fmtCurrency(totals.totalIncVat)}</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-10 pb-10 pt-4 border-t border-gray-200">
        <div className="text-xs text-gray-400 text-center space-y-0.5">
          {company?.company_name && <div className="font-medium text-gray-500">{company.company_name}</div>}
          <div>
            {[company?.address, [company?.postal_code, company?.city].filter(Boolean).join(" ")].filter(Boolean).join(" • ")}
          </div>
          {company?.bank_account && <div>Konto: {company.bank_account}</div>}
          {company?.website && <div>{company.website}</div>}
        </div>
      </div>
    </div>
  );
}
