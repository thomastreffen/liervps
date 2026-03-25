import { useMemo } from "react";
import { startOfWeek, addDays, format } from "date-fns";
import type { CalendarEvent } from "@/hooks/useCalendarEvents";
import type { TechDayCapacity } from "@/hooks/useCapacity";

/** A gap of free time for a specific technician on a specific day */
export interface CapacityGap {
  techId: string;
  techName: string;
  date: Date;
  dayKey: string;
  startHour: number; // decimal, e.g. 10.5 = 10:30
  endHour: number;
  durationMinutes: number;
}

export interface CapacityGapsSummary {
  /** Total unused minutes across all techs this week */
  totalUnusedMinutes: number;
  /** Number of techs with significant free time (>2h/day unused) */
  underutilizedTechCount: number;
  /** Top gaps (sorted by duration desc) */
  topGaps: CapacityGap[];
  /** Gaps grouped by tech */
  gapsByTech: Map<string, CapacityGap[]>;
}

const WORK_START = 7; // 07:00
const WORK_END = 16; // 16:00
const MIN_GAP_MINUTES = 60; // Only show gaps >= 1h

/**
 * Analyzes calendar events to find gaps (unused capacity) in technicians' schedules.
 * Uses a simple interval-based approach: for each tech+day, find free slots
 * between work hours that aren't covered by events.
 */
export function useCapacityGaps(
  events: CalendarEvent[],
  techCapacities: TechDayCapacity[],
  technicianMap: Map<string, { name: string; color: string | null }>,
  referenceDate: Date,
): CapacityGapsSummary {
  return useMemo(() => {
    const weekStart = startOfWeek(referenceDate, { weekStartsOn: 1 });
    const now = new Date();
    const gaps: CapacityGap[] = [];
    let totalUnusedMinutes = 0;
    const gapsByTech = new Map<string, CapacityGap[]>();

    // Build event intervals per tech per day
    const techDayIntervals = new Map<string, Array<{ start: number; end: number }>>();

    for (const ev of events) {
      for (const tech of ev.technicians) {
        for (let d = 0; d < 5; d++) { // Mon-Fri only
          const day = addDays(weekStart, d);
          const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
          const dayEnd = new Date(dayStart);
          dayEnd.setDate(dayEnd.getDate() + 1);

          // Check if event overlaps this day
          if (ev.end <= dayStart || ev.start >= dayEnd) continue;

          const clampedStart = Math.max(ev.start.getTime(), dayStart.getTime());
          const clampedEnd = Math.min(ev.end.getTime(), dayEnd.getTime());

          const startHour = (clampedStart - dayStart.getTime()) / (1000 * 60 * 60);
          const endHour = (clampedEnd - dayStart.getTime()) / (1000 * 60 * 60);

          // Clamp to work hours
          const s = Math.max(startHour, WORK_START);
          const e = Math.min(endHour, WORK_END);
          if (s >= e) continue;

          const key = `${tech.id}|${d}`;
          if (!techDayIntervals.has(key)) techDayIntervals.set(key, []);
          techDayIntervals.get(key)!.push({ start: s, end: e });
        }
      }
    }

    // For each tech, for each day, find gaps
    const underutilizedTechs = new Set<string>();

    for (const tc of techCapacities) {
      const techInfo = technicianMap.get(tc.techId);
      if (!techInfo) continue;

      let techWeekUnused = 0;

      for (let d = 0; d < 5; d++) {
        const day = addDays(weekStart, d);

        // Skip past days (only show today + future)
        if (day < new Date(now.getFullYear(), now.getMonth(), now.getDate())) continue;

        const key = `${tc.techId}|${d}`;
        const intervals = techDayIntervals.get(key) || [];

        // Sort intervals by start
        intervals.sort((a, b) => a.start - b.start);

        // Merge overlapping intervals
        const merged: Array<{ start: number; end: number }> = [];
        for (const iv of intervals) {
          if (merged.length > 0 && iv.start <= merged[merged.length - 1].end) {
            merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, iv.end);
          } else {
            merged.push({ ...iv });
          }
        }

        // Find gaps between WORK_START and WORK_END
        let cursor = WORK_START;
        const dayKey = format(day, "yyyy-MM-dd");

        for (const iv of merged) {
          if (iv.start > cursor) {
            const durationMin = Math.round((iv.start - cursor) * 60);
            if (durationMin >= MIN_GAP_MINUTES) {
              const gap: CapacityGap = {
                techId: tc.techId,
                techName: techInfo.name,
                date: day,
                dayKey,
                startHour: cursor,
                endHour: iv.start,
                durationMinutes: durationMin,
              };
              gaps.push(gap);
              totalUnusedMinutes += durationMin;
              techWeekUnused += durationMin;
              if (!gapsByTech.has(tc.techId)) gapsByTech.set(tc.techId, []);
              gapsByTech.get(tc.techId)!.push(gap);
            }
          }
          cursor = Math.max(cursor, iv.end);
        }

        // Gap after last event until WORK_END
        if (cursor < WORK_END) {
          const durationMin = Math.round((WORK_END - cursor) * 60);
          if (durationMin >= MIN_GAP_MINUTES) {
            const gap: CapacityGap = {
              techId: tc.techId,
              techName: techInfo.name,
              date: day,
              dayKey,
              startHour: cursor,
              endHour: WORK_END,
              durationMinutes: durationMin,
            };
            gaps.push(gap);
            totalUnusedMinutes += durationMin;
            techWeekUnused += durationMin;
            if (!gapsByTech.has(tc.techId)) gapsByTech.set(tc.techId, []);
            gapsByTech.get(tc.techId)!.push(gap);
          }
        }
      }

      // Underutilized: more than 2h/day avg unused (10h+ in remaining week)
      if (techWeekUnused >= 120) {
        underutilizedTechs.add(tc.techId);
      }
    }

    // Sort gaps by duration desc
    gaps.sort((a, b) => b.durationMinutes - a.durationMinutes);

    return {
      totalUnusedMinutes,
      underutilizedTechCount: underutilizedTechs.size,
      topGaps: gaps.slice(0, 10),
      gapsByTech,
    };
  }, [events, techCapacities, technicianMap, referenceDate]);
}
