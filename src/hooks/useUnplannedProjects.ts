import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useUnplannedProjects() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    async function fetch() {
      // Projects that are not deleted, not archived, status in early stages, and have no schedule blocks
      const { count: total, error } = await supabase
        .from("events")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .is("archived_at", null)
        .in("status", ["requested", "approved"])
        .is("microsoft_event_id", null);

      if (!error && total !== null) {
        setCount(total);
      }
    }
    fetch();
    // Re-check every 60s
    const interval = setInterval(fetch, 60000);
    return () => clearInterval(interval);
  }, []);

  return count;
}
