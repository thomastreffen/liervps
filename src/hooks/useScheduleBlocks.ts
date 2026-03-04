import { useEffect, useState, useCallback, useMemo, useRef } from "react";
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

function isInWeek(dateStr: string, weekStart: Date, weekEnd: Date): boolean {
  const d = new Date(dateStr);
  return d >= weekStart && d <= weekEnd;
}

export function useScheduleBlocks(referenceDate: Date, technicianId?: string | null) {
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [loading, setLoading] = useState(false);
  const fetchIdRef = useRef(0);

  const weekStart = useMemo(() => startOfWeek(referenceDate, { weekStartsOn: 1 }), [referenceDate.toDateString()]);
  const weekEnd = useMemo(() => endOfWeek(referenceDate, { weekStartsOn: 1 }), [referenceDate.toDateString()]);

  const fetchBlocks = useCallback(async (silent = false) => {
    const id = ++fetchIdRef.current;
    if (!silent) setLoading(true);
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
      if (id !== fetchIdRef.current) return; // stale
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
      if (id === fetchIdRef.current && !silent) setLoading(false);
    }
  }, [weekStart, weekEnd, technicianId]);

  // Initial fetch
  useEffect(() => { fetchBlocks(); }, [fetchBlocks]);

  // Realtime – broad subscription, refetch on relevant changes
  useEffect(() => {
    const channel = supabase
      .channel("schedule-blocks-rt")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "schedule_blocks" },
        (payload) => {
          const row = payload.new as any;
          // If the new row falls in current week range, do a silent refetch
          // to get joined data (technician name, project title)
          if (isInWeek(row.start_at, weekStart, weekEnd)) {
            if (!technicianId || row.technician_id === technicianId) {
              fetchBlocks(true);
            }
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "schedule_blocks" },
        (payload) => {
          const row = payload.new as any;
          // Refetch if updated block is in current view or was previously in view
          const inView = isInWeek(row.start_at, weekStart, weekEnd);
          const wasInView = blocks.some((b) => b.id === row.id);
          if (inView || wasInView) {
            if (!technicianId || row.technician_id === technicianId) {
              fetchBlocks(true);
            }
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "schedule_blocks" },
        (payload) => {
          const old = payload.old as any;
          // Remove from local state immediately
          setBlocks((prev) => prev.filter((b) => b.id !== old.id));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, weekEnd, technicianId, fetchBlocks]);

  // Fallback: silent refetch every 60s
  useEffect(() => {
    const interval = setInterval(() => fetchBlocks(true), 60_000);
    return () => clearInterval(interval);
  }, [fetchBlocks]);

  // Fallback: refetch on tab focus / visibilitychange
  useEffect(() => {
    const onFocus = () => fetchBlocks(true);
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchBlocks(true);
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
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
      .channel("confirmation-count-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "schedule_blocks" }, () => {
        fetchCount();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchCount]);

  // Fallback polling for confirmation count
  useEffect(() => {
    const interval = setInterval(fetchCount, 60_000);
    return () => clearInterval(interval);
  }, [fetchCount]);

  return count;
}
