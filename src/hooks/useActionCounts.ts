import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface ActionCounts {
  newOrders: number;
  pendingOrders: number;
  unreadAllApproved: number;
  loading: boolean;
}

/**
 * Data-driven "Krever handling" counters.
 * - newOrders: order_form_submissions with status 'new' / 'submitted' (not deleted)
 * - pendingOrders: status 'in_review' / 'pending'
 * - unreadAllApproved: notifications.type='all_approved' unread for current user
 */
export function useActionCounts(): ActionCounts {
  const { user } = useAuth();
  const [state, setState] = useState<ActionCounts>({
    newOrders: 0,
    pendingOrders: 0,
    unreadAllApproved: 0,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [newRes, pendingRes, approvedRes] = await Promise.all([
        supabase
          .from("order_form_submissions")
          .select("id", { count: "exact", head: true })
          .is("deleted_at", null)
          .in("status", ["new", "submitted", "received"]),
        supabase
          .from("order_form_submissions")
          .select("id", { count: "exact", head: true })
          .is("deleted_at", null)
          .in("status", ["in_review", "pending", "needs_info"]),
        user
          ? supabase
              .from("notifications")
              .select("id", { count: "exact", head: true })
              .eq("user_id", user.id)
              .eq("type", "all_approved")
              .eq("read", false)
          : Promise.resolve({ count: 0 } as any),
      ]);
      if (cancelled) return;
      setState({
        newOrders: newRes.count ?? 0,
        pendingOrders: pendingRes.count ?? 0,
        unreadAllApproved: (approvedRes as any).count ?? 0,
        loading: false,
      });
    }
    load();

    const ch = supabase
      .channel("action-counts")
      .on("postgres_changes", { event: "*", schema: "public", table: "order_form_submissions" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, load)
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [user]);

  return state;
}
