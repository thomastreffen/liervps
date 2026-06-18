import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface MaterialSuggestionRow {
  id: string;
  material_list_id: string;
  share_token: string | null;
  suggested_by_name: string | null;
  suggested_by_email: string | null;
  elnr: string | null;
  description: string | null;
  quantity: number;
  unit: string;
  provided_by: string | null;
  comment: string | null;
  status: "pending" | "approved" | "rejected";
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_comment: string | null;
  created_at: string;
  updated_at: string;
}

export function useMaterialSuggestions(materialListId: string | null | undefined) {
  const [rows, setRows] = useState<MaterialSuggestionRow[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!materialListId) {
      setRows([]);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("material_external_suggestions" as never)
      .select("*")
      .eq("material_list_id", materialListId)
      .order("created_at", { ascending: false });
    setRows((data ?? []) as unknown as MaterialSuggestionRow[]);
    setLoading(false);
  }, [materialListId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!materialListId) return;
    const ch = supabase
      .channel(`mat-sug-${materialListId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "material_external_suggestions",
          filter: `material_list_id=eq.${materialListId}`,
        },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [materialListId, refresh]);

  const pendingCount = rows.filter((r) => r.status === "pending").length;

  const updateStatus = useCallback(
    async (id: string, status: "approved" | "rejected", reviewComment?: string) => {
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("material_external_suggestions" as never)
        .update({
          status,
          reviewed_by: userRes.user?.id ?? null,
          reviewed_at: new Date().toISOString(),
          review_comment: reviewComment ?? null,
        } as never)
        .eq("id", id);
      if (error) throw error;
    },
    [],
  );

  return { rows, loading, refresh, pendingCount, updateStatus };
}
