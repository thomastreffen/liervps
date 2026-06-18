import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { MaterialListStatus, MaterialItemSource } from "@/lib/material-status";

export interface MaterialListRow {
  id: string;
  job_id: string | null;
  order_id: string | null;
  company_id: string;
  status: MaterialListStatus;
  notes: string | null;
  created_by: string | null;
  approved_by: string | null;
  ordered_at: string | null;
  received_at: string | null;
  picked_at: string | null;
  sent_with_installer_at: string | null;
  consumption_registered_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MaterialItemRow {
  id: string;
  material_list_id: string;
  elnr: string | null;
  supplier_sku: string | null;
  description: string;
  quantity_ordered: number;
  quantity_picked: number;
  quantity_used: number;
  quantity_returned: number;
  return_overridden: boolean;
  unit: string;
  supplier: string | null;
  source: MaterialItemSource;
  ai_confidence: string | null;
  ai_reason: string | null;
  comment: string | null;
  unit_price: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface UseMaterialListOpts {
  jobId?: string | null;
  orderId?: string | null;
  companyId?: string | null;
}

export function useMaterialList({ jobId, orderId, companyId }: UseMaterialListOpts) {
  const [list, setList] = useState<MaterialListRow | null>(null);
  const [items, setItems] = useState<MaterialItemRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!jobId && !orderId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = supabase.from("material_lists").select("*").limit(1);
    if (jobId) q.eq("job_id", jobId);
    else if (orderId) q.eq("order_id", orderId);
    const { data: lists } = await q;
    const found = (lists ?? [])[0] as MaterialListRow | undefined;
    setList(found ?? null);
    if (found) {
      const { data: rows } = await supabase
        .from("material_list_items")
        .select("*")
        .eq("material_list_id", found.id)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      setItems((rows ?? []) as MaterialItemRow[]);
    } else {
      setItems([]);
    }
    setLoading(false);
  }, [jobId, orderId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Realtime
  useEffect(() => {
    if (!list?.id) return;
    const channel = supabase
      .channel(`mat-list-${list.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "material_list_items", filter: `material_list_id=eq.${list.id}` },
        () => fetchAll(),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "material_lists", filter: `id=eq.${list.id}` },
        () => fetchAll(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [list?.id, fetchAll]);

  const create = useCallback(async () => {
    if (!companyId) throw new Error("Mangler selskap");
    const { data: userRes } = await supabase.auth.getUser();
    const payload = {
      job_id: jobId ?? null,
      order_id: orderId ?? null,
      company_id: companyId,
      status: "utkast" as MaterialListStatus,
      created_by: userRes.user?.id ?? null,
    };
    const { data, error } = await supabase.from("material_lists").insert(payload).select("*").single();
    if (error) throw error;
    setList(data as MaterialListRow);
    return data as MaterialListRow;
  }, [jobId, orderId, companyId]);

  const addItem = useCallback(
    async (
      patch: Partial<MaterialItemRow> & { description: string },
      listIdOverride?: string,
    ) => {
      const targetId = listIdOverride ?? list?.id;
      if (!targetId) throw new Error("Mangler materialliste");
      const insert = {
        material_list_id: targetId,
        description: patch.description,
        elnr: patch.elnr ?? null,
        supplier_sku: patch.supplier_sku ?? null,
        unit: patch.unit ?? "stk",
        supplier: patch.supplier ?? null,
        quantity_ordered: patch.quantity_ordered ?? 1,
        quantity_picked: patch.quantity_picked ?? 0,
        quantity_used: patch.quantity_used ?? 0,
        source: (patch.source ?? "manual") as MaterialItemSource,
        ai_confidence: patch.ai_confidence ?? null,
        ai_reason: patch.ai_reason ?? null,
        comment: patch.comment ?? null,
        sort_order: patch.sort_order ?? items.length,
      };
      const { error } = await supabase.from("material_list_items").insert(insert);
      if (error) throw error;
      await fetchAll();
    },
    [list?.id, items.length, fetchAll],
  );

  const addItemsBulk = useCallback(
    async (rows: Array<Partial<MaterialItemRow> & { description: string }>) => {
      if (!list?.id || rows.length === 0) return;
      const base = items.length;
      const payload = rows.map((r, idx) => ({
        material_list_id: list.id,
        description: r.description,
        elnr: r.elnr ?? null,
        supplier_sku: r.supplier_sku ?? null,
        unit: r.unit ?? "stk",
        supplier: r.supplier ?? null,
        quantity_ordered: r.quantity_ordered ?? 1,
        quantity_picked: 0,
        quantity_used: 0,
        source: (r.source ?? "manual") as MaterialItemSource,
        ai_confidence: r.ai_confidence ?? null,
        ai_reason: r.ai_reason ?? null,
        comment: r.comment ?? null,
        sort_order: base + idx,
      }));
      const { error } = await supabase.from("material_list_items").insert(payload);
      if (error) throw error;
      await fetchAll();
    },
    [list?.id, items.length, fetchAll],
  );

  const updateItem = useCallback(async (id: string, patch: Partial<MaterialItemRow>) => {
    const { error } = await supabase.from("material_list_items").update(patch).eq("id", id);
    if (error) throw error;
  }, []);

  const deleteItem = useCallback(async (id: string) => {
    const { error } = await supabase.from("material_list_items").delete().eq("id", id);
    if (error) throw error;
  }, []);

  const updateStatus = useCallback(
    async (status: MaterialListStatus) => {
      if (!list?.id) return;
      const stamp: Record<string, string> = { status };
      const now = new Date().toISOString();
      if (status === "bestilt") stamp.ordered_at = now;
      if (status === "mottatt") stamp.received_at = now;
      if (status === "plukket") stamp.picked_at = now;
      if (status === "med_montor") stamp.sent_with_installer_at = now;
      if (status === "forbruk_registrert") stamp.consumption_registered_at = now;
      if (status === "ferdig") stamp.completed_at = now;
      const { error } = await supabase.from("material_lists").update(stamp).eq("id", list.id);
      if (error) throw error;
    },
    [list?.id],
  );

  return {
    list,
    items,
    loading,
    refresh: fetchAll,
    create,
    addItem,
    addItemsBulk,
    updateItem,
    deleteItem,
    updateStatus,
  };
}
