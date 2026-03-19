/**
 * Hook for supplier CRUD operations – company-scoped.
 *
 * Usage:
 *   const { suppliers, loading, createSupplier, updateSupplier } = useSuppliers();
 *
 * All queries are automatically filtered by activeCompanyId from CompanyContext.
 * Admin-level mutations use the "Admins manage suppliers" RLS policy.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { toast } from "sonner";
import type { Supplier, SupplierFormValues } from "@/types/product-module";

export function useSuppliers() {
  const { activeCompanyId } = useCompanyContext();
  const qc = useQueryClient();

  const queryKey = ["suppliers", activeCompanyId];

  const { data: suppliers = [], isLoading: loading } = useQuery({
    queryKey,
    enabled: !!activeCompanyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .eq("company_id", activeCompanyId!)
        .order("name");
      if (error) throw error;
      return data as Supplier[];
    },
  });

  const createSupplier = useMutation({
    mutationFn: async (values: SupplierFormValues) => {
      if (!activeCompanyId) throw new Error("Ingen aktiv bedrift valgt");
      const row = { ...values, company_id: activeCompanyId } as any;
      const { data, error } = await supabase
        .from("suppliers")
        .insert(row)
        .select()
        .single();
      if (error) throw error;
      return data as Supplier;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success("Grossist opprettet");
    },
    onError: (err: Error) => toast.error("Feil ved opprettelse", { description: err.message }),
  });

  const updateSupplier = useMutation({
    mutationFn: async ({ id, ...values }: Partial<SupplierFormValues> & { id: string }) => {
      const { data, error } = await supabase
        .from("suppliers")
        .update(values)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Supplier;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success("Grossist oppdatert");
    },
    onError: (err: Error) => toast.error("Feil ved oppdatering", { description: err.message }),
  });

  return { suppliers, loading, createSupplier, updateSupplier };
}
