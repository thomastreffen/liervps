/**
 * Hook for unlinked supplier products – those without a catalog master link.
 * Used in the data quality section of the product module.
 * Supports server-side pagination with total count.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { toast } from "sonner";

export interface UnlinkedProduct {
  id: string;
  supplier_id: string;
  supplier_name: string;
  supplier_sku: string;
  supplier_product_name: string | null;
  raw_brand: string | null;
  raw_category: string | null;
  last_seen_at: string | null;
  created_at: string;
}

interface UnlinkedParams {
  page?: number;
  pageSize?: number;
  search?: string;
}

export function useUnlinkedProducts(params: UnlinkedParams = {}) {
  const { activeCompanyId } = useCompanyContext();
  const qc = useQueryClient();
  const { page = 0, pageSize = 100, search } = params;

  const { data, isLoading: loading } = useQuery({
    queryKey: ["unlinked-products", activeCompanyId, page, pageSize, search],
    enabled: !!activeCompanyId,
    queryFn: async () => {
      // Get total count
      let countQuery = supabase
        .from("supplier_products")
        .select("id", { count: "exact", head: true })
        .eq("company_id", activeCompanyId!)
        .is("product_id", null);

      if (search && search.length >= 2) {
        countQuery = countQuery.or(
          `supplier_sku.ilike.%${search}%,supplier_product_name.ilike.%${search}%,raw_brand.ilike.%${search}%`
        );
      }

      const { count: totalCount, error: countErr } = await countQuery;
      if (countErr) throw countErr;

      // Get paginated rows
      const from = page * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from("supplier_products")
        .select("id, supplier_id, supplier_sku, supplier_product_name, raw_brand, raw_category, last_seen_at, created_at, suppliers:supplier_id(name)")
        .eq("company_id", activeCompanyId!)
        .is("product_id", null)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (search && search.length >= 2) {
        query = query.or(
          `supplier_sku.ilike.%${search}%,supplier_product_name.ilike.%${search}%,raw_brand.ilike.%${search}%`
        );
      }

      const { data: rows, error } = await query;
      if (error) throw error;

      const items = (rows || []).map((row: any) => ({
        id: row.id,
        supplier_id: row.supplier_id,
        supplier_name: (row.suppliers as any)?.name ?? "Ukjent",
        supplier_sku: row.supplier_sku,
        supplier_product_name: row.supplier_product_name,
        raw_brand: row.raw_brand,
        raw_category: row.raw_category,
        last_seen_at: row.last_seen_at,
        created_at: row.created_at,
      })) as UnlinkedProduct[];

      return { items, totalCount: totalCount ?? 0 };
    },
  });

  const linkToProduct = useMutation({
    mutationFn: async ({ supplierProductId, productId }: { supplierProductId: string; productId: string }) => {
      const { error } = await supabase
        .from("supplier_products")
        .update({ product_id: productId })
        .eq("id", supplierProductId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Produkt koblet");
      qc.invalidateQueries({ queryKey: ["unlinked-products"] });
      qc.invalidateQueries({ queryKey: ["product-list"] });
    },
    onError: (err: Error) => {
      toast.error("Kobling feilet", { description: err.message });
    },
  });

  const createAndLink = useMutation({
    mutationFn: async (supplierProduct: UnlinkedProduct) => {
      const { data: newProduct, error: createErr } = await supabase
        .from("supplier_catalog_products")
        .insert({
          company_id: activeCompanyId!,
          name: supplierProduct.supplier_product_name || supplierProduct.supplier_sku,
          brand: supplierProduct.raw_brand,
          category: supplierProduct.raw_category,
          is_active: true,
        })
        .select("id")
        .single();

      if (createErr) throw createErr;

      const { error: linkErr } = await supabase
        .from("supplier_products")
        .update({ product_id: newProduct.id })
        .eq("id", supplierProduct.id);

      if (linkErr) throw linkErr;
      return newProduct.id;
    },
    onSuccess: () => {
      toast.success("Masterprodukt opprettet og koblet");
      qc.invalidateQueries({ queryKey: ["unlinked-products"] });
      qc.invalidateQueries({ queryKey: ["product-list"] });
    },
    onError: (err: Error) => {
      toast.error("Opprettelse feilet", { description: err.message });
    },
  });

  return {
    unlinked: data?.items ?? [],
    totalCount: data?.totalCount ?? 0,
    loading,
    linkToProduct,
    createAndLink,
  };
}
