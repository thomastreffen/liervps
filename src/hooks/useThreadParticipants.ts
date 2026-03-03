import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ThreadParticipant {
  id: string;
  thread_id: string;
  participant_type: "internal" | "external";
  user_account_id: string | null;
  email: string | null;
  display_name: string | null;
  added_at: string;
  // Enriched
  full_name?: string;
}

export function useThreadParticipants(threadId: string | null) {
  const [participants, setParticipants] = useState<ThreadParticipant[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!threadId) { setParticipants([]); return; }
    setLoading(true);

    const { data } = await (supabase as any)
      .from("conversation_thread_participants")
      .select("*")
      .eq("thread_id", threadId)
      .order("added_at", { ascending: true });

    const rows: ThreadParticipant[] = (data ?? []) as any[];

    // Enrich internal participants with names
    const uaIds = rows.filter(r => r.user_account_id).map(r => r.user_account_id!);
    if (uaIds.length > 0) {
      const { data: accounts } = await supabase
        .from("user_accounts")
        .select("id, people:people!user_accounts_person_id_fkey(full_name)")
        .in("id", uaIds);

      const nameMap: Record<string, string> = {};
      for (const a of (accounts as any[]) ?? []) {
        const person = Array.isArray(a.people) ? a.people[0] : a.people;
        nameMap[a.id] = person?.full_name || "Ukjent";
      }
      for (const r of rows) {
        if (r.user_account_id && nameMap[r.user_account_id]) {
          r.full_name = nameMap[r.user_account_id];
        }
      }
    }

    setParticipants(rows);
    setLoading(false);
  }, [threadId]);

  useEffect(() => { fetch(); }, [fetch]);

  const addInternal = async (threadId: string, companyId: string, projectId: string, userAccountId: string, addedBy: string) => {
    const { error } = await (supabase as any)
      .from("conversation_thread_participants")
      .insert({
        company_id: companyId,
        project_id: projectId,
        thread_id: threadId,
        participant_type: "internal",
        user_account_id: userAccountId,
        added_by: addedBy,
      });
    if (error) throw error;
    fetch();
  };

  const addExternal = async (threadId: string, companyId: string, projectId: string, email: string, displayName: string, addedBy: string) => {
    const { error } = await (supabase as any)
      .from("conversation_thread_participants")
      .insert({
        company_id: companyId,
        project_id: projectId,
        thread_id: threadId,
        participant_type: "external",
        email,
        display_name: displayName,
        added_by: addedBy,
      });
    if (error) throw error;
    fetch();
  };

  const remove = async (participantId: string) => {
    await (supabase as any)
      .from("conversation_thread_participants")
      .delete()
      .eq("id", participantId);
    fetch();
  };

  return { participants, loading, refresh: fetch, addInternal, addExternal, remove };
}
