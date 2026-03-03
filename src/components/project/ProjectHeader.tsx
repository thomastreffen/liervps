import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { JobStatusBadge } from "@/components/JobStatusBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  CalendarCheck,
  MoreHorizontal,
  Copy,
  ExternalLink,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import type { JobStatus } from "@/lib/job-status";
import { getDisplayNumber } from "@/lib/job-status";

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
  projectType?: string;
  onNavigateTab: (tab: string) => void;
}

export function ProjectHeader({
  jobNumber,
  internalNumber,
  title,
  customer,
  address,
  start,
  end,
  status,
  technicianNames,
  projectType,
  onNavigateTab,
}: ProjectHeaderProps) {
  const navigate = useNavigate();
  const displayNumber = getDisplayNumber(jobNumber, internalNumber);
  const period = `${format(start, "d. MMM", { locale: nb })} – ${format(end, "d. MMM yyyy", { locale: nb })}`;

  return (
    <div className="border-b border-border/40 bg-background">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6">
        {/* Back */}
        <button
          onClick={() => navigate("/projects")}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-3 w-3" />
          Prosjekter
        </button>

        {/* Title */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
              {title}
            </h1>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <JobStatusBadge status={status} />
              {customer && (
                <span className="text-sm text-muted-foreground">{customer}</span>
              )}
              <span className="text-sm text-muted-foreground">{period}</span>
              {displayNumber && (
                <span className="text-xs text-muted-foreground/50 font-mono">{displayNumber}</span>
              )}
            </div>
            {technicianNames.length > 0 && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                <Users className="h-3 w-3" />
                {technicianNames.join(", ")}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg gap-1.5 h-8 text-xs font-medium"
              onClick={() => onNavigateTab("plan")}
            >
              <CalendarCheck className="h-3.5 w-3.5" />
              Se plan
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-lg h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  className="gap-2"
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    toast.success("Lenke kopiert");
                  }}
                >
                  <Copy className="h-3.5 w-3.5" /> Kopier lenke
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="gap-2"
                  onClick={() => window.open(window.location.href, "_blank")}
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Åpne i ny fane
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  );
}