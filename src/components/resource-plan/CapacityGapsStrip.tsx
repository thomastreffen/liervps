import { useState, useMemo } from "react";
import { Battery, ChevronDown, ChevronUp, Clock } from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { CapacityGapsSummary, CapacityGap } from "@/hooks/useCapacityGaps";

interface Props {
  summary: CapacityGapsSummary;
  onGapClick?: (gap: CapacityGap) => void;
}

function fmtHour(h: number): string {
  const hours = Math.floor(h);
  const minutes = Math.round((h - hours) * 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function fmtDuration(min: number): string {
  if (min >= 60) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m > 0 ? `${h}t ${m}m` : `${h}t`;
  }
  return `${min}m`;
}

export function CapacityGapsStrip({ summary, onGapClick }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (summary.totalUnusedMinutes < 60) return null;

  const totalHours = Math.round(summary.totalUnusedMinutes / 60 * 10) / 10;
  const visibleGaps = expanded ? summary.topGaps : summary.topGaps.slice(0, 3);

  return (
    <div className="mb-1">
      {/* Summary line */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground shrink-0 mr-0.5">
          Kapasitet
        </span>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={cn(
            "inline-flex items-center gap-1 rounded-md border border-border/30 px-2 py-0.5 text-[11px] font-medium transition-all",
            "text-success hover:bg-success/10",
          )}
        >
          <Battery className="h-2.5 w-2.5" />
          <span className="font-bold">{totalHours}t</span>
          <span className="text-[10px]">ledig</span>
          {summary.underutilizedTechCount > 0 && (
            <span className="text-muted-foreground text-[10px] ml-0.5">
              · {summary.underutilizedTechCount} montør{summary.underutilizedTechCount > 1 ? "er" : ""} underutnyttet
            </span>
          )}
          {summary.topGaps.length > 3 && (
            expanded
              ? <ChevronUp className="h-2.5 w-2.5 ml-0.5 text-muted-foreground" />
              : <ChevronDown className="h-2.5 w-2.5 ml-0.5 text-muted-foreground" />
          )}
        </button>

        {/* Inline gap chips (compact) */}
        {visibleGaps.map((gap, i) => (
          <button
            key={`${gap.techId}-${gap.dayKey}-${gap.startHour}`}
            type="button"
            onClick={() => onGapClick?.(gap)}
            className="inline-flex items-center gap-1 rounded-md border border-border/20 px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all shrink-0"
          >
            <Clock className="h-2 w-2 shrink-0" />
            <span className="font-medium truncate max-w-[120px]">
              {gap.techName.split(" ")[0]}
            </span>
            <span>
              {format(gap.date, "EEE", { locale: nb })} {fmtHour(gap.startHour)}–{fmtHour(gap.endHour)}
            </span>
            <span className="font-bold">{fmtDuration(gap.durationMinutes)}</span>
          </button>
        ))}

        {!expanded && summary.topGaps.length > 3 && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            +{summary.topGaps.length - 3}
          </button>
        )}
      </div>
    </div>
  );
}
