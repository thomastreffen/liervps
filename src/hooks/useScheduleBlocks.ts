import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { startOfWeek, endOfWeek } from "date-fns";

export interface ScheduleBlock {
  id: string;
  company_id: string;
  technician_id: string;
  project_id: string | null;
  outlook_event_id: string | null;
  calendar_id: string | null;
  source: "outlook" | "manual" | "system";
  start_at: Date;
  end_at: Date;
  title: string;
  location: string | null;
  description: string | null;
  match_confidence: number;
  match_reason: string | null;
  match_state: "auto" | "needs_confirmation" | "external" | "confirmed" | "manual";
  mcs_block_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  technician_name?: string;
  technician_color?: string | null;
  project_title?: string | null;
}

export function useScheduleBlocks(referenceDate: Date, technicianId?: string | null) {
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [loading, setLoading] = useState(false);

  const weekStart = useMemo(() => startOfWeek(referenceDate, { weekStartsOn: 1 }), [referenceDate.toDateString()]);
  const weekEnd = useMemo(() => endOfWeek(referenceDate, { weekStartsOn: 1 }), [referenceDate.toDateString()]);

  const fetchBlocks = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("schedule_blocks")
        .select(`
          *,
          technicians!inner(name, color),
          events(title)
        `)
        .gte("start_at", weekStart.toISOString())
        .lte("start_at", weekEnd.toISOString())
        .order("start_at", { ascending: true });

      if (technicianId) {
        query = query.eq("technician_id", technicianId);
      }

      const { data, error } = await query;
      if (error) {
        console.error("[ScheduleBlocks] Fetch error:", error);
        setBlocks([]);
        return;
      }

      const mapped: ScheduleBlock[] = (data ?? []).map((row: any) => ({
        ...row,
        start_at: new Date(row.start_at),
        end_at: new Date(row.end_at),
        technician_name: row.technicians?.name,
        technician_color: row.technicians?.color,
        project_title: row.events?.title ?? null,
      }));

      setBlocks(mapped);
    } catch (err) {
      console.error("[ScheduleBlocks] Exception:", err);
    } finally {
      setLoading(false);
    }
  }, [weekStart, weekEnd, technicianId]);

  useEffect(() => { fetchBlocks(); }, [fetchBlocks]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("schedule-blocks-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "schedule_blocks" }, () => {
        fetchBlocks();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchBlocks]);

  return { blocks, loading, refetch: fetchBlocks };
}

/** Hook to get count of blocks needing confirmation */
export function useConfirmationCount() {
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    const { count: c, error } = await supabase
      .from("schedule_blocks")
      .select("id", { count: "exact", head: true })
      .eq("match_state", "needs_confirmation");
    if (!error && c !== null) setCount(c);
  }, []);

  useEffect(() => { fetchCount(); }, [fetchCount]);

  useEffect(() => {
    const channel = supabase
      .channel("confirmation-count")
      .on("postgres_changes", { event: "*", schema: "public", table: "schedule_blocks" }, () => {
        fetchCount();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchCount]);

  return count;
}
