/**
 * Google Workspace helsestatus (kun synlig for admin/superadmin via RLS).
 * Leser tabellen integration_health som edge-funksjonene skriver til.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type GoogleService = "gmail" | "calendar" | "drive";
export type GoogleServiceStatus = "ok" | "needs_reconnect" | "unknown";

export interface GoogleServiceHealth {
  service: GoogleService;
  status: GoogleServiceStatus;
  errorCode: string | null;
  lastFailedAt: string | null;
  lastSuccessAt: string | null;
}

const SERVICES: GoogleService[] = ["gmail", "calendar", "drive"];

export const GOOGLE_SERVICE_LABEL: Record<GoogleService, string> = {
  gmail: "Gmail",
  calendar: "Google Kalender",
  drive: "Google Drive",
};

export function useGoogleHealth() {
  const { isAdmin, isSuperAdmin } = useAuth();
  const canSee = isAdmin || isSuperAdmin;
  const [loading, setLoading] = useState(canSee);
  const [services, setServices] = useState<GoogleServiceHealth[]>([]);

  const refresh = useCallback(async () => {
    if (!canSee) {
      setServices([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("integration_health")
      .select("service, status, error_code, last_failed_at, last_success_at")
      .eq("provider", "google");

    const byService = new Map((data ?? []).map((r) => [r.service, r]));
    setServices(
      SERVICES.map((service) => {
        const row = byService.get(service);
        const status = (row?.status as GoogleServiceStatus | undefined) ?? "unknown";
        return {
          service,
          status: status === "ok" || status === "needs_reconnect" ? status : "unknown",
          errorCode: row?.error_code ?? null,
          lastFailedAt: row?.last_failed_at ?? null,
          lastSuccessAt: row?.last_success_at ?? null,
        };
      }),
    );
    setLoading(false);
  }, [canSee]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const needsReconnect = services.some((s) => s.status === "needs_reconnect");
  const failing = services.filter((s) => s.status === "needs_reconnect");

  return { canSee, loading, services, needsReconnect, failing, refresh };
}
