import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SyncHealth {
  lastSyncAt: Date | null;
  status: string | null;
  minutesAgo: number | null;
  color: "green" | "yellow" | "red";
  label: string;
}

export function useSyncHealth(enabled: boolean): SyncHealth {
  const [health, setHealth] = useState<SyncHealth>({
    lastSyncAt: null, status: null, minutesAgo: null, color: "green", label: "–",
  });

  const fetch = useCallback(async () => {
    if (!enabled) return;
    const { data, error } = await supabase
      .from("schedule_sync_runs")
      .select("started_at, status")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      setHealth({ lastSyncAt: null, status: null, minutesAgo: null, color: "red", label: "Ingen synk" });
      return;
    }

    const lastSync = new Date(data.started_at);
    const mins = Math.round((Date.now() - lastSync.getTime()) / 60_000);
    const hasError = data.status === "error";
    const color = hasError || mins > 30 ? "red" : mins > 10 ? "yellow" : "green";
    const label = `${lastSync.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" })}`;

    setHealth({ lastSyncAt: lastSync, status: data.status, minutesAgo: mins, color, label });
  }, [enabled]);

  useEffect(() => { fetch(); }, [fetch]);
  useEffect(() => {
    if (!enabled) return;
    const interval = setInterval(fetch, 60_000);
    return () => clearInterval(interval);
  }, [fetch, enabled]);

  return health;
}
