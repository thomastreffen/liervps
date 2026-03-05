import { useNavigate } from "react-router-dom";
import { FolderKanban, ListChecks, MessageSquare, AlertTriangle, CalendarCheck, Clock } from "lucide-react";
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
  hasPlanned: boolean;
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
          className="bg-card rounded-2xl border-2 border-border/60 p-5 text-left
            hover:border-primary/40 hover:shadow-lg hover:bg-card/80 hover:-translate-y-1
            transition-all duration-200 group relative cursor-pointer"
        >
          <div className="flex items-start gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <FolderKanban className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-bold text-foreground truncate group-hover:text-primary transition-colors leading-tight">
                {p.title}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {p.internal_number && <span className="font-mono">#{p.internal_number}</span>}
                {p.internal_number && p.customer && " · "}
                {p.customer || "Ingen kunde"}
              </p>
            </div>
          </div>

          {/* Status chips */}
          <div className="flex items-center gap-1.5 flex-wrap mt-3">
            {p.hasPlanned && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 bg-primary/10 text-primary border border-primary/20">
                <Clock className="h-2.5 w-2.5" />
                Planlagt
              </span>
            )}
            {p.taskCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 bg-accent/10 text-accent border border-accent/20">
                <ListChecks className="h-2.5 w-2.5" />
                {p.taskCount} oppgaver
              </span>
            )}
            {p.messageCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 bg-info/10 text-info border border-info/20">
                <MessageSquare className="h-2.5 w-2.5" />
                {p.messageCount} meldinger
              </span>
            )}
            {p.deviationCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 bg-destructive/10 text-destructive border border-destructive/20">
                <AlertTriangle className="h-2.5 w-2.5" />
                {p.deviationCount} avvik
              </span>
            )}
          </div>

          {/* Next activity */}
          {p.nextActivity && (
            <div className="flex items-center gap-2 text-xs bg-primary/5 rounded-lg px-3 py-1.5 mt-3 border border-primary/10">
              <CalendarCheck className="h-3 w-3 text-primary shrink-0" />
              <span className="truncate text-foreground/80 text-[11px]">{p.nextActivity.title}</span>
              <span className="shrink-0 ml-auto text-muted-foreground font-mono text-[10px]">
                {format(new Date(p.nextActivity.scheduled_date), "d. MMM", { locale: nb })}
              </span>
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
