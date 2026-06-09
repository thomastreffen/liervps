import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type SecurityStatus =
  | "unknown"
  | "not_required"
  | "needs_check"
  | "clearance_valid"
  | "authorization_required"
  | "pob_required"
  | "pending_customer"
  | "approved"
  | "expired"
  | "blocked";

const LABELS: Record<SecurityStatus, string> = {
  unknown: "Ukjent",
  not_required: "Ikke påkrevd",
  needs_check: "Må sjekkes",
  clearance_valid: "Klarering gyldig",
  authorization_required: "Autorisasjon kreves",
  pob_required: "POB kreves",
  pending_customer: "Venter kunde",
  approved: "Godkjent",
  expired: "Utløpt",
  blocked: "Blokkert",
};

const STYLES: Record<SecurityStatus, string> = {
  unknown: "bg-muted text-muted-foreground border-border",
  not_required: "bg-muted/60 text-muted-foreground border-border",
  needs_check: "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300",
  clearance_valid: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300",
  authorization_required: "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300",
  pob_required: "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300",
  pending_customer: "bg-blue-500/10 text-blue-700 border-blue-500/30 dark:text-blue-300",
  approved: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300",
  expired: "bg-destructive/10 text-destructive border-destructive/30",
  blocked: "bg-destructive/10 text-destructive border-destructive/30",
};

interface Props {
  status: SecurityStatus | string | null | undefined;
  label?: string;
  className?: string;
}

export function SecurityStatusBadge({ status, label, className }: Props) {
  const key = (status && status in LABELS ? status : "unknown") as SecurityStatus;
  return (
    <Badge variant="outline" className={cn("font-medium", STYLES[key], className)}>
      {label ?? LABELS[key]}
    </Badge>
  );
}
