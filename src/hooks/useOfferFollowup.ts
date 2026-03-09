import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type OfferFollowupType =
  | "offer_follow_up"
  | "offer_hot_lead_follow_up"
  | "offer_expiry_warning"
  | "offer_next_step_missing"
  | "offer_active_customer_follow_up";

export type OfferFollowupStatus = "open" | "snoozed" | "completed" | "cancelled";
export type OfferFollowupPriority = "low" | "medium" | "high" | "urgent";

export interface OfferFollowupTask {
  id: string;
  offer_id: string;
  company_id: string | null;
  task_type: OfferFollowupType;
  status: OfferFollowupStatus;
  priority: OfferFollowupPriority;
  title: string;
  description: string | null;
  assigned_to: string | null;
  due_date: string | null;
  snoozed_until: string | null;
  completed_at: string | null;
  lead_id: string | null;
  customer_name: string | null;
  meta: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

export const FOLLOWUP_TYPE_CONFIG: Record<OfferFollowupType, { label: string; icon: string }> = {
  offer_follow_up: { label: "Oppfølging", icon: "📞" },
  offer_hot_lead_follow_up: { label: "Varm kunde", icon: "🔥" },
  offer_expiry_warning: { label: "Utløper snart", icon: "⏰" },
  offer_next_step_missing: { label: "Mangler neste steg", icon: "📋" },
  offer_active_customer_follow_up: { label: "Aktiv kunde", icon: "👁️" },
};

export const PRIORITY_CONFIG: Record<OfferFollowupPriority, { label: string; className: string }> = {
  urgent: { label: "Haster", className: "bg-destructive/15 text-destructive" },
  high: { label: "Høy", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" },
  medium: { label: "Medium", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  low: { label: "Lav", className: "bg-muted text-muted-foreground" },
};

/** Fetch followup tasks for a specific offer */
export function useOfferFollowupTasks(offerId: string | null) {
  const [tasks, setTasks] = useState<OfferFollowupTask[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!offerId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("offer_followup_tasks" as any)
      .select("*")
      .eq("offer_id", offerId)
      .order("created_at", { ascending: false });
    setTasks((data as any as OfferFollowupTask[]) || []);
    setLoading(false);
  }, [offerId]);

  useEffect(() => { fetch(); }, [fetch]);

  const completeTask = useCallback(async (taskId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase
      .from("offer_followup_tasks" as any)
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        completed_by: user?.id || null,
      })
      .eq("id", taskId);
    fetch();
  }, [fetch]);

  const snoozeTask = useCallback(async (taskId: string, days: number = 1) => {
    const until = new Date();
    until.setDate(until.getDate() + days);
    await supabase
      .from("offer_followup_tasks" as any)
      .update({
        status: "snoozed",
        snoozed_until: until.toISOString(),
      })
      .eq("id", taskId);
    fetch();
  }, [fetch]);

  const cancelTask = useCallback(async (taskId: string) => {
    await supabase
      .from("offer_followup_tasks" as any)
      .update({ status: "cancelled" })
      .eq("id", taskId);
    fetch();
  }, [fetch]);

  return { tasks, loading, refetch: fetch, completeTask, snoozeTask, cancelTask };
}

/** Fetch followup task summary for dashboard (counts by status/priority) */
export function useOfferFollowupSummary(userId: string | null) {
  const [summary, setSummary] = useState<{
    totalOpen: number;
    urgent: number;
    high: number;
    tasks: OfferFollowupTask[];
  }>({ totalOpen: 0, urgent: 0, high: 0, tasks: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase
        .from("offer_followup_tasks" as any)
        .select("*")
        .eq("assigned_to", userId)
        .in("status", ["open"])
        .order("due_date", { ascending: true })
        .limit(20);

      const tasks = (data as any as OfferFollowupTask[]) || [];
      setSummary({
        totalOpen: tasks.length,
        urgent: tasks.filter((t) => t.priority === "urgent").length,
        high: tasks.filter((t) => t.priority === "high").length,
        tasks,
      });
      setLoading(false);
    })();
  }, [userId]);

  return { summary, loading };
}

/** Trigger followup check for a specific offer */
export async function triggerFollowupCheck(offerId: string) {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  await fetch(
    `https://${projectId}.supabase.co/functions/v1/offer-followup-check`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
      },
      body: JSON.stringify({ offer_id: offerId }),
    }
  );
}
