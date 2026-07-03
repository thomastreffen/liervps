import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export type AppRole = "super_admin" | "admin" | "montør" | "customer_user";



interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: AppRole;
}

interface AuthContextType {
  session: Session | null;
  user: AuthUser | null;
  loading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Build an AuthUser immediately from Supabase User (metadata only, no DB call) */
function buildUserFromMeta(supaUser: User): AuthUser {
  return {
    id: supaUser.id,
    email: supaUser.email || "",
    name: supaUser.user_metadata?.full_name || supaUser.email || "",
    role: (supaUser.user_metadata?.app_role as AppRole) || "montør",
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  /** Idempotent first-login provisioning: person, user_account, membership, role */
  const ensureProvisioning = useCallback(async (supaUser: User) => {
    try {
      const meta = (supaUser.user_metadata || {}) as Record<string, any>;
      const fullName =
        meta.full_name || meta.name ||
        [meta.given_name, meta.family_name].filter(Boolean).join(" ") ||
        supaUser.email || "";
      const avatar = meta.avatar_url || meta.picture || null;
      console.info("[Auth] Provisioning start", {
        auth_user_id: supaUser.id,
        email: supaUser.email,
        provider: supaUser.app_metadata?.provider,
      });
      const { data, error } = await supabase.rpc("ensure_user_provisioning", {
        p_full_name: fullName,
        p_email: supaUser.email || null,
        p_avatar: avatar,
      });
      if (error) {
        console.warn("[Auth] ensure_user_provisioning error:", error.message);
        return;
      }
      console.info("[Auth] Provisioning result:", data);
    } catch (err) {
      console.warn("[Auth] provisioning exception:", err);
    }
  }, []);

  /** Non-blocking role fetch from DB — updates user if role differs */
  const fetchRoleInBackground = useCallback(async (supaUser: User) => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", supaUser.id)
        .maybeSingle();

      if (error) {
        console.warn("[Auth] DB role query error:", error.message);
        return; // keep metadata role
      }

      if (data?.role) {
        const dbRole = data.role as AppRole;
        const currentMetaRole = supaUser.user_metadata?.app_role;
        if (dbRole !== currentMetaRole) {
          console.log("[Auth] Role from DB differs, updating:", dbRole);
        }
        setUser((prev) =>
          prev && prev.id === supaUser.id ? { ...prev, role: dbRole } : prev
        );
      }
    } catch (err) {
      console.warn("[Auth] Role fetch exception, keeping default role");
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // 1. Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (!mounted) return;
        console.log("[Auth] State change:", _event, !!newSession);
        setSession(newSession);

        if (newSession?.user) {
          const authUser = buildUserFromMeta(newSession.user);
          setUser(authUser);
          // Provision + role fetch (deferred to next tick to avoid deadlock in the callback)
          setTimeout(() => {
            ensureProvisioning(newSession.user).then(() => {
              fetchRoleInBackground(newSession.user);
            });
          }, 0);
        } else {
          setUser(null);
        }
        setLoading(false);
      }
    );

    // 2. Check existing session
    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      if (!mounted) return;
      setSession(existing);
      if (existing?.user) {
        const authUser = buildUserFromMeta(existing.user);
        setUser(authUser);
        ensureProvisioning(existing.user).then(() => {
          fetchRoleInBackground(existing.user);
        });
      }
      setLoading(false);
    }).catch((err) => {
      console.error("[Auth] getSession failed:", err);
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchRoleInBackground, ensureProvisioning]);

  /**
   * Sign out: local Supabase sign-out, clear state, redirect to /login.
   * No Microsoft/Azure logout — Lier VPS uses Google/Supabase auth.
   */
  const signOut = useCallback(async () => {
    console.log("[Auth] Signing out...");
    setUser(null);
    setSession(null);
    try {
      queryClient.clear();
    } catch (err) {
      console.warn("[Auth] queryClient.clear failed", err);
    }
    try {
      await supabase.auth.signOut({ scope: "global" });
    } catch (err) {
      console.error("[Auth] signOut error:", err);
    }
    Object.keys(localStorage).forEach((key) => {
      if (
        key.startsWith("sb-") ||
        key.startsWith("mcs.") ||
        key.startsWith("react-query") ||
        key.startsWith("unread-")
      ) {
        localStorage.removeItem(key);
      }
    });
    try {
      sessionStorage.clear();
    } catch {
      /* noop */
    }
    window.location.href = "/login";
  }, [queryClient]);

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const isSuperAdmin = user?.role === "super_admin";

  return (
    <AuthContext.Provider value={{ session, user, loading, isAdmin, isSuperAdmin, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
