import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/hooks/useAuth";

export interface PreviewTarget {
  type: "user" | "role";
  /** auth_user_id when type=user, role_id when type=role */
  id: string;
  label: string;
  /** Legacy app_role for the target (used for isAdmin/isSuperAdmin override) */
  appRole?: AppRole;
}

export interface PreviewPermissionDetail {
  key: string;
  allowed: boolean;
  source: "role" | "override";
  roleName?: string;
}

interface PreviewModeContextType {
  /** Whether preview is currently active */
  active: boolean;
  /** The preview target */
  target: PreviewTarget | null;
  /** Effective permissions for the preview target */
  permissions: Record<string, boolean>;
  /** Detailed permission breakdown for inspector */
  permissionDetails: PreviewPermissionDetail[];
  /** Derived scope */
  scope: "own" | "company" | "all";
  /** Loading state while fetching target permissions */
  loading: boolean;
  /** Activate preview for a target */
  activate: (target: PreviewTarget) => Promise<void>;
  /** Deactivate preview */
  deactivate: () => void;
  /** Effective role overrides */
  effectiveRole: AppRole | null;
  /** Whether current user is actually superadmin (real identity) */
  realIsSuperAdmin: boolean;
}

const PreviewModeContext = createContext<PreviewModeContextType | undefined>(undefined);

export function PreviewModeProvider({ children }: { children: ReactNode }) {
  const { user, isSuperAdmin } = useAuth();
  const [active, setActive] = useState(false);
  const [target, setTarget] = useState<PreviewTarget | null>(null);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [permissionDetails, setPermissionDetails] = useState<PreviewPermissionDetail[]>([]);
  const [scope, setScope] = useState<"own" | "company" | "all">("own");
  const [loading, setLoading] = useState(false);
  const [effectiveRole, setEffectiveRole] = useState<AppRole | null>(null);

  const fetchUserPermissions = useCallback(async (authUserId: string) => {
    // Fetch role assignments
    const { data: assignments } = await supabase
      .from("user_role_assignments")
      .select("role_id")
      .eq("user_id", authUserId);

    const roleIds = (assignments || []).map((a: any) => a.role_id);

    // Fetch role names for inspector
    let roleNames: Record<string, string> = {};
    if (roleIds.length > 0) {
      const { data: roles } = await supabase
        .from("roles")
        .select("id, name")
        .in("id", roleIds);
      for (const r of roles || []) {
        roleNames[(r as any).id] = (r as any).name;
      }
    }

    // Fetch role permissions
    let rolePerms: Record<string, boolean> = {};
    const details: PreviewPermissionDetail[] = [];
    if (roleIds.length > 0) {
      const { data: rp } = await supabase
        .from("role_permissions")
        .select("permission_key, allowed, role_id")
        .in("role_id", roleIds);
      for (const p of rp || []) {
        const pk = (p as any).permission_key;
        const allowed = (p as any).allowed;
        if (allowed) rolePerms[pk] = true;
        else if (!rolePerms[pk]) rolePerms[pk] = false;
        details.push({
          key: pk,
          allowed,
          source: "role",
          roleName: roleNames[(p as any).role_id] || "Ukjent rolle",
        });
      }
    }

    // Fetch overrides
    const { data: overrides } = await supabase
      .from("user_permission_overrides")
      .select("permission_key, allowed")
      .eq("user_id", authUserId);

    const merged = { ...rolePerms };
    for (const o of overrides || []) {
      const pk = (o as any).permission_key;
      merged[pk] = (o as any).allowed;
      details.push({ key: pk, allowed: (o as any).allowed, source: "override" });
    }

    // Check legacy role
    const { data: legacyRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", authUserId)
      .maybeSingle();

    const appRole = (legacyRole?.role as AppRole) || "montør";

    // Apply legacy admin defaults (same as usePermissions)
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
    if (appRole === "super_admin") {
      for (const k of adminKeys) merged[k] = merged[k] ?? true;
    } else if (appRole === "admin") {
      merged["scope.view.company"] = merged["scope.view.company"] ?? true;
      const adminSubset = adminKeys.filter(k => k !== "scope.view.all" && k !== "admin.data_integrity");
      for (const k of adminSubset) merged[k] = merged[k] ?? true;
    }

    return { permissions: merged, details, appRole };
  }, []);

  const fetchRolePermissions = useCallback(async (roleId: string) => {
    const { data: rp } = await supabase
      .from("role_permissions")
      .select("permission_key, allowed")
      .eq("role_id", roleId);

    const merged: Record<string, boolean> = {};
    const details: PreviewPermissionDetail[] = [];
    for (const p of rp || []) {
      const pk = (p as any).permission_key;
      merged[pk] = (p as any).allowed;
      details.push({ key: pk, allowed: (p as any).allowed, source: "role" });
    }
    return { permissions: merged, details };
  }, []);

  const activate = useCallback(async (newTarget: PreviewTarget) => {
    if (!isSuperAdmin) return;
    setLoading(true);
    setTarget(newTarget);

    try {
      let result: { permissions: Record<string, boolean>; details: PreviewPermissionDetail[] };
      let appRole: AppRole = "montør";

      if (newTarget.type === "user") {
        const r = await fetchUserPermissions(newTarget.id);
        result = r;
        appRole = r.appRole;
      } else {
        result = await fetchRolePermissions(newTarget.id);
      }

      setPermissions(result.permissions);
      setPermissionDetails(result.details);
      setEffectiveRole(appRole);

      // Derive scope
      if (result.permissions["scope.view.all"]) setScope("all");
      else if (result.permissions["scope.view.company"]) setScope("company");
      else setScope("own");

      setActive(true);

      // Audit log
      if (user) {
        await supabase.from("audit_log").insert({
          action: "preview_mode_activated",
          target_type: newTarget.type === "user" ? "user" : "role",
          target_id: newTarget.id,
          actor_user_account_id: null, // We'll use metadata
          metadata: {
            actor_auth_id: user.id,
            actor_name: user.name,
            target_label: newTarget.label,
            preview_type: newTarget.type,
          },
        });
      }
    } catch (err) {
      console.error("[PreviewMode] Failed to activate:", err);
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin, user, fetchUserPermissions, fetchRolePermissions]);

  const deactivate = useCallback(() => {
    setActive(false);
    setTarget(null);
    setPermissions({});
    setPermissionDetails([]);
    setScope("own");
    setEffectiveRole(null);
  }, []);

  return (
    <PreviewModeContext.Provider value={{
      active,
      target,
      permissions,
      permissionDetails,
      scope,
      loading,
      activate,
      deactivate,
      effectiveRole,
      realIsSuperAdmin: isSuperAdmin,
    }}>
      {children}
    </PreviewModeContext.Provider>
  );
}

export function usePreviewMode() {
  const ctx = useContext(PreviewModeContext);
  if (!ctx) throw new Error("usePreviewMode must be used within PreviewModeProvider");
  return ctx;
}
