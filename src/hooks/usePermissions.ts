import { useEffect, useState, useCallback, createContext, useContext } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// Preview mode override context - set by PreviewModeProvider
interface PreviewOverride {
  active: boolean;
  permissions: Record<string, boolean>;
  scope: "own" | "company" | "all";
  loading: boolean;
}

const PreviewPermissionCtx = createContext<PreviewOverride | null>(null);

/** Used by PreviewModeProvider to inject override permissions */
export const PreviewPermissionOverrideProvider = PreviewPermissionCtx.Provider;

export interface PermissionState {
  permissions: Record<string, boolean>;
  scope: "own" | "company" | "all";
  loading: boolean;
  hasPermission: (key: string) => boolean;
  refetch: () => void;
}

/**
 * Permissions hook – DB is the SINGLE SOURCE OF TRUTH.
 * No hardcoded admin defaults. All permissions come from:
 *   1. role_permissions (via user_role_assignments)
 *   2. user_permission_overrides
 */
export function usePermissions(): PermissionState {
  const { user } = useAuth();
  const preview = useContext(PreviewPermissionCtx);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [scope, setScope] = useState<"own" | "company" | "all">("own");
  const [loading, setLoading] = useState(true);

  const fetchPermissions = useCallback(async () => {
    if (!user) {
      setPermissions({});
      setScope("own");
      setLoading(false);
      return;
    }

    try {
      // Fetch from v1 assignments (user_role_assignments)
      const { data: assignments } = await supabase
        .from("user_role_assignments")
        .select("role_id")
        .eq("user_id", user.id);

      const roleIds = assignments?.map((a: any) => a.role_id) || [];

      // Also fetch from v2 assignments (user_roles_v2 via user_accounts)
      const { data: ua } = await supabase
        .from("user_accounts")
        .select("id")
        .eq("auth_user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (ua) {
        const { data: v2Roles } = await supabase
          .from("user_roles_v2")
          .select("role_id")
          .eq("user_account_id", ua.id);
        for (const r of v2Roles || []) {
          if (!roleIds.includes((r as any).role_id)) {
            roleIds.push((r as any).role_id);
          }
        }
      }

      let rolePerms: Record<string, boolean> = {};
      if (roleIds.length > 0) {
        const { data: rp } = await supabase
          .from("role_permissions")
          .select("permission_key, allowed")
          .in("role_id", roleIds);

        for (const p of rp || []) {
          if ((p as any).allowed) {
            rolePerms[(p as any).permission_key] = true;
          } else if (!(rolePerms[(p as any).permission_key])) {
            rolePerms[(p as any).permission_key] = false;
          }
        }
      }

      // Fetch v1 overrides
      const { data: overrides } = await supabase
        .from("user_permission_overrides")
        .select("permission_key, allowed")
        .eq("user_id", user.id);

      const merged = { ...rolePerms };
      for (const o of overrides || []) {
        merged[(o as any).permission_key] = (o as any).allowed;
      }

      // Fetch v2 overrides if user_account exists
      if (ua) {
        const { data: v2Overrides } = await supabase
          .from("user_permission_overrides_v2")
          .select("permission_key, mode")
          .eq("user_account_id", ua.id);

        for (const o of v2Overrides || []) {
          merged[(o as any).permission_key] = (o as any).mode === "allow";
        }
      }

      setPermissions(merged);

      if (merged["scope.view.all"]) setScope("all");
      else if (merged["scope.view.company"]) setScope("company");
      else setScope("own");
    } catch (err) {
      console.warn("[Permissions] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const hasPermission = useCallback(
    (key: string) => {
      // If preview mode is active, use preview permissions
      if (preview?.active) {
        return preview.permissions[key] === true;
      }
      return permissions[key] === true;
    },
    [permissions, preview]
  );

  // If preview mode is active, override with preview permissions
  if (preview?.active) {
    return {
      permissions: preview.permissions,
      scope: preview.scope,
      loading: preview.loading,
      hasPermission,
      refetch: fetchPermissions,
    };
  }

  return { permissions, scope, loading, hasPermission, refetch: fetchPermissions };
}
