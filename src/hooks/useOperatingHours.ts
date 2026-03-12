import { useMemo } from "react";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

export type OperatingProfile = "office" | "extended" | "industry";
export type ZoomLevel = "compact" | "normal" | "detailed";

const PROFILE_HOURS: Record<OperatingProfile, { start: string; end: string; startHour: number; endHour: number; dayMinutes: number }> = {
  office:   { start: "08:00:00", end: "16:00:00", startHour: 8,  endHour: 16, dayMinutes: 480 },
  extended: { start: "06:00:00", end: "22:00:00", startHour: 6,  endHour: 22, dayMinutes: 480 },
  industry: { start: "00:00:00", end: "24:00:00", startHour: 0,  endHour: 24, dayMinutes: 480 },
};

const ZOOM_DURATIONS: Record<ZoomLevel, string> = {
  compact:  "01:00:00",
  normal:   "00:30:00",
  detailed: "00:15:00",
};

export interface OperatingHours {
  profile: OperatingProfile;
  slotMinTime: string;
  slotMaxTime: string;
  startHour: number;
  endHour: number;
  /** Standard work day minutes for capacity calculation (always 8h) */
  workDayMinutes: number;
  slotDuration: string;
  zoom: ZoomLevel;
  setZoom: (z: ZoomLevel) => void;
  /** Whether to show night shading (true for extended/industry) */
  hasNightHours: boolean;
}

const ZOOM_STORAGE_KEY = "resourcePlanZoom";

function getStoredZoom(): ZoomLevel {
  try {
    const v = localStorage.getItem(ZOOM_STORAGE_KEY);
    if (v === "compact" || v === "normal" || v === "detailed") return v;
  } catch {}
  return "normal";
}

export function useOperatingHours(): OperatingHours {
  const { activeCompanyId } = useCompanyContext();
  const [profile, setProfile] = useState<OperatingProfile>("office");
  const [zoom, setZoomState] = useState<ZoomLevel>(getStoredZoom);

  useEffect(() => {
    if (!activeCompanyId) return;
    supabase
      .from("internal_companies")
      .select("operating_profile")
      .eq("id", activeCompanyId)
      .single()
      .then(({ data }) => {
        const p = (data as any)?.operating_profile;
        if (p === "office" || p === "extended" || p === "industry") {
          setProfile(p);
        }
      });
  }, [activeCompanyId]);

  const setZoom = (z: ZoomLevel) => {
    setZoomState(z);
    localStorage.setItem(ZOOM_STORAGE_KEY, z);
  };

  const hours = PROFILE_HOURS[profile];

  return useMemo(() => ({
    profile,
    slotMinTime: hours.start,
    slotMaxTime: hours.end,
    startHour: hours.startHour,
    endHour: hours.endHour,
    workDayMinutes: hours.dayMinutes,
    slotDuration: ZOOM_DURATIONS[zoom],
    zoom,
    setZoom,
    hasNightHours: profile !== "office",
  }), [profile, zoom, hours]);
}
