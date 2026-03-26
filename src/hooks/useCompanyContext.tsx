import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Company {
  id: string;
  name: string;
  org_number: string | null;
}

interface CompanyContextType {
  companies: Company[];
  /** null means "Alle selskaper" (cross-company aggregate) */
  activeCompanyId: string | null;
  activeCompany: Company | null;
  setActiveCompanyId: (id: string | null) => void;
  loading: boolean;
  userMemberships: { company_id: string; department_id: string | null }[];
  /** True when user explicitly chose "all companies" */
  isAllCompanies: boolean;
  /** Company IDs the user actually has membership in */
  allowedCompanyIds: string[];
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompanyId, setActiveCompanyIdState] = useState<string | null>(null);
  const [isAllCompanies, setIsAllCompanies] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userMemberships, setUserMemberships] = useState<{ company_id: string; department_id: string | null }[]>([]);

  useEffect(() => {
    if (!user) {
      setCompanies([]);
      setActiveCompanyIdState(null);
      setIsAllCompanies(false);
      setLoading(false);
      return;
    }

    async function fetch() {
      // Get user memberships
      const { data: memberships } = await supabase
        .from("user_memberships")
        .select("company_id, department_id")
        .eq("user_id", user!.id)
        .eq("is_active", true);

      setUserMemberships(
        (memberships || []).map((m: any) => ({
          company_id: m.company_id,
          department_id: m.department_id,
        }))
      );

      // Get only companies the user has membership in
      const memberCompanyIds = [...new Set((memberships || []).map((m: any) => m.company_id))];

      let companyList: Company[] = [];
      if (memberCompanyIds.length > 0) {
        const { data: comps } = await supabase
          .from("internal_companies")
          .select("id, name, org_number")
          .eq("is_active", true)
          .in("id", memberCompanyIds)
          .order("name");

        companyList = (comps || []).map((c: any) => ({
          id: c.id,
          name: c.name,
          org_number: c.org_number,
        }));
      }

      setCompanies(companyList);

      // Restore from localStorage or pick first
      const stored = localStorage.getItem("mcs_active_company");
      if (stored === "__all__") {
        setActiveCompanyIdState(null);
        setIsAllCompanies(true);
      } else if (stored && companyList.some((c) => c.id === stored)) {
        setActiveCompanyIdState(stored);
        setIsAllCompanies(false);
      } else if (companyList.length > 0) {
        setActiveCompanyIdState(companyList[0].id);
        setIsAllCompanies(false);
      }

      setLoading(false);
    }

    fetch();
  }, [user]);

  const setActiveCompanyId = useCallback((id: string | null) => {
    if (id === null) {
      setActiveCompanyIdState(null);
      setIsAllCompanies(true);
      localStorage.setItem("mcs_active_company", "__all__");
    } else {
      setActiveCompanyIdState(id);
      setIsAllCompanies(false);
      localStorage.setItem("mcs_active_company", id);
    }
  }, []);

  const activeCompany = companies.find((c) => c.id === activeCompanyId) || null;

  return (
    <CompanyContext.Provider
      value={{ companies, activeCompanyId, activeCompany, setActiveCompanyId, loading, userMemberships, isAllCompanies }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompanyContext() {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error("useCompanyContext must be used within CompanyProvider");
  return ctx;
}
