import { differenceInMinutes, differenceInHours, differenceInDays } from "date-fns";

export function timeAgoLabel(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const now = new Date();
  const mins = differenceInMinutes(now, date);
  if (mins < 1) return "Akkurat nå";
  if (mins < 60) return `${mins} min siden`;
  const hours = differenceInHours(now, date);
  if (hours < 24) return `${hours} t siden`;
  const days = differenceInDays(now, date);
  if (days === 1) return "I går";
  if (days < 30) return `${days} dager siden`;
  return `${Math.floor(days / 30)} mnd siden`;
}

export function TimeAgo({ date, className }: { date: string | null | undefined; className?: string }) {
  const label = timeAgoLabel(date);
  if (!label) return null;
  return <span className={className ?? "text-xs text-muted-foreground"}>Oppdatert {label}</span>;
}
