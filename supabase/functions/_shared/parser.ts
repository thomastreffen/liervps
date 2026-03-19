/**
 * Parser framework and import services for supplier product imports.
 * Extracted from supplier-integration to reduce edge function compile size.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

type SupabaseAdmin = ReturnType<typeof createClient>;

// ===== File sniffing & delimiter detection =====

const DELIMITERS = [";", "\t", ",", "|"] as const;

export function detectDelimiter(lines: string[]): string {
  const sample = lines.slice(0, Math.min(10, lines.length));
  let best = ";";
  let bestScore = 0;

  for (const d of DELIMITERS) {
    const counts = sample.map((l) => l.split(d).length - 1);
    if (counts.length === 0) continue;
    const consistent = counts.every((c) => c === counts[0] && c > 0);
    const avgCount = counts.reduce((a, b) => a + b, 0) / counts.length;
    const score = consistent ? avgCount * 10 : avgCount;
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  console.log(`[parser] Detected delimiter: "${best === "\t" ? "TAB" : best}" (score: ${bestScore})`);
  return best;
}

export function detectHeaderRow(lines: string[], delimiter: string): { headerIndex: number; headers: string[] } {
  for (let i = 0; i < Math.min(3, lines.length); i++) {
    const cols = lines[i].split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ""));
    const nonNumericCount = cols.filter((c) => c.length > 0 && isNaN(Number(c.replace(",", ".")))).length;
    if (nonNumericCount > cols.length * 0.5) {
      return { headerIndex: i, headers: cols.map((h) => h.toLowerCase().trim()) };
    }
  }
  const cols = lines[0]?.split(delimiter).map((c) => c.trim().replace(/^"|"$/g, "").toLowerCase()) ?? [];
  return { headerIndex: 0, headers: cols };
}

// ===== Value normalization =====

export function parseNumber(raw: string | undefined | null): number | null {
  if (!raw || raw.trim() === "") return null;
  let cleaned = raw.trim().replace(/\s/g, "");
  if (cleaned.includes(".") && cleaned.includes(",") && cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (cleaned.includes(",") && !cleaned.includes(".")) {
    cleaned = cleaned.replace(",", ".");
  }
  cleaned = cleaned.replace(/[^0-9.\-]/g, "");
  const val = parseFloat(cleaned);
  return isNaN(val) ? null : val;
}

function cleanString(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/^"|"$/g, "").trim();
  return cleaned.length > 0 ? cleaned : null;
}

// ===== Supplier mapping profiles =====

interface ColumnMapping {
  supplier_sku?: string[];
  el_number?: string[];
  ean?: string[];
  product_name?: string[];
  description?: string[];
  brand?: string[];
  unit?: string[];
  category?: string[];
  list_price?: string[];
  discount_percent?: string[];
  net_price?: string[];
}

const GENERIC_MAPPING: ColumnMapping = {
  supplier_sku: ["artikkel", "artikkelkode", "artikkelnr", "artnr", "art.nr", "artikkel_nr", "sku", "item_number", "varenr", "varenummer"],
  el_number: ["elnummer", "el_nummer", "el.nr", "elnr", "el-nr", "el_nr", "el number"],
  ean: ["ean", "ean13", "ean_kode", "ean-kode", "gtin", "strekkode"],
  product_name: ["beskrivelse", "produktnavn", "artikkel_tekst", "artikkeltekst", "artikkelbeskrivelse", "name", "product_name", "tekst", "varetekst", "varenavn"],
  description: ["tilleggstekst", "detaljert_beskrivelse", "long_description", "tillegg", "description"],
  brand: ["merke", "brand", "produsent", "leverandør_merke", "manufacturer"],
  unit: ["enhet", "unit", "mål", "pakningsenhet", "mengde_enhet"],
  category: ["kategori", "category", "gruppe", "varegruppe", "produktgruppe", "hovedgruppe"],
  list_price: ["bruttopris", "brutto", "listepris", "liste_pris", "list_price", "gross_price", "pris", "veil.pris", "veiledende"],
  discount_percent: ["rabatt", "rabatt%", "rabatt_prosent", "discount", "discount_percent", "rabatt_pst"],
  net_price: ["nettopris", "netto", "netto_pris", "net_price", "din_pris", "innkjøpspris", "kjøpspris"],
};

const ONNINEN_MAPPING: ColumnMapping = {
  supplier_sku: ["artikkelnr", "artikkel", "artnr", "varenr"],
  el_number: ["elnr", "el.nr", "elnummer", "el_nummer"],
  ean: ["ean", "ean13"],
  product_name: ["beskrivelse", "artikkeltekst", "produktnavn", "tekst", "varetekst"],
  brand: ["merke", "brand", "produsent"],
  unit: ["enhet", "unit"],
  category: ["gruppe", "varegruppe", "kategori"],
  list_price: ["bruttopris", "brutto", "listepris", "pris"],
  discount_percent: ["rabatt", "rabatt%", "rabatt_prosent"],
  net_price: ["nettopris", "netto", "netto_pris"],
};

function getSupplierMapping(supplierCode: string | null): ColumnMapping {
  if (supplierCode?.toUpperCase() === "ONNINEN") return ONNINEN_MAPPING;
  return GENERIC_MAPPING;
}

// ===== Column resolver =====

function resolveColumn(headers: string[], candidates: string[]): number {
  for (const candidate of candidates) {
    const idx = headers.indexOf(candidate);
    if (idx !== -1) return idx;
  }
  for (const candidate of candidates) {
    const idx = headers.findIndex((h) => h.includes(candidate));
    if (idx !== -1) return idx;
  }
  return -1;
}

interface ResolvedColumns {
  supplier_sku: number;
  el_number: number;
  ean: number;
  product_name: number;
  description: number;
  brand: number;
  unit: number;
  category: number;
  list_price: number;
  discount_percent: number;
  net_price: number;
}

function resolveAllColumns(headers: string[], mapping: ColumnMapping): { columns: ResolvedColumns; missing: string[] } {
  const columns: ResolvedColumns = {
    supplier_sku: resolveColumn(headers, mapping.supplier_sku ?? GENERIC_MAPPING.supplier_sku!),
    el_number: resolveColumn(headers, mapping.el_number ?? GENERIC_MAPPING.el_number!),
    ean: resolveColumn(headers, mapping.ean ?? GENERIC_MAPPING.ean!),
    product_name: resolveColumn(headers, mapping.product_name ?? GENERIC_MAPPING.product_name!),
    description: resolveColumn(headers, mapping.description ?? GENERIC_MAPPING.description!),
    brand: resolveColumn(headers, mapping.brand ?? GENERIC_MAPPING.brand!),
    unit: resolveColumn(headers, mapping.unit ?? GENERIC_MAPPING.unit!),
    category: resolveColumn(headers, mapping.category ?? GENERIC_MAPPING.category!),
    list_price: resolveColumn(headers, mapping.list_price ?? GENERIC_MAPPING.list_price!),
    discount_percent: resolveColumn(headers, mapping.discount_percent ?? GENERIC_MAPPING.discount_percent!),
    net_price: resolveColumn(headers, mapping.net_price ?? GENERIC_MAPPING.net_price!),
  };
  const missing: string[] = [];
  if (columns.supplier_sku === -1) missing.push("supplier_sku");
  if (columns.product_name === -1) missing.push("product_name");
  if (columns.list_price === -1 && columns.net_price === -1) missing.push("list_price/net_price");
  return { columns, missing };
}

// ===== Row parser =====

interface ParsedRow {
  supplier_sku: string | null;
  el_number: string | null;
  ean: string | null;
  product_name: string | null;
  description: string | null;
  brand: string | null;
  unit: string | null;
  category: string | null;
  list_price: number | null;
  discount_percent: number | null;
  net_price: number | null;
  raw_fields: Record<string, string>;
}

function parseRow(fields: string[], columns: ResolvedColumns, headers: string[]): ParsedRow {
  const get = (idx: number) => (idx >= 0 && idx < fields.length ? fields[idx]?.trim().replace(/^"|"$/g, "") : null);
  const rawFields: Record<string, string> = {};
  headers.forEach((h, i) => { if (i < fields.length) rawFields[h] = fields[i]?.trim() ?? ""; });

  let listPrice = parseNumber(get(columns.list_price));
  let discountPct = parseNumber(get(columns.discount_percent));
  let netPrice = parseNumber(get(columns.net_price));

  if (netPrice === null && listPrice !== null && discountPct !== null) {
    netPrice = Math.round(listPrice * (1 - discountPct / 100) * 100) / 100;
  }

  return {
    supplier_sku: cleanString(get(columns.supplier_sku)),
    el_number: cleanString(get(columns.el_number)),
    ean: cleanString(get(columns.ean)),
    product_name: cleanString(get(columns.product_name)),
    description: cleanString(get(columns.description)),
    brand: cleanString(get(columns.brand)),
    unit: cleanString(get(columns.unit)),
    category: cleanString(get(columns.category)),
    list_price: listPrice,
    discount_percent: discountPct,
    net_price: netPrice,
    raw_fields: rawFields,
  };
}

// ===== Import services =====

async function upsertSupplierProduct(
  supabaseAdmin: SupabaseAdmin, companyId: string, supplierId: string, row: ParsedRow,
): Promise<{ id: string; isNew: boolean }> {
  const { data: existing } = await supabaseAdmin
    .from("supplier_products").select("id")
    .eq("company_id", companyId).eq("supplier_id", supplierId).eq("supplier_sku", row.supplier_sku!)
    .maybeSingle();

  const now = new Date().toISOString();
  if (existing) {
    await supabaseAdmin.from("supplier_products").update({
      supplier_product_name: row.product_name, supplier_product_description: row.description,
      raw_category: row.category, raw_brand: row.brand, raw_unit: row.unit,
      raw_payload: row.raw_fields, last_seen_at: now, updated_at: now,
    }).eq("id", existing.id);
    return { id: existing.id, isNew: false };
  }

  const { data: inserted, error } = await supabaseAdmin.from("supplier_products").insert({
    company_id: companyId, supplier_id: supplierId, supplier_sku: row.supplier_sku!,
    supplier_product_name: row.product_name, supplier_product_description: row.description,
    raw_category: row.category, raw_brand: row.brand, raw_unit: row.unit,
    raw_payload: row.raw_fields, last_seen_at: now,
  }).select("id").single();

  if (error) throw new Error(`Upsert supplier_product: ${error.message}`);
  return { id: inserted.id, isNew: true };
}

async function matchCatalogProduct(supabaseAdmin: SupabaseAdmin, companyId: string, row: ParsedRow): Promise<string | null> {
  if (row.el_number) {
    const { data } = await supabaseAdmin.from("supplier_catalog_products").select("id")
      .eq("company_id", companyId).eq("el_number", row.el_number).limit(1).maybeSingle();
    if (data) return data.id;
  }
  if (row.ean) {
    const { data } = await supabaseAdmin.from("supplier_catalog_products").select("id")
      .eq("company_id", companyId).eq("ean", row.ean).limit(1).maybeSingle();
    if (data) return data.id;
  }
  return null;
}

async function autoCreateCatalogProduct(supabaseAdmin: SupabaseAdmin, companyId: string, row: ParsedRow): Promise<string | null> {
  if (!row.product_name || (!row.el_number && !row.ean)) return null;
  const { data, error } = await supabaseAdmin.from("supplier_catalog_products").insert({
    company_id: companyId, name: row.product_name, el_number: row.el_number,
    ean: row.ean, brand: row.brand, unit: row.unit, category: row.category,
    description: row.description, is_active: true,
  }).select("id").single();
  if (error) { console.warn(`[catalog] Auto-create failed: ${error.message}`); return null; }
  return data.id;
}

async function upsertSupplierPrice(
  supabaseAdmin: SupabaseAdmin, companyId: string, supplierId: string,
  supplierProductId: string, row: ParsedRow, fileName: string,
): Promise<void> {
  if (row.list_price === null && row.net_price === null) return;
  await supabaseAdmin.from("supplier_prices").insert({
    company_id: companyId, supplier_id: supplierId, supplier_product_id: supplierProductId,
    list_price: row.list_price ?? 0, discount_percent: row.discount_percent,
    net_price: row.net_price, currency: "NOK", source_file_name: fileName,
    imported_at: new Date().toISOString(),
  });
}

// ===== Price cache recalculation =====

export async function rebuildPriceCache(supabaseAdmin: SupabaseAdmin, companyId: string, productIds: string[]) {
  if (productIds.length === 0) return;
  const uniqueIds = [...new Set(productIds)];
  console.log(`[cache] Rebuilding price cache for ${uniqueIds.length} products`);

  for (const productId of uniqueIds) {
    const { data: prices } = await supabaseAdmin
      .from("supplier_prices")
      .select("supplier_id, net_price, list_price, discount_percent")
      .eq("company_id", companyId)
      .in("supplier_product_id",
        (await supabaseAdmin.from("supplier_products").select("id")
          .eq("company_id", companyId).eq("product_id", productId)
        ).data?.map((sp: any) => sp.id) ?? []
      )
      .order("imported_at", { ascending: false });

    if (!prices || prices.length === 0) continue;

    let bestPrice: number | null = null;
    let bestSupplierId: string | null = null;
    const snapshot: Record<string, unknown> = {};

    for (const p of prices) {
      const effective = p.net_price ?? p.list_price;
      if (effective !== null && (bestPrice === null || effective < bestPrice)) {
        bestPrice = effective;
        bestSupplierId = p.supplier_id;
      }
      if (!snapshot[p.supplier_id]) {
        snapshot[p.supplier_id] = { net_price: p.net_price, list_price: p.list_price, discount_percent: p.discount_percent };
      }
    }

    const { data: existing } = await supabaseAdmin.from("product_price_cache").select("id")
      .eq("company_id", companyId).eq("product_id", productId).maybeSingle();

    const cacheData = {
      company_id: companyId, product_id: productId, best_supplier_id: bestSupplierId,
      best_net_price: bestPrice, price_snapshot: snapshot, recalculated_at: new Date().toISOString(),
    };

    if (existing) {
      await supabaseAdmin.from("product_price_cache").update(cacheData).eq("id", existing.id);
    } else {
      await supabaseAdmin.from("product_price_cache").insert(cacheData);
    }
  }
}

// ===== Import stats =====

export interface ImportStats {
  rows_processed: number;
  rows_inserted: number;
  rows_updated: number;
  rows_failed: number;
  rows_skipped: number;
  rows_needs_review: number;
  errors: string[];
  affected_product_ids: string[];
}

// ===== Main parseFile =====

export async function parseFile(params: {
  supabaseAdmin: SupabaseAdmin;
  supplierId: string;
  supplierCode: string | null;
  companyId: string;
  importJobId: string;
  fileType: string;
  fileName: string;
  fileContent: string;
}): Promise<ImportStats> {
  const { supabaseAdmin, supplierId, supplierCode, companyId, importJobId, fileType, fileName, fileContent } = params;

  const stats: ImportStats = {
    rows_processed: 0, rows_inserted: 0, rows_updated: 0, rows_failed: 0,
    rows_skipped: 0, rows_needs_review: 0, errors: [], affected_product_ids: [],
  };

  const rawLines = fileContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (rawLines.length < 2) {
    stats.errors.push(`${fileName}: Filen har for få rader (${rawLines.length})`);
    return stats;
  }

  const delimiter = detectDelimiter(rawLines);
  const { headerIndex, headers } = detectHeaderRow(rawLines, delimiter);
  console.log(`[parser] ${fileName}: ${rawLines.length} rader, header=${headerIndex}, ${headers.length} kolonner`);
  console.log(`[parser] Headers: ${headers.join(" | ")}`);

  const mapping = getSupplierMapping(supplierCode);
  const { columns, missing } = resolveAllColumns(headers, mapping);

  if (columns.supplier_sku === -1) {
    stats.errors.push(`${fileName}: Kunne ikke finne artikkelkode-kolonne. Kolonner: ${headers.join(", ")}`);
    return stats;
  }
  if (missing.length > 0) console.warn(`[parser] ${fileName}: Missing: ${missing.join(", ")}`);

  const dataLines = rawLines.slice(headerIndex + 1);

  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i];
    const rowNumber = i + headerIndex + 2;
    stats.rows_processed++;

    let parseStatus = "parsed";
    let errorMessage: string | null = null;
    let linkedProductId: string | null = null;
    let linkedSupplierProductId: string | null = null;

    try {
      const fields = line.split(delimiter);
      const parsed = parseRow(fields, columns, headers);

      if (!parsed.supplier_sku) {
        parseStatus = "skipped";
        errorMessage = "Manglende artikkelkode";
        stats.rows_skipped++;
        await supabaseAdmin.from("product_import_rows").insert({
          company_id: companyId, import_job_id: importJobId, row_number: rowNumber,
          row_type: fileType, raw_data: parsed.raw_fields, parse_status: parseStatus, error_message: errorMessage,
        });
        continue;
      }

      const { id: spId, isNew } = await upsertSupplierProduct(supabaseAdmin, companyId, supplierId, parsed);
      linkedSupplierProductId = spId;
      if (isNew) stats.rows_inserted++; else stats.rows_updated++;

      let catalogProductId = await matchCatalogProduct(supabaseAdmin, companyId, parsed);
      if (!catalogProductId) catalogProductId = await autoCreateCatalogProduct(supabaseAdmin, companyId, parsed);

      if (catalogProductId) {
        await supabaseAdmin.from("supplier_products").update({ product_id: catalogProductId }).eq("id", spId);
        linkedProductId = catalogProductId;
        stats.affected_product_ids.push(catalogProductId);
      } else {
        parseStatus = "needs_review";
        errorMessage = "Ingen match i produktkatalog";
        stats.rows_needs_review++;
      }

      await upsertSupplierPrice(supabaseAdmin, companyId, supplierId, spId, parsed, fileName);
    } catch (rowErr) {
      parseStatus = "failed";
      errorMessage = (rowErr as Error).message.substring(0, 500);
      stats.rows_failed++;
      stats.errors.push(`Rad ${rowNumber}: ${errorMessage}`);
    }

    try {
      const fields = line.split(delimiter);
      const rawObj: Record<string, string> = {};
      headers.forEach((h, idx) => { rawObj[h] = fields[idx]?.trim() ?? ""; });
      await supabaseAdmin.from("product_import_rows").insert({
        company_id: companyId, import_job_id: importJobId, row_number: rowNumber,
        row_type: fileType, raw_data: rawObj, parse_status: parseStatus as any,
        error_message: errorMessage, linked_product_id: linkedProductId,
        linked_supplier_product_id: linkedSupplierProductId,
      });
    } catch (insertErr) {
      console.error(`[parser] Failed to save row ${rowNumber}: ${(insertErr as Error).message}`);
    }
  }

  try {
    await rebuildPriceCache(supabaseAdmin, companyId, stats.affected_product_ids);
  } catch (cacheErr) {
    console.error(`[parser] Cache rebuild error: ${(cacheErr as Error).message}`);
    stats.errors.push(`Price cache rebuild feilet: ${(cacheErr as Error).message}`);
  }

  console.log(`[parser] ${fileName} done: processed=${stats.rows_processed}, inserted=${stats.rows_inserted}, updated=${stats.rows_updated}, failed=${stats.rows_failed}`);
  return stats;
}
