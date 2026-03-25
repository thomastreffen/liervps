import { cn } from "@/lib/utils";
import { JOB_STATUS_CONFIG, type JobStatus, type StatusAxis } from "@/lib/job-status";

interface JobStatusBadgeProps {
  status: JobStatus;
  /** Optional: show axis label prefix */
  showAxis?: boolean;
  /** Size variant */
  size?: "sm" | "default";
}

export function JobStatusBadge({ status, showAxis, size = "default" }: JobStatusBadgeProps) {
  const config = JOB_STATUS_CONFIG[status];
  if (!config) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium",
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-xs",
        config.className
      )}
    >
      {config.label}
    </span>
  );
}

/** Grouped status display showing execution + acceptance + billing as separate badges */
export function JobStatusGroup({
  executionStatus,
  acceptanceStatuses,
  billingStatus,
  className,
}: {
  executionStatus: JobStatus;
  acceptanceStatuses?: Array<{ techName: string; status: string }>;
  billingStatus?: JobStatus | null;
  className?: string;
}) {
  // Map approval status strings to display config
  const approvalDisplayMap: Record<string, { label: string; className: string }> = {
    pending: { label: "Forespurt", className: "bg-status-requested text-status-requested-foreground" },
    approved: { label: "Godkjent", className: "bg-status-approved text-status-approved-foreground" },
    declined: { label: "Avslått", className: "bg-status-rejected text-status-rejected-foreground" },
    change_request: { label: "Tidsendring", className: "bg-status-time-change-proposed text-status-time-change-proposed-foreground" },
  };

  const allSameStatus = acceptanceStatuses && acceptanceStatuses.length > 0
    ? acceptanceStatuses.every((a) => a.status === acceptanceStatuses[0].status)
    : false;

  return (
    <div className={cn("space-y-2", className)}>
      {/* Execution */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground w-16 shrink-0">Utførelse</span>
        <JobStatusBadge status={executionStatus} size="sm" />
      </div>

      {/* Acceptance */}
      {acceptanceStatuses && acceptanceStatuses.length > 0 && (
        <div className="flex items-start gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground w-16 shrink-0 pt-0.5">Svar</span>
          {allSameStatus ? (
            <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium", approvalDisplayMap[acceptanceStatuses[0].status]?.className || "bg-muted text-muted-foreground")}>
              {acceptanceStatuses.length > 1 ? "Alle " : ""}{approvalDisplayMap[acceptanceStatuses[0].status]?.label || acceptanceStatuses[0].status}
            </span>
          ) : (
            <div className="flex flex-col gap-1">
              {acceptanceStatuses.map((a, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="text-[11px] text-foreground font-medium">{a.techName}:</span>
                  <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium", approvalDisplayMap[a.status]?.className || "bg-muted text-muted-foreground")}>
                    {approvalDisplayMap[a.status]?.label || a.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Billing */}
      {billingStatus && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground w-16 shrink-0">Økonomi</span>
          <JobStatusBadge status={billingStatus} size="sm" />
        </div>
      )}
    </div>
  );
}
