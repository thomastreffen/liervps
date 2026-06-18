import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { MaterialProcurementRow, MaterialActivityRow } from "./useMaterialList";
import type { ProcurementStatus } from "@/lib/material-status";

export function useMaterialProcurements(materialListId: string | null | undefined) {
  const [rows, setRows] = useState<MaterialProcurementRow[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!materialListId) {
      setRows([]);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("material_procurements")
      .select("*")
      .eq("material_list_id", materialListId)
      .order("created_at", { ascending: true });
    setRows((data ?? []) as MaterialProcurementRow[]);
    setLoading(false);
  }, [materialListId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!materialListId) return;
    const ch = supabase
      .channel(`mat-proc-${materialListId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "material_procurements", filter: `material_list_id=eq.${materialListId}` },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [materialListId, refresh]);

  const create = useCallback(
    async (patch: Partial<MaterialProcurementRow>) => {
      if (!materialListId) throw new Error("Mangler materialliste");
      const { data: userRes } = await supabase.auth.getUser();
      const payload = {
        material_list_id: materialListId,
        supplier: patch.supplier ?? null,
        supplier_order_number: patch.supplier_order_number ?? null,
        ordered_at: patch.ordered_at ?? null,
        ordered_by: patch.ordered_by ?? userRes.user?.id ?? null,
        expected_delivery_at: patch.expected_delivery_at ?? null,
        delivery_method: patch.delivery_method ?? null,
        delivery_location: patch.delivery_location ?? null,
        received_at: patch.received_at ?? null,
        received_by: patch.received_by ?? null,
        status: (patch.status ?? "planned") as ProcurementStatus,
        comment: patch.comment ?? null,
      };
      const { data, error } = await supabase
        .from("material_procurements")
        .insert(payload)
        .select("*")
        .single();
      if (error) throw error;
      await refresh();
      return data as MaterialProcurementRow;
    },
    [materialListId, refresh],
  );

  const update = useCallback(
    async (id: string, patch: Partial<MaterialProcurementRow>) => {
      const { error } = await supabase.from("material_procurements").update(patch).eq("id", id);
      if (error) throw error;
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("material_procurements").delete().eq("id", id);
      if (error) throw error;
      await refresh();
    },
    [refresh],
  );

  return { rows, loading, refresh, create, update, remove };
}

export function useMaterialActivityLog(materialListId: string | null | undefined) {
  const [rows, setRows] = useState<MaterialActivityRow[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!materialListId) {
      setRows([]);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("material_activity_log")
      .select("*")
      .eq("material_list_id", materialListId)
      .order("created_at", { ascending: false })
      .limit(50);
    setRows((data ?? []) as MaterialActivityRow[]);
    setLoading(false);
  }, [materialListId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!materialListId) return;
    const ch = supabase
      .channel(`mat-log-${materialListId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "material_activity_log", filter: `material_list_id=eq.${materialListId}` },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [materialListId, refresh]);

  const log = useCallback(
    async (
      eventType: string,
      message: string,
      metadata: Record<string, unknown> | null = null,
    ) => {
      if (!materialListId) return;
      const { data: userRes } = await supabase.auth.getUser();
      const userMeta = userRes.user?.user_metadata as { full_name?: string } | undefined;
      await supabase.from("material_activity_log").insert({
        material_list_id: materialListId,
        actor_id: userRes.user?.id ?? null,
        actor_name: userMeta?.full_name ?? userRes.user?.email ?? null,
        actor_type: "internal",
        event_type: eventType,
        message,
        metadata: (metadata ?? null) as never,
      });
    },
    [materialListId],
  );

  return { rows, loading, refresh, log };
}
