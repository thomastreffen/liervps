import { memo, useMemo } from "react";
import { UserCheck, UserMinus, Users, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TechDayCapacity } from "@/hooks/useCapacity";

interface CapacityStatusBarProps {
  techCapacities: TechDayCapacity[];
  todayDayIndex: number;
  onFilterClick: (filter: "all" | "available" | "partial" | "full" | "overbooked") => void;
  activeFilter: string;
}

export const CapacityStatusBar = memo(function CapacityStatusBar({
  techCapacities,
  todayDayIndex,
  onFilterClick,
  activeFilter,
}: CapacityStatusBarProps) {
  const counts = useMemo(() => {
    let free = 0, partial = 0, full = 0, overbooked = 0;
    for (const tc of techCapacities) {
      const wp = tc.weekPercent;
      if (wp > 100) overbooked++;
      else if (wp >= 90) full++;
      else if (wp >= 50) partial++;
      else free++;
    }
    return { free, partial, full, overbooked };
  }, [techCapacities]);

  const items = [
    { key: "available" as const, label: "Ledige", count: counts.free, icon: UserCheck, colorClass: "text-success", dotClass: "bg-success" },
    { key: "partial" as const, label: "Delvis", count: counts.partial, icon: UserMinus, colorClass: "text-warning", dotClass: "bg-warning" },
    { key: "full" as const, label: "Fullbooket", count: counts.full, icon: Users, colorClass: "text-destructive", dotClass: "bg-destructive" },
    { key: "overbooked" as const, label: "Overbooket", count: counts.overbooked, icon: AlertTriangle, colorClass: "text-destructive", dotClass: "bg-destructive", hide: counts.overbooked === 0 },
  ];

  return (
    <div className="flex items-center gap-1.5 mb-1">
      {items
        .filter((item) => !item.hide)
        .map((item) => {
          const isActive = activeFilter === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onFilterClick(isActive ? "all" : item.key)}
              className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium transition-all cursor-pointer",
                "border border-border/30 hover:bg-muted/50",
                isActive && "ring-1 ring-primary bg-muted",
              )}
            >
              <span className={cn("h-2 w-2 rounded-full", item.dotClass)} />
              <span className="font-bold tabular-nums">{item.count}</span>
              <span className="text-muted-foreground">{item.label}</span>
            </button>
          );
        })}
      <span className="text-[10px] text-muted-foreground ml-1">
        av {techCapacities.length} montører
      </span>
    </div>
  );
});
