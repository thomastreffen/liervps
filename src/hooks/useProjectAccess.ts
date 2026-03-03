import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ProjectMember {
  id: string;
  user_account_id: string;
  member_type: "internal" | "external";
  role: "owner" | "manager" | "member" | "follower";
  created_at: string;
  person_name?: string;
  email?: string;
}

export interface SpaceAccess {
  space_id: string;
  space_key: string;
  is_enabled: boolean;
  member_count: number;
}

export function useProjectAccess(projectId: string) {
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [spaces, setSpaces] = useState<SpaceAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [myRole, setMyRole] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    const authUid = userData.user?.id;

    const [membersRes, spacesRes, myMemberRes] = await Promise.all([
      supabase
        .from("project_members")
        .select(`
          id, user_account_id, member_type, role, created_at,
          user_accounts!inner ( id, auth_user_id,
            people:people!user_accounts_person_id_fkey ( first_name, last_name, email )
          )
        `)
        .eq("project_id", projectId),
      supabase
        .from("project_spaces")
        .select("id, space_key, is_enabled")
        .eq("project_id", projectId),
      authUid
        ? supabase
            .from("project_members")
            .select("role, user_accounts!inner(auth_user_id)")
            .eq("project_id", projectId)
            .eq("user_accounts.auth_user_id", authUid)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const enriched: ProjectMember[] = (membersRes.data ?? []).map((m: any) => {
      const person = m.user_accounts?.people?.[0] ?? m.user_accounts?.people;
      return {
        id: m.id,
        user_account_id: m.user_account_id,
        member_type: m.member_type,
        role: m.role,
        created_at: m.created_at,
        person_name: person
          ? `${person.first_name || ""} ${person.last_name || ""}`.trim()
          : undefined,
        email: person?.email || undefined,
      };
    });

    setMembers(enriched);
    setSpaces(
      (spacesRes.data ?? []).map((s: any) => ({
        space_id: s.id,
        space_key: s.space_key,
        is_enabled: s.is_enabled,
        member_count: 0,
      }))
    );
    setMyRole((myMemberRes as any)?.data?.role || null);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const addMember = useCallback(
    async (userAccountId: string, memberType: string, role: string) => {
      const { error } = await supabase.from("project_members").insert({
        project_id: projectId,
        user_account_id: userAccountId,
        member_type: memberType,
        role,
      });
      if (error) throw error;
      await fetchAll();
    },
    [projectId, fetchAll]
  );

  const removeMember = useCallback(
    async (memberId: string) => {
      const { error } = await supabase.from("project_members").delete().eq("id", memberId);
      if (error) throw error;
      await fetchAll();
    },
    [fetchAll]
  );

  const updateMemberRole = useCallback(
    async (memberId: string, role: string) => {
      const { error } = await supabase
        .from("project_members")
        .update({ role })
        .eq("id", memberId);
      if (error) throw error;
      await fetchAll();
    },
    [fetchAll]
  );

  const toggleSpace = useCallback(
    async (spaceId: string, enabled: boolean) => {
      const { error } = await supabase
        .from("project_spaces")
        .update({ is_enabled: enabled })
        .eq("id", spaceId);
      if (error) throw error;
      await fetchAll();
    },
    [fetchAll]
  );

  const ensureSpaces = useCallback(
    async () => {
      const keys = ["samtaler", "oppgaver", "dokumenter", "tidsplan"];
      for (const key of keys) {
        await supabase
          .from("project_spaces")
          .upsert({ project_id: projectId, space_key: key }, { onConflict: "project_id,space_key" });
      }
      await fetchAll();
    },
    [projectId, fetchAll]
  );

  const isAdmin = myRole === "owner" || myRole === "manager";

  return {
    members,
    spaces,
    loading,
    myRole,
    isAdmin,
    refresh: fetchAll,
    addMember,
    removeMember,
    updateMemberRole,
    toggleSpace,
    ensureSpaces,
  };
}
