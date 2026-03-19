/**
 * Hook for supplier price comparison – company-scoped.
 *
 * Given a product_id, fetches all supplier prices via supplier_products linkage.
 * Used for price comparison views in the product module.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import type { SupplierPrice } from "@/types/product-module";

export interface SupplierPriceWithDetails extends SupplierPrice {
  supplier_name?: string;
  supplier_sku?: string;
}

export function useSupplierPrices(productId?: string) {
  const { activeCompanyId } = useCompanyContext();

  const queryKey = ["supplier-prices", activeCompanyId, productId];

  const { data: prices = [], isLoading: loading } = useQuery({
    queryKey,
    enabled: !!activeCompanyId && !!productId,
    queryFn: async () => {
      // Get supplier_product ids linked to this product
      const { data: spLinks, error: spErr } = await supabase
        .from("supplier_products")
        .select("id, supplier_id, supplier_sku")
        .eq("company_id", activeCompanyId!)
        .eq("product_id", productId!);

      if (spErr) throw spErr;
      if (!spLinks?.length) return [];

      const spIds = spLinks.map((sp: any) => sp.id);
      const supplierMap = new Map(spLinks.map((sp: any) => [sp.id, sp]));

      const { data: priceRows, error: priceErr } = await supabase
        .from("supplier_prices")
        .select("*, suppliers:supplier_id(name)")
        .eq("company_id", activeCompanyId!)
        .in("supplier_product_id", spIds)
        .order("net_price", { ascending: true });

      if (priceErr) throw priceErr;

      return (priceRows || []).map((row: any) => ({
        ...row,
        supplier_name: row.suppliers?.name,
        supplier_sku: supplierMap.get(row.supplier_product_id)?.supplier_sku,
      })) as SupplierPriceWithDetails[];
    },
  });

  return { prices, loading };
}
