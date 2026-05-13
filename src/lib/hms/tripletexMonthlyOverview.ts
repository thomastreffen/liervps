// Parser for Tripletex "Månedsoversikt" wide-format CSV.
// Each row = (employee, activity); each day-column (1..31) holds hours for that day.
import { parseCSV, parseNorwegianDecimal, readFileWithEncoding } from "@/lib/tripletex-csv-parser";

export const TRIPLETEX_MONTHLY_SOURCE = "tripletex_monthly_overview";

export type ActivityKind =
  | "ordinary"
  | "overtime_50"
  | "overtime_100"
  | "absence_vacation"
  | "absence_sick"
  | "payroll_compensation"
  | "unknown";

export interface ActivityClassification {
  kind: ActivityKind;
  /** True if hours count toward AML worktime totals. */
  countsAsWork: boolean;
  /** True if also counted as overtime hours (in addition to worked hours). */
  countsAsOvertime: boolean;
  label: string;
}

const ACTIVITY_RULES: Array<{ test: RegExp; result: Omit<ActivityClassification, "label"> }> = [
  // Overtime variants — worked hours AND overtime hours
  { test: /overtid.*100|100.*overtid/i, result: { kind: "overtime_100", countsAsWork: true, countsAsOvertime: true } },
  { test: /overtid.*50|50.*overtid/i,   result: { kind: "overtime_50",  countsAsWork: true, countsAsOvertime: true } },
  // Absences — do NOT count as work
  { test: /ferie/i,                              result: { kind: "absence_vacation", countsAsWork: false, countsAsOvertime: false } },
  { test: /sykemeld|syk(dom)?/i,                 result: { kind: "absence_sick",     countsAsWork: false, countsAsOvertime: false } },
  // Compensation that is paid but not worked time
  { test: /helligdag|helligdagsgodtgj/i,         result: { kind: "payroll_compensation", countsAsWork: false, countsAsOvertime: false } },
  // Ordinary worked time
  { test: /servicetimer|montør|administrasjon|admin|lager|ventetid|arbeid/i,
    result: { kind: "ordinary", countsAsWork: true, countsAsOvertime: false } },
];

export function classifyActivity(name: string): ActivityClassification {
  const n = (name || "").trim();
  for (const r of ACTIVITY_RULES) {
    if (r.test.test(n)) return { ...r.result, label: n };
  }
  return { kind: "unknown", countsAsWork: true, countsAsOvertime: false, label: n };
}

const NORWEGIAN_MONTHS: Record<string, number> = {
  januar: 1, februar: 2, mars: 3, april: 4, mai: 5, juni: 6,
  juli: 7, august: 8, september: 9, oktober: 10, november: 11, desember: 12,
};

export function detectMonthYearFromFilename(name: string): { year: number; month: number } | null {
  const n = name.toLowerCase();
  // e.g. "Månedsoversikt - (April 2026).csv"
  const m = n.match(/(januar|februar|mars|april|mai|juni|juli|august|september|oktober|november|desember)[^\d]*(\d{4})/);
  if (m) return { year: parseInt(m[2], 10), month: NORWEGIAN_MONTHS[m[1]] };
  // e.g. "2026-04"
  const m2 = n.match(/(20\d{2})[-_\s]?(\d{1,2})/);
  if (m2) return { year: parseInt(m2[1], 10), month: parseInt(m2[2], 10) };
  return null;
}

const VACATION_BALANCE_HINTS = [
  "feriesaldo", "ferie saldo", "ferie til gode", "ferie igjen", "ferie i fjor",
  "feriedager", "rest ferie", "saldo",
];

function isVacationBalanceColumn(header: string): boolean {
  const h = header.toLowerCase().trim();
  return VACATION_BALANCE_HINTS.some((hint) => h.includes(hint));
}

export interface DayColumn {
  header: string;
  day: number;
}

/** Find columns whose header is purely numeric (1..31) — those are day columns. */
export function findDayColumns(headers: string[]): DayColumn[] {
  const out: DayColumn[] = [];
  for (const h of headers) {
    const t = h.trim();
    if (!/^\d{1,2}$/.test(t)) continue;
    const d = parseInt(t, 10);
    if (d >= 1 && d <= 31) out.push({ header: h, day: d });
  }
  return out;
}

export function looksLikeMonthlyOverview(headers: string[]): boolean {
  const lower = headers.map((h) => h.toLowerCase().trim());
  const hasEmpNum = lower.some((h) => h.includes("ansattnummer"));
  const hasEmpName = lower.some((h) => h === "ansattnavn" || h.includes("ansattnavn"));
  const hasActivity = lower.some((h) => h.includes("aktivitet"));
  const dayCols = findDayColumns(headers);
  return hasEmpNum && hasEmpName && hasActivity && dayCols.length >= 5;
}

export interface MonthlyHeaderMap {
  dept_no?: string;
  dept_name?: string;
  emp_no?: string;
  emp_name?: string;
  act_no?: string;
  act_name?: string;
}

export function detectMonthlyHeaders(headers: string[]): MonthlyHeaderMap {
  const map: MonthlyHeaderMap = {};
  for (const h of headers) {
    const l = h.toLowerCase().trim();
    if (!map.dept_no && l.includes("avdelingsnummer")) map.dept_no = h;
    else if (!map.dept_name && l.includes("avdelingsnavn")) map.dept_name = h;
    else if (!map.emp_no && l.includes("ansattnummer")) map.emp_no = h;
    else if (!map.emp_name && l.includes("ansattnavn")) map.emp_name = h;
    else if (!map.act_no && l.includes("aktivitet") && l.includes("nummer")) map.act_no = h;
    else if (!map.act_name && l.includes("aktivitet") && (l.includes("navn") || l === "aktivitet")) map.act_name = h;
  }
  return map;
}

export interface NormalizedDayRow {
  employee_number: string;
  employee_name: string;
  activity_number: string;
  activity_name: string;
  classification: ActivityClassification;
  work_date: string; // YYYY-MM-DD
  hours: number;
  ordinary_hours: number;
  hours_overtime: number;
  total_hours: number;
  source_month: string; // YYYY-MM
}

function pad2(n: number) { return n.toString().padStart(2, "0"); }

export function expandMonthlyRows(
  rawRows: Record<string, string>[],
  headers: string[],
  year: number,
  month: number,
): NormalizedDayRow[] {
  const hmap = detectMonthlyHeaders(headers);
  const dayCols = findDayColumns(headers).filter((c) => !isVacationBalanceColumn(c.header));
  // Determine days in month
  const lastDay = new Date(year, month, 0).getDate();
  const out: NormalizedDayRow[] = [];

  for (const r of rawRows) {
    const emp_no = (hmap.emp_no ? r[hmap.emp_no] : "").trim();
    const emp_name = (hmap.emp_name ? r[hmap.emp_name] : "").trim();
    if (!emp_no && !emp_name) continue;
    const act_no = (hmap.act_no ? r[hmap.act_no] : "").trim();
    const act_name = (hmap.act_name ? r[hmap.act_name] : "").trim();
    const klass = classifyActivity(act_name);

    for (const c of dayCols) {
      if (c.day > lastDay) continue;
      const v = parseNorwegianDecimal(r[c.header] ?? "") ?? 0;
      if (!v || v <= 0) continue;
      const hours = v;
      const ordinary = klass.countsAsWork ? hours : 0;
      const overtime = klass.countsAsOvertime ? hours : 0;
      const total = klass.countsAsWork ? hours : 0;
      out.push({
        employee_number: emp_no,
        employee_name: emp_name,
        activity_number: act_no,
        activity_name: act_name,
        classification: klass,
        work_date: `${year}-${pad2(month)}-${pad2(c.day)}`,
        hours,
        ordinary_hours: ordinary,
        hours_overtime: overtime,
        total_hours: total,
        source_month: `${year}-${pad2(month)}`,
      });
    }
  }
  return out;
}

/** Aggregate rows that share (employee, date, activity) — sums all numeric fields. */
export function aggregateRows(rows: NormalizedDayRow[]): NormalizedDayRow[] {
  const map = new Map<string, NormalizedDayRow>();
  for (const r of rows) {
    const key = `${r.employee_number}|${r.work_date}|${r.activity_number}|${r.activity_name}`;
    const ex = map.get(key);
    if (!ex) {
      map.set(key, { ...r });
    } else {
      ex.hours += r.hours;
      ex.ordinary_hours += r.ordinary_hours;
      ex.hours_overtime += r.hours_overtime;
      ex.total_hours += r.total_hours;
    }
  }
  return Array.from(map.values());
}

export interface MonthlyParseResult {
  year: number;
  month: number;
  source_month: string;
  headers: string[];
  rawRows: Record<string, string>[];
  normalized: NormalizedDayRow[];
  dayColumns: DayColumn[];
  vacationBalanceColumns: string[];
  headerMap: MonthlyHeaderMap;
}

export async function parseTripletexMonthlyOverview(file: File): Promise<MonthlyParseResult> {
  const text = await readFileWithEncoding(file);
  const parsed = parseCSV(text);
  const headers = parsed.headers;
  if (!looksLikeMonthlyOverview(headers)) {
    throw new Error("Filen ser ikke ut som en Tripletex månedsoversikt (mangler ansatt/aktivitet/dagkolonner).");
  }
  const my = detectMonthYearFromFilename(file.name);
  if (!my) throw new Error("Klarte ikke å lese måned/år fra filnavn. Forventet f.eks. '… (April 2026).csv'.");
  const normalized = aggregateRows(expandMonthlyRows(parsed.rows, headers, my.year, my.month));
  return {
    year: my.year,
    month: my.month,
    source_month: `${my.year}-${pad2(my.month)}`,
    headers,
    rawRows: parsed.rows,
    normalized,
    dayColumns: findDayColumns(headers),
    vacationBalanceColumns: headers.filter(isVacationBalanceColumn),
    headerMap: detectMonthlyHeaders(headers),
  };
}

export async function buildMonthlySourceHash(parts: {
  company_id: string;
  employee_id: string;
  work_date: string;
  activity_number: string;
  activity_name: string;
  total_hours: number;
  source_month: string;
}): Promise<string> {
  const s = [
    parts.company_id,
    parts.employee_id,
    parts.work_date,
    parts.activity_number,
    parts.activity_name,
    parts.total_hours.toFixed(2),
    parts.source_month,
    TRIPLETEX_MONTHLY_SOURCE,
  ].join("|");
  const data = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export interface ImportSummary {
  employees_found: number;
  employees_unmatched: number;
  activities_classified: Record<ActivityKind, number>;
  activities_unknown: string[];
  worked_hours: number;
  overtime_hours: number;
  absence_hours: number;
  rows_to_create: number;
  rows_to_update: number;
  rows_skipped_duplicate: number;
}
