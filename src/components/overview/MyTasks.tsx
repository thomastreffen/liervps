import { useNavigate } from "react-router-dom";
import { CheckCircle2, ChevronRight, AlertCircle } from "lucide-react";
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
      <div className="text-center py-10">
        <CheckCircle2 className="h-7 w-7 text-muted-foreground/30 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground/60">Ingen åpne oppgaver – alt i rute!</p>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {tasks.map((t) => {
        const overdue = t.due_at && isPast(new Date(t.due_at));
        return (
          <button
            key={t.id}
            onClick={() => t.linked_project_id && navigate(`/projects/${t.linked_project_id}`)}
            disabled={!t.linked_project_id}
            className="flex items-center gap-3 w-full rounded-xl px-3.5 py-2.5 text-left hover:bg-muted/50 transition-colors group disabled:cursor-default"
          >
            <div className={`h-2 w-2 rounded-full shrink-0 ${overdue ? "bg-destructive" : "bg-primary/40"}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground truncate group-hover:text-primary transition-colors">{t.title}</p>
              {t.due_at && (
                <p className={`text-[11px] ${overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                  {overdue && <AlertCircle className="h-2.5 w-2.5 inline mr-0.5 -mt-0.5" />}
                  {format(new Date(t.due_at), "d. MMM", { locale: nb })}
                </p>
              )}
            </div>
            {t.linked_project_id && (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/20 group-hover:text-primary/40 shrink-0" />
            )}
          </button>
        );
      })}
    </div>
  );
}
