import { useNavigate } from "react-router-dom";
import { FolderKanban, ListChecks, MessageSquare, AlertTriangle, CalendarCheck } from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";

export interface ProjectCardData {
  id: string;
  title: string;
  internal_number: string | null;
  customer: string;
  nextActivity: { title: string; scheduled_date: string } | null;
  taskCount: number;
  messageCount: number;
  deviationCount: number;
}

export function ProjectCards({ projects }: { projects: ProjectCardData[] }) {
  const navigate = useNavigate();

  if (projects.length === 0) {
    return (
      <div className="text-center py-12">
        <FolderKanban className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground/60">Ingen aktive prosjekter</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {projects.map((p) => (
        <button
          key={p.id}
          onClick={() => navigate(`/projects/${p.id}`)}
          className="bg-card rounded-2xl border border-border/50 p-5 text-left hover:border-primary/30 hover:shadow-sm transition-all group"
        >
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                {p.title}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {p.internal_number && `#${p.internal_number} · `}
                {p.customer || "Ingen kunde"}
              </p>
            </div>
            <div className="h-9 w-9 rounded-xl bg-primary/8 flex items-center justify-center shrink-0">
              <FolderKanban className="h-4 w-4 text-primary/60" />
            </div>
          </div>

          {/* Next activity */}
          {p.nextActivity && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3 bg-muted/30 rounded-lg px-2.5 py-1.5">
              <CalendarCheck className="h-3 w-3 shrink-0" />
              <span className="truncate">{p.nextActivity.title}</span>
              <span className="shrink-0 ml-auto text-muted-foreground/60">
                {format(new Date(p.nextActivity.scheduled_date), "d. MMM", { locale: nb })}
              </span>
            </div>
          )}

          {/* Chips */}
          <div className="flex items-center gap-2 flex-wrap">
            {p.taskCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium rounded-full px-2 py-0.5 bg-accent/10 text-accent-foreground">
                <ListChecks className="h-3 w-3" />
                {p.taskCount}
              </span>
            )}
            {p.messageCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium rounded-full px-2 py-0.5 bg-primary/10 text-primary">
                <MessageSquare className="h-3 w-3" />
                {p.messageCount}
              </span>
            )}
            {p.deviationCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium rounded-full px-2 py-0.5 bg-destructive/10 text-destructive">
                <AlertTriangle className="h-3 w-3" />
                {p.deviationCount}
              </span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
