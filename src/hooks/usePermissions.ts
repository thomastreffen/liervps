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
      const { data: assignments } = await supabase
        .from("user_role_assignments")
        .select("role_id")
        .eq("user_id", user.id);

      const roleIds = assignments?.map((a: any) => a.role_id) || [];

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

      const { data: overrides } = await supabase
        .from("user_permission_overrides")
        .select("permission_key, allowed")
        .eq("user_id", user.id);

      const merged = { ...rolePerms };
      for (const o of overrides || []) {
        merged[(o as any).permission_key] = (o as any).allowed;
      }

      const adminKeys = [
        "scope.view.all", "admin.manage_companies", "admin.manage_departments",
        "admin.manage_users", "admin.manage_roles", "admin.manage_settings",
        "calendar.read_busy", "calendar.view_external", "calendar.write_events", "calendar.delete_events",
        "documents.upload", "documents.delete", "documents.analyze",
        "change_orders.create", "change_orders.send", "change_orders.cancel", "change_orders.mark_invoiced",
        "contracts.create", "contracts.analyze", "contracts.upload_document",
        "calculations.create", "calculations.edit", "calculations.ai_generate", "calculations.create_offer",
        "projects.edit_plan", "projects.delete_attachment", "admin.data_integrity",
      ];
      if (user.role === "super_admin") {
        for (const k of adminKeys) merged[k] = merged[k] ?? true;
      } else if (user.role === "admin") {
        merged["scope.view.company"] = merged["scope.view.company"] ?? true;
        const adminSubset = adminKeys.filter(k => k !== "scope.view.all" && k !== "admin.data_integrity");
        for (const k of adminSubset) merged[k] = merged[k] ?? true;
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
