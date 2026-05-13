// Tripletex worktime CSV/Excel parser + mapping helpers
import { parseCSV, parseNorwegianDate, parseNorwegianDecimal, getCol, readFileWithEncoding } from "@/lib/tripletex-csv-parser";

export interface WorktimeMapping {
  employee_name?: string;
  employee_number?: string;
  employee_email?: string;
  date?: string;
  start_time?: string;
  end_time?: string;
  break_minutes?: string;
  ordinary_hours?: string;
  overtime_hours?: string;
  total_hours?: string;
  project?: string;
  project_number?: string;
  time_type?: string;
  external_id?: string;
}

export interface WorktimeRow {
  employee_name: string;
  employee_number?: string;
  employee_email?: string;
  work_date: string;
  start_at?: string;
  end_at?: string;
  break_minutes: number;
  ordinary_hours: number;
  hours_overtime: number;
  total_hours: number;
  project_number_raw?: string;
  project_label?: string;
  time_type?: string;
  source_external_id?: string;
  raw: Record<string, string>;
}

const MAP_HINTS: Record<keyof WorktimeMapping, string[]> = {
  employee_name: ["ansatt", "navn", "ansattnavn", "employee", "employee name"],
  employee_number: ["ansattnummer", "ansatt nr", "employee number", "ansatt-id"],
  employee_email: ["e-post", "epost", "email"],
  date: ["dato", "date", "arbeidsdato"],
  start_time: ["start", "starttid", "fra"],
  end_time: ["slutt", "sluttid", "til"],
  break_minutes: ["pause", "pause (min)", "lunsj"],
  ordinary_hours: ["ordinære timer", "ordinaer timer", "normaltimer", "ord", "ord. timer"],
  overtime_hours: ["overtid", "overtidstimer", "ot", "ot timer"],
  total_hours: ["totaltimer", "sum", "sum timer", "antall timer", "timer"],
  project: ["prosjekt", "project", "prosjektnavn"],
  project_number: ["prosjektnummer", "project number", "prosjektnr"],
  time_type: ["timeart", "type", "kategori"],
  external_id: ["id", "linje-id", "linje id", "external id"],
};

export function autoMapHeaders(headers: string[]): WorktimeMapping {
  const map: WorktimeMapping = {};
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const [field, hints] of Object.entries(MAP_HINTS) as [keyof WorktimeMapping, string[]][]) {
    for (const h of hints) {
      const idx = lower.findIndex((x) => x === h || x.includes(h));
      if (idx >= 0) {
        map[field] = headers[idx];
        break;
      }
    }
  }
  return map;
}

function parseTime(date: string, raw: string): string | undefined {
  if (!raw) return undefined;
  const m = raw.trim().match(/^(\d{1,2})[:.](\d{2})/);
  if (!m) return undefined;
  const hh = m[1].padStart(2, "0");
  return `${date}T${hh}:${m[2]}:00`;
}

export function applyMapping(rows: Record<string, string>[], map: WorktimeMapping): WorktimeRow[] {
  const out: WorktimeRow[] = [];
  for (const r of rows) {
    const name = map.employee_name ? (r[map.employee_name] || "").trim() : "";
    const dateRaw = map.date ? r[map.date] : "";
    const work_date = parseNorwegianDate(dateRaw) ?? "";
    if (!name || !work_date) continue;
    const ord = parseNorwegianDecimal(r[map.ordinary_hours ?? ""] ?? "") ?? 0;
    const ot = parseNorwegianDecimal(r[map.overtime_hours ?? ""] ?? "") ?? 0;
    const total =
      parseNorwegianDecimal(r[map.total_hours ?? ""] ?? "") ?? ord + ot;
    out.push({
      employee_name: name,
      employee_number: map.employee_number ? r[map.employee_number] : undefined,
      employee_email: map.employee_email ? r[map.employee_email] : undefined,
      work_date,
      start_at: map.start_time ? parseTime(work_date, r[map.start_time] ?? "") : undefined,
      end_at: map.end_time ? parseTime(work_date, r[map.end_time] ?? "") : undefined,
      break_minutes: parseNorwegianDecimal(r[map.break_minutes ?? ""] ?? "") ?? 0,
      ordinary_hours: ord,
      hours_overtime: ot,
      total_hours: total,
      project_number_raw: map.project_number ? r[map.project_number] : undefined,
      project_label: map.project ? r[map.project] : undefined,
      time_type: map.time_type ? r[map.time_type] : undefined,
      source_external_id: map.external_id ? r[map.external_id] : undefined,
      raw: r,
    });
  }
  return out;
}

export async function readWorktimeFile(file: File): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    const XLSX = await import("xlsx");
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "", raw: false });
    const headers = json.length > 0 ? Object.keys(json[0]) : [];
    const rows = json.map((r) => {
      const out: Record<string, string> = {};
      for (const h of headers) out[h] = String(r[h] ?? "").trim();
      return out;
    });
    return { headers, rows };
  }
  const text = await readFileWithEncoding(file);
  const parsed = parseCSV(text);
  return { headers: parsed.headers, rows: parsed.rows };
}

export async function buildSourceHash(parts: (string | number | null | undefined)[]): Promise<string> {
  const s = parts.map((p) => (p === null || p === undefined ? "" : String(p))).join("|");
  const data = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
