import type { MaterialItemRow } from "@/hooks/useMaterialList";

function escape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export interface CsvJobMeta {
  jobNumber: string;
  customer: string;
  address: string;
}

export function buildMaterialCsv(meta: CsvJobMeta, items: MaterialItemRow[]): string {
  const headers = ["Jobbnummer", "Kunde", "Adresse", "Elnr", "Beskrivelse", "Antall", "Enhet", "Leverandør", "Kommentar"];
  const lines = [headers.join(",")];
  for (const it of items) {
    lines.push(
      [
        escape(meta.jobNumber),
        escape(meta.customer),
        escape(meta.address),
        escape(it.elnr ?? ""),
        escape(it.description),
        escape(it.quantity_ordered),
        escape(it.unit),
        escape(it.supplier ?? ""),
        escape(it.comment ?? ""),
      ].join(","),
    );
  }
  return lines.join("\n");
}

export function downloadCsv(filename: string, content: string) {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
