import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Clock, RefreshCw, Pause, AlertTriangle, AlertCircle, X } from "lucide-react";
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
    label: "Venter",
    colorClass: "text-amber-700 dark:text-amber-400",
    activeClass: "ring-1 ring-amber-500 bg-amber-500/15",
    filter: (_, s) => s.pending > 0 && s.responseRequired,
  },
  {
    key: "multi_reminder",
    icon: RefreshCw,
    label: "Påminnelser",
    colorClass: "text-orange-700 dark:text-orange-400",
    activeClass: "ring-1 ring-orange-500 bg-orange-500/15",
    filter: (_, s) => s.reminderCount >= 2 && s.approved < s.total,
  },
  {
    key: "paused",
    icon: Pause,
    label: "Pauset",
    colorClass: "text-muted-foreground",
    activeClass: "ring-1 ring-primary bg-muted",
    filter: (_, s) => s.hasPaused,
  },
  {
    key: "declined",
    icon: AlertTriangle,
    label: "Avslag",
    colorClass: "text-destructive",
    activeClass: "ring-1 ring-destructive bg-destructive/15",
    filter: (_, s) => s.declined > 0 || s.changeRequest > 0,
  },
  {
    key: "starting_soon",
    icon: AlertCircle,
    label: "Haster",
    colorClass: "text-red-700 dark:text-red-400",
    activeClass: "ring-1 ring-red-500 bg-red-500/15",
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
    <div className="flex items-center gap-1.5 mb-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground shrink-0 mr-0.5">
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
              "inline-flex items-center gap-1 rounded-md border border-border/30 px-2 py-0.5 text-[11px] font-medium transition-all shrink-0",
              cat.colorClass,
              isActive && cat.activeClass,
              "hover:bg-muted/50",
            )}
          >
            <Icon className="h-2.5 w-2.5 shrink-0" />
            <span className="font-bold">{count}</span>
            <span className="hidden sm:inline text-[10px]">{cat.label}</span>
          </button>
        );
      })}

      {activeFilter && (
        <button
          type="button"
          className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors ml-0.5"
          onClick={() => onFilterChange(null)}
        >
          <X className="h-2.5 w-2.5" />
          Nullstill
        </button>
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
