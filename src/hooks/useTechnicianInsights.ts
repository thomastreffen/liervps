import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TechInsight {
  technicianUserId: string;
  avgResponseMinutes: number | null;
  avgRemindersBeforeResponse: number;
  totalApprovals: number;
  label: string; // "Svarer raskt" | "Svarer ofte sent" | ""
}

export function useTechnicianInsights(technicianUserIds: string[]) {
  const [insights, setInsights] = useState<Map<string, TechInsight>>(new Map());

  const fetch = useCallback(async () => {
    if (technicianUserIds.length === 0) {
      setInsights(new Map());
      return;
    }

    // Get historical approvals for these technicians (last 90 days)
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);

    const { data, error } = await supabase
      .from("job_approvals")
      .select("technician_user_id, status, created_at, responded_at, reminder_count")
      .in("technician_user_id", technicianUserIds)
      .gte("created_at", cutoff.toISOString())
      .not("responded_at", "is", null);

    if (error || !data) return;

    const byTech = new Map<string, Array<{ responseMinutes: number; reminderCount: number }>>();
    for (const row of data) {
      if (!row.responded_at || !row.created_at) continue;
      const responseMs = new Date(row.responded_at).getTime() - new Date(row.created_at).getTime();
      const responseMinutes = responseMs / (1000 * 60);
      if (responseMinutes < 0) continue; // Invalid data

      const arr = byTech.get(row.technician_user_id) || [];
      arr.push({ responseMinutes, reminderCount: row.reminder_count ?? 0 });
      byTech.set(row.technician_user_id, arr);
    }

    const result = new Map<string, TechInsight>();
    for (const userId of technicianUserIds) {
      const entries = byTech.get(userId);
      if (!entries || entries.length === 0) {
        result.set(userId, {
          technicianUserId: userId,
          avgResponseMinutes: null,
          avgRemindersBeforeResponse: 0,
          totalApprovals: 0,
          label: "",
        });
        continue;
      }

      const avgMin = entries.reduce((s, e) => s + e.responseMinutes, 0) / entries.length;
      const avgReminders = entries.reduce((s, e) => s + e.reminderCount, 0) / entries.length;

      let label = "";
      if (avgMin < 120) label = "Svarer raskt";
      else if (avgMin > 1440 || avgReminders >= 2) label = "Svarer ofte sent";

      result.set(userId, {
        technicianUserId: userId,
        avgResponseMinutes: Math.round(avgMin),
        avgRemindersBeforeResponse: Math.round(avgReminders * 10) / 10,
        totalApprovals: entries.length,
        label,
      });
    }
    setInsights(result);
  }, [technicianUserIds.join(",")]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { insights };
}
