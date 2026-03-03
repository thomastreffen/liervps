import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ConversationThread {
  id: string;
  project_id: string;
  company_id: string;
  title: string;
  thread_type: "conversation" | "email_thread";
  created_by: string | null;
  created_at: string;
  last_activity_at: string;
  post_count: number;
  last_author_name: string | null;
  is_archived: boolean;
  author_name?: string;
}

export interface ConversationPost {
  id: string;
  thread_id: string;
  company_id: string;
  author_id: string | null;
  post_type: "internal_message" | "email" | "system";
  subject: string | null;
  body_html: string | null;
  body_text: string | null;
  created_at: string;
  outlook_message_id: string | null;
  outlook_weblink: string | null;
  from_email: string | null;
  from_name: string | null;
  to_emails: string[] | null;
  cc_emails: string[] | null;
  sent_at: string | null;
  direction: "inbound" | "outbound" | null;
  author_name?: string;
  attachments?: ConversationAttachment[];
}

export interface ConversationAttachment {
  id: string;
  post_id: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  storage_path: string | null;
  sharepoint_web_url: string | null;
  created_at: string;
}

export function useConversationThreads(projectId: string) {
  const [threads, setThreads] = useState<ConversationThread[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchThreads = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("conversation_threads")
      .select("*")
      .eq("project_id", projectId)
      .eq("is_archived", false)
      .order("last_activity_at", { ascending: false });

    setThreads((data as any[]) ?? []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`conv-threads-${projectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversation_threads", filter: `project_id=eq.${projectId}` },
        () => fetchThreads()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [projectId, fetchThreads]);

  return { threads, loading, refresh: fetchThreads };
}

export function useConversationPosts(threadId: string | null) {
  const [posts, setPosts] = useState<ConversationPost[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPosts = useCallback(async () => {
    if (!threadId) { setPosts([]); setLoading(false); return; }
    setLoading(true);

    const { data } = await supabase
      .from("conversation_posts")
      .select(`
        *,
        conversation_attachments (*)
      `)
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });

    const enriched: ConversationPost[] = ((data as any[]) ?? []).map((p) => ({
      ...p,
      attachments: p.conversation_attachments ?? [],
    }));

    // Fetch author names
    const authorIds = [...new Set(enriched.filter(p => p.author_id).map(p => p.author_id!))];
    if (authorIds.length > 0) {
      const { data: authors } = await supabase
        .from("user_accounts")
        .select("id, people:people!user_accounts_person_id_fkey(full_name)")
        .in("id", authorIds);

      const nameMap: Record<string, string> = {};
      for (const a of (authors as any[]) ?? []) {
        const person = a.people?.[0] ?? a.people;
        nameMap[a.id] = person?.full_name || "Ukjent";
      }
      for (const p of enriched) {
        if (p.author_id && nameMap[p.author_id]) {
          p.author_name = nameMap[p.author_id];
        }
      }
    }

    setPosts(enriched);
    setLoading(false);
  }, [threadId]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  // Realtime for posts
  useEffect(() => {
    if (!threadId) return;
    const channel = supabase
      .channel(`conv-posts-${threadId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversation_posts", filter: `thread_id=eq.${threadId}` },
        () => fetchPosts()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [threadId, fetchPosts]);

  return { posts, loading, refresh: fetchPosts };
}
