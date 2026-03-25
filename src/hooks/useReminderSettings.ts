import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";

export interface ReminderSettings {
  id?: string;
  company_id: string;
  enabled: boolean;
  reminder_1_minutes: number;
  reminder_2_minutes: number;
  reminder_3_minutes: number;
  max_reminders: number;
  notify_manager: boolean;
  escalation_delay_minutes: number;
}

const DEFAULTS: Omit<ReminderSettings, "company_id"> = {
  enabled: true,
  reminder_1_minutes: 120,
  reminder_2_minutes: 1440,
  reminder_3_minutes: 2880,
  max_reminders: 3,
  notify_manager: false,
  escalation_delay_minutes: 60,
};

export function useReminderSettings() {
  const { activeCompanyId } = useCompanyContext();
  const [settings, setSettings] = useState<ReminderSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetch = useCallback(async () => {
    if (!activeCompanyId) return;
    setLoading(true);
    const { data } = await supabase
      .from("company_reminder_settings")
      .select("*")
      .eq("company_id", activeCompanyId)
      .maybeSingle();

    setSettings(
      data
        ? (data as any as ReminderSettings)
        : { ...DEFAULTS, company_id: activeCompanyId }
    );
    setLoading(false);
  }, [activeCompanyId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const save = useCallback(
    async (updated: ReminderSettings) => {
      if (!activeCompanyId) return;
      setSaving(true);
      const payload = { ...updated, company_id: activeCompanyId };
      delete (payload as any).id;

      if (updated.id) {
        await (supabase as any)
          .from("company_reminder_settings")
          .update(payload)
          .eq("id", updated.id);
      } else {
        await (supabase as any)
          .from("company_reminder_settings")
          .insert(payload);
      }
      await fetch();
      setSaving(false);
    },
    [activeCompanyId, fetch]
  );

  return { settings, loading, saving, save, refetch: fetch };
}
