/**
 * Hook for purchase order detail – loads order + lines with pricing intelligence.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { toast } from "sonner";

export interface PurchaseOrderLine {
  id: string;
  sort_order: number;
  catalog_product_id: string | null;
  supplier_product_id: string | null;
  description: string;
  el_number: string | null;
  quantity: number;
  unit: string;
  unit_price: number;
  discount_percent: number;
  net_price: number;
  total_ex_vat: number;
  vat_rate: number;
  best_available_price: number | null;
  best_available_supplier_id: string | null;
  best_available_supplier_name: string | null;
  chosen_supplier_id: string | null;
  chosen_supplier_name: string | null;
  price_saving: number;
}

export interface PurchaseOrderDetail {
  id: string;
  order_number: string;
  title: string;
  status: string;
  notes: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  project_id: string | null;
  project_title: string | null;
  total_ex_vat: number;
  preferred_supplier_threshold: number;
  created_at: string;
  updated_at: string;
  lines: PurchaseOrderLine[];
}

export interface OrderAnalysis {
  totalCost: number;
  totalBestCost: number;
  totalSaving: number;
  linesWithSaving: number;
  supplierBreakdown: Array<{
    supplier_id: string;
    supplier_name: string;
    lineCount: number;
    total: number;
    saving: number;
  }>;
  splitRecommendation: string | null;
}

export function usePurchaseOrderDetail(orderId?: string) {
  const { activeCompanyId } = useCompanyContext();
  const qc = useQueryClient();

  const { data: order, isLoading: loading } = useQuery({
    queryKey: ["purchase-order-detail", activeCompanyId, orderId],
    enabled: !!activeCompanyId && !!orderId,
    queryFn: async (): Promise<PurchaseOrderDetail | null> => {
      const { data: po, error: poErr } = await supabase
        .from("purchase_orders")
        .select(`
          *,
          suppliers:supplier_id(name),
          events:project_id(title)
        `)
        .eq("id", orderId!)
        .eq("company_id", activeCompanyId!)
        .single();

      if (poErr) throw poErr;
      if (!po) return null;

      const { data: lines, error: lErr } = await supabase
        .from("purchase_order_lines")
        .select("*")
        .eq("purchase_order_id", orderId!)
        .order("sort_order");

      if (lErr) throw lErr;

      // Get supplier names for best/chosen supplier IDs
      const { data: allSuppliers } = await supabase
        .from("suppliers")
        .select("id, name")
        .eq("company_id", activeCompanyId!);

      const supplierMap = new Map((allSuppliers || []).map((s: any) => [s.id, s.name]));

      const mappedLines: PurchaseOrderLine[] = (lines || []).map((l: any) => ({
        ...l,
        best_available_supplier_name: l.best_available_supplier_id
          ? supplierMap.get(l.best_available_supplier_id) ?? null
          : null,
        chosen_supplier_name: l.chosen_supplier_id
          ? supplierMap.get(l.chosen_supplier_id) ?? null
          : null,
      }));

      return {
        id: po.id,
        order_number: po.order_number,
        title: po.title,
        status: po.status,
        notes: po.notes,
        supplier_id: po.supplier_id,
        supplier_name: (po as any).suppliers?.name ?? null,
        project_id: po.project_id,
        project_title: (po as any).events?.title ?? null,
        total_ex_vat: po.total_ex_vat,
        preferred_supplier_threshold: po.preferred_supplier_threshold,
        created_at: po.created_at,
        updated_at: po.updated_at,
        lines: mappedLines,
      };
    },
  });

  // Analyze order
  function analyzeOrder(detail: PurchaseOrderDetail): OrderAnalysis {
    const lines = detail.lines;
    const totalCost = lines.reduce((sum, l) => sum + (l.total_ex_vat || 0), 0);
    const totalBestCost = lines.reduce((sum, l) => {
      const best = l.best_available_price != null
        ? l.best_available_price * l.quantity
        : l.total_ex_vat || 0;
      return sum + best;
    }, 0);
    const totalSaving = totalCost - totalBestCost;
    const linesWithSaving = lines.filter((l) => l.price_saving > 0).length;

    // Group by best supplier
    const bySupplier = new Map<string, { name: string; lineCount: number; total: number; saving: number }>();
    for (const l of lines) {
      const sid = l.best_available_supplier_id || l.chosen_supplier_id || detail.supplier_id || "unknown";
      const sname = l.best_available_supplier_name || l.chosen_supplier_name || detail.supplier_name || "Ukjent";
      const entry = bySupplier.get(sid) || { name: sname, lineCount: 0, total: 0, saving: 0 };
      entry.lineCount++;
      entry.total += l.best_available_price != null ? l.best_available_price * l.quantity : (l.total_ex_vat || 0);
      entry.saving += l.price_saving;
      bySupplier.set(sid, entry);
    }

    const supplierBreakdown = Array.from(bySupplier.entries()).map(([sid, data]) => ({
      supplier_id: sid,
      supplier_name: data.name,
      ...data,
    }));

    let splitRecommendation: string | null = null;
    if (supplierBreakdown.length > 1 && totalSaving > 0) {
      const threshold = detail.preferred_supplier_threshold;
      const savingPercent = totalCost > 0 ? (totalSaving / totalCost) * 100 : 0;
      if (savingPercent <= threshold) {
        splitRecommendation = `Behold samlet hos ${detail.supplier_name || "valgt leverandør"}? Merkostnad kun ${formatKr(totalSaving)}`;
      } else {
        splitRecommendation = `${linesWithSaving} linjer kan flyttes og spare ${formatKr(totalSaving)}`;
      }
    }

    return { totalCost, totalBestCost, totalSaving, linesWithSaving, supplierBreakdown, splitRecommendation };
  }

  // Add line
  const addLine = useMutation({
    mutationFn: async (line: {
      description: string;
      el_number?: string;
      quantity: number;
      unit?: string;
      unit_price: number;
      net_price: number;
      catalog_product_id?: string;
      supplier_product_id?: string;
      best_available_price?: number;
      best_available_supplier_id?: string;
      chosen_supplier_id?: string;
    }) => {
      const currentLines = order?.lines.length ?? 0;
      const { error } = await supabase
        .from("purchase_order_lines")
        .insert({
          purchase_order_id: orderId!,
          company_id: activeCompanyId!,
          sort_order: currentLines,
          ...line,
        } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase-order-detail"] });
    },
    onError: (err: Error) => {
      toast.error("Feil ved legg til linje", { description: err.message });
    },
  });

  // Remove line
  const removeLine = useMutation({
    mutationFn: async (lineId: string) => {
      const { error } = await supabase
        .from("purchase_order_lines")
        .delete()
        .eq("id", lineId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase-order-detail"] });
    },
  });

  // Update order fields
  const updateOrder = useMutation({
    mutationFn: async (fields: Record<string, unknown>) => {
      const { error } = await supabase
        .from("purchase_orders")
        .update(fields)
        .eq("id", orderId!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase-order-detail"] });
      qc.invalidateQueries({ queryKey: ["purchase-orders"] });
    },
  });

  // Recalculate totals
  const recalcTotals = useMutation({
    mutationFn: async () => {
      if (!order) return;
      const total = order.lines.reduce((s, l) => s + (l.total_ex_vat || 0), 0);
      const totalInc = total * 1.25; // 25% MVA
      await supabase
        .from("purchase_orders")
        .update({ total_ex_vat: total, total_inc_vat: totalInc })
        .eq("id", orderId!);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase-order-detail"] });
      qc.invalidateQueries({ queryKey: ["purchase-orders"] });
    },
  });

  return {
    order: order ?? null,
    loading,
    analyzeOrder,
    addLine,
    removeLine,
    updateOrder,
    recalcTotals,
  };
}

function formatKr(val: number) {
  return new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK", maximumFractionDigits: 0 }).format(val);
}
