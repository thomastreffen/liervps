import { useMemo } from "react";
import { addDays, startOfWeek, format, isSameDay } from "date-fns";
import { nb } from "date-fns/locale";
import { Palmtree, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CalendarEvent, TechnicianInfo } from "@/hooks/useCalendarEvents";
import type { AbsenceBlock } from "@/hooks/useAbsenceBlocks";
import type { TechDayCapacity } from "@/hooks/useCapacity";
import { JOB_STATUS_CONFIG } from "@/lib/job-status";

interface TechMeta {
  name: string;
  color: string | null;
  avatarId?: string | null;
}

interface TeamViewProps {
  referenceDate: Date;
  technicians: Array<{ id: string; name: string; color?: string | null }>;
  technicianMap: Map<string, TechMeta>;
  events: CalendarEvent[];
  absenceBlocks: AbsenceBlock[];
  techCapacities?: TechDayCapacity[];
  onEventClick?: (eventId: string) => void;
  onCellCreate?: (techId: string, day: Date) => void;
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

function fmtHM(d: Date) {
  return format(d, "H");
}

function utilTone(p: number): "ok" | "warn" | "over" {
  if (p > 100) return "over";
  if (p >= 80) return "warn";
  return "ok";
}

function statusColors(status: string) {
  // Map execution-ish statuses to colour groups; fall back to "Planlagt" blue
  const cfg = (JOB_STATUS_CONFIG as any)[status];
  switch (status) {
    case "approved":
      return { bg: "bg-teal-500/15", border: "border-l-teal-500", text: "text-teal-900 dark:text-teal-100" };
    case "in_progress":
      return { bg: "bg-amber-500/15", border: "border-l-amber-500", text: "text-amber-900 dark:text-amber-100" };
    case "rejected":
      return { bg: "bg-red-500/15", border: "border-l-red-500", text: "text-red-900 dark:text-red-100" };
    case "completed":
    case "ready_for_invoicing":
    case "invoiced":
      return { bg: "bg-emerald-500/15", border: "border-l-emerald-500", text: "text-emerald-900 dark:text-emerald-100" };
    default:
      return { bg: "bg-blue-500/15", border: "border-l-blue-500", text: "text-blue-900 dark:text-blue-100" };
  }
}

interface CellEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  status: string;
}

export function TeamView({
  referenceDate,
  technicians,
  technicianMap,
  events,
  absenceBlocks,
  techCapacities,
  onEventClick,
  onCellCreate,
}: TeamViewProps) {
  const weekStart = useMemo(
    () => startOfWeek(referenceDate, { weekStartsOn: 1 }),
    [referenceDate.toDateString()]
  );
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  // Build per-tech per-day index of events
  const eventsByTechDay = useMemo(() => {
    const map = new Map<string, CellEvent[]>();
    const push = (techId: string, day: Date, e: CellEvent) => {
      const key = `${techId}__${format(day, "yyyy-MM-dd")}`;
      const arr = map.get(key) || [];
      arr.push(e);
      map.set(key, arr);
    };
    for (const ev of events) {
      for (const t of ev.technicians as TechnicianInfo[]) {
        const start = t.startAt || ev.start;
        const end = t.endAt || ev.end;
        if (!start || !end) continue;
        for (const day of days) {
          if (isSameDay(start, day) || (start < day && end > day)) {
            push(t.id, day, {
              id: ev.id,
              title: ev.title || ev.customer || "Oppdrag",
              start,
              end,
              status: ev.status as string,
            });
          }
        }
      }
    }
    // sort by start time
    for (const arr of map.values()) arr.sort((a, b) => a.start.getTime() - b.start.getTime());
    return map;
  }, [events, days]);

  const absencesByTechDay = useMemo(() => {
    const map = new Map<string, AbsenceBlock[]>();
    for (const b of absenceBlocks) {
      const key = `${b.technicianId}__${format(b.date, "yyyy-MM-dd")}`;
      const arr = map.get(key) || [];
      arr.push(b);
      map.set(key, arr);
    }
    return map;
  }, [absenceBlocks]);

  const capByTech = useMemo(() => {
    const map = new Map<string, TechDayCapacity>();
    for (const tc of techCapacities || []) map.set(tc.techId, tc);
    return map;
  }, [techCapacities]);

  return (
    <div className="overflow-auto rounded-lg border border-border bg-background">
      <div className="min-w-[920px]">
        {/* Header row */}
        <div className="grid sticky top-0 z-10 bg-background border-b border-border" style={{ gridTemplateColumns: "140px repeat(7, minmax(0,1fr))" }}>
          <div className="px-3 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Team</div>
          {days.map((d) => {
            const dow = d.getDay();
            const isWeekend = dow === 0 || dow === 6;
            return (
              <div
                key={d.toISOString()}
                className={cn(
                  "px-2 py-2 text-center border-l border-border",
                  isWeekend && "bg-muted/40"
                )}
              >
                <div className="text-[11px] font-medium text-muted-foreground capitalize">
                  {format(d, "EEE", { locale: nb })}
                </div>
                <div className="text-sm font-semibold text-foreground">{format(d, "d")}</div>
              </div>
            );
          })}
        </div>

        {/* Tech rows */}
        {technicians.map((t) => {
          const meta = technicianMap.get(t.id);
          const color = meta?.color || t.color || "hsl(var(--primary))";
          const tc = capByTech.get(t.id);
          return (
            <div
              key={t.id}
              className="grid border-b border-border last:border-b-0"
              style={{ gridTemplateColumns: "140px repeat(7, minmax(0,1fr))" }}
            >
              {/* Tech cell */}
              <div className="px-3 py-2 flex items-center gap-2 bg-muted/20">
                <div
                  className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                  style={{ backgroundColor: color }}
                >
                  {initials(t.name)}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold truncate text-foreground">{t.name}</div>
                  {tc && (
                    <div className="text-[10px] text-muted-foreground">
                      {Math.round(tc.weekPlannedHours)}/{Math.round(tc.weekCapacityHours)}t
                    </div>
                  )}
                </div>
              </div>

              {/* Day cells */}
              {days.map((day) => {
                const dow = day.getDay();
                const isWeekend = dow === 0 || dow === 6;
                const key = `${t.id}__${format(day, "yyyy-MM-dd")}`;
                const cellEvents = eventsByTechDay.get(key) || [];
                const cellAbsences = absencesByTechDay.get(key) || [];
                const dayCap = tc?.days.find((d) => isSameDay(d.date, day));
                const tone = dayCap ? utilTone(dayCap.percent) : "ok";

                return (
                  <button
                    type="button"
                    key={key}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("[data-chip]")) return;
                      onCellCreate?.(t.id, day);
                    }}
                    className={cn(
                      "relative min-h-[68px] border-l border-border px-1.5 py-1 flex flex-col gap-1 text-left group transition-colors",
                      isWeekend && "bg-muted/40",
                      "hover:bg-accent/30"
                    )}
                  >
                    {/* Utilization indicator at top */}
                    {dayCap && dayCap.percent > 0 && (
                      <div
                        className={cn(
                          "absolute top-0 right-1 text-[9px] font-semibold tabular-nums",
                          tone === "ok" && "text-emerald-600",
                          tone === "warn" && "text-amber-600",
                          tone === "over" && "text-red-600"
                        )}
                      >
                        {Math.round(dayCap.percent)}%
                      </div>
                    )}

                    {cellEvents.map((ev) => {
                      const c = statusColors(ev.status);
                      return (
                        <div
                          key={ev.id}
                          data-chip
                          onClick={(e) => {
                            e.stopPropagation();
                            onEventClick?.(ev.id);
                          }}
                          className={cn(
                            "rounded border-l-2 px-1.5 py-0.5 text-[10px] leading-tight cursor-pointer truncate",
                            c.bg,
                            c.border,
                            c.text
                          )}
                          title={`${ev.title} · ${fmtHM(ev.start)}–${fmtHM(ev.end)}`}
                        >
                          <span className="font-medium">{fmtHM(ev.start)}–{fmtHM(ev.end)}</span>{" "}
                          <span className="truncate">{ev.title}</span>
                        </div>
                      );
                    })}

                    {cellAbsences.map((a) => (
                      <div
                        key={a.id}
                        data-chip
                        className="rounded border-l-2 border-l-muted-foreground/40 bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground flex items-center gap-1"
                        title={a.label}
                      >
                        <Palmtree className="h-3 w-3 shrink-0" />
                        <span className="truncate">{a.label}</span>
                      </div>
                    ))}

                    {/* Empty hover hint */}
                    {cellEvents.length === 0 && cellAbsences.length === 0 && !isWeekend && (
                      <span className="m-auto opacity-0 group-hover:opacity-40 text-muted-foreground">
                        <Plus className="h-4 w-4" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}

        {technicians.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">Ingen teknikere å vise.</div>
        )}
      </div>
    </div>
  );
}
