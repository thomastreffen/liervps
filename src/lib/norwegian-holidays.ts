/**
 * Norwegian public holidays (bevegelige og faste).
 * Beregner for et gitt år.
 */

function getEasterSunday(year: number): Date {
  // Meeus/Jones/Butcher algorithm
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number): Date {
  const r = new Date(date);
  r.setDate(r.getDate() + days);
  return r;
}

export interface NorwegianHoliday {
  date: Date;
  name: string;
}

export function getNorwegianHolidays(year: number): NorwegianHoliday[] {
  const easter = getEasterSunday(year);

  return [
    { date: new Date(year, 0, 1), name: "Nyttårsdag" },
    { date: addDays(easter, -3), name: "Skjærtorsdag" },
    { date: addDays(easter, -2), name: "Langfredag" },
    { date: easter, name: "1. påskedag" },
    { date: addDays(easter, 1), name: "2. påskedag" },
    { date: new Date(year, 4, 1), name: "Arbeidernes dag" },
    { date: new Date(year, 4, 17), name: "Grunnlovsdag" },
    { date: addDays(easter, 39), name: "Kristi himmelfartsdag" },
    { date: addDays(easter, 49), name: "1. pinsedag" },
    { date: addDays(easter, 50), name: "2. pinsedag" },
    { date: new Date(year, 11, 25), name: "1. juledag" },
    { date: new Date(year, 11, 26), name: "2. juledag" },
  ];
}

const cache = new Map<number, Map<string, string>>();

export function getHolidayName(date: Date): string | null {
  const y = date.getFullYear();
  if (!cache.has(y)) {
    const map = new Map<string, string>();
    for (const h of getNorwegianHolidays(y)) {
      map.set(h.date.toDateString(), h.name);
    }
    cache.set(y, map);
  }
  return cache.get(y)!.get(date.toDateString()) ?? null;
}
