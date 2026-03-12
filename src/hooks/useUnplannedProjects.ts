import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useUnplannedProjects(companyId?: string | null) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    async function fetch() {
      // Projects that are not deleted, not archived, status in early stages, and have no schedule blocks
      let query = supabase
        .from("events")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .is("archived_at", null)
        .in("status", ["requested", "approved"])
        .is("microsoft_event_id", null);

      if (companyId) {
        query = query.eq("company_id", companyId);
      }

      const { count: total, error } = await query;

      if (!error && total !== null) {
        setCount(total);
      }
    }

    fetch();
    // Re-check every 60s
    const interval = setInterval(fetch, 60000);
    return () => clearInterval(interval);
  }, [companyId]);

  return count;
}
