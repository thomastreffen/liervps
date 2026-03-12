import { useMemo } from "react";
import { startOfWeek, addDays } from "date-fns";
import type { CalendarEvent } from "@/hooks/useCalendarEvents";
import type { ExternalBusySlot } from "@/hooks/useExternalBusy";

const DEFAULT_WORK_DAY_MINUTES = 480; // 8h (08:00–16:00)
const MIRROR_TOLERANCE_MINUTES = 5;

type Interval = {
  startMs: number;
  endMs: number;
};

export interface DayCapacity {
  date: Date;
  bookedMinutes: number;
  externalMinutes: number;
  totalMinutes: number;
  percent: number;
  color: string;
  label: string;
}

export interface TechDayCapacity {
  techId: string;
  days: DayCapacity[];
  weekPercent: number;
}

function capacityColor(percent: number): string {
  if (percent > 100) return "#7F1D1D"; // dark red
  if (percent >= 90) return "#DC2626";  // red
  if (percent >= 50) return "#F59E0B";  // yellow/amber
  return "#22C55E"; // green
}

function capacityLabel(percent: number): string {
  if (percent > 100) return "Overbooket";
  if (percent >= 90) return "Full dag";
  if (percent >= 50) return `${Math.round(percent)}%`;
  if (percent > 0) return `${Math.round(percent)}%`;
  return "Ledig";
}

function toDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normalizeInterval(start: Date, end: Date): Interval {
  const startMs = start.getTime();
  let endMs = end.getTime();

  if (endMs <= startMs) {
    endMs += 24 * 60 * 60 * 1000;
  }

  return { startMs, endMs };
}

function splitIntervalByDay(start: Date, end: Date): Array<{ dayKey: string; minutes: number }> {
  const normalized = normalizeInterval(start, end);
  const chunks: Array<{ dayKey: string; minutes: number }> = [];

  let cursor = normalized.startMs;
  while (cursor < normalized.endMs) {
    const cursorDate = new Date(cursor);
    const dayStart = new Date(cursorDate.getFullYear(), cursorDate.getMonth(), cursorDate.getDate());
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const segmentEnd = Math.min(normalized.endMs, dayEnd.getTime());
    const minutes = Math.max(0, Math.round((segmentEnd - cursor) / 60000));

    if (minutes > 0) {
      chunks.push({ dayKey: toDayKey(dayStart), minutes });
    }

    cursor = segmentEnd;
  }

  return chunks;
}

function roundToMinute(ms: number): number {
  return Math.round(ms / 60000);
}

function overlapMinutes(a: Interval, b: Interval): number {
  const overlapStart = Math.max(a.startMs, b.startMs);
  const overlapEnd = Math.min(a.endMs, b.endMs);
  return Math.max(0, roundToMinute(overlapEnd - overlapStart));
}

function isLikelyMirrored(slot: Interval, internal: Interval): boolean {
  const slotMinutes = roundToMinute(slot.endMs - slot.startMs);
  const internalMinutes = roundToMinute(internal.endMs - internal.startMs);
  if (slotMinutes <= 0 || internalMinutes <= 0) return false;

  const overlap = overlapMinutes(slot, internal);
  const minDuration = Math.min(slotMinutes, internalMinutes);
  const overlapRatio = minDuration > 0 ? overlap / minDuration : 0;

  const closeStart = Math.abs(roundToMinute(slot.startMs - internal.startMs)) <= MIRROR_TOLERANCE_MINUTES;
  const closeEnd = Math.abs(roundToMinute(slot.endMs - internal.endMs)) <= MIRROR_TOLERANCE_MINUTES;

  return overlapRatio >= 0.95 || (closeStart && closeEnd);
}

export function useCapacity(
  events: CalendarEvent[],
  busySlots: ExternalBusySlot[],
  referenceDate: Date,
  technicianIds: string[],
  workDayMinutes: number = DEFAULT_WORK_DAY_MINUTES
) {
  return useMemo(() => {
    const weekStart = startOfWeek(referenceDate, { weekStartsOn: 1 });
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const weekDayKeys = new Set(weekDays.map((d) => toDayKey(d)));

    const internalByTechByDay = new Map<string, Map<string, number>>();
    const internalIntervalsByTech = new Map<string, Interval[]>();

    // 1) Deduplicated internal load, split by day
    const seenInternal = new Set<string>();
    for (const ev of events) {
      const normalized = normalizeInterval(ev.start, ev.end);

      for (const tech of ev.technicians) {
        const techId = tech.id;
        const internalKey = `${ev.id}|${techId}|${roundToMinute(normalized.startMs)}|${roundToMinute(normalized.endMs)}`;
        if (seenInternal.has(internalKey)) continue;
        seenInternal.add(internalKey);

        if (!internalByTechByDay.has(techId)) internalByTechByDay.set(techId, new Map());
        if (!internalIntervalsByTech.has(techId)) internalIntervalsByTech.set(techId, []);

        internalIntervalsByTech.get(techId)!.push(normalized);

        const chunks = splitIntervalByDay(ev.start, ev.end);
        const dayMap = internalByTechByDay.get(techId)!;

        for (const chunk of chunks) {
          if (!weekDayKeys.has(chunk.dayKey)) continue;
          dayMap.set(chunk.dayKey, (dayMap.get(chunk.dayKey) || 0) + chunk.minutes);
        }
      }
    }

    const externalByTechByDay = new Map<string, Map<string, number>>();

    // 2) Deduplicated external busy load, split by day, excluding mirrored internal events
    const seenExternal = new Set<string>();
    for (const slot of busySlots) {
      const normalized = normalizeInterval(slot.start, slot.end);
      const externalKey = `${slot.technicianId}|${roundToMinute(normalized.startMs)}|${roundToMinute(normalized.endMs)}`;
      if (seenExternal.has(externalKey)) continue;
      seenExternal.add(externalKey);

      const internalIntervals = internalIntervalsByTech.get(slot.technicianId) || [];
      const mirrored = internalIntervals.some((internal) => isLikelyMirrored(normalized, internal));
      if (mirrored) continue;

      if (!externalByTechByDay.has(slot.technicianId)) externalByTechByDay.set(slot.technicianId, new Map());
      const dayMap = externalByTechByDay.get(slot.technicianId)!;

      const chunks = splitIntervalByDay(slot.start, slot.end);
      for (const chunk of chunks) {
        if (!weekDayKeys.has(chunk.dayKey)) continue;
        dayMap.set(chunk.dayKey, (dayMap.get(chunk.dayKey) || 0) + chunk.minutes);
      }
    }

    // Per-tech capacity
    const techCapacities: TechDayCapacity[] = technicianIds.map((techId) => {
      const days: DayCapacity[] = [];
      let weekTotal = 0;

      const internalDayMap = internalByTechByDay.get(techId) || new Map<string, number>();
      const externalDayMap = externalByTechByDay.get(techId) || new Map<string, number>();

      for (let i = 0; i < 7; i++) {
        const day = addDays(weekStart, i);
        const dayKey = toDayKey(day);

        const bookedMinutes = internalDayMap.get(dayKey) || 0;
        const externalMinutes = externalDayMap.get(dayKey) || 0;

        const totalMinutes = bookedMinutes + externalMinutes;
        const percent = (totalMinutes / workDayMinutes) * 100;

        days.push({
          date: day,
          bookedMinutes,
          externalMinutes,
          totalMinutes,
          percent,
          color: capacityColor(percent),
          label: capacityLabel(percent),
        });

        weekTotal += totalMinutes;
      }

      const weekPercent = (weekTotal / (5 * workDayMinutes)) * 100; // 5 work days

      return { techId, days, weekPercent };
    });

    // Aggregated day capacity (all techs or filtered)
    const aggregatedDays: DayCapacity[] = [];
    for (let i = 0; i < 7; i++) {
      const day = addDays(weekStart, i);

      let totalBooked = 0;
      let totalExternal = 0;

      for (const techCap of techCapacities) {
        const d = techCap.days[i];
        totalBooked += d.bookedMinutes;
        totalExternal += d.externalMinutes;
      }

      const totalMinutes = totalBooked + totalExternal;
      const totalCapacity = technicianIds.length * workDayMinutes;
      const percent = totalCapacity > 0 ? (totalMinutes / totalCapacity) * 100 : 0;

      aggregatedDays.push({
        date: day,
        bookedMinutes: totalBooked,
        externalMinutes: totalExternal,
        totalMinutes,
        percent,
        color: capacityColor(percent),
        label: capacityLabel(percent),
      });
    }

    // Filter helpers
    const availableTechIds = (dayIndex: number) =>
      techCapacities
        .filter((tc) => tc.days[dayIndex].percent < 50)
        .map((tc) => tc.techId);

    const partialTechIds = (dayIndex: number) =>
      techCapacities
        .filter((tc) => tc.days[dayIndex].percent >= 50 && tc.days[dayIndex].percent < 90)
        .map((tc) => tc.techId);

    return {
      techCapacities,
      aggregatedDays,
      availableTechIds,
      partialTechIds,
    };
  }, [events, busySlots, referenceDate, technicianIds, workDayMinutes]);
}
