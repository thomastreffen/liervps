/**
 * useSupplierIntegration – fetches/saves integration config for a single supplier.
 * Admin-only (RLS enforced).
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { toast } from "sonner";
import type { SupplierIntegration } from "@/types/product-module";

export function useSupplierIntegration(supplierId: string | undefined) {
  const { activeCompanyId } = useCompanyContext();
  const qc = useQueryClient();
  const queryKey = ["supplier-integration", activeCompanyId, supplierId];

  const { data: integration, isLoading: loading } = useQuery({
    queryKey,
    enabled: !!activeCompanyId && !!supplierId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_integrations")
        .select("*")
        .eq("company_id", activeCompanyId!)
        .eq("supplier_id", supplierId!)
        .maybeSingle();
      if (error) throw error;
      return (data as SupplierIntegration) ?? null;
    },
  });

  const upsertIntegration = useMutation({
    mutationFn: async (values: Partial<SupplierIntegration>) => {
      if (!activeCompanyId || !supplierId) throw new Error("Mangler kontekst");

      const payload = {
        ...values,
        company_id: activeCompanyId,
        supplier_id: supplierId,
      } as any;

      // Remove password_secret_ref from upsert – handled server-side
      delete payload.id;
      delete payload.created_at;
      delete payload.updated_at;

      if (integration?.id) {
        const { data, error } = await supabase
          .from("supplier_integrations")
          .update(payload)
          .eq("id", integration.id)
          .select()
          .single();
        if (error) throw error;
        return data as SupplierIntegration;
      } else {
        const { data, error } = await supabase
          .from("supplier_integrations")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        return data as SupplierIntegration;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success("Integrasjon lagret");
    },
    onError: (err: Error) => toast.error("Feil ved lagring", { description: err.message }),
  });

  return { integration: integration ?? null, loading, upsertIntegration };
}
