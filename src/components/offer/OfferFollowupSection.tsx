import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useOfferFollowupTasks,
  FOLLOWUP_TYPE_CONFIG,
  PRIORITY_CONFIG,
  type OfferFollowupTask,
} from "@/hooks/useOfferFollowup";
import {
  CheckCircle2,
  Clock,
  X,
  CalendarClock,
  ListChecks,
} from "lucide-react";
import { toast } from "sonner";

function relativeDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = new Date(dateStr).getTime() - Date.now();
  const days = Math.ceil(diff / 86400000);
  if (days < 0) return `${Math.abs(days)}d forfalt`;
  if (days === 0) return "I dag";
  if (days === 1) return "I morgen";
  return `Om ${days} dager`;
}

interface OfferFollowupSectionProps {
  offerId: string;
}

export function OfferFollowupSection({ offerId }: OfferFollowupSectionProps) {
  const nav = useNavigate();
  const { tasks, loading, completeTask, snoozeTask, cancelTask } = useOfferFollowupTasks(offerId);

  if (loading) {
    return (
      <div className="rounded-2xl border border-border/40 bg-card shadow-sm p-5 space-y-3">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  const openTasks = tasks.filter((t) => t.status === "open" || t.status === "snoozed");
  const completedTasks = tasks.filter((t) => t.status === "completed").slice(0, 3);

  if (openTasks.length === 0 && completedTasks.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border/40 bg-card shadow-sm overflow-hidden">
      <div className="p-4 pb-3">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold text-foreground">Oppfølging</h4>
          {openTasks.length > 0 && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 rounded-md ml-auto">
              {openTasks.length} åpne
            </Badge>
          )}
        </div>
      </div>

      {openTasks.length > 0 && (
        <div className="divide-y divide-border/20">
          {openTasks.map((task) => (
            <FollowupTaskRow
              key={task.id}
              task={task}
              onComplete={async () => {
                await completeTask(task.id);
                toast.success("Oppgave fullført");
              }}
              onSnooze={async () => {
                await snoozeTask(task.id, 1);
                toast.success("Utsatt til i morgen");
              }}
              onCancel={async () => {
                await cancelTask(task.id);
                toast.success("Oppgave avbrutt");
              }}
            />
          ))}
        </div>
      )}

      {completedTasks.length > 0 && (
        <div className="border-t border-border/30 px-4 py-2">
          <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-1">Fullførte</p>
          {completedTasks.map((task) => (
            <div key={task.id} className="flex items-center gap-2 py-1 text-xs text-muted-foreground/40">
              <CheckCircle2 className="h-3 w-3 text-green-500/50" />
              <span className="line-through truncate">{task.title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FollowupTaskRow({
  task,
  onComplete,
  onSnooze,
  onCancel,
}: {
  task: OfferFollowupTask;
  onComplete: () => void;
  onSnooze: () => void;
  onCancel: () => void;
}) {
  const typeCfg = FOLLOWUP_TYPE_CONFIG[task.task_type];
  const priCfg = PRIORITY_CONFIG[task.priority];
  const dueDateStr = relativeDate(task.due_date);
  const isOverdue = task.due_date && new Date(task.due_date).getTime() < Date.now();

  return (
    <div className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors group">
      <div className="pt-0.5 text-base shrink-0">{typeCfg?.icon || "📋"}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={`${priCfg.className} rounded-lg text-[10px] px-1.5 py-0`}>
            {priCfg.label}
          </Badge>
          {task.due_date && (
            <span className={`text-[11px] flex items-center gap-0.5 ${isOverdue ? "text-destructive font-medium" : "text-muted-foreground/60"}`}>
              <CalendarClock className="h-3 w-3" />
              {dueDateStr}
            </span>
          )}
          {task.description && (
            <span className="text-[11px] text-muted-foreground/50 truncate max-w-[200px]">
              {task.description}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 rounded-md"
          title="Fullført"
          onClick={(e) => { e.stopPropagation(); onComplete(); }}
        >
          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 rounded-md"
          title="Utsett"
          onClick={(e) => { e.stopPropagation(); onSnooze(); }}
        >
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 rounded-md"
          title="Avbryt"
          onClick={(e) => { e.stopPropagation(); onCancel(); }}
        >
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </div>
    </div>
  );
}
