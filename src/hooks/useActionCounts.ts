import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface ActionCounts {
  newOrders: number;
  pendingOrders: number;
  unreadAllApproved: number;
  activeJobs: number;
  plannedJobs: number;
  doneJobs: number;
  awaitingClarification: number;
  loading: boolean;
}

const NEW_ORDER_STATUSES = ["new", "submitted", "received"];
const PENDING_ORDER_STATUSES = ["under_review", "in_review", "waiting_internal", "pending", "needs_info"];

/**
 * Data-driven counters for dashboard cards.
 * Realtime-subscribed to orders + events + notifications.
 */
export function useActionCounts(): ActionCounts {
  const { user } = useAuth();
  const [state, setState] = useState<ActionCounts>({
    newOrders: 0,
    pendingOrders: 0,
    unreadAllApproved: 0,
    activeJobs: 0,
    plannedJobs: 0,
    doneJobs: 0,
    awaitingClarification: 0,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const eventsQ = supabase.from("events").select("id", { count: "exact", head: true }).is("deleted_at", null);
      const ordersQ = supabase.from("order_form_submissions").select("id", { count: "exact", head: true }).is("deleted_at", null);

      const [newRes, pendingRes, activeRes, plannedRes, doneRes, awaitingRes, approvedNotifRes] = await Promise.all([
        ordersQ.in("status", NEW_ORDER_STATUSES),
        supabase.from("order_form_submissions").select("id", { count: "exact", head: true }).is("deleted_at", null).in("status", PENDING_ORDER_STATUSES),
        eventsQ.in("status", ["scheduled", "in_progress", "approved"]),
        supabase.from("events").select("id", { count: "exact", head: true }).is("deleted_at", null).eq("status", "scheduled"),
        supabase.from("events").select("id", { count: "exact", head: true }).is("deleted_at", null).in("status", ["completed", "ready_for_invoicing", "invoiced"]),
        supabase.from("events").select("id", { count: "exact", head: true }).is("deleted_at", null).in("status", ["requested", "time_change_proposed"]),
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
        activeJobs: activeRes.count ?? 0,
        plannedJobs: plannedRes.count ?? 0,
        doneJobs: doneRes.count ?? 0,
        awaitingClarification: awaitingRes.count ?? 0,
        unreadAllApproved: (approvedNotifRes as any).count ?? 0,
        loading: false,
      });
    }
    load();

    const ch = supabase
      .channel("action-counts")
      .on("postgres_changes", { event: "*", schema: "public", table: "order_form_submissions" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, load)
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [user]);

  return state;
}
