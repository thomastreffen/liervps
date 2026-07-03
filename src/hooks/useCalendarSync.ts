import { useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Hook for syncing internal events to Google Calendar.
 *
 * - Local save always happens first (caller responsibility).
 * - If the current user has not connected Google Calendar yet, we show a
 *   single non-blocking toast per session and continue.
 * - On real errors, we show a toast; we never delete the local activity.
 *
 * Legacy `forceUpdate` / `acceptGraphVersion` / `conflict` fields are kept
 * as no-ops so existing call sites (ResourcePlan, EventDrawer) keep compiling
 * without touching every reference — Google flow does not have Outlook-style
 * write conflicts yet.
 */
export interface GraphConflict {
  eventId: string;
  graphVersion: { start: string; end: string; subject: string } | null;
}

type SyncStatus = "synced" | "no_token" | "error" | "unknown";

export function useCalendarSync() {
  // Only show "not connected" toast once per browser session
  const noTokenToastShown = useRef(false);

  const notifyNoToken = useCallback(() => {
    if (noTokenToastShown.current) return;
    noTokenToastShown.current = true;
    toast.info("Lagret lokalt. Google Kalender er ikke koblet til ennå.", {
      description: "Koble til Google under Innstillinger → Integrasjoner for automatisk kalender-synk.",
      duration: 6000,
    });
  }, []);

  const invoke = useCallback(async (action: "create" | "update" | "delete", eventId: string): Promise<SyncStatus> => {
    try {
      const { data, error } = await supabase.functions.invoke("google-calendar-sync", {
        body: { action, event_id: eventId },
      });
      if (error) {
        console.error("[GoogleCalendar] invoke error:", error);
        toast.error("Google Kalender-synk feilet", { description: error.message });
        return "error";
      }
      if (data?.status === "no_token") {
        notifyNoToken();
        return "no_token";
      }
      if (data?.status === "created" || data?.status === "updated" || data?.status === "deleted" || data?.status === "not_found") {
        return "synced";
      }
      if (data?.status === "error") {
        console.error("[GoogleCalendar] error:", data);
        toast.error("Google Kalender-synk feilet", {
          description: `Kode ${data.code}: ${data.detail ?? ""}`.trim(),
        });
        return "error";
      }
      return "unknown";
    } catch (err: any) {
      console.error("[GoogleCalendar] exception:", err);
      toast.error("Google Kalender-synk feilet", { description: err?.message });
      return "error";
    }
  }, [notifyNoToken]);

  const syncCreate = useCallback((eventId: string) => { void invoke("create", eventId); }, [invoke]);
  const syncUpdate = useCallback((eventId: string) => invoke("update", eventId), [invoke]);
  const syncDelete = useCallback((eventId: string) => invoke("delete", eventId), [invoke]);

  // Legacy Outlook conflict API — no-ops now.
  const forceUpdate = useCallback((_eventId: string) => { /* Google has no conflict flow */ }, []);
  const acceptGraphVersion = useCallback(async (_eventId: string, _start: string, _end: string) => { /* no-op */ }, []);
  const dismissConflict = useCallback(() => { /* no-op */ }, []);

  return {
    syncCreate,
    syncUpdate,
    syncDelete,
    forceUpdate,
    acceptGraphVersion,
    conflict: null as GraphConflict | null,
    dismissConflict,
  };
}
