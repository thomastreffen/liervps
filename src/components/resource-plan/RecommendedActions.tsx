import { useMemo } from "react";
import { Send, UserPlus, AlertCircle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ApprovalSummary } from "@/hooks/useApprovalSummaries";
import type { CalendarEvent } from "@/hooks/useCalendarEvents";

interface Action {
  id: string;
  icon: typeof Send;
  label: string;
  detail: string;
  severity: "critical" | "warning" | "info";
  jobId: string;
}

interface Props {
  summaries: Map<string, ApprovalSummary>;
  events: CalendarEvent[];
  onActionClick: (jobId: string) => void;
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: "border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10",
  warning: "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10",
  info: "border-border/50 bg-muted/30 text-muted-foreground hover:bg-muted/50",
};

export function RecommendedActions({ summaries, events, onActionClick }: Props) {
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

      // Critical: Starting soon without response
      if (s.pending > 0 && hoursUntilStart > 0 && hoursUntilStart < 12) {
        result.push({
          id: `urgent-${jobId}`,
          icon: AlertCircle,
          label: `Følg opp ${eventTitle}`,
          detail: "Starter snart – mangler svar",
          severity: "critical",
          jobId,
        });
      }

      // Warning: Declined – suggest replacement
      if (s.declined > 0 || s.changeRequest > 0) {
        result.push({
          id: `replace-${jobId}`,
          icon: UserPlus,
          label: `Bytt montør for ${eventTitle}`,
          detail: s.declined > 0 ? "Avslag registrert" : "Tidsendring foreslått",
          severity: "warning",
          jobId,
        });
      }

      // Info: Send reminder to pending
      if (s.pending > 0 && s.responseRequired && s.reminderCount < 3 && !(hoursUntilStart > 0 && hoursUntilStart < 12)) {
        result.push({
          id: `remind-${jobId}`,
          icon: Send,
          label: `Send påminnelse (${s.pending} montør${s.pending > 1 ? "er" : ""})`,
          detail: eventTitle,
          severity: "info",
          jobId,
        });
      }
    }

    // Sort: critical first, then warning, then info
    const order = { critical: 0, warning: 1, info: 2 };
    result.sort((a, b) => order[a.severity] - order[b.severity]);

    return result.slice(0, 5); // Max 5 suggestions
  }, [summaries, eventMap]);

  if (actions.length === 0) return null;

  return (
    <div className="px-1 py-1.5 space-y-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        Anbefalte handlinger
      </span>
      <div className="flex flex-col gap-1">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              type="button"
              onClick={() => onActionClick(action.jobId)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all group",
                SEVERITY_STYLES[action.severity],
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium truncate">{action.label}</p>
                <p className="text-[10px] opacity-70 truncate">{action.detail}</p>
              </div>
              <ArrowRight className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
