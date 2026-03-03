import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { JobStatusBadge } from "@/components/JobStatusBadge";
import {
  ArrowLeft,
  Users,
  MoreHorizontal,
  Pencil,
  Eye,
  Settings2,
  Shield,
  Copy,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
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
  onOpenAccess?: () => void;
  onOpenSpaces?: () => void;
  onEdit?: () => void;
}

export function ProjectHeader({
  title,
  customer,
  start,
  end,
  status,
  technicianNames,
  onOpenAccess,
  onOpenSpaces,
  onEdit,
}: ProjectHeaderProps) {
  const navigate = useNavigate();
  const period = `${format(start, "d. MMM", { locale: nb })} – ${format(end, "d. MMM yyyy", { locale: nb })}`;

  return (
    <div className="bg-card border-b border-border/30">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
        {/* Top row: back + menu */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate("/projects")}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            Prosjekter
          </button>

          {/* Three-dot menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {onEdit && (
                <DropdownMenuItem onClick={onEdit} className="gap-2.5">
                  <Pencil className="h-4 w-4 text-muted-foreground" />
                  Rediger prosjekt
                </DropdownMenuItem>
              )}
              {onOpenAccess && (
                <DropdownMenuItem onClick={onOpenAccess} className="gap-2.5">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  Administrer tilgang
                </DropdownMenuItem>
              )}
              {onOpenSpaces && (
                <DropdownMenuItem onClick={onOpenSpaces} className="gap-2.5">
                  <Settings2 className="h-4 w-4 text-muted-foreground" />
                  Administrer rom
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2.5 text-destructive focus:text-destructive">
                <Trash2 className="h-4 w-4" />
                Slett prosjekt
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Title — centered */}
        <div className="text-center">
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
    </div>
  );
}
