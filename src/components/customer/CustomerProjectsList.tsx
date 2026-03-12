import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FolderKanban, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { JOB_STATUS_CONFIG, type JobStatus } from "@/lib/job-status";

interface ProjectRow {
  id: string;
  title: string;
  status: JobStatus;
  start_time: string;
  internal_number: string | null;
}

interface Props {
  projects: ProjectRow[];
  customerId: string;
}

export function CustomerProjectsList({ projects, customerId }: Props) {
  const navigate = useNavigate();

  if (projects.length === 0) {
    return (
      <Card className="rounded-2xl border-dashed">
        <CardContent className="flex flex-col items-center py-12 text-center space-y-3">
          <FolderKanban className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Ingen prosjekter knyttet til denne kunden ennå.</p>
          <Button size="sm" onClick={() => navigate(`/projects/new?customer=${customerId}`)} className="gap-1.5 rounded-xl">
            <Plus className="h-3.5 w-3.5" /> Opprett prosjekt
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Split into active vs completed
  const active = projects.filter(p => !["completed", "invoiced"].includes(p.status));
  const completed = projects.filter(p => ["completed", "invoiced"].includes(p.status));

  return (
    <div className="space-y-4">
      {active.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground px-1">Aktive ({active.length})</p>
          {active.map(p => <ProjectCard key={p.id} project={p} />)}
        </div>
      )}
      {completed.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground px-1">Ferdigstilte ({completed.length})</p>
          {completed.map(p => <ProjectCard key={p.id} project={p} />)}
        </div>
      )}
    </div>
  );
}

function ProjectCard({ project }: { project: ProjectRow }) {
  const navigate = useNavigate();
  const cfg = JOB_STATUS_CONFIG[project.status];

  return (
    <Card
      className="rounded-2xl cursor-pointer hover:bg-secondary/30 transition-colors"
      onClick={() => navigate(`/projects/${project.id}`)}
    >
      <CardContent className="flex items-center justify-between py-3 px-4">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{project.title}</p>
          <p className="text-xs text-muted-foreground">
            {project.internal_number && <span className="font-mono mr-2">{project.internal_number}</span>}
            {format(new Date(project.start_time), "d. MMM yyyy", { locale: nb })}
          </p>
        </div>
        <Badge className="text-[10px] whitespace-nowrap rounded-lg shrink-0" variant="outline">
          {cfg?.label || project.status}
        </Badge>
      </CardContent>
    </Card>
  );
}
