/**
 * ============================================================
 * PRODUCT MODULE – Type definitions & Zod schemas
 * ============================================================
 *
 * Architecture overview:
 *
 * 1. suppliers              – Grossist-register per tenant (Onninen, Solar, …)
 * 2. supplier_integrations  – FTP/sFTP credentials & sync config (admin-only)
 * 3. supplier_catalog_products – Canonical product master (el_number, EAN, …)
 * 4. supplier_products      – Supplier-specific artikler, koblet til master
 * 5. supplier_prices        – Pris-/rabattlinjer fra importfiler
 * 6. product_price_cache    – Materialisert "best price" per produkt
 * 7. product_import_jobs    – Import-kjøringer med status og statistikk
 * 8. product_import_rows    – Rad-for-rad resultat av import
 *
 * Neste steg i modulen:
 * - Edge Function for FTP/sFTP connect + filhenting (bruker Deno ssh2/ftp)
 * - Parser-lag per grossist (CSV/XML → supplier_products + supplier_prices)
 * - Price cache recalculation trigger/function
 * - Admin UI: Supplier management, import status, price comparison
 * - Integration med kalkyle/tilbud: oppslag i product_price_cache
 * ============================================================
 */

import { z } from "zod";

// ==================== Enums ====================

export const SupplierIntegrationType = z.enum(["ftp", "ftps", "sftp", "manual", "api"]);
export type SupplierIntegrationType = z.infer<typeof SupplierIntegrationType>;

export const SupplierProtocol = z.enum(["ftp", "ftps", "sftp"]);
export type SupplierProtocol = z.infer<typeof SupplierProtocol>;

export const SupplierConnectionStatus = z.enum(["never_tested", "ok", "warning", "error"]);
export type SupplierConnectionStatus = z.infer<typeof SupplierConnectionStatus>;

export const SupplierSyncFrequency = z.enum(["manual", "hourly", "daily"]);
export type SupplierSyncFrequency = z.infer<typeof SupplierSyncFrequency>;

export const ImportJobType = z.enum(["connection_test", "catalog_sync", "price_sync", "discount_sync", "full_sync"]);
export type ImportJobType = z.infer<typeof ImportJobType>;

export const ImportJobStatus = z.enum(["queued", "running", "success", "partial_success", "failed"]);
export type ImportJobStatus = z.infer<typeof ImportJobStatus>;

export const ImportRowStatus = z.enum(["parsed", "failed", "skipped", "needs_review"]);
export type ImportRowStatus = z.infer<typeof ImportRowStatus>;

// ==================== Domain types ====================

export interface Supplier {
  id: string;
  company_id: string;
  name: string;
  code: string;
  is_active: boolean;
  integration_type: SupplierIntegrationType;
  created_at: string;
  updated_at: string;
}

export interface SupplierIntegration {
  id: string;
  company_id: string;
  supplier_id: string;
  protocol: SupplierProtocol;
  host: string;
  port: number;
  username: string;
  /** Never exposed to frontend – always null from RLS read policies */
  password_secret_ref: string | null;
  remote_base_path: string | null;
  catalog_file_pattern: string | null;
  price_file_pattern: string | null;
  discount_file_pattern: string | null;
  invoice_file_pattern: string | null;
  last_connection_status: SupplierConnectionStatus;
  last_connection_message: string | null;
  last_connected_at: string | null;
  last_sync_at: string | null;
  sync_enabled: boolean;
  sync_frequency: SupplierSyncFrequency;
  created_at: string;
  updated_at: string;
}

export interface CatalogProduct {
  id: string;
  company_id: string;
  el_number: string | null;
  ean: string | null;
  supplier_independent_sku: string | null;
  brand: string | null;
  name: string;
  description: string | null;
  unit: string | null;
  category: string | null;
  subcategory: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SupplierProduct {
  id: string;
  company_id: string;
  supplier_id: string;
  product_id: string | null;
  supplier_sku: string;
  supplier_product_name: string | null;
  supplier_product_description: string | null;
  raw_category: string | null;
  raw_brand: string | null;
  raw_unit: string | null;
  raw_payload: Record<string, unknown>;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupplierPrice {
  id: string;
  company_id: string;
  supplier_id: string;
  supplier_product_id: string;
  price_list_name: string | null;
  list_price: number;
  discount_percent: number | null;
  net_price: number | null;
  currency: string;
  valid_from: string | null;
  valid_to: string | null;
  source_file_name: string | null;
  imported_at: string;
  created_at: string;
}

export interface ProductPriceCache {
  id: string;
  company_id: string;
  product_id: string;
  best_supplier_id: string | null;
  best_net_price: number | null;
  price_snapshot: Record<string, unknown>;
  recalculated_at: string;
}

export interface ProductImportJob {
  id: string;
  company_id: string;
  supplier_id: string;
  job_type: ImportJobType;
  status: ImportJobStatus;
  started_at: string | null;
  finished_at: string | null;
  files_found: unknown[];
  rows_processed: number;
  rows_inserted: number;
  rows_updated: number;
  rows_failed: number;
  current_chunk: number;
  total_chunks: number;
  progress_percent: number;
  last_heartbeat_at: string | null;
  failed_step: string | null;
  error_log: unknown[];
  triggered_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductImportRow {
  id: string;
  company_id: string;
  import_job_id: string;
  row_number: number;
  row_type: string | null;
  raw_data: Record<string, unknown>;
  parse_status: ImportRowStatus;
  error_message: string | null;
  linked_product_id: string | null;
  linked_supplier_product_id: string | null;
  created_at: string;
}

// ==================== Zod Schemas (for forms/validation) ====================

export const SupplierFormSchema = z.object({
  name: z.string().min(1, "Navn er påkrevd"),
  code: z.string().min(1, "Kode er påkrevd").max(20),
  is_active: z.boolean().default(true),
  integration_type: SupplierIntegrationType.default("manual"),
});
export type SupplierFormValues = z.infer<typeof SupplierFormSchema>;

export const SupplierIntegrationFormSchema = z.object({
  protocol: SupplierProtocol.default("sftp"),
  host: z.string().min(1, "Vertsnavn er påkrevd"),
  port: z.number().int().min(1).max(65535).default(22),
  username: z.string().min(1, "Brukernavn er påkrevd"),
  password: z.string().optional(),
  remote_base_path: z.string().default("/"),
  catalog_file_pattern: z.string().optional(),
  price_file_pattern: z.string().optional(),
  discount_file_pattern: z.string().optional(),
  sync_enabled: z.boolean().default(false),
  sync_frequency: SupplierSyncFrequency.default("manual"),
});
export type SupplierIntegrationFormValues = z.infer<typeof SupplierIntegrationFormSchema>;

// ==================== Standard grossist-koder ====================

export const STANDARD_SUPPLIERS = [
  { code: "ONNINEN", name: "Onninen" },
  { code: "SOLAR", name: "Solar Norge" },
  { code: "AHLSELL", name: "Ahlsell Norge" },
  { code: "SONEPAR", name: "Sonepar Norge" },
] as const;
