import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TechnicianInfo {
  id: string;
  name: string;
  email: string;
  color?: string;
}

/**
 * Fetches plannable technicians.
 * If companyId is provided, filters to technicians with an employment_profile in that company.
 * If companyId is null/undefined, returns all plannable technicians.
 */
export function useTechnicians(companyId?: string | null) {
  const [technicians, setTechnicians] = useState<TechnicianInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const prevKey = useRef<string>("");

  useEffect(() => {
    const key = companyId || "all";
    if (key === prevKey.current && technicians.length > 0) return;
    prevKey.current = key;
    setLoading(true);

    async function fetch() {
      if (companyId) {
        // Get technician ids via employment_profiles for this company
        const { data: profiles } = await supabase
          .from("employment_profiles")
          .select("person_id")
          .eq("company_id", companyId)
          .is("archived_at", null);

        if (!profiles || profiles.length === 0) {
          setTechnicians([]);
          setLoading(false);
          return;
        }

        const personIds = profiles.map((p: any) => p.person_id);

        // Get user_ids from user_accounts for those persons
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

        const { data } = await supabase
          .from("technicians")
          .select("id, name, email, color")
          .eq("is_plannable_resource", true)
          .is("archived_at", null)
          .in("user_id", authUserIds)
          .order("name");

        setTechnicians(data || []);
      } else {
        const { data } = await supabase
          .from("technicians")
          .select("id, name, email, color")
          .eq("is_plannable_resource", true)
          .is("archived_at", null)
          .order("name");

        setTechnicians(data || []);
      }
      setLoading(false);
    }

    fetch();
  }, [companyId]);

  return { technicians, loading };
}
