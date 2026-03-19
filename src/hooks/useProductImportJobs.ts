/**
 * Hook for product import job monitoring – company-scoped.
 *
 * Provides read access to import job history and status.
 * Job creation is done via Edge Functions (not client-side).
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import type { ProductImportJob } from "@/types/product-module";

export function useProductImportJobs(supplierId?: string) {
  const { activeCompanyId } = useCompanyContext();

  const queryKey = ["product-import-jobs", activeCompanyId, supplierId];

  const { data: jobs = [], isLoading: loading } = useQuery({
    queryKey,
    enabled: !!activeCompanyId,
    queryFn: async () => {
      let query = supabase
        .from("product_import_jobs")
        .select("*")
        .eq("company_id", activeCompanyId!)
        .order("created_at", { ascending: false })
        .limit(50);

      if (supplierId) {
        query = query.eq("supplier_id", supplierId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ProductImportJob[];
    },
  });

  return { jobs, loading };
}
