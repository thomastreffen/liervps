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
  // Outlook detail fields
  outlook_subject: string | null;
  outlook_location: string | null;
  outlook_preview: string | null;
  outlook_weblink: string | null;
  outlook_organizer: string | null;
  // Joined
  technician_name?: string;
  technician_color?: string | null;
  project_title?: string | null;
}

function mapRow(row: any): ScheduleBlock {
  return {
    ...row,
    start_at: new Date(row.start_at),
    end_at: new Date(row.end_at),
    technician_name: row.technicians?.name,
    technician_color: row.technicians?.color,
    project_title: row.events?.title ?? null,
  };
}

/**
 * Fetches schedule_blocks with correct overlap query:
 *   start_at < rangeEnd AND end_at > rangeStart
 * 
 * Accepts optional technicianIds array for batched viewport fetching.
 * Realtime changes are debounced (200ms) to handle cron batch upserts.
 */
export function useScheduleBlocks(
  referenceDate: Date,
  technicianId?: string | null,
  technicianIds?: string[]
) {
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [loading, setLoading] = useState(false);
  const fetchIdRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const weekStart = useMemo(
    () => startOfWeek(referenceDate, { weekStartsOn: 1 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [referenceDate.toDateString()]
  );
  const weekEnd = useMemo(
    () => endOfWeek(referenceDate, { weekStartsOn: 1 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [referenceDate.toDateString()]
  );

  // Stable key for technician filter
  const techFilterKey = technicianId || (technicianIds ? technicianIds.join(",") : "all");

  const fetchBlocks = useCallback(async (silent = false) => {
    const id = ++fetchIdRef.current;
    if (!silent) setLoading(true);
    try {
      // Correct overlap query: start_at < rangeEnd AND end_at > rangeStart
      let query = supabase
        .from("schedule_blocks")
        .select(`
          *,
          technicians!inner(name, color),
          events(title)
        `)
        .lt("start_at", weekEnd.toISOString())
        .gt("end_at", weekStart.toISOString())
        .order("start_at", { ascending: true });

      // Filter by technician(s)
      if (technicianId) {
        query = query.eq("technician_id", technicianId);
      } else if (technicianIds && technicianIds.length > 0) {
        query = query.in("technician_id", technicianIds);
      }

      const { data, error } = await query;
      if (id !== fetchIdRef.current) return; // stale
      if (error) {
        console.error("[ScheduleBlocks] Fetch error:", error);
        setBlocks([]);
        return;
      }

      setBlocks((data ?? []).map(mapRow));
    } catch (err) {
      console.error("[ScheduleBlocks] Exception:", err);
    } finally {
      if (id === fetchIdRef.current && !silent) setLoading(false);
    }
  }, [weekStart, weekEnd, technicianId, technicianIds?.join(",")]);

  // Debounced silent refetch – batches multiple realtime events
  const debouncedRefetch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchBlocks(true), 200);
  }, [fetchBlocks]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Initial fetch
  useEffect(() => { fetchBlocks(); }, [fetchBlocks]);

  // Realtime – debounced to handle cron batch upserts
  useEffect(() => {
    const channel = supabase
      .channel(`schedule-blocks-rt-${techFilterKey}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "schedule_blocks" },
        () => debouncedRefetch()
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "schedule_blocks" },
        () => debouncedRefetch()
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "schedule_blocks" },
        (payload) => {
          const old = payload.old as any;
          // Immediate removal from state
          setBlocks((prev) => prev.filter((b) => b.id !== old.id));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [techFilterKey, debouncedRefetch]);

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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(fetchCount, 300);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchCount]);

  // Fallback polling
  useEffect(() => {
    const interval = setInterval(fetchCount, 60_000);
    return () => clearInterval(interval);
  }, [fetchCount]);

  return count;
}
