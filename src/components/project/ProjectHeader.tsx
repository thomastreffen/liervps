import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { JobStatusBadge } from "@/components/JobStatusBadge";
import {
  ArrowLeft,
  Users,
} from "lucide-react";
import type { JobStatus } from "@/lib/job-status";

interface ProjectHeaderProps {
  jobNumber: string | null;
  internalNumber: string | null;
  title: string;
  customer: string;
  address: string;
  start: Date;
  end: Date;
  status: JobStatus;
  technicianNames: string[];
  onOpenPlan?: () => void;
}

export function ProjectHeader({
  title,
  customer,
  start,
  end,
  status,
  technicianNames,
  onOpenPlan,
}: ProjectHeaderProps) {
  const navigate = useNavigate();
  const period = `${format(start, "d. MMM", { locale: nb })} – ${format(end, "d. MMM yyyy", { locale: nb })}`;

  return (
    <div className="bg-card border-b border-border/30">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 text-center">
        {/* Back */}
        <button
          onClick={() => navigate("/projects")}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-6 mx-auto w-fit"
        >
          <ArrowLeft className="h-3 w-3" />
          Prosjekter
        </button>

        {/* Title — big and centered like Basecamp */}
        <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
          {title}
        </h1>

        {/* Meta row */}
        <div className="flex items-center justify-center gap-3 mt-3 flex-wrap">
          <JobStatusBadge status={status} />
          {customer && (
            <span className="text-sm text-muted-foreground">{customer}</span>
          )}
          <span className="text-sm text-muted-foreground">{period}</span>
        </div>

        {/* Participants */}
        {technicianNames.length > 0 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              {technicianNames.join(", ")}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
