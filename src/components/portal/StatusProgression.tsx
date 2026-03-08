import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

const STEPS = [
  { key: "planned", label: "Planlagt" },
  { key: "active", label: "Pågår" },
  { key: "completed", label: "Ferdig" },
  { key: "report_delivered", label: "Rapport levert" },
  { key: "approved", label: "Godkjent" },
];

function stepIndex(projectStatus: string, hasReport: boolean, hasApproved: boolean): number {
  if (hasApproved) return 4;
  if (hasReport) return 3;
  if (["completed"].includes(projectStatus)) return 2;
  if (["active", "in_progress"].includes(projectStatus)) return 1;
  return 0;
}

interface Props {
  projectStatus: string;
  hasReport?: boolean;
  hasApprovedReport?: boolean;
}

export function StatusProgression({ projectStatus, hasReport = false, hasApprovedReport = false }: Props) {
  const current = stepIndex(projectStatus, hasReport, hasApprovedReport);

  return (
    <div className="flex items-center gap-1 w-full">
      {STEPS.map((step, i) => {
        const isDone = i < current;
        const isCurrent = i === current;
        return (
          <div key={step.key} className="flex flex-col items-center flex-1 min-w-0">
            <div className="flex items-center w-full">
              {i > 0 && (
                <div className={cn(
                  "h-0.5 flex-1 rounded-full transition-colors",
                  i <= current ? "bg-primary" : "bg-border"
                )} />
              )}
              <div className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold transition-colors",
                isDone ? "bg-primary text-primary-foreground" :
                isCurrent ? "bg-primary/20 text-primary border-2 border-primary" :
                "bg-muted text-muted-foreground"
              )}>
                {isDone ? <Check className="h-3 w-3" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn(
                  "h-0.5 flex-1 rounded-full transition-colors",
                  i < current ? "bg-primary" : "bg-border"
                )} />
              )}
            </div>
            <span className={cn(
              "mt-1 text-[9px] leading-tight text-center truncate w-full",
              isCurrent ? "font-semibold text-primary" :
              isDone ? "text-muted-foreground" :
              "text-muted-foreground/60"
            )}>
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
