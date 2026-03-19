/**
 * Hook for purchase order list – company-scoped.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface PurchaseOrderRow {
  id: string;
  order_number: string;
  title: string;
  status: string;
  supplier_id: string | null;
  supplier_name: string | null;
  project_id: string | null;
  project_title: string | null;
  total_ex_vat: number;
  line_count: number;
  total_saving: number;
  created_at: string;
  updated_at: string;
}

export function usePurchaseOrders() {
  const { activeCompanyId } = useCompanyContext();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: orders = [], isLoading: loading } = useQuery({
    queryKey: ["purchase-orders", activeCompanyId],
    enabled: !!activeCompanyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select(`
          id, order_number, title, status, supplier_id, project_id, total_ex_vat, created_at, updated_at,
          suppliers:supplier_id(name),
          events:project_id(title),
          purchase_order_lines(id, price_saving)
        `)
        .eq("company_id", activeCompanyId!)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;

      return (data || []).map((row: any) => {
        const lines = Array.isArray(row.purchase_order_lines) ? row.purchase_order_lines : [];
        return {
          id: row.id,
          order_number: row.order_number,
          title: row.title,
          status: row.status,
          supplier_id: row.supplier_id,
          supplier_name: row.suppliers?.name ?? null,
          project_id: row.project_id,
          project_title: row.events?.title ?? null,
          total_ex_vat: row.total_ex_vat,
          line_count: lines.length,
          total_saving: lines.reduce((sum: number, l: any) => sum + (l.price_saving || 0), 0),
          created_at: row.created_at,
          updated_at: row.updated_at,
        };
      }) as PurchaseOrderRow[];
    },
  });

  const createOrder = useMutation({
    mutationFn: async (params: { title: string; supplier_id?: string; project_id?: string }) => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .insert({
          company_id: activeCompanyId!,
          title: params.title,
          supplier_id: params.supplier_id || null,
          project_id: params.project_id || null,
          created_by: user!.id,
        } as any)
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase-orders"] });
      toast.success("Innkjøpsordre opprettet");
    },
    onError: (err: Error) => {
      toast.error("Feil ved opprettelse", { description: err.message });
    },
  });

  return { orders, loading, createOrder };
}
