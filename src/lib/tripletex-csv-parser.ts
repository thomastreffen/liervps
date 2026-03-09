/**
 * Tripletex CSV parser with Norwegian format support.
 * Handles: comma as decimal, Norwegian dates, empty fields, BOM, semicolon delimiter.
 * Encoding: tries UTF-8 first, falls back to Windows-1252 / Latin-1.
 */

export interface ParsedCSV {
  headers: string[];
  rows: Record<string, string>[];
  rawRowCount: number;
}

const PROJECT_COLUMNS = [
  "prosjektnavn", "prosjektnummer", "startdato", "sluttdato",
  "kundenavn", "kundenummer", "kontaktens navn", "referanse",
  "hovedprosjekt", "prosjektleder", "avdeling", "kategori",
  "prosjektbeskrivelse", "internprosjekt", "mva-kode", "valuta",
  "påslag", "kontraktstype",
];

const OFFER_COLUMNS = [
  "nummer", "tilbudsdato", "kundenummer", "kundenavn",
  "organisasjonsnummer", "kontaktperson", "vår kontakt",
  "referanse", "leveringsadresse", "leveringsdato", "valuta",
  "beskrivelse", "antall", "enhetspris", "rabatt", "mva-sats",
  "beløp", "ordrebeløp",
];

export type DetectedFileType = "project" | "quote" | "unknown";

export function detectFileType(headers: string[]): DetectedFileType {
  const lower = headers.map(h => h.toLowerCase().trim());

  const projectHits = PROJECT_COLUMNS.filter(c => lower.includes(c)).length;
  const offerHits = OFFER_COLUMNS.filter(c => lower.includes(c)).length;

  if (projectHits >= 3 && projectHits > offerHits) return "project";
  if (offerHits >= 3) return "quote";
  return "unknown";
}

/** Detect if text has encoding issues (replacement chars or garbled Norwegian) */
function hasEncodingIssues(text: string): boolean {
  // Check for replacement character
  if (text.includes('\uFFFD')) return true;
  // Common garbled patterns for æøå in Windows-1252 read as UTF-8
  const garbled = ['Ã¦', 'Ã¸', 'Ã¥', 'Ã†', 'Ã˜', 'Ã…', 'Ã¶', 'Ã¤', 'Ã¼', 'Â'];
  return garbled.some(g => text.includes(g));
}

/** Read file with encoding detection: UTF-8 first, fallback to Windows-1252 */
export async function readFileWithEncoding(file: File): Promise<string> {
  // Try UTF-8 first
  const utf8Text = await file.text();
  if (!hasEncodingIssues(utf8Text)) {
    return utf8Text;
  }

  // Fallback to Windows-1252 (Latin-1 superset, standard for Norwegian Windows exports)
  const buffer = await file.arrayBuffer();
  const decoder = new TextDecoder('windows-1252');
  return decoder.decode(buffer);
}

export function parseCSV(text: string): ParsedCSV {
  // Remove BOM
  let clean = text.replace(/^\uFEFF/, "");

  // Detect delimiter: semicolon (Tripletex default) or comma
  const firstLine = clean.split(/\r?\n/)[0] || "";
  const delimiter = firstLine.includes(";") ? ";" : ",";

  const lines = clean.split(/\r?\n/).filter(l => l.trim() !== "");
  if (lines.length === 0) return { headers: [], rows: [], rawRowCount: 0 };

  const headers = parseLine(lines[0], delimiter).map(h => h.trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i], delimiter);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (values[idx] ?? "").trim();
    });
    rows.push(row);
  }

  return { headers, rows, rawRowCount: rows.length };
}

function parseLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        result.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

/** Parse Norwegian date formats: dd.mm.yyyy, dd/mm/yyyy, yyyy-mm-dd */
export function parseNorwegianDate(val: string): string | null {
  if (!val || val.trim() === "") return null;
  const v = val.trim();

  // yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.substring(0, 10);

  // dd.mm.yyyy or dd/mm/yyyy
  const match = v.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (match) {
    const [, d, m, y] = match;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

/** Parse Norwegian decimal: "1 234,56" → 1234.56 */
export function parseNorwegianDecimal(val: string): number | null {
  if (!val || val.trim() === "") return null;
  const cleaned = val.trim().replace(/\s/g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/** Find a column value case-insensitively from a row */
export function getCol(row: Record<string, string>, ...candidates: string[]): string {
  for (const c of candidates) {
    const lower = c.toLowerCase();
    const key = Object.keys(row).find(k => k.toLowerCase() === lower);
    if (key && row[key]) return row[key];
  }
  return "";
}

/** Simple string similarity (Dice coefficient) for fuzzy matching */
export function stringSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const sa = a.toLowerCase().trim();
  const sb = b.toLowerCase().trim();
  if (sa === sb) return 1;
  if (sa.length < 2 || sb.length < 2) return 0;
  
  const bigramsA = new Set<string>();
  for (let i = 0; i < sa.length - 1; i++) bigramsA.add(sa.substring(i, i + 2));
  
  const bigramsB = new Set<string>();
  for (let i = 0; i < sb.length - 1; i++) bigramsB.add(sb.substring(i, i + 2));
  
  let intersection = 0;
  for (const bg of bigramsA) {
    if (bigramsB.has(bg)) intersection++;
  }
  
  return (2 * intersection) / (bigramsA.size + bigramsB.size);
}

export interface GroupedOffer {
  number: string;
  date: string;
  customerNumber: string;
  customerName: string;
  orgNumber: string;
  contactPerson: string;
  ourContact: string;
  reference: string;
  deliveryAddress: string;
  deliveryDate: string;
  currency: string;
  orderAmount: string;
  lines: {
    description: string;
    quantity: number | null;
    unitPrice: number | null;
    discount: number | null;
    vatRate: number | null;
    amount: number | null;
  }[];
  rawRows: Record<string, string>[];
}

/** Group offer rows by "Nummer" */
export function groupOfferRows(rows: Record<string, string>[]): GroupedOffer[] {
  const map = new Map<string, GroupedOffer>();

  for (const row of rows) {
    const num = getCol(row, "Nummer");
    if (!num) continue;

    if (!map.has(num)) {
      map.set(num, {
        number: num,
        date: getCol(row, "Tilbudsdato"),
        customerNumber: getCol(row, "Kundenummer"),
        customerName: getCol(row, "Kundenavn"),
        orgNumber: getCol(row, "Organisasjonsnummer"),
        contactPerson: getCol(row, "Kontaktperson"),
        ourContact: getCol(row, "Vår kontakt"),
        reference: getCol(row, "Referanse"),
        deliveryAddress: getCol(row, "Leveringsadresse"),
        deliveryDate: getCol(row, "Leveringsdato"),
        currency: getCol(row, "Valuta"),
        orderAmount: getCol(row, "Ordrebeløp"),
        lines: [],
        rawRows: [],
      });
    }

    const offer = map.get(num)!;
    offer.lines.push({
      description: getCol(row, "Beskrivelse"),
      quantity: parseNorwegianDecimal(getCol(row, "Antall")),
      unitPrice: parseNorwegianDecimal(getCol(row, "Enhetspris")),
      discount: parseNorwegianDecimal(getCol(row, "Rabatt")),
      vatRate: parseNorwegianDecimal(getCol(row, "Mva-sats")),
      amount: parseNorwegianDecimal(getCol(row, "Beløp")),
    });
    offer.rawRows.push(row);
  }

  return Array.from(map.values());
}
