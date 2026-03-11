import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { useAuth } from "@/hooks/useAuth";

export type FagRegime = "nek" | "fel" | "fse" | "fsl" | "annet";
export type FagPriority = "normal" | "viktig";
export type FagStatus = "new" | "analyzing" | "answered" | "needs_followup" | "error";

export interface FagRequest {
  id: string;
  company_id: string;
  created_by_user_id: string;
  regime: FagRegime;
  question: string;
  priority: FagPriority;
  status: FagStatus;
  image_paths: string[];
  ai_summary: string | null;
  ai_confidence: number | null;
  ai_followup_questions: string[];
  created_at: string;
  updated_at: string;
  last_activity_at: string;
  linked_case_id: string | null;
  linked_project_id: string | null;
  linked_offer_id: string | null;
  parent_request_id: string | null;
  archived_at: string | null;
  archived_by: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  is_test: boolean;
  pinned_at: string | null;
}

export interface FagAnswer {
  id: string;
  fag_request_id: string;
  company_id: string;
  answer_markdown: string;
  model: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  created_at: string;
  created_by: string;
}

export function useFagRequests() {
  const { activeCompanyId } = useCompanyContext();
  const { user } = useAuth();
  const [requests, setRequests] = useState<FagRequest[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRequests = useCallback(async () => {
    if (!activeCompanyId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("fag_requests")
        .select("*")
        .eq("company_id", activeCompanyId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      setRequests((data || []) as unknown as FagRequest[]);
    } catch (err) {
      console.warn("[useFagRequests] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [activeCompanyId]);

  const fetchAnswers = useCallback(async (requestId: string): Promise<FagAnswer[]> => {
    const { data, error } = await supabase
      .from("fag_answers")
      .select("*")
      .eq("fag_request_id", requestId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []) as unknown as FagAnswer[];
  }, []);

  const createRequest = useCallback(async (params: {
    regime: FagRegime;
    question: string;
    priority: FagPriority;
  }): Promise<FagRequest> => {
    if (!activeCompanyId || !user) throw new Error("Mangler kontekst");
    const { data, error } = await supabase
      .from("fag_requests")
      .insert({
        company_id: activeCompanyId,
        created_by_user_id: user.id,
        regime: params.regime,
        question: params.question,
        priority: params.priority,
      } as any)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as FagRequest;
  }, [activeCompanyId, user]);

  const uploadImage = useCallback(async (requestId: string, file: File): Promise<string> => {
    if (!activeCompanyId) throw new Error("Mangler selskap");
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${activeCompanyId}/fag/${requestId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("fag-attachments")
      .upload(path, file, { contentType: file.type });
    if (error) throw error;
    return path;
  }, [activeCompanyId]);

  const updateImagePaths = useCallback(async (requestId: string, paths: string[]) => {
    const { error } = await supabase
      .from("fag_requests")
      .update({ image_paths: paths } as any)
      .eq("id", requestId);
    if (error) throw error;
  }, []);

  const analyzeRequest = useCallback(async (params: {
    fag_request_id: string;
    company_id: string;
    regime: string;
    question: string;
    images: Array<{ path: string; mime_type: string }>;
    context?: { site?: string; notes?: string };
  }) => {
    const { data, error } = await supabase.functions.invoke("fag-image-analyze", {
      body: params,
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.message || data.error);
    return data;
  }, []);

  const archiveRequest = useCallback(async (requestId: string) => {
    if (!user) return;
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("fag_requests")
      .update({ archived_at: now, archived_by: user.id } as any)
      .eq("id", requestId);
    if (error) throw error;
    await supabase
      .from("fag_requests")
      .update({ archived_at: now, archived_by: user.id } as any)
      .eq("parent_request_id", requestId);
    await fetchRequests();
  }, [user, fetchRequests]);

  const unarchiveRequest = useCallback(async (requestId: string) => {
    const { error } = await supabase
      .from("fag_requests")
      .update({ archived_at: null, archived_by: null } as any)
      .eq("id", requestId);
    if (error) throw error;
    await supabase
      .from("fag_requests")
      .update({ archived_at: null, archived_by: null } as any)
      .eq("parent_request_id", requestId);
    await fetchRequests();
  }, [fetchRequests]);

  const deleteRequest = useCallback(async (requestId: string) => {
    if (!user) return;
    const now = new Date().toISOString();
    await supabase
      .from("fag_requests")
      .update({ deleted_at: now, deleted_by: user.id } as any)
      .eq("parent_request_id", requestId);
    const { error } = await supabase
      .from("fag_requests")
      .update({ deleted_at: now, deleted_by: user.id } as any)
      .eq("id", requestId);
    if (error) throw error;
    await fetchRequests();
  }, [user, fetchRequests]);

  const toggleTestMode = useCallback(async (requestId: string, isTest: boolean) => {
    const { error } = await supabase
      .from("fag_requests")
      .update({ is_test: isTest } as any)
      .eq("id", requestId);
    if (error) throw error;
    await fetchRequests();
  }, [fetchRequests]);

  const pinRequest = useCallback(async (requestId: string, pin: boolean) => {
    const { error } = await supabase
      .from("fag_requests")
      .update({ pinned_at: pin ? new Date().toISOString() : null } as any)
      .eq("id", requestId);
    if (error) throw error;
    await fetchRequests();
  }, [fetchRequests]);

  const bulkArchive = useCallback(async (ids: string[]) => {
    if (!user || ids.length === 0) return;
    const now = new Date().toISOString();
    for (const id of ids) {
      await supabase.from("fag_requests").update({ archived_at: now, archived_by: user.id } as any).eq("id", id);
      await supabase.from("fag_requests").update({ archived_at: now, archived_by: user.id } as any).eq("parent_request_id", id);
    }
    await fetchRequests();
  }, [user, fetchRequests]);

  const bulkDelete = useCallback(async (ids: string[]) => {
    if (!user || ids.length === 0) return;
    const now = new Date().toISOString();
    for (const id of ids) {
      await supabase.from("fag_requests").update({ deleted_at: now, deleted_by: user.id } as any).eq("parent_request_id", id);
      await supabase.from("fag_requests").update({ deleted_at: now, deleted_by: user.id } as any).eq("id", id);
    }
    await fetchRequests();
  }, [user, fetchRequests]);

  const bulkMarkTest = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    for (const id of ids) {
      await supabase.from("fag_requests").update({ is_test: true } as any).eq("id", id);
    }
    await fetchRequests();
  }, [fetchRequests]);

  const purgeTestConversations = useCallback(async () => {
    if (!user) return;
    const now = new Date().toISOString();
    // Get all test root requests
    const testRoots = requests.filter(r => r.is_test && !r.parent_request_id && !r.deleted_at);
    for (const r of testRoots) {
      await supabase.from("fag_requests").update({ deleted_at: now, deleted_by: user.id } as any).eq("parent_request_id", r.id);
      await supabase.from("fag_requests").update({ deleted_at: now, deleted_by: user.id } as any).eq("id", r.id);
    }
    await fetchRequests();
  }, [user, requests, fetchRequests]);

  return {
    requests,
    loading,
    fetchRequests,
    fetchAnswers,
    createRequest,
    uploadImage,
    updateImagePaths,
    analyzeRequest,
    archiveRequest,
    unarchiveRequest,
    deleteRequest,
    toggleTestMode,
    pinRequest,
    bulkArchive,
    bulkDelete,
    bulkMarkTest,
    purgeTestConversations,
  };
}
