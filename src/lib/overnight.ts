import { addDays, format } from "date-fns";

/**
 * Normalize start/end datetime for overnight jobs.
 * If end <= start (same day with end time before start time), bumps end_date by 1 day.
 * Returns ISO strings ready for database insertion.
 */
export function normalizeOvernightDates(
  startDate: string,
  startTime: string,
  endDate: string,
  endTime: string
): { startISO: string; endISO: string; isOvernight: boolean } {
  const start = new Date(`${startDate}T${startTime}`);
  let end = new Date(`${endDate}T${endTime}`);

  const isOvernight = end.getTime() <= start.getTime();

  if (isOvernight) {
    // Bump end to next day
    end = new Date(`${startDate}T${endTime}`);
    end = addDays(end, 1);
  }

  return {
    startISO: start.toISOString(),
    endISO: end.toISOString(),
    isOvernight,
  };
}

/**
 * Detect if a time range crosses midnight.
 * Used in UI to show "Går over midnatt" label.
 */
export function isOvernightRange(startDate: string, startTime: string, endDate: string, endTime: string): boolean {
  if (!startDate || !startTime || !endDate || !endTime) return false;
  const start = new Date(`${startDate}T${startTime}`);
  const end = new Date(`${endDate}T${endTime}`);
  return end.getTime() <= start.getTime();
}

/**
 * Auto-adjust end date when user changes time inputs.
 * Returns the corrected end date string (yyyy-MM-dd).
 */
export function autoAdjustEndDate(startDate: string, startTime: string, endTime: string): string {
  if (!startDate || !startTime || !endTime) return startDate;
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  if (endMinutes <= startMinutes) {
    return format(addDays(new Date(startDate), 1), "yyyy-MM-dd");
  }
  return startDate;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}
