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
      <div className="text-center py-16">
        <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-3 border-2 border-success/20">
          <CheckCircle2 className="h-7 w-7 text-success/50" />
        </div>
        <p className="text-sm text-muted-foreground/50 font-medium">Ingen åpne oppgaver – alt i rute!</p>
      </div>
    );
  }

  return (
    <div className="p-2">
      {tasks.map((t) => {
        const overdue = t.due_at && isPast(new Date(t.due_at));
        return (
          <button
            key={t.id}
            onClick={() => t.linked_project_id && navigate(`/projects/${t.linked_project_id}`)}
            disabled={!t.linked_project_id}
            className="flex items-center gap-3 w-full rounded-xl px-4 py-3 text-left hover:bg-primary/5 transition-colors group disabled:cursor-default"
          >
            <Circle className={`h-[18px] w-[18px] shrink-0 stroke-[2.5] ${overdue ? "text-destructive" : "text-border"}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground truncate group-hover:text-primary transition-colors">{t.title}</p>
            </div>
            {t.due_at && (
              <span className={`text-[11px] shrink-0 flex items-center gap-1 font-medium ${
                overdue ? "text-destructive" : "text-muted-foreground/50"
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
