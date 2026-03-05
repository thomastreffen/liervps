import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface ModuleSetting {
  module_key: string;
  label: string;
  is_enabled: boolean;
  sort_order: number;
}

export interface ModuleUserOverride {
  module_key: string;
  user_account_id: string;
  is_hidden: boolean;
}

export function useModuleVisibility() {
  const { isSuperAdmin } = useAuth();
  const queryClient = useQueryClient();

  // Fetch global module settings
  const { data: modules = [] } = useQuery<ModuleSetting[]>({
    queryKey: ["module-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("module_settings")
        .select("module_key, label, is_enabled, sort_order")
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch current user's overrides
  const { data: userOverrides = [] } = useQuery<ModuleUserOverride[]>({
    queryKey: ["module-user-overrides"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Get user_account_id
      const { data: ua } = await supabase
        .from("user_accounts")
        .select("id")
        .eq("auth_user_id", user.id)
        .eq("is_active", true)
        .single();
      if (!ua) return [];

      const { data, error } = await supabase
        .from("module_user_overrides")
        .select("module_key, user_account_id, is_hidden")
        .eq("user_account_id", ua.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  /**
   * Check if a module should be visible for the current user.
   * Superadmin always sees everything.
   */
  function isModuleVisible(moduleKey: string): boolean {
    if (isSuperAdmin) return true;

    const mod = modules.find((m) => m.module_key === moduleKey);
    // If module is globally disabled, hide it
    if (mod && !mod.is_enabled) return false;

    // Check per-user override
    const override = userOverrides.find((o) => o.module_key === moduleKey);
    if (override?.is_hidden) return false;

    return true;
  }

  // Mutation: toggle global module enabled
  const toggleGlobal = useMutation({
    mutationFn: async ({ moduleKey, enabled }: { moduleKey: string; enabled: boolean }) => {
      const { error } = await supabase
        .from("module_settings")
        .update({ is_enabled: enabled, updated_at: new Date().toISOString() })
        .eq("module_key", moduleKey);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["module-settings"] });
    },
  });

  // Mutation: set user override
  const setUserOverride = useMutation({
    mutationFn: async ({
      moduleKey,
      userAccountId,
      isHidden,
    }: {
      moduleKey: string;
      userAccountId: string;
      isHidden: boolean;
    }) => {
      const { error } = await supabase
        .from("module_user_overrides")
        .upsert(
          { module_key: moduleKey, user_account_id: userAccountId, is_hidden: isHidden },
          { onConflict: "module_key,user_account_id" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["module-user-overrides"] });
    },
  });

  // Mutation: remove user override
  const removeUserOverride = useMutation({
    mutationFn: async ({ moduleKey, userAccountId }: { moduleKey: string; userAccountId: string }) => {
      const { error } = await supabase
        .from("module_user_overrides")
        .delete()
        .eq("module_key", moduleKey)
        .eq("user_account_id", userAccountId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["module-user-overrides"] });
    },
  });

  return {
    modules,
    userOverrides,
    isModuleVisible,
    toggleGlobal,
    setUserOverride,
    removeUserOverride,
  };
}
