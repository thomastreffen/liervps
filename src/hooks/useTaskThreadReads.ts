import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface TaskThreadReadState {
  unreadCount: number;
  markAsRead: () => Promise<void>;
  loading: boolean;
  lastReadAt: string | null;
}

/**
 * Per-task thread unread tracking.
 * Uses task_thread_reads to track last_read_at per user per thread.
 */
export function useTaskThreadReads(taskId: string | null | undefined): TaskThreadReadState {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [lastReadAt, setLastReadAt] = useState<string | null>(null);

  const fetchUnreadCount = useCallback(async () => {
    if (!taskId || !user) { setUnreadCount(0); return; }
    setLoading(true);
    try {
      // Get thread for this task
      const { data: thread } = await (supabase as any)
        .from("task_threads")
        .select("id")
        .eq("task_id", taskId)
        .maybeSingle();

      if (!thread) { setUnreadCount(0); return; }

      // Get user's last read timestamp
      const { data: readRecord } = await (supabase as any)
        .from("task_thread_reads")
        .select("last_read_at")
        .eq("thread_id", thread.id)
        .eq("user_id", user.id)
        .maybeSingle();

      const lastReadAtVal = readRecord?.last_read_at || "1970-01-01T00:00:00Z";
      setLastReadAt(readRecord?.last_read_at || null);

      // Count messages after last_read_at (exclude user's own messages)
      const { count } = await (supabase as any)
        .from("task_messages")
        .select("id", { count: "exact", head: true })
        .eq("thread_id", thread.id)
        .is("deleted_at", null)
        .gt("created_at", lastReadAtVal)
        .neq("author_user_id", user.id);

      setUnreadCount(count || 0);
    } catch (err) {
      console.error("[useTaskThreadReads] error:", err);
    } finally {
      setLoading(false);
    }
  }, [taskId, user]);

  useEffect(() => { fetchUnreadCount(); }, [fetchUnreadCount]);

  // Realtime: refetch on new messages
  useEffect(() => {
    if (!taskId) return;
    const channel = supabase
      .channel(`thread-reads-${taskId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "task_messages",
        filter: `task_id=eq.${taskId}`,
      }, () => { fetchUnreadCount(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [taskId, fetchUnreadCount]);

  const markAsRead = useCallback(async () => {
    if (!taskId || !user) return;
    try {
      const { data: thread } = await (supabase as any)
        .from("task_threads")
        .select("id")
        .eq("task_id", taskId)
        .maybeSingle();

      if (!thread) return;

      // Get latest message id
      const { data: latestMsg } = await (supabase as any)
        .from("task_messages")
        .select("id")
        .eq("thread_id", thread.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      await (supabase as any)
        .from("task_thread_reads")
        .upsert({
          thread_id: thread.id,
          user_id: user.id,
          last_read_at: new Date().toISOString(),
          last_read_message_id: latestMsg?.id || null,
        }, { onConflict: "thread_id,user_id" });

      setUnreadCount(0);
    } catch (err) {
      console.error("[useTaskThreadReads] markAsRead error:", err);
    }
  }, [taskId, user]);

  return { unreadCount, markAsRead, loading, lastReadAt };
}

/**
 * Batch unread counts for multiple tasks at once.
 * Used in resource plan overview to show indicators.
 */
export function useTaskThreadUnreadBatch(taskIds: string[]): Map<string, number> {
  const { user } = useAuth();
  const [counts, setCounts] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (!user || taskIds.length === 0) { setCounts(new Map()); return; }

    let cancelled = false;

    (async () => {
      try {
        // Get all threads for these tasks
        const { data: threads } = await (supabase as any)
          .from("task_threads")
          .select("id, task_id")
          .in("task_id", taskIds);

        if (!threads || threads.length === 0) { setCounts(new Map()); return; }

        const threadIds = threads.map((t: any) => t.id);
        const threadTaskMap = new Map<string, string>();
        for (const t of threads) threadTaskMap.set(t.id, t.task_id);

        // Get user's read records
        const { data: reads } = await (supabase as any)
          .from("task_thread_reads")
          .select("thread_id, last_read_at")
          .eq("user_id", user.id)
          .in("thread_id", threadIds);

        const readMap = new Map<string, string>();
        for (const r of (reads || [])) {
          readMap.set(r.thread_id, r.last_read_at);
        }

        // Get message counts per thread after last_read_at
        const newCounts = new Map<string, number>();
        for (const thread of threads) {
          const lastReadAt = readMap.get(thread.id) || "1970-01-01T00:00:00Z";
          const { count } = await (supabase as any)
            .from("task_messages")
            .select("id", { count: "exact", head: true })
            .eq("thread_id", thread.id)
            .is("deleted_at", null)
            .gt("created_at", lastReadAt)
            .neq("author_user_id", user.id);

          if (count && count > 0) {
            newCounts.set(thread.task_id, count);
          }
        }

        if (!cancelled) setCounts(newCounts);
      } catch (err) {
        console.error("[useTaskThreadUnreadBatch] error:", err);
      }
    })();

    return () => { cancelled = true; };
  }, [user, taskIds.join(",")]);

  return counts;
}
