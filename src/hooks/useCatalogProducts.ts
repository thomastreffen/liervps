/**
 * Hook for querying the canonical product catalog – company-scoped.
 *
 * Supports search by el_number, EAN, name, and brand.
 * Used in tilbud/kalkyle for product lookup with best price.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import type { CatalogProduct, ProductPriceCache } from "@/types/product-module";

interface CatalogSearchParams {
  search?: string;
  category?: string;
  limit?: number;
}

export interface CatalogProductWithPrice extends CatalogProduct {
  price_cache?: ProductPriceCache | null;
}

export function useCatalogProducts(params: CatalogSearchParams = {}) {
  const { activeCompanyId } = useCompanyContext();
  const { search, category, limit = 50 } = params;

  const queryKey = ["catalog-products", activeCompanyId, search, category, limit];

  const { data: products = [], isLoading: loading } = useQuery({
    queryKey,
    enabled: !!activeCompanyId,
    queryFn: async () => {
      let query = supabase
        .from("supplier_catalog_products")
        .select(`
          *,
          product_price_cache (*)
        `)
        .eq("company_id", activeCompanyId!)
        .eq("is_active", true)
        .order("name")
        .limit(limit);

      if (search && search.length >= 2) {
        query = query.or(
          `el_number.ilike.%${search}%,ean.ilike.%${search}%,name.ilike.%${search}%,brand.ilike.%${search}%`
        );
      }

      if (category) {
        query = query.eq("category", category);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((row: any) => ({
        ...row,
        price_cache: Array.isArray(row.product_price_cache)
          ? row.product_price_cache[0] ?? null
          : row.product_price_cache ?? null,
      })) as CatalogProductWithPrice[];
    },
  });

  return { products, loading };
}
