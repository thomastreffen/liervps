import { ReactNode } from "react";
import { ChevronRight, Inbox, User, Package, Wrench, Check, Circle, Dot } from "lucide-react";
import { cn } from "@/lib/utils";

export type FlowStepKind = "inbox" | "lead" | "order" | "job";
export type FlowStepStatus = "not_started" | "active" | "completed";

export interface FlowStep {
  kind: FlowStepKind;
  label: string;
  status: FlowStepStatus;
  ref?: string | null;
  subtitle?: string | null;
  onClick?: () => void;
}

const KIND_ICON: Record<FlowStepKind, typeof Inbox> = {
  inbox: Inbox,
  lead: User,
  order: Package,
  job: Wrench,
};

const STATUS_STYLES: Record<FlowStepStatus, string> = {
  not_started:
    "border-border/40 bg-muted/30 text-muted-foreground/70",
  active:
    "border-primary/40 bg-primary/10 text-primary",
  completed:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
};

const STATUS_DOT: Record<FlowStepStatus, ReactNode> = {
  not_started: <Circle className="h-2.5 w-2.5 opacity-50" />,
  active: <Dot className="h-3.5 w-3.5" />,
  completed: <Check className="h-3 w-3" />,
};

interface FlowTrailProps {
  steps: FlowStep[];
  className?: string;
}

/**
 * Compact horizontal trail showing where a record sits in the
 * Postkontor → Lead → Bestilling → Oppdrag chain.
 * Steps that are missing should be filtered out by the caller.
 */
export function FlowTrail({ steps, className }: FlowTrailProps) {
  if (!steps || steps.length === 0) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1.5 rounded-xl border border-border/50 bg-muted/20 px-2.5 py-1.5",
        className,
      )}
      aria-label="Henvendelsesflyt"
    >
      {steps.map((step, idx) => {
        const Icon = KIND_ICON[step.kind];
        const interactive = !!step.onClick && step.status !== "not_started";
        const node = (
          <div
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] leading-none transition-colors",
              STATUS_STYLES[step.status],
              interactive && "cursor-pointer hover:brightness-105",
            )}
            role={interactive ? "button" : undefined}
            tabIndex={interactive ? 0 : undefined}
            onClick={interactive ? step.onClick : undefined}
            onKeyDown={
              interactive
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      step.onClick?.();
                    }
                  }
                : undefined
            }
            title={step.subtitle || undefined}
          >
            <Icon className="h-3 w-3 shrink-0" />
            <span className="font-medium">{step.label}</span>
            {step.ref && (
              <span className="font-mono text-[10px] opacity-80 truncate max-w-[120px]">
                {step.ref}
              </span>
            )}
            <span className="ml-0.5 flex items-center">{STATUS_DOT[step.status]}</span>
          </div>
        );

        return (
          <div key={`${step.kind}-${idx}`} className="flex items-center gap-1.5">
            {node}
            {idx < steps.length - 1 && (
              <ChevronRight className="h-3 w-3 text-muted-foreground/60 shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}
