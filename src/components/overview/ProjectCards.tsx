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
      <div className="text-center py-16 bg-card rounded-2xl border border-border/40 shadow-sm">
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
          className="bg-card rounded-2xl border border-border/40 shadow-sm p-6 text-left
            hover:shadow-md hover:border-primary/25 hover:-translate-y-0.5
            transition-all duration-200 group relative overflow-hidden"
        >
          {/* Subtle top accent */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/40 via-primary/20 to-transparent rounded-t-2xl" />

          <div className="flex items-start gap-3 mb-4">
            <div className="h-11 w-11 rounded-xl bg-primary/8 flex items-center justify-center shrink-0 shadow-inner">
              <FolderKanban className="h-5 w-5 text-primary/70" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-foreground truncate group-hover:text-primary transition-colors leading-tight">
                {p.title}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {p.internal_number && <span className="font-mono">#{p.internal_number}</span>}
                {p.internal_number && p.customer && " · "}
                {p.customer || "Ingen kunde"}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/15 group-hover:text-primary/50 shrink-0 mt-1 transition-colors" />
          </div>

          {/* Next activity */}
          {p.nextActivity && (
            <div className="flex items-center gap-2 text-xs bg-muted/40 rounded-xl px-3 py-2 mb-4 border border-border/30">
              <CalendarCheck className="h-3.5 w-3.5 text-primary/60 shrink-0" />
              <span className="truncate text-foreground/80">{p.nextActivity.title}</span>
              <span className="shrink-0 ml-auto text-muted-foreground font-mono text-[11px]">
                {format(new Date(p.nextActivity.scheduled_date), "d. MMM", { locale: nb })}
              </span>
            </div>
          )}

          {/* Chips */}
          <div className="flex items-center gap-2 flex-wrap">
            {p.taskCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium rounded-full px-2.5 py-1 bg-accent/8 text-accent-foreground border border-accent/15">
                <ListChecks className="h-3 w-3" />
                {p.taskCount} oppgaver
              </span>
            )}
            {p.messageCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium rounded-full px-2.5 py-1 bg-primary/8 text-primary border border-primary/15">
                <MessageSquare className="h-3 w-3" />
                {p.messageCount}
              </span>
            )}
            {p.deviationCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium rounded-full px-2.5 py-1 bg-destructive/8 text-destructive border border-destructive/15">
                <AlertTriangle className="h-3 w-3" />
                {p.deviationCount}
              </span>
            )}
            {p.taskCount === 0 && p.messageCount === 0 && p.deviationCount === 0 && (
              <span className="text-[11px] text-muted-foreground/40">Ingen aktivitet</span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
