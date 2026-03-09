import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useOfferFollowupSummary, FOLLOWUP_TYPE_CONFIG, PRIORITY_CONFIG } from "@/hooks/useOfferFollowup";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ListChecks, ArrowRight, CalendarClock } from "lucide-react";

function relativeDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = new Date(dateStr).getTime() - Date.now();
  const days = Math.ceil(diff / 86400000);
  if (days < 0) return `${Math.abs(days)}d forfalt`;
  if (days === 0) return "I dag";
  if (days === 1) return "I morgen";
  return `Om ${days}d`;
}

export function DashboardFollowupTasks() {
  const nav = useNavigate();
  const { user } = useAuth();
  const { summary, loading } = useOfferFollowupSummary(user?.id || null);

  if (loading) {
    return (
      <div className="rounded-2xl border border-border/40 bg-card shadow-sm p-5 space-y-3">
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (summary.totalOpen === 0) return null;

  return (
    <div className="rounded-2xl border border-border/40 bg-card shadow-sm overflow-hidden">
      <div className="p-5 pb-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <ListChecks className="h-3.5 w-3.5 text-primary" />
          </div>
          <h4 className="text-sm font-semibold text-foreground">
            Tilbudsoppfølging
          </h4>
          <div className="flex items-center gap-1 ml-auto">
            {summary.urgent > 0 && (
              <Badge className="bg-destructive/15 text-destructive rounded-lg text-[10px] px-1.5 py-0">
                {summary.urgent} haster
              </Badge>
            )}
            {summary.high > 0 && (
              <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 rounded-lg text-[10px] px-1.5 py-0">
                {summary.high} høy
              </Badge>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground/60 ml-9">
          {summary.totalOpen} {summary.totalOpen === 1 ? "oppgave" : "oppgaver"} krever handling
        </p>
      </div>

      <div className="divide-y divide-border/30">
        {summary.tasks.slice(0, 5).map((task) => {
          const typeCfg = FOLLOWUP_TYPE_CONFIG[task.task_type];
          const priCfg = PRIORITY_CONFIG[task.priority];
          const dueDateStr = relativeDate(task.due_date);
          const isOverdue = task.due_date && new Date(task.due_date).getTime() < Date.now();

          return (
            <div
              key={task.id}
              className="flex items-center gap-3 px-5 py-2.5 hover:bg-muted/30 transition-colors cursor-pointer"
              onClick={() => nav(`/sales/offers/${task.offer_id}`)}
            >
              <span className="text-base shrink-0">{typeCfg?.icon || "📋"}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground truncate">{task.title}</p>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground/50">
                  {task.customer_name && <span className="truncate max-w-[140px]">{task.customer_name}</span>}
                  {task.due_date && (
                    <>
                      <span>·</span>
                      <span className={`flex items-center gap-0.5 ${isOverdue ? "text-destructive" : ""}`}>
                        <CalendarClock className="h-3 w-3" />
                        {dueDateStr}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <Badge className={`${priCfg.className} rounded-lg text-[10px] px-1.5 py-0 shrink-0`}>
                {priCfg.label}
              </Badge>
            </div>
          );
        })}
      </div>

      {summary.totalOpen > 5 && (
        <div className="px-5 py-2.5 border-t border-border/30">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs gap-1.5 rounded-xl text-muted-foreground"
            onClick={() => nav("/tasks?filter=offer_followup")}
          >
            Se alle tilbudsoppgaver <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}
