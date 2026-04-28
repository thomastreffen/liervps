import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CalcAiDraftAttachment {
  path: string;
  name: string;
  mime_type: string;
  size: number;
  bucket: string;
}

export interface CalcAiProposedField {
  value: any;
  confidence: number;
  reason?: string;
}

export interface CalcAiDraft {
  id: string;
  company_id: string | null;
  user_id: string | null;
  package_id: string;
  status: "draft" | "analyzing" | "ready" | "applied" | "discarded";
  initial_description: string | null;
  attachments: CalcAiDraftAttachment[];
  ai_summary: string | null;
  ai_assumptions: string[];
  ai_open_questions: string[];
  ai_proposed_input: Record<string, CalcAiProposedField>;
  ai_proposed_lines: any[];
  overall_confidence: number | null;
  model_used: string | null;
  applied_calculation_id: string | null;
  applied_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CalcAiDraftMessage {
  id: string;
  draft_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  attachments: CalcAiDraftAttachment[];
  proposal_diff: any;
  metadata: any;
  created_at: string;
}

export function useCalcAiDraft(draftId: string | null) {
  const [draft, setDraft] = useState<CalcAiDraft | null>(null);
  const [messages, setMessages] = useState<CalcAiDraftMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!draftId) return;
    setLoading(true);
    const [d, m] = await Promise.all([
      supabase.from("calc_ai_drafts").select("*").eq("id", draftId).maybeSingle(),
      supabase.from("calc_ai_draft_messages").select("*").eq("draft_id", draftId).order("created_at"),
    ]);
    if (d.data) setDraft(d.data as any);
    if (m.data) setMessages(m.data as any);
    setLoading(false);
  }, [draftId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Realtime updates
  useEffect(() => {
    if (!draftId) return;
    const ch = supabase
      .channel(`calc-ai-${draftId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "calc_ai_drafts", filter: `id=eq.${draftId}` },
        () => fetchAll())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "calc_ai_draft_messages", filter: `draft_id=eq.${draftId}` },
        () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [draftId, fetchAll]);

  const analyze = useCallback(async (userMessage?: string) => {
    if (!draftId) return;
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("calc-ai-analyze", {
        body: { draft_id: draftId, user_message: userMessage },
      });
      if (error) throw error;
      await fetchAll();
      return data;
    } finally {
      setAnalyzing(false);
    }
  }, [draftId, fetchAll]);

  return { draft, messages, loading, analyzing, analyze, refresh: fetchAll };
}
