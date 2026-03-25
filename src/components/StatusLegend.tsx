import { StatusDot } from "./StatusDot";
import {
  ACCEPTANCE_STATUSES,
  EXECUTION_STATUSES,
  BILLING_STATUSES,
  STATUS_AXIS_LABELS,
  JOB_STATUS_CONFIG,
} from "@/lib/job-status";

export function StatusLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
      {/* Acceptance group */}
      <div className="flex items-center gap-x-3 gap-y-1 flex-wrap">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
          {STATUS_AXIS_LABELS.acceptance}
        </span>
        {ACCEPTANCE_STATUSES.map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <StatusDot status={s} /> {JOB_STATUS_CONFIG[s].label}
          </span>
        ))}
      </div>

      <div className="hidden sm:block h-4 w-px bg-border" />

      {/* Execution group */}
      <div className="flex items-center gap-x-3 gap-y-1 flex-wrap">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
          {STATUS_AXIS_LABELS.execution}
        </span>
        {EXECUTION_STATUSES.map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <StatusDot status={s} /> {JOB_STATUS_CONFIG[s].label}
          </span>
        ))}
      </div>

      <div className="hidden sm:block h-4 w-px bg-border" />

      {/* Billing group */}
      <div className="flex items-center gap-x-3 gap-y-1 flex-wrap">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
          {STATUS_AXIS_LABELS.billing}
        </span>
        {BILLING_STATUSES.map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <StatusDot status={s} /> {JOB_STATUS_CONFIG[s].label}
          </span>
        ))}
      </div>
    </div>
  );
}
