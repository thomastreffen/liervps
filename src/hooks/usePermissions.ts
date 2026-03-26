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

// Active company context for per-company role resolution
const ActiveCompanyCtx = createContext<string | null>(null);
export const ActiveCompanyForPermissions = ActiveCompanyCtx.Provider;

export interface PermissionState {
  permissions: Record<string, boolean>;
  scope: "own" | "company" | "all";
  loading: boolean;
  hasPermission: (key: string) => boolean;
  refetch: () => void;
}

/**
 * Permissions hook – DB is the SINGLE SOURCE OF TRUTH.
 * Per-company roles (user_memberships.role_id) take precedence over global roles.
 * Falls back to global user_role_assignments when no per-company role is set.
 */
export function usePermissions(): PermissionState {
  const { user } = useAuth();
  const preview = useContext(PreviewPermissionCtx);
  const activeCompanyId = useContext(ActiveCompanyCtx);
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
      // 1. Check for per-company role via user_memberships
      let membershipRoleId: string | null = null;
      if (activeCompanyId) {
        const { data: membership } = await supabase
          .from("user_memberships")
          .select("role_id")
          .eq("user_id", user.id)
          .eq("company_id", activeCompanyId)
          .eq("is_active", true)
          .not("role_id", "is", null)
          .maybeSingle();

        membershipRoleId = (membership as any)?.role_id || null;
      }

      // 2. Get role IDs: per-company role takes precedence, else fall back to global assignments
      let roleIds: string[] = [];

      if (membershipRoleId) {
        // Per-company role is the primary source
        roleIds = [membershipRoleId];
      } else {
        // Fallback: global v1 assignments
        const { data: assignments } = await supabase
          .from("user_role_assignments")
          .select("role_id")
          .eq("user_id", user.id);

        roleIds = assignments?.map((a: any) => a.role_id) || [];

        // Also merge v2 assignments
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
      }

      // 3. Resolve permissions from roles
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

      // 4. Apply v1 overrides
      const { data: overrides } = await supabase
        .from("user_permission_overrides")
        .select("permission_key, allowed")
        .eq("user_id", user.id);

      const merged = { ...rolePerms };
      for (const o of overrides || []) {
        merged[(o as any).permission_key] = (o as any).allowed;
      }

      // 5. Apply v2 overrides if user_account exists
      const { data: ua2 } = await supabase
        .from("user_accounts")
        .select("id")
        .eq("auth_user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (ua2) {
        const { data: v2Overrides } = await supabase
          .from("user_permission_overrides_v2")
          .select("permission_key, mode")
          .eq("user_account_id", ua2.id);

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
  }, [user, activeCompanyId]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const hasPermission = useCallback(
    (key: string) => {
      if (preview?.active) {
        return preview.permissions[key] === true;
      }
      return permissions[key] === true;
    },
    [permissions, preview]
  );

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
