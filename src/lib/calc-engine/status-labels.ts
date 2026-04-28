// Norske statuslabels + farger for kalkylemotoren
export type CalcStatusKind = "calculation" | "case" | "draft";

export interface StatusBadge {
  label: string;
  className: string;
}

const palette: Record<string, string> = {
  draft: "bg-amber-100 text-amber-900 border-amber-200",
  ready: "bg-sky-100 text-sky-900 border-sky-200",
  active: "bg-sky-100 text-sky-900 border-sky-200",
  in_progress: "bg-sky-100 text-sky-900 border-sky-200",
  applied: "bg-emerald-100 text-emerald-900 border-emerald-200",
  approved: "bg-emerald-100 text-emerald-900 border-emerald-200",
  done: "bg-emerald-100 text-emerald-900 border-emerald-200",
  archived: "bg-muted text-muted-foreground border-border",
  cancelled: "bg-muted text-muted-foreground border-border",
  rejected: "bg-rose-100 text-rose-900 border-rose-200",
  partial: "bg-violet-100 text-violet-900 border-violet-200",
};

const labels: Record<CalcStatusKind, Record<string, string>> = {
  calculation: {
    draft: "Utkast",
    ready: "Klar",
    active: "Aktiv",
    approved: "Godkjent",
    archived: "Arkivert",
    cancelled: "Avbrutt",
  },
  case: {
    draft: "Utkast",
    ready: "Klar",
    active: "Aktiv",
    in_progress: "Under arbeid",
    applied: "Ferdig",
    done: "Ferdig",
    archived: "Arkivert",
  },
  draft: {
    draft: "Utkast",
    analyzing: "Analyserer",
    ready: "Klar til bruk",
    applied: "Ferdig brukt",
    archived: "Arkivert",
  },
};

export function getStatusBadge(kind: CalcStatusKind, status?: string | null): StatusBadge {
  const key = (status ?? "draft").toLowerCase();
  return {
    label: labels[kind]?.[key] ?? status ?? "—",
    className: palette[key] ?? "bg-muted text-muted-foreground border-border",
  };
}

export function formatDateTime(value?: string | Date | null): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("nb-NO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}
