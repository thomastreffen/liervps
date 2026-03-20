/**
 * Parser framework and import services for supplier product imports.
 * Supports: CSV/delimited files AND EFONELFO (Norwegian standard) format.
 * 
 * OPTIMIZED: Uses batch DB operations, skips no-op updates, minimal audit trail.
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
    if (score > bestScore) { bestScore = score; best = d; }
  }
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

// ===== Encoding helper =====

export function decodeRawBytes(raw: Uint8Array): string {
  let text = new TextDecoder("utf-8").decode(raw);
  if (text.includes("\ufffd")) {
    text = new TextDecoder("latin1").decode(raw);
    console.log(`[decode] Fell back to latin1 encoding (UTF-8 had replacement chars)`);
  }
  return text;
}

// ===== Timing helper =====
function timer() {
  const start = Date.now();
  return () => Date.now() - start;
}

// ===== EFONELFO Format Detection & Parsing =====

function isEfonelfoFormat(lines: string[]): boolean {
  for (const line of lines.slice(0, 5)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const fields = trimmed.split(";");
    const recordType = fields[0]?.toUpperCase().trim();
    if (["VH", "PH", "RH", "IH"].includes(recordType)) return true;
    if (fields[1]?.toUpperCase().trim() === "EFONELFO") return true;
  }
  return false;
}

interface EfonelfoProduct {
  supplier_sku: string;
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
}

function parseEfonelfoFile(lines: string[]): EfonelfoProduct[] {
  const products = new Map<string, EfonelfoProduct>();
  let vlCount = 0;
  let plCount = 0;
  let rlCount = 0;

  for (const line of lines) {
    const fields = line.split(";").map(f => f.trim());
    const recordType = fields[0]?.toUpperCase();

    if (recordType === "VL") {
      vlCount++;
      const sku = cleanString(fields[2]);
      if (!sku || products.has(sku)) continue;

      const rawPriceField = fields[9];
      const priceOre = parseNumber(rawPriceField);
      const listPrice = priceOre !== null && priceOre > 0 ? priceOre / 100 : null;

      if (vlCount <= 5) {
        console.log(`[EFONELFO] VL#${vlCount}: sku="${sku}" name="${fields[3]?.substring(0, 40)}" el="${fields[4]}" price_raw="${rawPriceField}" price_ore=${priceOre} list_nok=${listPrice} brand="${fields[14]}"`);
      }

      products.set(sku, {
        supplier_sku: sku,
        el_number: cleanString(fields[4]),
        ean: cleanString(fields[18]) || null,
        product_name: cleanString(fields[3]),
        description: null,
        unit: cleanString(fields[6]),
        brand: cleanString(fields[14]),
        category: cleanString(fields[8]),
        list_price: listPrice,
        discount_percent: null,
        net_price: null,
      });
    }
  }

  for (const line of lines) {
    const fields = line.split(";").map(f => f.trim());
    const recordType = fields[0]?.toUpperCase();

    if (recordType === "PL") {
      plCount++;
      const sku = cleanString(fields[2]);
      if (!sku) continue;
      const existing = products.get(sku);
      if (existing) {
        const plListOre = parseNumber(fields[3]);
        const plNetOre = parseNumber(fields[4]);
        const plDiscount = parseNumber(fields[5]);

        if (plListOre !== null && plListOre > 0) existing.list_price = plListOre / 100;
        if (plNetOre !== null && plNetOre > 0) existing.net_price = plNetOre / 100;
        if (plDiscount !== null) existing.discount_percent = plDiscount;

        if (plCount <= 5) {
          console.log(`[EFONELFO] PL#${plCount}: sku="${sku}" list_ore=${plListOre} net_ore=${plNetOre} disc=${plDiscount} → list=${existing.list_price} net=${existing.net_price}`);
        }
      }
    } else if (recordType === "RL") {
      rlCount++;
      const sku = cleanString(fields[1]);
      if (!sku) continue;
      const existing = products.get(sku);
      if (existing) {
        const rlDiscount = parseNumber(fields[2]);
        const rlNetOre = parseNumber(fields[3]);

        if (rlDiscount !== null) existing.discount_percent = rlDiscount;
        if (rlNetOre !== null && rlNetOre > 0) existing.net_price = rlNetOre / 100;

        if (rlCount <= 5) {
          console.log(`[EFONELFO] RL#${rlCount}: sku="${sku}" disc=${rlDiscount} net_ore=${rlNetOre} → disc=${existing.discount_percent} net=${existing.net_price}`);
        }
      }
    }
  }

  console.log(`[EFONELFO] Totals: VL=${vlCount}, PL=${plCount}, RL=${rlCount}, unique products=${products.size}`);

  let calcCount = 0;
  for (const p of products.values()) {
    if (p.net_price == null && p.list_price != null && p.discount_percent != null && p.discount_percent > 0) {
      p.net_price = Math.round(p.list_price * (1 - p.discount_percent / 100) * 100) / 100;
      calcCount++;
    }
  }
  if (calcCount > 0) console.log(`[EFONELFO] Calculated net_price for ${calcCount} products from list_price + discount`);

  let withListPrice = 0, withNetPrice = 0, withDiscount = 0, noPrice = 0;
  for (const p of products.values()) {
    if (p.list_price !== null) withListPrice++;
    if (p.net_price !== null) withNetPrice++;
    if (p.discount_percent !== null) withDiscount++;
    if (p.list_price === null && p.net_price === null) noPrice++;
  }
  console.log(`[EFONELFO] Price quality: list=${withListPrice}, net=${withNetPrice}, disc=${withDiscount}, no_price=${noPrice} of ${products.size}`);

  let sampleCount = 0;
  for (const p of products.values()) {
    if (sampleCount >= 5) break;
    if (p.list_price !== null || p.net_price !== null) {
      console.log(`[EFONELFO] PRICE_SAMPLE: sku=${p.supplier_sku} list=${p.list_price} disc=${p.discount_percent}% net=${p.net_price} name="${p.product_name?.substring(0, 30)}"`);
      sampleCount++;
    }
  }

  return Array.from(products.values());
}

// ===== Supplier mapping profiles =====

interface ColumnMapping {
  supplier_sku?: string[]; el_number?: string[]; ean?: string[]; product_name?: string[];
  description?: string[]; brand?: string[]; unit?: string[]; category?: string[];
  list_price?: string[]; discount_percent?: string[]; net_price?: string[];
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
  for (const c of candidates) { const idx = headers.indexOf(c); if (idx !== -1) return idx; }
  for (const c of candidates) { const idx = headers.findIndex((h) => h.includes(c)); if (idx !== -1) return idx; }
  return -1;
}

interface ResolvedColumns {
  supplier_sku: number; el_number: number; ean: number; product_name: number;
  description: number; brand: number; unit: number; category: number;
  list_price: number; discount_percent: number; net_price: number;
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
  supplier_sku: string | null; el_number: string | null; ean: string | null;
  product_name: string | null; description: string | null; brand: string | null;
  unit: string | null; category: string | null; list_price: number | null;
  discount_percent: number | null; net_price: number | null;
}

function parseRow(fields: string[], columns: ResolvedColumns): ParsedRow {
  const get = (idx: number) => (idx >= 0 && idx < fields.length ? fields[idx]?.trim().replace(/^"|"$/g, "") : null);
  let listPrice = parseNumber(get(columns.list_price));
  let discountPct = parseNumber(get(columns.discount_percent));
  let netPrice = parseNumber(get(columns.net_price));
  if (netPrice === null && listPrice !== null && discountPct !== null) {
    netPrice = Math.round(listPrice * (1 - discountPct / 100) * 100) / 100;
  }
  return {
    supplier_sku: cleanString(get(columns.supplier_sku)), el_number: cleanString(get(columns.el_number)),
    ean: cleanString(get(columns.ean)), product_name: cleanString(get(columns.product_name)),
    description: cleanString(get(columns.description)), brand: cleanString(get(columns.brand)),
    unit: cleanString(get(columns.unit)), category: cleanString(get(columns.category)),
    list_price: listPrice, discount_percent: discountPct, net_price: netPrice,
  };
}

// ===== BATCH Import Services =====

const BATCH_SIZE = 500;

/**
 * Batch upsert supplier_products.
 * OPTIMIZED: Only updates rows where data actually changed across ALL fields.
 */
async function batchUpsertSupplierProducts(
  sa: SupabaseAdmin, companyId: string, supplierId: string, rows: ParsedRow[],
): Promise<{ map: Map<string, { id: string; isNew: boolean; existingProductId: string | null }>; unchanged: number; updated: number }> {
  const map = new Map<string, { id: string; isNew: boolean; existingProductId: string | null }>();
  const skus = rows.map(r => r.supplier_sku!).filter(Boolean);
  if (skus.length === 0) return { map, unchanged: 0, updated: 0 };

  // Fetch existing with ALL comparable fields + product_id for link check
  interface ExistingProduct {
    id: string; supplier_sku: string; product_id: string | null;
    supplier_product_name: string | null;
    supplier_product_description: string | null; raw_category: string | null;
    raw_brand: string | null; raw_unit: string | null;
  }
  const existingMap = new Map<string, ExistingProduct>();
  for (let i = 0; i < skus.length; i += 200) {
    const batch = skus.slice(i, i + 200);
    const { data } = await sa.from("supplier_products")
      .select("id, supplier_sku, product_id, supplier_product_name, supplier_product_description, raw_category, raw_brand, raw_unit")
      .eq("company_id", companyId).eq("supplier_id", supplierId).in("supplier_sku", batch);
    for (const d of (data ?? []) as ExistingProduct[]) existingMap.set(d.supplier_sku, d);
  }

  // Log matching key info
  console.log(`[upsert] Matching key: supplier_sku + supplier_id. ${skus.length} incoming SKUs, ${existingMap.size} matched in DB`);
  let sampleCount = 0;
  for (const row of rows) {
    if (!row.supplier_sku || sampleCount >= 5) break;
    const existing = existingMap.get(row.supplier_sku);
    if (existing) {
      console.log(`[match-sample] SKU="${row.supplier_sku}" el="${row.el_number}" → matched sp.id=${existing.id} sp.product_id=${existing.product_id}`);
    } else {
      console.log(`[match-sample] SKU="${row.supplier_sku}" el="${row.el_number}" → NO MATCH (will insert)`);
    }
    sampleCount++;
  }

  const now = new Date().toISOString();
  const toInsert: any[] = [];
  const toTouchIds: string[] = [];
  const toUpdateFull: { id: string; row: ParsedRow }[] = [];

  for (const row of rows) {
    if (!row.supplier_sku) continue;
    const existing = existingMap.get(row.supplier_sku);
    if (existing) {
      // Compare ALL relevant fields
      const changed =
        (row.product_name !== null && row.product_name !== existing.supplier_product_name) ||
        (row.description !== null && row.description !== existing.supplier_product_description) ||
        (row.brand !== null && row.brand !== existing.raw_brand) ||
        (row.category !== null && row.category !== existing.raw_category) ||
        (row.unit !== null && row.unit !== existing.raw_unit);

      if (changed) {
        toUpdateFull.push({ id: existing.id, row });
      } else {
        toTouchIds.push(existing.id);
      }
      map.set(row.supplier_sku, { id: existing.id, isNew: false, existingProductId: existing.product_id });
    } else {
      toInsert.push({
        company_id: companyId, supplier_id: supplierId, supplier_sku: row.supplier_sku,
        supplier_product_name: row.product_name, supplier_product_description: row.description,
        raw_category: row.category, raw_brand: row.brand, raw_unit: row.unit,
        last_seen_at: now,
      });
    }
  }

  // Batch insert new products
  if (toInsert.length > 0) {
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE);
      const { data, error } = await sa.from("supplier_products").insert(batch).select("id, supplier_sku");
      if (error) {
        console.error(`[batch] Insert supplier_products error: ${error.message}`);
        for (const item of batch) {
          try {
            const { data: single } = await sa.from("supplier_products").insert(item).select("id, supplier_sku").single();
            if (single) map.set(single.supplier_sku, { id: single.id, isNew: true, existingProductId: null });
          } catch {}
        }
        continue;
      }
      for (const d of data ?? []) map.set(d.supplier_sku, { id: d.id, isNew: true, existingProductId: null });
    }
  }

  // Batch touch last_seen_at for unchanged rows (lightweight)
  if (toTouchIds.length > 0) {
    for (let i = 0; i < toTouchIds.length; i += 500) {
      const batch = toTouchIds.slice(i, i + 500);
      await sa.from("supplier_products").update({ last_seen_at: now }).in("id", batch);
    }
  }

  // Full update for changed rows
  if (toUpdateFull.length > 0) {
    for (const u of toUpdateFull) {
      await sa.from("supplier_products").update({
        supplier_product_name: u.row.product_name,
        supplier_product_description: u.row.description,
        raw_category: u.row.category, raw_brand: u.row.brand, raw_unit: u.row.unit,
        last_seen_at: now, updated_at: now,
      }).eq("id", u.id);
    }
  }

  console.log(`[upsert] products: ${toInsert.length} new, ${toUpdateFull.length} updated, ${toTouchIds.length} unchanged`);
  return { map, unchanged: toTouchIds.length, updated: toUpdateFull.length };
}

/**
 * Batch match catalog products by el_number and EAN.
 */
async function batchMatchCatalogProducts(
  sa: SupabaseAdmin, companyId: string, rows: ParsedRow[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  
  const elNumbers = rows.filter(r => r.el_number).map(r => r.el_number!);
  const eans = rows.filter(r => r.ean).map(r => r.ean!);
  
  const elMap = new Map<string, string>();
  if (elNumbers.length > 0) {
    const unique = [...new Set(elNumbers)];
    for (let i = 0; i < unique.length; i += 200) {
      const batch = unique.slice(i, i + 200);
      const { data } = await sa.from("supplier_catalog_products").select("id, el_number")
        .eq("company_id", companyId).in("el_number", batch);
      for (const d of data ?? []) if (d.el_number) elMap.set(d.el_number, d.id);
    }
  }
  
  const eanMap = new Map<string, string>();
  if (eans.length > 0) {
    const unique = [...new Set(eans)];
    for (let i = 0; i < unique.length; i += 200) {
      const batch = unique.slice(i, i + 200);
      const { data } = await sa.from("supplier_catalog_products").select("id, ean")
        .eq("company_id", companyId).in("ean", batch);
      for (const d of data ?? []) if (d.ean) eanMap.set(d.ean, d.id);
    }
  }
  
  for (const row of rows) {
    if (!row.supplier_sku) continue;
    if (row.el_number && elMap.has(row.el_number)) {
      result.set(row.supplier_sku, elMap.get(row.el_number)!);
    } else if (row.ean && eanMap.has(row.ean)) {
      result.set(row.supplier_sku, eanMap.get(row.ean)!);
    }
  }
  
  return result;
}

/**
 * Batch auto-create catalog products for unmatched rows.
 */
async function batchAutoCreateCatalogProducts(
  sa: SupabaseAdmin, companyId: string, unmatchedRows: ParsedRow[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const toCreate: { row: ParsedRow; payload: any }[] = [];

  const seenElNumbers = new Set<string>();
  const seenEans = new Set<string>();

  for (const row of unmatchedRows) {
    if (!row.supplier_sku) continue;
    const hasName = !!row.product_name && row.product_name.length >= 3;
    const hasStrongId = !!row.el_number || !!row.ean;
    const hasSkuIdentity = !!row.supplier_sku && row.supplier_sku.length >= 3;
    if (!hasName && !hasSkuIdentity) continue;
    if (!hasName && !hasStrongId) continue;

    if (row.el_number && seenElNumbers.has(row.el_number)) continue;
    if (row.ean && seenEans.has(row.ean)) continue;

    if (row.el_number) seenElNumbers.add(row.el_number);
    if (row.ean) seenEans.add(row.ean);

    toCreate.push({
      row,
      payload: {
        company_id: companyId, name: row.product_name || row.supplier_sku || "Ukjent produkt",
        el_number: row.el_number, ean: row.ean, brand: row.brand,
        unit: row.unit, category: row.category, description: row.description, is_active: true,
      },
    });
  }

  for (let i = 0; i < toCreate.length; i += BATCH_SIZE) {
    const batch = toCreate.slice(i, i + BATCH_SIZE);
    const payloads = batch.map(b => b.payload);
    const { data, error } = await sa.from("supplier_catalog_products").insert(payloads).select("id, el_number, ean, name");
    if (error) {
      console.warn(`[batch] Auto-create catalog error: ${error.message}, falling back to individual`);
      for (const item of batch) {
        try {
          const { data: single } = await sa.from("supplier_catalog_products").insert(item.payload).select("id").single();
          if (single) result.set(item.row.supplier_sku!, single.id);
        } catch {}
      }
      continue;
    }
    for (let j = 0; j < (data ?? []).length; j++) {
      const created = data![j];
      const srcRow = batch[j].row;
      result.set(srcRow.supplier_sku!, created.id);
    }
  }

  return result;
}

/**
 * Batch insert supplier_prices.
 * OPTIMIZED: Only inserts if price data actually differs from latest existing price.
 */
async function batchInsertPrices(
  sa: SupabaseAdmin, companyId: string, supplierId: string,
  priceRows: Array<{ supplierProductId: string; row: ParsedRow; fileName: string }>,
): Promise<{ inserted: number; skippedDuplicate: number; skippedNoPrice: number }> {
  const now = new Date().toISOString();
  const withPrice = priceRows.filter(p => {
    const hasListPrice = p.row.list_price !== null && p.row.list_price > 0;
    const hasNetPrice = p.row.net_price !== null && p.row.net_price > 0;
    return hasListPrice || hasNetPrice;
  });
  const skippedNoPrice = priceRows.length - withPrice.length;

  if (withPrice.length === 0) return { inserted: 0, skippedDuplicate: 0, skippedNoPrice };

  // Fetch latest existing prices for all supplier_product_ids in this batch
  const spIds = [...new Set(withPrice.map(p => p.supplierProductId))];
  interface ExistingPrice { supplier_product_id: string; list_price: number | null; discount_percent: number | null; net_price: number | null }
  const latestPriceMap = new Map<string, ExistingPrice>();
  for (let i = 0; i < spIds.length; i += 200) {
    const batch = spIds.slice(i, i + 200);
    // Get the most recent price per supplier_product_id
    const { data } = await sa.from("supplier_prices")
      .select("supplier_product_id, list_price, discount_percent, net_price")
      .eq("company_id", companyId).eq("supplier_id", supplierId)
      .in("supplier_product_id", batch)
      .order("imported_at", { ascending: false });
    // Only keep the first (latest) per supplier_product_id
    for (const d of (data ?? []) as ExistingPrice[]) {
      if (!latestPriceMap.has(d.supplier_product_id)) {
        latestPriceMap.set(d.supplier_product_id, d);
      }
    }
  }

  // Compare and filter out duplicates
  const payloads: any[] = [];
  let skippedDuplicate = 0;
  for (const p of withPrice) {
    const existing = latestPriceMap.get(p.supplierProductId);
    if (existing) {
      const sameList = (p.row.list_price ?? null) === (existing.list_price ?? null);
      const sameNet = (p.row.net_price ?? null) === (existing.net_price ?? null);
      const sameDiscount = (p.row.discount_percent ?? null) === (existing.discount_percent ?? null);
      if (sameList && sameNet && sameDiscount) {
        skippedDuplicate++;
        continue;
      }
    }
    payloads.push({
      company_id: companyId, supplier_id: supplierId, supplier_product_id: p.supplierProductId,
      list_price: p.row.list_price,
      discount_percent: p.row.discount_percent,
      net_price: p.row.net_price, currency: "NOK", source_file_name: p.fileName,
      imported_at: now,
    });
  }

  for (let i = 0; i < payloads.length; i += BATCH_SIZE) {
    const batch = payloads.slice(i, i + BATCH_SIZE);
    const { error } = await sa.from("supplier_prices").insert(batch);
    if (error) console.error(`[batch] Insert prices error: ${error.message}`);
  }

  console.log(`[prices] ${payloads.length} inserted, ${skippedDuplicate} unchanged, ${skippedNoPrice} no price`);
  return { inserted: payloads.length, skippedDuplicate, skippedNoPrice };
}

/**
 * Batch insert import rows — ONLY for errors and needs_review.
 * Successful rows are NOT logged individually to save write throughput.
 */
async function batchInsertImportRows(
  sa: SupabaseAdmin, companyId: string, importJobId: string, fileType: string,
  rows: Array<{ rowNumber: number; parseStatus: string; errorMessage: string | null; linkedProductId: string | null; linkedSupplierProductId: string | null }>,
): Promise<void> {
  // Only log errors and needs_review — skip "parsed" (success) and "skipped" (no sku)
  const errorRows = rows.filter(r => r.parseStatus === "needs_review" || r.parseStatus === "error");
  if (errorRows.length === 0) return;

  const payloads = errorRows.map(r => ({
    company_id: companyId, import_job_id: importJobId, row_number: r.rowNumber,
    row_type: fileType, raw_data: {}, parse_status: r.parseStatus,
    error_message: r.errorMessage, linked_product_id: r.linkedProductId,
    linked_supplier_product_id: r.linkedSupplierProductId,
  }));

  for (let i = 0; i < payloads.length; i += BATCH_SIZE) {
    const batch = payloads.slice(i, i + BATCH_SIZE);
    try {
      await sa.from("product_import_rows").insert(batch);
    } catch (e) {
      console.error(`[batch] Insert import_rows error: ${(e as Error).message}`);
    }
  }
}

/**
 * Batch link supplier_products to catalog products.
 */
async function batchLinkProducts(
  sa: SupabaseAdmin, links: Array<{ supplierProductId: string; catalogProductId: string }>,
): Promise<void> {
  const byProduct = new Map<string, string[]>();
  for (const l of links) {
    const arr = byProduct.get(l.catalogProductId) ?? [];
    arr.push(l.supplierProductId);
    byProduct.set(l.catalogProductId, arr);
  }
  for (const [catalogId, spIds] of byProduct) {
    for (let i = 0; i < spIds.length; i += 200) {
      const batch = spIds.slice(i, i + 200);
      await sa.from("supplier_products").update({ product_id: catalogId }).in("id", batch);
    }
  }
}

// ===== Price cache recalculation =====

export async function rebuildPriceCache(sa: SupabaseAdmin, companyId: string, productIds: string[]) {
  const uniqueIds = [...new Set(productIds)];
  if (uniqueIds.length === 0) return;
  console.log(`[cache] Rebuilding price cache for ${uniqueIds.length} products`);

  for (let i = 0; i < uniqueIds.length; i += 50) {
    const batch = uniqueIds.slice(i, i + 50);
    
    const { data: linkedSps } = await sa.from("supplier_products").select("id, product_id")
      .eq("company_id", companyId).in("product_id", batch);
    
    if (!linkedSps || linkedSps.length === 0) continue;
    
    const spIds = linkedSps.map(sp => sp.id);
    const { data: prices } = await sa.from("supplier_prices")
      .select("supplier_id, supplier_product_id, net_price, list_price, discount_percent")
      .eq("company_id", companyId).in("supplier_product_id", spIds)
      .order("imported_at", { ascending: false });

    if (!prices || prices.length === 0) continue;

    const spToProduct = new Map<string, string>();
    for (const sp of linkedSps) spToProduct.set(sp.id, sp.product_id);

    const pricesByProduct = new Map<string, typeof prices>();
    for (const p of prices) {
      const productId = spToProduct.get(p.supplier_product_id);
      if (!productId) continue;
      const arr = pricesByProduct.get(productId) ?? [];
      arr.push(p);
      pricesByProduct.set(productId, arr);
    }

    for (const [productId, pList] of pricesByProduct) {
      let bestPrice: number | null = null;
      let bestSupplierId: string | null = null;
      const snapshot: Record<string, unknown> = {};

      for (const p of pList) {
        const effective = p.net_price ?? p.list_price;
        if (effective !== null && effective > 0 && (bestPrice === null || effective < bestPrice)) {
          bestPrice = effective; bestSupplierId = p.supplier_id;
        }
        if (!snapshot[p.supplier_id]) {
          snapshot[p.supplier_id] = { net_price: p.net_price, list_price: p.list_price, discount_percent: p.discount_percent };
        }
      }

      const cacheData = {
        company_id: companyId, product_id: productId, best_supplier_id: bestSupplierId,
        best_net_price: bestPrice, price_snapshot: snapshot, recalculated_at: new Date().toISOString(),
      };

      const { data: existing } = await sa.from("product_price_cache").select("id")
        .eq("company_id", companyId).eq("product_id", productId).maybeSingle();

      if (existing) {
        await sa.from("product_price_cache").update(cacheData).eq("id", existing.id);
      } else {
        await sa.from("product_price_cache").insert(cacheData);
      }
    }
  }
}

// ===== Import stats =====

export interface ImportStats {
  rows_processed: number; rows_inserted: number; rows_updated: number;
  rows_failed: number; rows_skipped: number; rows_needs_review: number;
  errors: string[]; affected_product_ids: string[];
}

// ===== Chunked processing core =====

async function processChunk(params: {
  sa: SupabaseAdmin; companyId: string; supplierId: string;
  importJobId: string; fileType: string; fileName: string;
  rows: ParsedRow[]; startRowNumber: number;
}): Promise<ImportStats> {
  const { sa, companyId, supplierId, importJobId, fileType, fileName, rows, startRowNumber } = params;
  const stats: ImportStats = {
    rows_processed: 0, rows_inserted: 0, rows_updated: 0, rows_failed: 0,
    rows_skipped: 0, rows_needs_review: 0, errors: [], affected_product_ids: [],
  };

  const validRows = rows.filter(r => r.supplier_sku);
  const skippedCount = rows.length - validRows.length;
  stats.rows_processed = rows.length;
  stats.rows_skipped = skippedCount;

  if (validRows.length === 0) return stats;

  // Phase 1: Upsert supplier_products
  const t1 = timer();
  let spResult: { map: Map<string, { id: string; isNew: boolean }>; unchanged: number; updated: number };
  try {
    spResult = await batchUpsertSupplierProducts(sa, companyId, supplierId, validRows);
  } catch (e) {
    stats.rows_failed = validRows.length;
    stats.errors.push(`Batch upsert failed: ${(e as Error).message}`);
    return stats;
  }
  const spMap = spResult.map;
  const t1ms = t1();

  for (const [, v] of spMap) {
    if (v.isNew) stats.rows_inserted++;
  }
  stats.rows_updated = spResult.updated;

  // Phase 2: Match catalog products
  const t2 = timer();
  const matchMap = await batchMatchCatalogProducts(sa, companyId, validRows);
  const t2ms = t2();

  // Phase 3: Auto-create catalog products
  const t3 = timer();
  const unmatchedRows = validRows.filter(r => r.supplier_sku && !matchMap.has(r.supplier_sku));
  const autoCreatedMap = await batchAutoCreateCatalogProducts(sa, companyId, unmatchedRows);
  for (const [sku, id] of autoCreatedMap) matchMap.set(sku, id);
  const t3ms = t3();

  // Phase 4: Link products
  const t4 = timer();
  const links: Array<{ supplierProductId: string; catalogProductId: string }> = [];
  for (const row of validRows) {
    if (!row.supplier_sku) continue;
    const spEntry = spMap.get(row.supplier_sku);
    const catalogId = matchMap.get(row.supplier_sku);
    if (spEntry && catalogId) {
      links.push({ supplierProductId: spEntry.id, catalogProductId: catalogId });
      stats.affected_product_ids.push(catalogId);
    } else {
      stats.rows_needs_review++;
    }
  }
  if (links.length > 0) await batchLinkProducts(sa, links);
  const t4ms = t4();

  // Phase 5: Insert prices (only if changed)
  const t5 = timer();
  const priceRows = validRows
    .filter(r => r.supplier_sku && spMap.has(r.supplier_sku))
    .map(r => ({ supplierProductId: spMap.get(r.supplier_sku!)!.id, row: r, fileName }));
  const priceResult = await batchInsertPrices(sa, companyId, supplierId, priceRows);
  const t5ms = t5();

  // Phase 6: Import rows audit (only errors/needs_review)
  const t6 = timer();
  const importRowEntries = rows.map((row, idx) => {
    const sku = row.supplier_sku;
    const spEntry = sku ? spMap.get(sku) : undefined;
    const catalogId = sku ? matchMap.get(sku) : undefined;
    return {
      rowNumber: startRowNumber + idx,
      parseStatus: !sku ? "skipped" : catalogId ? "parsed" : "needs_review",
      errorMessage: !sku ? "Manglende artikkelkode" : !catalogId ? "Ingen match i produktkatalog" : null,
      linkedProductId: catalogId ?? null,
      linkedSupplierProductId: spEntry?.id ?? null,
    };
  });
  await batchInsertImportRows(sa, companyId, importJobId, fileType, importRowEntries);
  const t6ms = t6();

  console.log(`[timing] upsert=${t1ms}ms match=${t2ms}ms autocreate=${t3ms}ms link=${t4ms}ms prices=${t5ms}ms audit=${t6ms}ms total=${t1ms+t2ms+t3ms+t4ms+t5ms+t6ms}ms rows=${validRows.length} | products: ${stats.rows_inserted} new, ${spResult.updated} updated, ${spResult.unchanged} unchanged | prices: ${priceResult.inserted} new, ${priceResult.skippedDuplicate} unchanged`);

  return stats;
}

// ===== Main parseFile =====

const CHUNK_SIZE = 1000;

export async function parseFile(params: {
  supabaseAdmin: SupabaseAdmin; supplierId: string; supplierCode: string | null;
  companyId: string; importJobId: string; fileType: string; fileName: string; fileContent: string;
  chunkRange?: { start: number; end: number };
  skipPriceCache?: boolean;
}): Promise<ImportStats & { totalChunks: number }> {
  const { supabaseAdmin: sa, supplierId, supplierCode, companyId, importJobId, fileType, fileName, fileContent } = params;

  const tParse = timer();
  const rawLines = fileContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (rawLines.length < 2) {
    return { rows_processed: 0, rows_inserted: 0, rows_updated: 0, rows_failed: 0,
      rows_skipped: 0, rows_needs_review: 0, errors: [`${fileName}: For få rader (${rawLines.length})`], affected_product_ids: [], totalChunks: 0 };
  }

  console.log(`[parser] ${fileName}: ${rawLines.length} lines, checking format...`);

  let allParsed: ParsedRow[];
  let startRowBase = 1;

  if (isEfonelfoFormat(rawLines)) {
    console.log(`[parser] EFONELFO format detected for ${fileName}`);
    const efonProducts = parseEfonelfoFile(rawLines);
    console.log(`[parser] EFONELFO: ${efonProducts.length} products extracted`);
    allParsed = efonProducts.map(ep => ({
      supplier_sku: ep.supplier_sku, el_number: ep.el_number, ean: ep.ean,
      product_name: ep.product_name, description: ep.description, brand: ep.brand,
      unit: ep.unit, category: ep.category, list_price: ep.list_price,
      discount_percent: ep.discount_percent, net_price: ep.net_price,
    }));
  } else {
    const delimiter = detectDelimiter(rawLines);
    const { headerIndex, headers } = detectHeaderRow(rawLines, delimiter);
    console.log(`[parser] ${fileName}: delimiter="${delimiter === "\t" ? "TAB" : delimiter}", header=${headerIndex}, cols=${headers.length}`);
    
    const mapping = getSupplierMapping(supplierCode);
    const { columns, missing } = resolveAllColumns(headers, mapping);
    if (columns.supplier_sku === -1) {
      return { rows_processed: 0, rows_inserted: 0, rows_updated: 0, rows_failed: 0,
        rows_skipped: 0, rows_needs_review: 0, errors: [`${fileName}: Fant ikke artikkelkode-kolonne. Kolonner: ${headers.join(", ")}`], affected_product_ids: [], totalChunks: 0 };
    }
    if (missing.length > 0) console.warn(`[parser] Missing columns: ${missing.join(", ")}`);

    const dataLines = rawLines.slice(headerIndex + 1);
    startRowBase = headerIndex + 2;
    allParsed = dataLines.map(line => parseRow(line.split(delimiter), columns));
  }
  const parseMs = tParse();

  const totalChunks = Math.ceil(allParsed.length / CHUNK_SIZE);
  const chunkStart = params.chunkRange?.start ?? 0;
  const chunkEnd = Math.min(params.chunkRange?.end ?? totalChunks, totalChunks);

  console.log(`[parser] ${fileName}: ${allParsed.length} rows, ${totalChunks} total chunks, processing chunks ${chunkStart}-${chunkEnd - 1} (parse=${parseMs}ms)`);

  const totalStats: ImportStats & { totalChunks: number } = {
    rows_processed: 0, rows_inserted: 0, rows_updated: 0, rows_failed: 0,
    rows_skipped: 0, rows_needs_review: 0, errors: [], affected_product_ids: [], totalChunks,
  };

  for (let ci = chunkStart; ci < chunkEnd; ci++) {
    const i = ci * CHUNK_SIZE;
    const chunk = allParsed.slice(i, i + CHUNK_SIZE);
    const chunkStats = await processChunk({
      sa, companyId, supplierId, importJobId, fileType, fileName,
      rows: chunk, startRowNumber: startRowBase + i,
    });
    totalStats.rows_processed += chunkStats.rows_processed;
    totalStats.rows_inserted += chunkStats.rows_inserted;
    totalStats.rows_updated += chunkStats.rows_updated;
    totalStats.rows_failed += chunkStats.rows_failed;
    totalStats.rows_skipped += chunkStats.rows_skipped;
    totalStats.rows_needs_review += chunkStats.rows_needs_review;
    totalStats.errors.push(...chunkStats.errors);
    totalStats.affected_product_ids.push(...chunkStats.affected_product_ids);
    
    console.log(`[parser] ${fileName}: chunk ${ci + 1}/${totalChunks} done (${i + chunk.length}/${allParsed.length})`);
  }

  if (!params.skipPriceCache && chunkEnd >= totalChunks) {
    try {
      await rebuildPriceCache(sa, companyId, totalStats.affected_product_ids);
    } catch (cacheErr) {
      console.error(`[parser] Cache rebuild error: ${(cacheErr as Error).message}`);
      totalStats.errors.push(`Price cache rebuild feilet: ${(cacheErr as Error).message}`);
    }
  }

  console.log(`[parser] ${fileName} chunks ${chunkStart}-${chunkEnd - 1} done: processed=${totalStats.rows_processed}, inserted=${totalStats.rows_inserted}, updated=${totalStats.rows_updated}, failed=${totalStats.rows_failed}`);
  return totalStats;
}
