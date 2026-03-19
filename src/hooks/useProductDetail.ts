/**
 * Hook for product detail view – fetches catalog product + supplier prices + import history.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";

export interface SupplierPriceRow {
  id: string;
  supplier_id: string;
  supplier_name: string;
  supplier_sku: string;
  supplier_product_name: string | null;
  list_price: number;
  discount_percent: number | null;
  net_price: number | null;
  source_file_name: string | null;
  imported_at: string;
  is_cheapest: boolean;
}

export interface ProductDetailData {
  id: string;
  name: string;
  el_number: string | null;
  ean: string | null;
  brand: string | null;
  category: string | null;
  subcategory: string | null;
  description: string | null;
  unit: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  best_net_price: number | null;
  best_supplier_id: string | null;
  prices: SupplierPriceRow[];
  importJobs: Array<{
    id: string;
    job_type: string;
    status: string;
    finished_at: string | null;
    files_found: unknown[];
    rows_processed: number;
    supplier_name: string;
  }>;
}

export function useProductDetail(productId?: string) {
  const { activeCompanyId } = useCompanyContext();

  const { data: product, isLoading: loading } = useQuery({
    queryKey: ["product-detail", activeCompanyId, productId],
    enabled: !!activeCompanyId && !!productId,
    queryFn: async (): Promise<ProductDetailData | null> => {
      // 1. Catalog product
      const { data: cat, error: catErr } = await supabase
        .from("supplier_catalog_products")
        .select("*, product_price_cache(best_net_price, best_supplier_id)")
        .eq("id", productId!)
        .eq("company_id", activeCompanyId!)
        .single();

      if (catErr) throw catErr;
      if (!cat) return null;

      const cache = Array.isArray(cat.product_price_cache)
        ? cat.product_price_cache[0]
        : cat.product_price_cache;

      // 2. Supplier products linked to this
      const { data: spLinks } = await supabase
        .from("supplier_products")
        .select("id, supplier_id, supplier_sku, supplier_product_name")
        .eq("company_id", activeCompanyId!)
        .eq("product_id", productId!);

      const spIds = (spLinks || []).map((sp: any) => sp.id);
      const spMap = new Map((spLinks || []).map((sp: any) => [sp.id, sp]));

      // 3. Supplier names
      const { data: suppliers } = await supabase
        .from("suppliers")
        .select("id, name")
        .eq("company_id", activeCompanyId!);
      const supplierNameMap = new Map((suppliers || []).map((s: any) => [s.id, s.name]));

      // 4. Prices
      let prices: SupplierPriceRow[] = [];
      if (spIds.length > 0) {
        const { data: priceRows } = await supabase
          .from("supplier_prices")
          .select("*")
          .eq("company_id", activeCompanyId!)
          .in("supplier_product_id", spIds)
          .order("net_price", { ascending: true });

        const cheapestPrice = (priceRows || [])[0]?.net_price;

        prices = (priceRows || []).map((row: any) => {
          const sp = spMap.get(row.supplier_product_id);
          return {
            id: row.id,
            supplier_id: row.supplier_id,
            supplier_name: supplierNameMap.get(row.supplier_id) ?? "Ukjent",
            supplier_sku: sp?.supplier_sku ?? "",
            supplier_product_name: sp?.supplier_product_name ?? null,
            list_price: row.list_price,
            discount_percent: row.discount_percent,
            net_price: row.net_price,
            source_file_name: row.source_file_name,
            imported_at: row.imported_at,
            is_cheapest: row.net_price != null && row.net_price === cheapestPrice,
          };
        });
      }

      // 5. Import jobs (recent, relevant supplier)
      const supplierIds = [...new Set((spLinks || []).map((sp: any) => sp.supplier_id))];
      let importJobs: ProductDetailData["importJobs"] = [];
      if (supplierIds.length > 0) {
        const { data: jobs } = await supabase
          .from("product_import_jobs")
          .select("id, job_type, status, finished_at, files_found, rows_processed, supplier_id")
          .eq("company_id", activeCompanyId!)
          .in("supplier_id", supplierIds)
          .order("created_at", { ascending: false })
          .limit(10);

        importJobs = (jobs || []).map((j: any) => ({
          ...j,
          supplier_name: supplierNameMap.get(j.supplier_id) ?? "Ukjent",
        }));
      }

      return {
        id: cat.id,
        name: cat.name,
        el_number: cat.el_number,
        ean: cat.ean,
        brand: cat.brand,
        category: cat.category,
        subcategory: cat.subcategory,
        description: cat.description,
        unit: cat.unit,
        is_active: cat.is_active,
        created_at: cat.created_at,
        updated_at: cat.updated_at,
        best_net_price: cache?.best_net_price ?? null,
        best_supplier_id: cache?.best_supplier_id ?? null,
        prices,
        importJobs,
      };
    },
  });

  return { product: product ?? null, loading };
}
