import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface InboxItem {
  id: string;
  post_id: string;
  thread_id: string;
  reason: string;
  handled_at: string | null;
  created_at: string;
  // Joined data
  post_body?: string;
  post_author_name?: string;
  post_created_at?: string;
  thread_title?: string;
  suggested_actions?: any[];
}

export function useInbox(threadId: string, userAccountId: string | null) {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    if (!threadId || !userAccountId) { setItems([]); setLoading(false); return; }
    setLoading(true);

    const { data } = await (supabase as any)
      .from("conversation_inbox_items")
      .select(`
        *,
        conversation_posts!inner (
          body_text, body_clean, created_at, author_id,
          conversation_threads!inner ( title )
        )
      `)
      .eq("thread_id", threadId)
      .eq("target_user_account_id", userAccountId)
      .is("handled_at", null)
      .order("created_at", { ascending: false });

    const enriched: InboxItem[] = (data || []).map((row: any) => ({
      ...row,
      post_body: row.conversation_posts?.body_clean || row.conversation_posts?.body_text || "",
      post_created_at: row.conversation_posts?.created_at,
      thread_title: row.conversation_posts?.conversation_threads?.title || "",
    }));

    const rawAuthorIds: string[] = (data || [])
      .filter((r: any) => r.conversation_posts?.author_id)
      .map((r: any) => String(r.conversation_posts.author_id));
    const authorIds = Array.from(new Set(rawAuthorIds));
    if (authorIds.length > 0) {
      const { data: authors } = await supabase
        .from("user_accounts")
        .select("id, people:people!user_accounts_person_id_fkey(full_name)")
        .in("id", authorIds);
      const nameMap: Record<string, string> = {};
      for (const a of (authors as any[]) || []) {
        nameMap[a.id] = a.people?.[0]?.full_name || a.people?.full_name || "Ukjent";
      }
      for (const item of enriched) {
        const authorId = (data || []).find((r: any) => r.post_id === item.post_id)?.conversation_posts?.author_id;
        if (authorId && nameMap[authorId]) item.post_author_name = nameMap[authorId];
      }
    }

    // Fetch AI suggestions for each post
    const postIds = enriched.map((i: InboxItem) => i.post_id);
    if (postIds.length > 0) {
      const { data: suggestions } = await (supabase as any)
        .from("message_action_suggestions")
        .select("post_id, suggested_actions")
        .in("post_id", postIds)
        .is("dismissed_at", null);
      const sugMap = new Map<string, any[]>();
      for (const s of suggestions || []) {
        sugMap.set(s.post_id, s.suggested_actions || []);
      }
      for (const item of enriched) {
        item.suggested_actions = sugMap.get(item.post_id) || [];
      }
    }

    setItems(enriched);
    setLoading(false);
  }, [threadId, userAccountId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // Realtime
  useEffect(() => {
    if (!threadId) return;
    const channel = supabase
      .channel(`inbox-${threadId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "conversation_inbox_items",
        filter: `thread_id=eq.${threadId}`,
      }, () => fetchItems())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [threadId, fetchItems]);

  const markHandled = useCallback(async (itemId: string) => {
    if (!userAccountId) return;
    await (supabase as any)
      .from("conversation_inbox_items")
      .update({ handled_at: new Date().toISOString(), handled_by: userAccountId })
      .eq("id", itemId);
    fetchItems();
  }, [userAccountId, fetchItems]);

  return { items, loading, markHandled, refresh: fetchItems };
}
