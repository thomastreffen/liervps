/**
 * Split a time range into per-day rendering segments without mutating the source.
 *
 * Used by the resource-plan week calendar so that overnight or multi-day blocks
 * appear visually on every date they cover. Pure function — drag/drop, capacity
 * counting and DB writes must still use the original start/end on the underlying
 * schedule_block / event row.
 */

export interface TimeRangeLike {
  start: Date;
  end: Date;
}

export interface DaySegment<T extends TimeRangeLike> {
  source: T;
  /** Visible start within the day (clamped to 00:00 of the day if it began earlier). */
  segmentStart: Date;
  /** Visible end within the day (clamped to 24:00 of the day if it continues). */
  segmentEnd: Date;
  /** True for the first day the range touches (= where the real start lives). */
  isFirstSegment: boolean;
  /** True for the last day the range touches (= where the real end lives). */
  isLastSegment: boolean;
  /** True when the underlying range extends past the end of this day. */
  continuesNextDay: boolean;
  /** True when the underlying range started before the beginning of this day. */
  continuedFromPrevDay: boolean;
  /** Total day count the range spans (>=1). */
  totalDays: number;
  /** 1-indexed position of this segment within the span. */
  segmentIndex: number;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

/**
 * Returns true if `range` overlaps the local-time day represented by `day`.
 */
export function rangeOverlapsDay(range: TimeRangeLike, day: Date): boolean {
  const dayStart = startOfDay(day).getTime();
  const dayEnd = endOfDay(day).getTime() + 1; // exclusive
  return range.start.getTime() < dayEnd && range.end.getTime() > dayStart;
}

/**
 * Build the rendering segment for `range` on `day`, or null if it doesn't overlap.
 */
export function segmentForDay<T extends TimeRangeLike>(range: T, day: Date): DaySegment<T> | null {
  if (!rangeOverlapsDay(range, day)) return null;

  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);

  const segmentStart = range.start.getTime() < dayStart.getTime() ? dayStart : range.start;
  const segmentEnd = range.end.getTime() > dayEnd.getTime() ? dayEnd : range.end;

  const firstDay = startOfDay(range.start);
  const lastDay = startOfDay(range.end);
  const totalDays =
    Math.round((lastDay.getTime() - firstDay.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  const segmentIndex =
    Math.round((dayStart.getTime() - firstDay.getTime()) / (24 * 60 * 60 * 1000)) + 1;

  return {
    source: range,
    segmentStart,
    segmentEnd,
    isFirstSegment: dayStart.getTime() === firstDay.getTime(),
    isLastSegment: dayStart.getTime() === lastDay.getTime(),
    continuesNextDay: range.end.getTime() > dayEnd.getTime(),
    continuedFromPrevDay: range.start.getTime() < dayStart.getTime(),
    totalDays,
    segmentIndex,
  };
}

/**
 * Clamped minute count for `range` on `day` — used by capacity calculations
 * so a 23:00 → 06:00 block contributes 1h on day 1 and 6h on day 2.
 */
export function minutesOnDay(range: TimeRangeLike, day: Date): number {
  const seg = segmentForDay(range, day);
  if (!seg) return 0;
  return Math.max(
    0,
    Math.round((seg.segmentEnd.getTime() - seg.segmentStart.getTime()) / 60000),
  );
}
