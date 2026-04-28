import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface CommercialCase {
  id: string;
  case_number: string | null;
  title: string;
  phase: string;
  next_step: string | null;
  next_step_due_at: string | null;
  owner_user_id: string | null;
  customer_id: string | null;
  contact_person_id: string | null;
  value_estimate: number | null;
  probability_pct: number | null;
  expected_close_date: string | null;
  description: string | null;
  source: string | null;
  won_at: string | null;
  lost_at: string | null;
  created_at: string;
  updated_at: string;
}

export const COMMERCIAL_PHASES: Array<{ value: string; label: string }> = [
  { value: "lead", label: "Lead" },
  { value: "qualifying", label: "Kvalifisering" },
  { value: "calculating", label: "Kalkulerer" },
  { value: "quoted", label: "Tilbud sendt" },
  { value: "negotiating", label: "Forhandling" },
  { value: "won", label: "Vunnet" },
  { value: "lost", label: "Tapt" },
];

export function phaseLabel(phase: string | null | undefined): string {
  return COMMERCIAL_PHASES.find(p => p.value === phase)?.label || phase || "—";
}

export interface UpdateCommercialCaseInput {
  phase?: string;
  owner_user_id?: string | null;
  next_step?: string | null;
  next_step_due_at?: string | null;
  value_estimate?: number | null;
  probability_pct?: number | null;
  expected_close_date?: string | null;
  description?: string | null;
}

export function useCommercialCase(caseId: string | null | undefined) {
  const [data, setData] = useState<CommercialCase | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    if (!caseId) { setData(null); return; }
    setLoading(true);
    try {
      const { data: row } = await supabase
        .from("commercial_cases")
        .select("*")
        .eq("id", caseId)
        .is("deleted_at", null)
        .maybeSingle();
      setData((row as any) ?? null);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => { refresh(); }, [refresh]);

  const update = useCallback(async (patch: UpdateCommercialCaseInput) => {
    if (!caseId) return null;
    setSaving(true);
    try {
      const { data: updated, error } = await supabase.rpc("update_commercial_case_crm", {
        _case_id: caseId,
        _phase: patch.phase ?? null,
        _owner_user_id: patch.owner_user_id ?? null,
        _next_step: patch.next_step ?? null,
        _next_step_due_at: patch.next_step_due_at ?? null,
        _value_estimate: patch.value_estimate ?? null,
        _probability_pct: patch.probability_pct ?? null,
        _expected_close_date: patch.expected_close_date ?? null,
        _description: patch.description ?? null,
      });
      if (error) throw error;
      const row = Array.isArray(updated) ? updated[0] : updated;
      setData((row as any) ?? null);
      toast({ title: "Sak oppdatert" });
      return row as CommercialCase;
    } catch (err: any) {
      toast({ title: "Kunne ikke oppdatere sak", description: err.message, variant: "destructive" });
      return null;
    } finally {
      setSaving(false);
    }
  }, [caseId]);

  return { data, loading, saving, refresh, update };
}
