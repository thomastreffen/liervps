import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Clock, RefreshCw, Pause, AlertTriangle, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ApprovalSummary } from "@/hooks/useApprovalSummaries";
import type { CalendarEvent } from "@/hooks/useCalendarEvents";

export type FollowUpCategory = "waiting" | "multi_reminder" | "paused" | "declined" | "starting_soon" | null;

interface CategoryDef {
  key: FollowUpCategory & string;
  icon: typeof Clock;
  label: string;
  colorClass: string;
  activeClass: string;
  filter: (jobId: string, s: ApprovalSummary, event?: CalendarEvent) => boolean;
}

const CATEGORIES: CategoryDef[] = [
  {
    key: "waiting",
    icon: Clock,
    label: "Venter på svar",
    colorClass: "text-amber-700 dark:text-amber-400 bg-amber-500/10 border-amber-500/30",
    activeClass: "ring-2 ring-amber-500 bg-amber-500/20",
    filter: (_, s) => s.pending > 0 && s.responseRequired,
  },
  {
    key: "multi_reminder",
    icon: RefreshCw,
    label: "Flere påminnelser",
    colorClass: "text-orange-700 dark:text-orange-400 bg-orange-500/10 border-orange-500/30",
    activeClass: "ring-2 ring-orange-500 bg-orange-500/20",
    filter: (_, s) => s.reminderCount >= 2 && s.approved < s.total,
  },
  {
    key: "paused",
    icon: Pause,
    label: "Pauset",
    colorClass: "text-muted-foreground bg-muted/50 border-border/50",
    activeClass: "ring-2 ring-primary bg-muted",
    filter: (_, s) => s.hasPaused,
  },
  {
    key: "declined",
    icon: AlertTriangle,
    label: "Avslag / tidsendring",
    colorClass: "text-destructive bg-destructive/10 border-destructive/30",
    activeClass: "ring-2 ring-destructive bg-destructive/20",
    filter: (_, s) => s.declined > 0 || s.changeRequest > 0,
  },
  {
    key: "starting_soon",
    icon: AlertCircle,
    label: "Starter snart uten svar",
    colorClass: "text-red-700 dark:text-red-400 bg-red-500/10 border-red-500/30",
    activeClass: "ring-2 ring-red-500 bg-red-500/20",
    filter: (jobId, s, event) => {
      if (!event || s.pending === 0) return false;
      const hoursUntilStart = (event.start.getTime() - Date.now()) / (1000 * 60 * 60);
      return hoursUntilStart > 0 && hoursUntilStart < 12;
    },
  },
];

interface Props {
  summaries: Map<string, ApprovalSummary>;
  events: CalendarEvent[];
  activeFilter: FollowUpCategory;
  onFilterChange: (cat: FollowUpCategory) => void;
}

export function FollowUpStrip({ summaries, events, activeFilter, onFilterChange }: Props) {
  const eventMap = useMemo(() => {
    const m = new Map<string, CalendarEvent>();
    for (const e of events) m.set(e.id, e);
    return m;
  }, [events]);

  const counts = useMemo(() => {
    const result = new Map<string, Set<string>>();
    for (const cat of CATEGORIES) {
      result.set(cat.key, new Set());
    }
    for (const [jobId, s] of summaries) {
      const event = eventMap.get(jobId);
      for (const cat of CATEGORIES) {
        if (cat.filter(jobId, s, event)) {
          result.get(cat.key)!.add(jobId);
        }
      }
    }
    return result;
  }, [summaries, eventMap]);

  const totalIssues = useMemo(() => {
    const allIds = new Set<string>();
    for (const ids of counts.values()) {
      for (const id of ids) allIds.add(id);
    }
    return allIds.size;
  }, [counts]);

  if (totalIssues === 0) return null;

  return (
    <div className="flex items-center gap-2 px-1 py-1.5 overflow-x-auto">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground shrink-0">
        Oppfølging
      </span>

      {CATEGORIES.map((cat) => {
        const jobIds = counts.get(cat.key)!;
        const count = jobIds.size;
        if (count === 0) return null;

        const Icon = cat.icon;
        const isActive = activeFilter === cat.key;

        return (
          <button
            key={cat.key}
            type="button"
            onClick={() => onFilterChange(isActive ? null : cat.key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-all shrink-0",
              cat.colorClass,
              isActive && cat.activeClass,
            )}
          >
            <Icon className="h-3 w-3 shrink-0" />
            <span>{count}</span>
            <span className="hidden sm:inline">{cat.label}</span>
          </button>
        );
      })}

      {activeFilter && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-[10px] gap-1 shrink-0 px-2"
          onClick={() => onFilterChange(null)}
        >
          <X className="h-3 w-3" />
          Nullstill
        </Button>
      )}
    </div>
  );
}

/** Given a filter category and summaries, return the set of matching job IDs */
export function getFilteredJobIds(
  category: FollowUpCategory,
  summaries: Map<string, ApprovalSummary>,
  events: CalendarEvent[]
): Set<string> | null {
  if (!category) return null;

  const cat = CATEGORIES.find((c) => c.key === category);
  if (!cat) return null;

  const eventMap = new Map<string, CalendarEvent>();
  for (const e of events) eventMap.set(e.id, e);

  const result = new Set<string>();
  for (const [jobId, s] of summaries) {
    if (cat.filter(jobId, s, eventMap.get(jobId))) {
      result.add(jobId);
    }
  }
  return result;
}
