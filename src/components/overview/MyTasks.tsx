import { useNavigate } from "react-router-dom";
import { CheckCircle2, ChevronRight, AlertCircle, Circle } from "lucide-react";
import { format, isPast } from "date-fns";
import { nb } from "date-fns/locale";

export interface OverviewTask {
  id: string;
  title: string;
  due_at: string | null;
  linked_project_id: string | null;
  priority: string;
}

export function MyTasks({ tasks }: { tasks: OverviewTask[] }) {
  const navigate = useNavigate();

  if (tasks.length === 0) {
    return (
      <div className="text-center py-14">
        <div className="h-14 w-14 rounded-full bg-muted/40 flex items-center justify-center mx-auto mb-3">
          <CheckCircle2 className="h-7 w-7 text-muted-foreground/25" />
        </div>
        <p className="text-sm text-muted-foreground/50 font-medium">Ingen åpne oppgaver – alt i rute!</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/30">
      {tasks.map((t) => {
        const overdue = t.due_at && isPast(new Date(t.due_at));
        return (
          <button
            key={t.id}
            onClick={() => t.linked_project_id && navigate(`/projects/${t.linked_project_id}`)}
            disabled={!t.linked_project_id}
            className="flex items-center gap-3 w-full px-5 py-3.5 text-left hover:bg-muted/30 transition-colors group disabled:cursor-default"
          >
            <Circle className={`h-4 w-4 shrink-0 ${overdue ? "text-destructive" : "text-muted-foreground/30"}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground truncate group-hover:text-primary transition-colors">{t.title}</p>
            </div>
            {t.due_at && (
              <span className={`text-[11px] shrink-0 flex items-center gap-1 ${
                overdue ? "text-destructive font-semibold" : "text-muted-foreground/60"
              }`}>
                {overdue && <AlertCircle className="h-3 w-3" />}
                {format(new Date(t.due_at), "d. MMM", { locale: nb })}
              </span>
            )}
            {t.linked_project_id && (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/15 group-hover:text-primary/40 shrink-0" />
            )}
          </button>
        );
      })}
    </div>
  );
}
