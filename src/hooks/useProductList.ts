/**
 * Hook for the product module overview – company-scoped.
 * Fetches catalog products with price cache and supplier count.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";

export interface ProductListItem {
  id: string;
  name: string;
  el_number: string | null;
  ean: string | null;
  brand: string | null;
  category: string | null;
  unit: string | null;
  is_active: boolean;
  updated_at: string;
  best_net_price: number | null;
  best_supplier_name: string | null;
  supplier_count: number;
}

interface ProductListParams {
  search?: string;
  sortBy?: string;
  sortAsc?: boolean;
  filterSupplier?: string;
  filterOnlyWithPrice?: boolean;
  filterOnlyMultiSupplier?: boolean;
  limit?: number;
}

export function useProductList(params: ProductListParams = {}) {
  const { activeCompanyId } = useCompanyContext();
  const {
    search,
    sortBy = "name",
    sortAsc = true,
    filterSupplier,
    filterOnlyWithPrice,
    filterOnlyMultiSupplier,
    limit = 200,
  } = params;

  const queryKey = [
    "product-list",
    activeCompanyId,
    search,
    sortBy,
    sortAsc,
    filterSupplier,
    filterOnlyWithPrice,
    filterOnlyMultiSupplier,
    limit,
  ];

  const { data: products = [], isLoading: loading } = useQuery({
    queryKey,
    enabled: !!activeCompanyId,
    queryFn: async () => {
      // Step 1: fetch catalog products (left join with price cache)
      let query = supabase
        .from("supplier_catalog_products")
        .select(`
          id, name, el_number, ean, brand, category, unit, is_active, updated_at,
          product_price_cache (best_net_price, best_supplier_id)
        `)
        .eq("company_id", activeCompanyId!)
        .eq("is_active", true)
        .limit(limit);

      if (search && search.length >= 2) {
        query = query.or(
          `el_number.ilike.%${search}%,ean.ilike.%${search}%,name.ilike.%${search}%,brand.ilike.%${search}%`
        );
      }

      // Sort by name for non-computed columns; price/suppliers sorted client-side
      const orderCol = ["price", "suppliers"].includes(sortBy) ? "name" : sortBy;
      query = query.order(orderCol as any, { ascending: sortAsc });

      const { data: catalogRows, error: catErr } = await query;
      if (catErr) throw catErr;

      // Step 2: get supplier counts per product
      const productIds = (catalogRows || []).map((r: any) => r.id);
      let supplierCounts: Record<string, number> = {};
      let supplierNames: Record<string, string> = {};

      if (productIds.length > 0) {
        const { data: spLinks } = await supabase
          .from("supplier_products")
          .select("product_id, supplier_id, suppliers:supplier_id(name)")
          .eq("company_id", activeCompanyId!)
          .in("product_id", productIds);

        for (const link of spLinks || []) {
          const pid = (link as any).product_id;
          supplierCounts[pid] = (supplierCounts[pid] || 0) + 1;
        }

        // Get supplier names for best_supplier_id
        const { data: suppliers } = await supabase
          .from("suppliers")
          .select("id, name")
          .eq("company_id", activeCompanyId!);

        for (const s of suppliers || []) {
          supplierNames[s.id] = s.name;
        }
      }

      let items: ProductListItem[] = (catalogRows || []).map((row: any) => {
        const cache = Array.isArray(row.product_price_cache)
          ? row.product_price_cache[0]
          : row.product_price_cache;
        return {
          id: row.id,
          name: row.name,
          el_number: row.el_number,
          ean: row.ean,
          brand: row.brand,
          category: row.category,
          unit: row.unit,
          is_active: row.is_active,
          updated_at: row.updated_at,
          best_net_price: cache?.best_net_price ?? null,
          best_supplier_name: cache?.best_supplier_id
            ? supplierNames[cache.best_supplier_id] ?? null
            : null,
          supplier_count: supplierCounts[row.id] || 0,
        };
      });

      // Client-side filters
      if (filterOnlyWithPrice) {
        items = items.filter((p) => p.best_net_price != null);
      }
      if (filterOnlyMultiSupplier) {
        items = items.filter((p) => p.supplier_count > 1);
      }

      // Client-side sort for price/suppliers
      if (sortBy === "price") {
        items.sort((a, b) => {
          const ap = a.best_net_price ?? Infinity;
          const bp = b.best_net_price ?? Infinity;
          return sortAsc ? ap - bp : bp - ap;
        });
      } else if (sortBy === "suppliers") {
        items.sort((a, b) =>
          sortAsc ? a.supplier_count - b.supplier_count : b.supplier_count - a.supplier_count
        );
      }

      return items;
    },
  });

  return { products, loading };
}
