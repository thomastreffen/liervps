import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CustomerMessageReadSummary {
  message_id: string;
  internal_read_count: number;
  internal_first_read_at: string | null;
}

interface Args {
  trackingToken: string | undefined;
  /** IDs of messages currently visible to the customer (already filtered to is_visible_to_customer). */
  visibleMessageIds: string[];
  /** Disable if customer should not be marked as having read. */
  enabled?: boolean;
}

/**
 * Customer-side hook: marks visible messages as read via tracking token and
 * exposes which of the customer's own messages have been read by MCS.
 */
export function useCustomerConversationReads({ trackingToken, visibleMessageIds, enabled = true }: Args) {
  const qc = useQueryClient();

  const lastMarkedKeyRef = useRef<string>("");
  useEffect(() => {
    if (!enabled || !trackingToken || visibleMessageIds.length === 0) return;
    const key = `${trackingToken}:${visibleMessageIds.join(",")}`;
    if (lastMarkedKeyRef.current === key) return;
    lastMarkedKeyRef.current = key;

    (async () => {
      try {
        await supabase.rpc("mark_messages_read_by_token" as any, {
          _tracking_token: trackingToken,
          _message_ids: visibleMessageIds,
          _user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 200) : null,
        });
        qc.invalidateQueries({ queryKey: ["tracking-message-reads", trackingToken] });
      } catch (_) {
        // silent
      }
    })();
  }, [trackingToken, visibleMessageIds.join(","), enabled, qc]);

  const readSummary = useQuery({
    queryKey: ["tracking-message-reads", trackingToken],
    enabled: !!trackingToken,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_message_reads_by_token" as any, {
        _tracking_token: trackingToken!,
      });
      if (error) throw error;
      const map = new Map<string, CustomerMessageReadSummary>();
      for (const row of (data || []) as CustomerMessageReadSummary[]) {
        map.set(row.message_id, row);
      }
      return map;
    },
  });

  return {
    readsByMessage: readSummary.data || new Map<string, CustomerMessageReadSummary>(),
  };
}
