import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";

export type AbsenceType = "ferie" | "egenmelding" | "sykemelding" | "avspasering" | "permisjon" | "kurs" | "annet";
export type AbsenceStatus = "pending" | "approved" | "rejected";

export interface AbsenceRequest {
  id: string;
  person_id: string;
  person_name?: string;
  company_id: string;
  company_name?: string;
  absence_type: AbsenceType;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  is_full_day: boolean;
  comment: string | null;
  status: AbsenceStatus;
  requested_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
}

export const ABSENCE_TYPE_LABELS: Record<AbsenceType, string> = {
  ferie: "Ferie",
  egenmelding: "Egenmelding",
  sykemelding: "Sykemelding",
  avspasering: "Avspasering",
  permisjon: "Permisjon",
  kurs: "Kurs",
  annet: "Annet fravær",
};

export const ABSENCE_TYPE_COLORS: Record<AbsenceType, string> = {
  ferie: "bg-amber-500/20 text-amber-700 border-amber-500/30",
  egenmelding: "bg-orange-500/20 text-orange-700 border-orange-500/30",
  sykemelding: "bg-red-500/20 text-red-700 border-red-500/30",
  avspasering: "bg-blue-500/20 text-blue-700 border-blue-500/30",
  permisjon: "bg-purple-500/20 text-purple-700 border-purple-500/30",
  kurs: "bg-green-500/20 text-green-700 border-green-500/30",
  annet: "bg-muted text-muted-foreground border-border",
};

export function useAbsenceRequests(filterStatus?: AbsenceStatus | "all") {
  const { activeCompanyId } = useCompanyContext();
  const [requests, setRequests] = useState<AbsenceRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from("absence_requests")
      .select("*")
      .order("start_date", { ascending: false });

    if (activeCompanyId) {
      query = query.eq("company_id", activeCompanyId);
    }

    if (filterStatus && filterStatus !== "all") {
      query = query.eq("status", filterStatus);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Failed to fetch absence requests:", error);
      setRequests([]);
      setLoading(false);
      return;
    }

    // Enrich with person names
    const personIds = [...new Set((data || []).map((r: any) => r.person_id))];
    const companyIds = [...new Set((data || []).map((r: any) => r.company_id))];

    const [{ data: people }, { data: companies }] = await Promise.all([
      personIds.length > 0
        ? supabase.from("people").select("id, full_name").in("id", personIds)
        : { data: [] },
      companyIds.length > 0
        ? supabase.from("internal_companies").select("id, name").in("id", companyIds)
        : { data: [] },
    ]);

    const nameMap = new Map((people || []).map((p: any) => [p.id, p.full_name]));
    const compMap = new Map((companies || []).map((c: any) => [c.id, c.name]));

    setRequests(
      (data || []).map((r: any) => ({
        ...r,
        person_name: nameMap.get(r.person_id) || "Ukjent",
        company_name: compMap.get(r.company_id) || "Ukjent",
      }))
    );
    setLoading(false);
  }, [activeCompanyId, filterStatus]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  return { requests, loading, refetch: fetchRequests };
}
