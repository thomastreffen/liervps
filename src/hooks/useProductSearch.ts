/**
 * Hook for smart product search with pricing intelligence.
 * Searches catalog products and returns all supplier price alternatives.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";

export interface ProductSearchResult {
  catalog_product_id: string;
  name: string;
  el_number: string | null;
  ean: string | null;
  brand: string | null;
  category: string | null;
  unit: string | null;
  best_net_price: number | null;
  best_supplier_id: string | null;
  best_supplier_name: string | null;
  alternatives: SupplierAlternative[];
}

export interface SupplierAlternative {
  supplier_id: string;
  supplier_name: string;
  supplier_product_id: string;
  supplier_sku: string;
  net_price: number | null;
  list_price: number;
  discount_percent: number | null;
  is_cheapest: boolean;
  diff_from_cheapest: number;
  diff_percent: number;
}

export function useProductSearch(search: string, enabled = true) {
  const { activeCompanyId } = useCompanyContext();

  return useQuery({
    queryKey: ["product-search-intel", activeCompanyId, search],
    enabled: !!activeCompanyId && enabled && search.length >= 2,
    queryFn: async (): Promise<ProductSearchResult[]> => {
      // 1. Search catalog products
      const { data: catRows, error: catErr } = await supabase
        .from("supplier_catalog_products")
        .select("id, name, el_number, ean, brand, category, unit, product_price_cache(best_net_price, best_supplier_id)")
        .eq("company_id", activeCompanyId!)
        .eq("is_active", true)
        .or(`el_number.ilike.%${search}%,ean.ilike.%${search}%,name.ilike.%${search}%,brand.ilike.%${search}%`)
        .limit(20);

      if (catErr) throw catErr;
      if (!catRows?.length) return [];

      const productIds = catRows.map((r: any) => r.id);

      // 2. Get all supplier_products linked to these
      const { data: spLinks } = await supabase
        .from("supplier_products")
        .select("id, product_id, supplier_id, supplier_sku, supplier_product_name")
        .eq("company_id", activeCompanyId!)
        .in("product_id", productIds);

      const spIds = (spLinks || []).map((sp: any) => sp.id);

      // 3. Get prices
      let priceMap = new Map<string, any[]>();
      if (spIds.length > 0) {
        const { data: prices } = await supabase
          .from("supplier_prices")
          .select("*")
          .eq("company_id", activeCompanyId!)
          .in("supplier_product_id", spIds)
          .order("net_price", { ascending: true });

        for (const p of prices || []) {
          const arr = priceMap.get(p.supplier_product_id) || [];
          arr.push(p);
          priceMap.set(p.supplier_product_id, arr);
        }
      }

      // 4. Supplier names
      const { data: suppliers } = await supabase
        .from("suppliers")
        .select("id, name")
        .eq("company_id", activeCompanyId!);
      const supplierNameMap = new Map((suppliers || []).map((s: any) => [s.id, s.name]));

      // 5. Assemble results
      return catRows.map((cat: any) => {
        const cache = Array.isArray(cat.product_price_cache)
          ? cat.product_price_cache[0]
          : cat.product_price_cache;

        const linkedSPs = (spLinks || []).filter((sp: any) => sp.product_id === cat.id);

        const alternatives: SupplierAlternative[] = [];
        let cheapestPrice = Infinity;

        for (const sp of linkedSPs) {
          const prices = priceMap.get(sp.id);
          const bestPrice = prices?.[0]; // already sorted by net_price asc
          if (bestPrice && bestPrice.net_price != null && bestPrice.net_price < cheapestPrice) {
            cheapestPrice = bestPrice.net_price;
          }
        }

        for (const sp of linkedSPs) {
          const prices = priceMap.get(sp.id);
          const bestPrice = prices?.[0];
          const netPrice = bestPrice?.net_price ?? null;
          const diffFromCheapest = netPrice != null && cheapestPrice < Infinity
            ? netPrice - cheapestPrice
            : 0;
          const diffPercent = cheapestPrice > 0 && netPrice != null
            ? ((netPrice - cheapestPrice) / cheapestPrice) * 100
            : 0;

          alternatives.push({
            supplier_id: sp.supplier_id,
            supplier_name: supplierNameMap.get(sp.supplier_id) ?? "Ukjent",
            supplier_product_id: sp.id,
            supplier_sku: sp.supplier_sku,
            net_price: netPrice,
            list_price: bestPrice?.list_price ?? 0,
            discount_percent: bestPrice?.discount_percent ?? null,
            is_cheapest: netPrice != null && netPrice === cheapestPrice,
            diff_from_cheapest: diffFromCheapest,
            diff_percent: diffPercent,
          });
        }

        alternatives.sort((a, b) => (a.net_price ?? Infinity) - (b.net_price ?? Infinity));

        return {
          catalog_product_id: cat.id,
          name: cat.name,
          el_number: cat.el_number,
          ean: cat.ean,
          brand: cat.brand,
          category: cat.category,
          unit: cat.unit,
          best_net_price: cache?.best_net_price ?? (cheapestPrice < Infinity ? cheapestPrice : null),
          best_supplier_id: cache?.best_supplier_id ?? (alternatives[0]?.supplier_id ?? null),
          best_supplier_name: cache?.best_supplier_id
            ? supplierNameMap.get(cache.best_supplier_id) ?? null
            : alternatives[0]?.supplier_name ?? null,
          alternatives,
        };
      });
    },
  });
}
