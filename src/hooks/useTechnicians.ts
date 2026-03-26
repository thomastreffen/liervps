import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TechnicianInfo {
  id: string;
  name: string;
  email: string;
  color?: string;
  avatar_id?: string | null;
}

/**
 * Fetches plannable technicians.
 * Uses employment_profiles.is_plannable_resource as the per-company source of truth.
 * If companyId is provided, returns only technicians plannable in that company.
 * If companyId is null/undefined, returns technicians plannable in any of the allowedCompanyIds.
 * allowedCompanyIds restricts results to only companies the user has access to.
 */
export function useTechnicians(companyId?: string | null, allowedCompanyIds?: string[]) {
  const [technicians, setTechnicians] = useState<TechnicianInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const prevKey = useRef<string>("");

  useEffect(() => {
    const key = companyId || (allowedCompanyIds?.join(",") || "none");
    if (key === prevKey.current && technicians.length > 0) return;
    prevKey.current = key;
    setLoading(true);

    async function fetch() {
      // Step 1: Get plannable person_ids from employment_profiles
      let epQuery = supabase
        .from("employment_profiles")
        .select("person_id")
        .eq("is_plannable_resource", true)
        .is("archived_at", null);

      if (companyId) {
        epQuery = epQuery.eq("company_id", companyId);
      } else if (allowedCompanyIds && allowedCompanyIds.length > 0) {
        // When "all companies" is selected, restrict to user's allowed companies
        epQuery = epQuery.in("company_id", allowedCompanyIds);
      } else {
        // No access — return empty
        setTechnicians([]);
        setLoading(false);
        return;
      }

      const { data: profiles } = await epQuery;
      if (!profiles || profiles.length === 0) {
        setTechnicians([]);
        setLoading(false);
        return;
      }

      const personIds = [...new Set(profiles.map((p: any) => p.person_id))];

      // Step 2: Get auth_user_ids from user_accounts for those persons
      const { data: accounts } = await supabase
        .from("user_accounts")
        .select("auth_user_id, person_id")
        .in("person_id", personIds)
        .eq("is_active", true);

      if (!accounts || accounts.length === 0) {
        setTechnicians([]);
        setLoading(false);
        return;
      }

      const authUserIds = accounts
        .map((a: any) => a.auth_user_id)
        .filter(Boolean);

      if (authUserIds.length === 0) {
        setTechnicians([]);
        setLoading(false);
        return;
      }

      // Step 3: Get technician records for those auth users
      const { data } = await supabase
        .from("technicians")
        .select("id, name, email, color, avatar_id")
        .is("archived_at", null)
        .in("user_id", authUserIds)
        .order("name");

      setTechnicians(data || []);
      setLoading(false);
    }

    fetch();
  }, [companyId]);

  return { technicians, loading };
}
