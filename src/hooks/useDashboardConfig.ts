import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type ModuleKey = "projects" | "yourday" | "tasks" | "activity" | "risk";

export interface ModuleConfig {
  module_key: ModuleKey;
  enabled: boolean;
  sort_order: number;
  column_placement: "left" | "right" | "full";
  density: "compact" | "normal" | "expanded";
  filter_config: Record<string, any>;
}

const ROLE_DEFAULTS: Record<string, ModuleConfig[]> = {
  technician: [
    { module_key: "yourday", enabled: true, sort_order: 0, column_placement: "left", density: "normal", filter_config: {} },
    { module_key: "tasks", enabled: true, sort_order: 1, column_placement: "right", density: "normal", filter_config: {} },
    { module_key: "projects", enabled: true, sort_order: 2, column_placement: "full", density: "compact", filter_config: {} },
    { module_key: "activity", enabled: false, sort_order: 3, column_placement: "full", density: "normal", filter_config: {} },
    { module_key: "risk", enabled: false, sort_order: 4, column_placement: "full", density: "normal", filter_config: {} },
  ],
  manager: [
    { module_key: "projects", enabled: true, sort_order: 0, column_placement: "full", density: "normal", filter_config: {} },
    { module_key: "yourday", enabled: true, sort_order: 1, column_placement: "left", density: "normal", filter_config: {} },
    { module_key: "tasks", enabled: true, sort_order: 2, column_placement: "right", density: "normal", filter_config: {} },
    { module_key: "risk", enabled: true, sort_order: 3, column_placement: "full", density: "normal", filter_config: {} },
    { module_key: "activity", enabled: true, sort_order: 4, column_placement: "full", density: "normal", filter_config: {} },
  ],
  admin: [
    { module_key: "risk", enabled: true, sort_order: 0, column_placement: "full", density: "normal", filter_config: {} },
    { module_key: "projects", enabled: true, sort_order: 1, column_placement: "full", density: "normal", filter_config: {} },
    { module_key: "yourday", enabled: true, sort_order: 2, column_placement: "left", density: "normal", filter_config: {} },
    { module_key: "tasks", enabled: true, sort_order: 3, column_placement: "right", density: "normal", filter_config: {} },
    { module_key: "activity", enabled: true, sort_order: 4, column_placement: "full", density: "normal", filter_config: {} },
  ],
};

const FALLBACK_DEFAULTS = ROLE_DEFAULTS.manager;

export function useDashboardConfig() {
  const { user, isSuperAdmin } = useAuth();
  const [modules, setModules] = useState<ModuleConfig[]>([]);
  const [loading, setLoading] = useState(true);

  const getUserRole = useCallback(async (): Promise<string> => {
    if (!user) return "technician";
    if (isSuperAdmin) return "admin";

    const uaRes = await supabase.from("user_accounts" as any).select("id").eq("auth_user_id", user.id).maybeSingle();
    const uaId = (uaRes.data as any)?.id;
    if (!uaId) return "technician";

    const { data } = await supabase
      .from("user_roles_v2" as any)
      .select("role_id, roles_v2:role_id(name)")
      .eq("user_account_id", uaId)
      .limit(5);

    const roleNames = ((data || []) as any[]).map((r: any) => r.roles_v2?.name?.toLowerCase() || "");
    if (roleNames.some((n: string) => n.includes("admin"))) return "admin";
    if (roleNames.some((n: string) => n.includes("leder") || n.includes("manager"))) return "manager";
    return "technician";
  }, [user, isSuperAdmin]);

  const fetchConfig = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data } = await supabase
      .from("dashboard_module_configs" as any)
      .select("*")
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true });

    if (data && data.length > 0) {
      setModules((data as any[]).map((d: any) => ({
        module_key: d.module_key as ModuleKey,
        enabled: d.enabled,
        sort_order: d.sort_order,
        column_placement: d.column_placement,
        density: d.density,
        filter_config: d.filter_config || {},
      })));
    } else {
      // Use role-based defaults
      const role = await getUserRole();
      const defaults = ROLE_DEFAULTS[role] || FALLBACK_DEFAULTS;
      setModules(defaults);
      // Persist defaults
      await supabase.from("dashboard_module_configs" as any).insert(
        defaults.map((m) => ({
          user_id: user.id,
          module_key: m.module_key,
          enabled: m.enabled,
          sort_order: m.sort_order,
          column_placement: m.column_placement,
          density: m.density,
          filter_config: m.filter_config,
        }))
      );
    }
    setLoading(false);
  }, [user, getUserRole]);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const saveModules = useCallback(async (newModules: ModuleConfig[]) => {
    if (!user) return;
    setModules(newModules);

    // Upsert all
    for (const m of newModules) {
      await supabase.from("dashboard_module_configs" as any).upsert(
        {
          user_id: user.id,
          module_key: m.module_key,
          enabled: m.enabled,
          sort_order: m.sort_order,
          column_placement: m.column_placement,
          density: m.density,
          filter_config: m.filter_config,
        },
        { onConflict: "user_id,module_key" }
      );
    }
  }, [user]);

  const enabledModules = modules.filter((m) => m.enabled).sort((a, b) => a.sort_order - b.sort_order);

  const isEnabled = (key: ModuleKey) => enabledModules.some((m) => m.module_key === key);

  const getConfig = (key: ModuleKey) => modules.find((m) => m.module_key === key);

  return { modules, enabledModules, loading, saveModules, isEnabled, getConfig, refetch: fetchConfig };
}
