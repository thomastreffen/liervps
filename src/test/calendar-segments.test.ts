import { describe, it, expect } from "vitest";
import { segmentForDay, minutesOnDay, rangeOverlapsDay } from "@/lib/calendar-segments";

function makeRange(start: string, end: string) {
  return { start: new Date(start), end: new Date(end) };
}

describe("calendar-segments — week calendar overnight rendering", () => {
  it("same-day 08:00–16:00 produces a single segment with full duration", () => {
    const range = makeRange("2026-06-30T08:00:00", "2026-06-30T16:00:00");
    const day = new Date("2026-06-30T00:00:00");

    const seg = segmentForDay(range, day);
    expect(seg).not.toBeNull();
    expect(seg!.totalDays).toBe(1);
    expect(seg!.isFirstSegment).toBe(true);
    expect(seg!.isLastSegment).toBe(true);
    expect(seg!.continuesNextDay).toBe(false);
    expect(seg!.continuedFromPrevDay).toBe(false);
    expect(minutesOnDay(range, day)).toBe(8 * 60);
  });

  it("overnight 23:00 → 06:00 renders on BOTH days with clamped capacity", () => {
    const range = makeRange("2026-06-30T23:00:00", "2026-07-01T06:00:00");
    const day1 = new Date("2026-06-30T00:00:00");
    const day2 = new Date("2026-07-01T00:00:00");
    const day3 = new Date("2026-07-02T00:00:00");

    const seg1 = segmentForDay(range, day1);
    const seg2 = segmentForDay(range, day2);
    const seg3 = segmentForDay(range, day3);

    expect(seg1).not.toBeNull();
    expect(seg2).not.toBeNull();
    expect(seg3).toBeNull();

    expect(seg1!.totalDays).toBe(2);
    expect(seg1!.continuesNextDay).toBe(true);
    expect(seg1!.continuedFromPrevDay).toBe(false);
    expect(seg1!.isFirstSegment).toBe(true);

    expect(seg2!.continuedFromPrevDay).toBe(true);
    expect(seg2!.isLastSegment).toBe(true);

    // 1h on the start day, 6h on the end day — capacity must reflect this.
    expect(minutesOnDay(range, day1)).toBe(60);
    expect(minutesOnDay(range, day2)).toBe(6 * 60);
  });

  it("multi-day 30.06 22:00 → 02.07 06:00 renders a segment per covered date", () => {
    const range = makeRange("2026-06-30T22:00:00", "2026-07-02T06:00:00");
    const days = [
      new Date("2026-06-30T00:00:00"),
      new Date("2026-07-01T00:00:00"),
      new Date("2026-07-02T00:00:00"),
      new Date("2026-07-03T00:00:00"),
    ];
    const segs = days.map((d) => segmentForDay(range, d));

    expect(segs[0]).not.toBeNull();
    expect(segs[1]).not.toBeNull();
    expect(segs[2]).not.toBeNull();
    expect(segs[3]).toBeNull();

    expect(segs[0]!.totalDays).toBe(3);
    expect(segs[0]!.segmentIndex).toBe(1);
    expect(segs[1]!.segmentIndex).toBe(2);
    expect(segs[2]!.segmentIndex).toBe(3);

    // Middle day is fully spanned (close to a full day of capacity).
    expect(minutesOnDay(range, days[1])).toBeGreaterThanOrEqual(23 * 60);
  });

  it("rangeOverlapsDay rejects unrelated days", () => {
    const range = makeRange("2026-06-30T08:00:00", "2026-06-30T10:00:00");
    expect(rangeOverlapsDay(range, new Date("2026-07-05T00:00:00"))).toBe(false);
  });

  it("segments preserve source reference so click handlers open the same block", () => {
    const range = makeRange("2026-06-30T23:00:00", "2026-07-01T06:00:00");
    const seg1 = segmentForDay(range, new Date("2026-06-30T00:00:00"));
    const seg2 = segmentForDay(range, new Date("2026-07-01T00:00:00"));
    expect(seg1!.source).toBe(range);
    expect(seg2!.source).toBe(range);
  });
});
