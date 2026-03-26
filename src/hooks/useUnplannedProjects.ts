import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useUnplannedProjects(companyId?: string | null, allowedCompanyIds?: string[]) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    async function fetch() {
      let query = supabase
        .from("events")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .is("archived_at", null)
        .in("status", ["requested", "approved"])
        .is("microsoft_event_id", null);

      if (companyId) {
        query = query.eq("company_id", companyId);
      } else if (allowedCompanyIds && allowedCompanyIds.length > 0) {
        query = query.in("company_id", allowedCompanyIds);
      }

      const { count: total, error } = await query;

      if (!error && total !== null) {
        setCount(total);
      }
    }

    fetch();
    const interval = setInterval(fetch, 60000);
    return () => clearInterval(interval);
  }, [companyId, allowedCompanyIds?.join(",")]);

  return count;
}
