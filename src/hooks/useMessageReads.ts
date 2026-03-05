import { useEffect, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ReadReceipt {
  post_id: string;
  user_account_id: string;
  display_name: string;
  read_at: string;
}

export function useMessageReads(threadId: string | null, currentUaId: string | null, postIds: string[]) {
  const [reads, setReads] = useState<Map<string, ReadReceipt[]>>(new Map());

  const fetchReads = useCallback(async () => {
    if (!threadId || postIds.length === 0) return;

    const { data } = await (supabase as any)
      .from("message_reads")
      .select("post_id, user_account_id, read_at")
      .in("post_id", postIds);

    if (!data) return;

    // Group by post_id
    const grouped = new Map<string, ReadReceipt[]>();
    for (const r of data as any[]) {
      const list = grouped.get(r.post_id) || [];
      list.push(r);
      grouped.set(r.post_id, list);
    }
    setReads(grouped);
  }, [threadId, postIds.join(",")]);

  useEffect(() => { fetchReads(); }, [fetchReads]);

  // Realtime updates
  useEffect(() => {
    if (!threadId) return;
    const channel = supabase
      .channel(`msg-reads-${threadId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "message_reads" },
        () => fetchReads()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [threadId, fetchReads]);

  // Mark posts as read
  const markAsRead = useCallback(async (visiblePostIds: string[]) => {
    if (!currentUaId || visiblePostIds.length === 0) return;

    // Filter out already-read posts
    const unread = visiblePostIds.filter(id => {
      const postReads = reads.get(id) || [];
      return !postReads.some(r => r.user_account_id === currentUaId);
    });

    if (unread.length === 0) return;

    const inserts = unread.map(post_id => ({
      post_id,
      user_account_id: currentUaId,
    }));

    await (supabase as any)
      .from("message_reads")
      .upsert(inserts, { onConflict: "post_id,user_account_id", ignoreDuplicates: true });
  }, [currentUaId, reads]);

  const getReadCount = useCallback((postId: string): number => {
    const postReads = reads.get(postId) || [];
    // Exclude current user from count
    return postReads.filter(r => r.user_account_id !== currentUaId).length;
  }, [reads, currentUaId]);

  return { reads, markAsRead, getReadCount };
}
