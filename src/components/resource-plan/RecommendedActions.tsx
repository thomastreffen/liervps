import { useMemo, useState } from "react";
import { Send, UserPlus, AlertCircle, ArrowRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ApprovalSummary } from "@/hooks/useApprovalSummaries";
import type { CalendarEvent } from "@/hooks/useCalendarEvents";

interface Action {
  id: string;
  icon: typeof Send;
  label: string;
  severity: "critical" | "warning" | "info";
  jobId: string;
}

interface Props {
  summaries: Map<string, ApprovalSummary>;
  events: CalendarEvent[];
  onActionClick: (jobId: string) => void;
}

const MAX_VISIBLE = 3;

export function RecommendedActions({ summaries, events, onActionClick }: Props) {
  const [showAll, setShowAll] = useState(false);

  const eventMap = useMemo(() => {
    const m = new Map<string, CalendarEvent>();
    for (const e of events) m.set(e.id, e);
    return m;
  }, [events]);

  const actions = useMemo(() => {
    const result: Action[] = [];

    for (const [jobId, s] of summaries) {
      const event = eventMap.get(jobId);
      if (!event) continue;
      const hoursUntilStart = (event.start.getTime() - Date.now()) / (1000 * 60 * 60);
      const eventTitle = event.title?.replace("SERVICE – ", "") || "Oppdrag";

      if (s.pending > 0 && hoursUntilStart > 0 && hoursUntilStart < 12) {
        result.push({ id: `urgent-${jobId}`, icon: AlertCircle, label: `Følg opp ${eventTitle}`, severity: "critical", jobId });
      }
      if (s.declined > 0 || s.changeRequest > 0) {
        result.push({ id: `replace-${jobId}`, icon: UserPlus, label: `Bytt montør – ${eventTitle}`, severity: "warning", jobId });
      }
      if (s.pending > 0 && s.responseRequired && s.reminderCount < 3 && !(hoursUntilStart > 0 && hoursUntilStart < 12)) {
        result.push({ id: `remind-${jobId}`, icon: Send, label: `Påminnelse (${s.pending}) – ${eventTitle}`, severity: "info", jobId });
      }
    }

    const order = { critical: 0, warning: 1, info: 2 };
    result.sort((a, b) => order[a.severity] - order[b.severity]);
    return result.slice(0, 8);
  }, [summaries, eventMap]);

  if (actions.length === 0) return null;

  const visible = showAll ? actions : actions.slice(0, MAX_VISIBLE);
  const hiddenCount = actions.length - MAX_VISIBLE;

  const severityDot: Record<string, string> = {
    critical: "bg-destructive",
    warning: "bg-warning",
    info: "bg-muted-foreground/40",
  };

  return (
    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground shrink-0 mr-0.5">
        Handlinger
      </span>
      {visible.map((action) => (
        <button
          key={action.id}
          type="button"
          onClick={() => onActionClick(action.jobId)}
          className="inline-flex items-center gap-1 rounded-md border border-border/30 px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all group shrink-0"
        >
          <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", severityDot[action.severity])} />
          <span className="truncate max-w-[180px]">{action.label}</span>
          <ArrowRight className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </button>
      ))}
      {!showAll && hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          +{hiddenCount}
          <ChevronDown className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  );
}
