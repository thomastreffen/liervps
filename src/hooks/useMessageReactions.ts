import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Reaction {
  id: string;
  post_id: string;
  user_account_id: string;
  emoji: string;
  created_at: string;
}

export interface ReactionSummary {
  emoji: string;
  count: number;
  userIds: string[];
  myReaction: boolean;
}

export function useMessageReactions(threadId: string | null, currentUaId: string | null) {
  const [reactions, setReactions] = useState<Reaction[]>([]);

  const fetch = useCallback(async () => {
    if (!threadId) return;
    // Get all post ids for this thread, then get reactions
    const { data: posts } = await supabase
      .from("conversation_posts")
      .select("id")
      .eq("thread_id", threadId);
    
    if (!posts || posts.length === 0) { setReactions([]); return; }
    
    const postIds = posts.map(p => p.id);
    const { data } = await (supabase as any)
      .from("message_reactions")
      .select("*")
      .in("post_id", postIds);
    
    setReactions((data ?? []) as Reaction[]);
  }, [threadId]);

  useEffect(() => { fetch(); }, [fetch]);

  // Realtime
  useEffect(() => {
    if (!threadId) return;
    const channel = supabase
      .channel(`reactions-${threadId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_reactions" },
        () => fetch()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [threadId, fetch]);

  const getReactionsForPost = useCallback((postId: string): ReactionSummary[] => {
    const postReactions = reactions.filter(r => r.post_id === postId);
    const emojiMap = new Map<string, { count: number; userIds: string[]; myReaction: boolean }>();
    
    for (const r of postReactions) {
      const existing = emojiMap.get(r.emoji);
      if (existing) {
        existing.count++;
        existing.userIds.push(r.user_account_id);
        if (r.user_account_id === currentUaId) existing.myReaction = true;
      } else {
        emojiMap.set(r.emoji, {
          count: 1,
          userIds: [r.user_account_id],
          myReaction: r.user_account_id === currentUaId,
        });
      }
    }

    return Array.from(emojiMap.entries()).map(([emoji, data]) => ({
      emoji,
      ...data,
    }));
  }, [reactions, currentUaId]);

  const toggleReaction = async (postId: string, emoji: string) => {
    if (!currentUaId) return;
    
    const existing = reactions.find(
      r => r.post_id === postId && r.user_account_id === currentUaId && r.emoji === emoji
    );

    if (existing) {
      await (supabase as any).from("message_reactions").delete().eq("id", existing.id);
    } else {
      await (supabase as any).from("message_reactions").insert({
        post_id: postId,
        user_account_id: currentUaId,
        emoji,
      });
    }
    fetch();
  };

  return { getReactionsForPost, toggleReaction, refresh: fetch };
}
