import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";

export interface NewLeadSummary {
  id: string;
  company_name: string;
  source: string | null;
  created_at: string;
}

export function isWebsiteLead(source?: string | null) {
  const s = (source || "").toLowerCase();
  return s.includes("nettside") || s.includes("website") || s.includes("web");
}

/**
 * Counts of active leads with status "new", website leads today and the latest lead.
 * Active = deleted_at IS NULL AND archived_at IS NULL.
 */
export function useNewLeads() {
  const { activeCompanyId, allowedCompanyIds } = useCompanyContext();
  const [leads, setLeads] = useState<NewLeadSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeads = useCallback(async () => {
    let query = supabase
      .from("leads")
      .select("id, company_name, source, created_at, status")
      .is("deleted_at", null)
      .filter("archived_at", "is", "null")
      .eq("status", "new")
      .order("created_at", { ascending: false })
      .limit(200);
    if (activeCompanyId) query = query.eq("company_id", activeCompanyId);
    else if (allowedCompanyIds.length > 0) query = query.in("company_id", allowedCompanyIds);
    const { data } = await query;
    setLeads((data || []) as any as NewLeadSummary[]);
    setLoading(false);
  }, [activeCompanyId, allowedCompanyIds.join(",")]);

  useEffect(() => {
    fetchLeads();
    const channel = supabase
      .channel("new-leads-visibility")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => fetchLeads())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchLeads]);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const websiteToday = leads.filter(
    (l) => isWebsiteLead(l.source) && new Date(l.created_at) >= startOfToday
  ).length;

  return {
    loading,
    newCount: leads.length,
    websiteToday,
    latest: leads[0] || null,
    refresh: fetchLeads,
  };
}
