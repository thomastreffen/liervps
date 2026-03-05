import { useNavigate } from "react-router-dom";
import { FolderKanban, ListChecks, MessageSquare, AlertTriangle, CalendarCheck, ChevronRight } from "lucide-react";
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
      <div className="text-center py-16">
        <FolderKanban className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground/50">Ingen aktive prosjekter</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {projects.map((p) => (
        <button
          key={p.id}
          onClick={() => navigate(`/projects/${p.id}`)}
          className="bg-card rounded-2xl border-2 border-border/60 p-6 text-left
            hover:border-primary/40 hover:shadow-lg hover:-translate-y-1
            transition-all duration-200 group relative"
        >
          <div className="flex items-start gap-3 mb-3">
            <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <FolderKanban className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-bold text-foreground truncate group-hover:text-primary transition-colors leading-tight">
                {p.title}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {p.internal_number && <span className="font-mono">#{p.internal_number}</span>}
                {p.internal_number && p.customer && " · "}
                {p.customer || "Ingen kunde"}
              </p>
            </div>
          </div>

          {/* Next activity */}
          {p.nextActivity && (
            <div className="flex items-center gap-2 text-xs bg-primary/5 rounded-xl px-3 py-2 mb-3 border border-primary/10">
              <CalendarCheck className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="truncate text-foreground/80">{p.nextActivity.title}</span>
              <span className="shrink-0 ml-auto text-muted-foreground font-mono text-[11px]">
                {format(new Date(p.nextActivity.scheduled_date), "d. MMM", { locale: nb })}
              </span>
            </div>
          )}

          {/* Chips */}
          <div className="flex items-center gap-2 flex-wrap">
            {p.taskCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2.5 py-1 bg-accent/10 text-accent border border-accent/20">
                <ListChecks className="h-3 w-3" />
                {p.taskCount}
              </span>
            )}
            {p.messageCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2.5 py-1 bg-info/10 text-info border border-info/20">
                <MessageSquare className="h-3 w-3" />
                {p.messageCount}
              </span>
            )}
            {p.deviationCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2.5 py-1 bg-destructive/10 text-destructive border border-destructive/20">
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
