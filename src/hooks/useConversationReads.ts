import { useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ConversationParticipant {
  id: string;
  submission_id: string;
  participant_type: string;
  user_id: string | null;
  technician_id: string | null;
  display_name: string;
  name: string;
  email: string | null;
  phone: string | null;
  role_label: string | null;
  visibility: string;
  is_active: boolean;
  last_seen_at: string | null;
  last_seen_message_id: string | null;
  created_at: string;
}

export interface MessageRead {
  id: string;
  message_id: string;
  participant_id: string;
  read_at: string;
  reader_type: string;
}

interface UseConversationReadsArgs {
  submissionId: string | undefined;
  /** Messages currently visible to the viewer, ordered ascending by created_at. */
  visibleMessageIds: string[];
  /** When true, mark visible messages as read for the internal user (admin flow). */
  enableInternalMarkRead?: boolean;
}

/**
 * Internal/admin-side hook for participants + per-message read receipts.
 * Customer flow uses useCustomerConversationReads instead.
 */
export function useConversationReads({
  submissionId,
  visibleMessageIds,
  enableInternalMarkRead = false,
}: UseConversationReadsArgs) {
  const qc = useQueryClient();

  const participantsQuery = useQuery({
    queryKey: ["conversation-participants", submissionId],
    enabled: !!submissionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_form_participants")
        .select("*")
        .eq("submission_id", submissionId!)
        .eq("is_active", true)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as ConversationParticipant[];
    },
  });

  const readsQuery = useQuery({
    queryKey: ["conversation-reads", submissionId],
    enabled: !!submissionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_form_message_reads")
        .select("id, message_id, participant_id, read_at, reader_type")
        .eq("submission_id", submissionId!);
      if (error) throw error;
      return (data || []) as MessageRead[];
    },
  });

  // Mark visible messages as read for the current internal user.
  const lastMarkedKeyRef = useRef<string>("");
  useEffect(() => {
    if (!enableInternalMarkRead || !submissionId || visibleMessageIds.length === 0) return;
    const key = `${submissionId}:${visibleMessageIds.join(",")}`;
    if (lastMarkedKeyRef.current === key) return;
    lastMarkedKeyRef.current = key;

    let cancelled = false;
    (async () => {
      try {
        await supabase.rpc("mark_messages_read_internal" as any, {
          _submission_id: submissionId,
          _message_ids: visibleMessageIds,
        });
        if (!cancelled) {
          qc.invalidateQueries({ queryKey: ["conversation-reads", submissionId] });
          qc.invalidateQueries({ queryKey: ["conversation-participants", submissionId] });
        }
      } catch (e) {
        // silent — non-critical
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [submissionId, visibleMessageIds.join(","), enableInternalMarkRead, qc]);

  // Realtime — refresh on changes to reads or participants
  useEffect(() => {
    if (!submissionId) return;
    const channel = supabase
      .channel(`conv-reads-${submissionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_form_message_reads", filter: `submission_id=eq.${submissionId}` },
        () => qc.invalidateQueries({ queryKey: ["conversation-reads", submissionId] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_form_participants", filter: `submission_id=eq.${submissionId}` },
        () => qc.invalidateQueries({ queryKey: ["conversation-participants", submissionId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [submissionId, qc]);

  const indexes = useMemo(() => {
    const reads = readsQuery.data || [];
    const participants = participantsQuery.data || [];
    const readsByMessage = new Map<string, MessageRead[]>();
    for (const r of reads) {
      const arr = readsByMessage.get(r.message_id) || [];
      arr.push(r);
      readsByMessage.set(r.message_id, arr);
    }
    const participantById = new Map<string, ConversationParticipant>();
    for (const p of participants) participantById.set(p.id, p);
    return { readsByMessage, participantById, participants, reads };
  }, [participantsQuery.data, readsQuery.data]);

  return {
    participants: indexes.participants,
    reads: indexes.reads,
    readsByMessage: indexes.readsByMessage,
    participantById: indexes.participantById,
    loading: participantsQuery.isLoading || readsQuery.isLoading,
  };
}
