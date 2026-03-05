import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface MentionUser {
  id: string;
  name: string;
  user_id: string | null;
}

export function useMentions(companyId: string | null) {
  const [users, setUsers] = useState<MentionUser[]>([]);

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      const { data } = await supabase
        .from("technicians")
        .select("id, name, user_id")
        .not("name", "is", null)
        .order("name");
      setUsers((data ?? []).map(t => ({ id: t.id, name: t.name || "", user_id: t.user_id })));
    })();
  }, [companyId]);

  return { users };
}

export function filterMentionUsers(users: MentionUser[], query: string): MentionUser[] {
  if (!query) return users.slice(0, 8);
  const lower = query.toLowerCase();
  return users.filter(u => u.name.toLowerCase().includes(lower)).slice(0, 8);
}
