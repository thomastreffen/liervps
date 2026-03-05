import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SuggestedMessageAction {
  action_type: "task" | "deviation" | "fdv_note" | "call_customer" | "order_parts";
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  due_date_suggestion: string | null;
  confidence: number;
  reasons: string[];
}

interface ActionSuggestionRow {
  id: string;
  post_id: string;
  suggested_actions: SuggestedMessageAction[];
  created_at: string;
  dismissed_at: string | null;
  clicked_action_type: string | null;
  clicked_at: string | null;
}

export function useAIMessageActions(threadId: string) {
  const [suggestions, setSuggestions] = useState<Map<string, ActionSuggestionRow>>(new Map());

  const fetchSuggestions = useCallback(async () => {
    if (!threadId) return;
    const { data } = await (supabase as any)
      .from("message_action_suggestions")
      .select("*")
      .in("post_id", 
        (await supabase
          .from("conversation_posts")
          .select("id")
          .eq("thread_id", threadId)
        ).data?.map((p: any) => p.id) || []
      );

    if (data) {
      const map = new Map<string, ActionSuggestionRow>();
      for (const row of data) {
        map.set(row.post_id, row as ActionSuggestionRow);
      }
      setSuggestions(map);
    }
  }, [threadId]);

  useEffect(() => { fetchSuggestions(); }, [fetchSuggestions]);

  // Realtime
  useEffect(() => {
    if (!threadId) return;
    const channel = supabase
      .channel(`ai-suggestions-${threadId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "message_action_suggestions",
      }, () => fetchSuggestions())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [threadId, fetchSuggestions]);

  const getSuggestionsForPost = useCallback((postId: string): ActionSuggestionRow | null => {
    return suggestions.get(postId) || null;
  }, [suggestions]);

  const dismissSuggestions = useCallback(async (postId: string) => {
    await (supabase as any)
      .from("message_action_suggestions")
      .update({ dismissed_at: new Date().toISOString() })
      .eq("post_id", postId);
    fetchSuggestions();
  }, [fetchSuggestions]);

  const recordClick = useCallback(async (postId: string, actionType: string) => {
    await (supabase as any)
      .from("message_action_suggestions")
      .update({ clicked_action_type: actionType, clicked_at: new Date().toISOString() })
      .eq("post_id", postId);
    fetchSuggestions();
  }, [fetchSuggestions]);

  const triggerAnalysis = useCallback(async (postId: string, messageText: string, contextTags?: string[]) => {
    try {
      await supabase.functions.invoke("analyze-message-actions", {
        body: { post_id: postId, message_text: messageText, context_tags: contextTags || [] },
      });
    } catch (err) {
      console.warn("AI analysis failed, fallback applied on server", err);
    }
  }, []);

  return {
    getSuggestionsForPost,
    dismissSuggestions,
    recordClick,
    triggerAnalysis,
    refresh: fetchSuggestions,
  };
}
