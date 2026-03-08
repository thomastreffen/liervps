import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export type PortalRole = "customer_admin" | "customer_user" | "customer_finance";

interface PortalUser {
  id: string;
  authUserId: string;
  email: string;
  fullName: string;
  accountId: string | null;
  accountName: string | null;
  portalRole: PortalRole;
}

interface PortalContextType {
  user: PortalUser | null;
  loading: boolean;
  isCustomerAdmin: boolean;
  signOut: () => Promise<void>;
}

const PortalContext = createContext<PortalContextType | undefined>(undefined);

export function PortalProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<PortalUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      const authUser = session.user;

      // Fetch portal user with account info
      const { data: portalUser } = await supabase
        .from("customer_portal_users")
        .select("id, email, full_name, account_id, portal_role, status")
        .eq("auth_user_id", authUser.id)
        .eq("status", "active")
        .maybeSingle();

      if (!portalUser) {
        setLoading(false);
        return;
      }

      let accountName: string | null = null;
      if (portalUser.account_id) {
        const { data: acc } = await supabase
          .from("customer_accounts")
          .select("name")
          .eq("id", portalUser.account_id)
          .maybeSingle();
        accountName = acc?.name || null;
      }

      // Update last login
      await supabase
        .from("customer_portal_users")
        .update({ last_login_at: new Date().toISOString() })
        .eq("id", portalUser.id);

      setUser({
        id: portalUser.id,
        authUserId: authUser.id,
        email: portalUser.email,
        fullName: portalUser.full_name || authUser.email?.split("@")[0] || "Kunde",
        accountId: portalUser.account_id,
        accountName,
        portalRole: portalUser.portal_role as PortalRole,
      });

      setLoading(false);
    };

    load();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    navigate("/portal/login", { replace: true });
  };

  const isCustomerAdmin = user?.portalRole === "customer_admin";

  return (
    <PortalContext.Provider value={{ user, loading, isCustomerAdmin, signOut }}>
      {children}
    </PortalContext.Provider>
  );
}

export function usePortal() {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new Error("usePortal must be used within PortalProvider");
  return ctx;
}
