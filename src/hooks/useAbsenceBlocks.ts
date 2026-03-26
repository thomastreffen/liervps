import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { startOfWeek, endOfWeek, eachDayOfInterval, format } from "date-fns";
import type { AbsenceType } from "@/hooks/useAbsenceRequests";

export interface AbsenceBlock {
  id: string;
  absenceRequestId: string;
  technicianId: string;
  technicianName: string;
  absenceType: AbsenceType;
  label: string;
  date: Date;
  isFullDay: boolean;
  startTime: string | null;
  endTime: string | null;
  comment: string | null;
}

const ABSENCE_LABELS: Record<string, string> = {
  ferie: "Ferie",
  egenmelding: "Egenmelding",
  sykemelding: "Sykemelding",
  avspasering: "Avspasering",
  permisjon: "Permisjon",
  kurs: "Kurs",
  annet: "Fravær",
};

/**
 * Fetches approved absence requests for the visible week
 * and maps person_id → technician_id for calendar rendering.
 */
export function useAbsenceBlocks(
  referenceDate: Date,
  technicianId?: string | null,
  companyId?: string | null,
  allowedCompanyIds?: string[]
) {
  const [blocks, setBlocks] = useState<AbsenceBlock[]>([]);
  const [loading, setLoading] = useState(false);

  const weekStart = useMemo(
    () => startOfWeek(referenceDate, { weekStartsOn: 1 }),
    [referenceDate.toDateString()]
  );
  const weekEnd = useMemo(
    () => endOfWeek(referenceDate, { weekStartsOn: 1 }),
    [referenceDate.toDateString()]
  );

  const rangeStartStr = format(weekStart, "yyyy-MM-dd");
  const rangeEndStr = format(weekEnd, "yyyy-MM-dd");

  const fetchBlocks = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch approved absence requests overlapping the visible range
      let query = supabase
        .from("absence_requests")
        .select("id, person_id, absence_type, start_date, end_date, start_time, end_time, is_full_day, comment, company_id")
        .eq("status", "approved")
        .lte("start_date", rangeEndStr)
        .gte("end_date", rangeStartStr);

      if (companyId) {
        query = query.eq("company_id", companyId);
      } else if (allowedCompanyIds && allowedCompanyIds.length > 0) {
        query = query.in("company_id", allowedCompanyIds);
      }

      const { data: absences, error } = await query;
      if (error || !absences || absences.length === 0) {
        setBlocks([]);
        setLoading(false);
        return;
      }

      // 2. Map person_id → technician. Try two strategies:
      //    A) person_id IS the technician_id directly (people table shares IDs with technicians)
      //    B) person_id → user_accounts.person_id → auth_user_id → technicians.user_id
      const personIds = [...new Set(absences.map((a: any) => a.person_id))];

      // Strategy A: direct match person_id = technician.id
      const { data: directTechs } = await supabase
        .from("technicians")
        .select("id, name")
        .is("archived_at", null)
        .in("id", personIds);

      const personToTech = new Map<string, { id: string; name: string }>();
      if (directTechs) {
        for (const t of directTechs) {
          personToTech.set(t.id, { id: t.id, name: t.name });
        }
      }

      // Strategy B: for unmatched person_ids, try via user_accounts
      const unmatchedIds = personIds.filter((pid) => !personToTech.has(pid));
      if (unmatchedIds.length > 0) {
        const { data: accounts } = await supabase
          .from("user_accounts")
          .select("person_id, auth_user_id")
          .in("person_id", unmatchedIds)
          .eq("is_active", true);

        if (accounts && accounts.length > 0) {
          const authUserIds = accounts.map((a: any) => a.auth_user_id).filter(Boolean);
          const { data: indirectTechs } = await supabase
            .from("technicians")
            .select("id, name, user_id")
            .is("archived_at", null)
            .in("user_id", authUserIds);

          if (indirectTechs) {
            const authToTech = new Map(indirectTechs.map((t: any) => [t.user_id, { id: t.id, name: t.name }]));
            for (const acc of accounts) {
              const tech = authToTech.get(acc.auth_user_id);
              if (tech) personToTech.set(acc.person_id, tech);
            }
          }
        }
      }

      if (personToTech.size === 0) {
        setBlocks([]);
        setLoading(false);
        return;
      }

      const result: AbsenceBlock[] = [];

      for (const absence of absences) {
        const authUserId = personToAuth.get(absence.person_id);
        if (!authUserId) continue;
        const tech = authToTech.get(authUserId);
        if (!tech) continue;

        // Filter by technician if specified
        if (technicianId && tech.id !== technicianId) continue;

        // Generate a block for each day in the absence range that overlaps the visible week
        const absStart = new Date(absence.start_date + "T00:00:00");
        const absEnd = new Date(absence.end_date + "T00:00:00");
        const rangeStart = absStart < weekStart ? weekStart : absStart;
        const rangeEnd = absEnd > weekEnd ? weekEnd : absEnd;

        const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });

        for (const day of days) {
          result.push({
            id: `absence-${absence.id}-${format(day, "yyyy-MM-dd")}`,
            absenceRequestId: absence.id,
            technicianId: tech.id,
            technicianName: tech.name,
            absenceType: absence.absence_type as AbsenceType,
            label: ABSENCE_LABELS[absence.absence_type] || "Fravær",
            date: day,
            isFullDay: absence.is_full_day,
            startTime: absence.start_time,
            endTime: absence.end_time,
            comment: absence.comment,
          });
        }
      }

      setBlocks(result);
    } catch (err) {
      console.error("[AbsenceBlocks] Fetch error:", err);
      setBlocks([]);
    } finally {
      setLoading(false);
    }
  }, [rangeStartStr, rangeEndStr, technicianId, companyId, allowedCompanyIds?.join(",")]);

  useEffect(() => {
    fetchBlocks();
  }, [fetchBlocks]);

  return { absenceBlocks: blocks, loading, refetch: fetchBlocks };
}
