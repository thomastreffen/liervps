import { useMemo } from "react";
import { addDays, startOfWeek, format, isSameDay } from "date-fns";
import { nb } from "date-fns/locale";
import { Palmtree } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScheduleBlock } from "@/hooks/useScheduleBlocks";
import type { AbsenceBlock } from "@/hooks/useAbsenceBlocks";
import type { TechDayCapacity } from "@/hooks/useCapacity";

export type TeamStatusKey =
  | "approved"
  | "scheduled"
  | "in_progress"
  | "rejected"
  | "requested"
  | "time_change_proposed"
  | "absence";

export const TEAM_STATUS_OPTIONS: { key: TeamStatusKey; label: string; swatch: string }[] = [
  { key: "approved", label: "Godkjent", swatch: "bg-emerald-300 border-emerald-400" },
  { key: "scheduled", label: "Planlagt", swatch: "bg-sky-300 border-sky-400" },
  { key: "in_progress", label: "Pågår", swatch: "bg-amber-300 border-amber-400" },
  { key: "requested", label: "Forespurt", swatch: "bg-violet-300 border-violet-400" },
  { key: "time_change_proposed", label: "Tidsendring foreslått", swatch: "bg-orange-300 border-orange-400" },
  { key: "rejected", label: "Avslått", swatch: "bg-rose-300 border-rose-400" },
  { key: "absence", label: "Ferie/fravær", swatch: "bg-stone-300 border-stone-400" },
];

export function blockStatusKey(status?: string | null): TeamStatusKey {
  switch (status) {
    case "approved":
    case "completed":
    case "ready_for_invoicing":
    case "invoiced":
      return "approved";
    case "in_progress":
      return "in_progress";
    case "rejected":
    case "cancelled":
      return "rejected";
    case "requested":
      return "requested";
    case "time_change_proposed":
      return "time_change_proposed";
    default:
      return "scheduled";
  }
}

interface TechMeta {
  name: string;
  color: string | null;
  avatarId?: string | null;
}

interface TeamViewProps {
  referenceDate: Date;
  technicians: Array<{ id: string; name: string; color?: string | null }>;
  technicianMap: Map<string, TechMeta>;
  scheduleBlocks: ScheduleBlock[];
  absenceBlocks: AbsenceBlock[];
  techCapacities?: TechDayCapacity[];
  visibleStatuses?: Set<TeamStatusKey>;
  onBlockClick?: (block: ScheduleBlock) => void;
  onCellCreate?: (techId: string, day: Date) => void;
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

function fmtHour(d: Date) {
  return format(d, "H");
}

/** Soft pastel chip tones — calm, modern */
function statusTone(status?: string | null) {
  switch (status) {
    case "approved":
    case "completed":
    case "ready_for_invoicing":
    case "invoiced":
      return "bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-100";
    case "in_progress":
      return "bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-100";
    case "rejected":
    case "cancelled":
      return "bg-rose-50 border-rose-200 text-rose-900 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-100";
    default:
      // planlagt
      return "bg-sky-50 border-sky-200 text-sky-900 dark:bg-sky-950/40 dark:border-sky-900 dark:text-sky-100";
  }
}

function utilColor(p: number) {
  if (p > 100) return "text-rose-600";
  if (p >= 80) return "text-emerald-600";
  if (p > 0) return "text-muted-foreground";
  return "text-muted-foreground/60";
}

export function TeamView({
  referenceDate,
  technicians,
  technicianMap,
  scheduleBlocks,
  absenceBlocks,
  techCapacities,
  visibleStatuses,
  onBlockClick,
  onCellCreate,
}: TeamViewProps) {
  const weekStart = useMemo(
    () => startOfWeek(referenceDate, { weekStartsOn: 1 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [referenceDate.toDateString()]
  );
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const filteredBlocks = useMemo(() => {
    if (!visibleStatuses) return scheduleBlocks;
    return scheduleBlocks.filter((b) => visibleStatuses.has(blockStatusKey(b.job_status)));
  }, [scheduleBlocks, visibleStatuses]);

  const showAbsence = !visibleStatuses || visibleStatuses.has("absence");

  // Index blocks by tech+day
  const blocksByTechDay = useMemo(() => {
    const map = new Map<string, ScheduleBlock[]>();
    for (const b of filteredBlocks) {
      for (const day of days) {
        const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(day); dayEnd.setHours(23, 59, 59, 999);
        if (b.start_at <= dayEnd && b.end_at >= dayStart) {
          const key = `${b.technician_id}__${format(day, "yyyy-MM-dd")}`;
          const arr = map.get(key) || [];
          arr.push(b);
          map.set(key, arr);
        }
      }
    }
    for (const arr of map.values()) arr.sort((a, b) => a.start_at.getTime() - b.start_at.getTime());
    return map;
  }, [filteredBlocks, days]);

  const absencesByTechDay = useMemo(() => {
    const map = new Map<string, AbsenceBlock[]>();
    if (!showAbsence) return map;
    for (const b of absenceBlocks) {
      const key = `${b.technicianId}__${format(b.date, "yyyy-MM-dd")}`;
      const arr = map.get(key) || [];
      arr.push(b);
      map.set(key, arr);
    }
    return map;
  }, [absenceBlocks, showAbsence]);

  const capByTech = useMemo(() => {
    const map = new Map<string, TechDayCapacity>();
    for (const tc of techCapacities || []) map.set(tc.techId, tc);
    return map;
  }, [techCapacities]);

  // Today highlight
  const today = new Date();

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="overflow-auto">
        <div className="min-w-[920px]">
          {/* Header */}
          <div
            className="grid sticky top-0 z-20 bg-card/95 backdrop-blur border-b border-border"
            style={{ gridTemplateColumns: "200px repeat(7, minmax(0,1fr))" }}
          >
            <div className="sticky left-0 z-10 bg-card/95 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-border">
              Montør
            </div>
            {days.map((d) => {
              const dow = d.getDay();
              const isWeekend = dow === 0 || dow === 6;
              const isToday = isSameDay(d, today);
              // Aggregate utilisation across all visible techs for this day
              let plannedMin = 0;
              let capMin = 0;
              for (const tc of techCapacities || []) {
                const dc = tc.days.find((dd) => isSameDay(dd.date, d));
                if (dc) {
                  plannedMin += dc.totalMinutes;
                  capMin += (tc.weekCapacityMinutes / 5); // approx per workday
                }
              }
              const pct = capMin > 0 ? Math.round((plannedMin / capMin) * 100) : 0;
              return (
                <div
                  key={d.toISOString()}
                  className={cn(
                    "px-2 py-3 text-center border-r border-border last:border-r-0",
                    isWeekend && "bg-muted/30",
                  )}
                >
                  <div className={cn(
                    "text-[10px] font-semibold uppercase tracking-wider",
                    isToday ? "text-primary" : "text-muted-foreground"
                  )}>
                    {format(d, "EEE", { locale: nb })}
                  </div>
                  <div className={cn(
                    "text-base font-semibold leading-tight mt-0.5",
                    isToday ? "text-primary" : "text-foreground",
                  )}>
                    {format(d, "d")}
                  </div>
                  <div className={cn("text-[10px] tabular-nums mt-0.5", isWeekend ? "text-muted-foreground/60" : utilColor(pct))}>
                    {isWeekend ? "—" : (pct > 0 ? `${pct} %` : "—")}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Rows */}
          {technicians.map((t, rowIdx) => {
            const meta = technicianMap.get(t.id);
            const color = meta?.color || t.color || "hsl(var(--primary))";
            const tc = capByTech.get(t.id);
            const freeHours = tc ? Math.max(0, tc.weekCapacityHours - tc.weekPlannedHours) : null;
            return (
              <div
                key={t.id}
                className={cn(
                  "grid border-b border-border last:border-b-0 group/row",
                  rowIdx % 2 === 1 && "bg-muted/10",
                )}
                style={{ gridTemplateColumns: "200px repeat(7, minmax(0,1fr))" }}
              >
                {/* Sticky tech cell */}
                <div className="sticky left-0 z-10 bg-card px-3 py-3 flex items-center gap-3 border-r border-border">
                  <div
                    className="h-9 w-9 rounded-full flex items-center justify-center text-[11px] font-semibold text-white shrink-0 ring-2 ring-background"
                    style={{ backgroundColor: color }}
                  >
                    {initials(t.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium leading-tight truncate text-foreground">{t.name}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
                      {tc ? (
                        tc.weekPlannedHours > 0
                          ? `${Math.round(tc.weekPlannedHours)}/${Math.round(tc.weekCapacityHours)}t`
                          : `${Math.round(freeHours ?? 0)}t ledig`
                      ) : "—"}
                    </div>
                  </div>
                </div>

                {/* Day cells */}
                {days.map((day) => {
                  const dow = day.getDay();
                  const isWeekend = dow === 0 || dow === 6;
                  const isToday = isSameDay(day, today);
                  const key = `${t.id}__${format(day, "yyyy-MM-dd")}`;
                  const cellBlocks = blocksByTechDay.get(key) || [];
                  const cellAbsences = absencesByTechDay.get(key) || [];

                  return (
                    <button
                      type="button"
                      key={key}
                      disabled={isWeekend}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest("[data-chip]")) return;
                        if (isWeekend) return;
                        onCellCreate?.(t.id, day);
                      }}
                      className={cn(
                        "relative min-h-[76px] border-r border-border last:border-r-0 px-1.5 py-1.5 flex flex-col gap-1 text-left transition-colors",
                        isWeekend ? "bg-muted/30 cursor-default" : "hover:bg-accent/40 cursor-pointer",
                        isToday && !isWeekend && "bg-primary/5",
                      )}
                    >
                      {cellAbsences.map((a) => (
                        <div
                          key={a.id}
                          data-chip
                          className="rounded-md border border-stone-200 bg-stone-50 dark:border-stone-800 dark:bg-stone-900/40 px-2 py-1 text-[11px] text-stone-600 dark:text-stone-300 flex items-center gap-1.5"
                          title={a.label}
                        >
                          <Palmtree className="h-3 w-3 shrink-0 opacity-70" />
                          <span className="truncate">{a.label}</span>
                        </div>
                      ))}

                      {cellBlocks.map((b) => {
                        const tone = statusTone(b.job_status);
                        // Primary: human-readable title (job → block → parent project)
                        const primaryTitle = b.job_title
                          || b.title
                          || b.project_title
                          || b.outlook_subject
                          || b.job_number_resolved
                          || b.internal_number
                          || "Oppdrag";
                        // Secondary: JOB-ID / internal number badge
                        const refId = b.job_number_resolved || b.internal_number || null;
                        const timeStr = `${fmtHour(b.start_at)}–${fmtHour(b.end_at)}`;
                        const secondary = refId ? `${refId} · ${timeStr}` : timeStr;
                        return (
                          <div
                            key={b.id}
                            data-chip
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              onBlockClick?.(b);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                onBlockClick?.(b);
                              }
                            }}
                            className={cn(
                              "rounded-md border px-2 py-1 text-[11px] leading-tight cursor-pointer transition-all hover:shadow-sm hover:-translate-y-px",
                              tone,
                            )}
                            title={refId ? `${primaryTitle} (${refId}) · ${timeStr}` : `${primaryTitle} · ${timeStr}`}
                          >
                            <div className="font-medium line-clamp-2 break-words">{primaryTitle}</div>
                            <div className="text-[10px] opacity-75 tabular-nums truncate">{secondary}</div>
                          </div>
                        );
                      })}
                    </button>
                  );
                })}
              </div>
            );
          })}

          {technicians.length === 0 && (
            <div className="p-10 text-center text-sm text-muted-foreground">Ingen teknikere å vise.</div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="border-t border-border bg-muted/20 px-4 py-2.5 flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
        <LegendDot className="bg-emerald-200 border-emerald-300" label="Godkjent" />
        <LegendDot className="bg-sky-200 border-sky-300" label="Planlagt" />
        <LegendDot className="bg-amber-200 border-amber-300" label="Pågår" />
        <LegendDot className="bg-rose-200 border-rose-300" label="Avslått" />
        <LegendDot className="bg-stone-200 border-stone-300" label="Ferie/fravær" />
      </div>
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn("h-3 w-3 rounded-sm border", className)} />
      <span>{label}</span>
    </div>
  );
}
