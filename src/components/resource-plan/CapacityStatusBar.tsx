import { memo, useMemo } from "react";
import { UserCheck, UserMinus, Users, AlertTriangle } from "lucide-react";
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
      const dayPercent = tc.days[todayDayIndex]?.percent ?? 0;
      if (dayPercent > 100) overbooked++;
      else if (dayPercent >= 90) full++;
      else if (dayPercent >= 50) partial++;
      else free++;
    }
    return { free, partial, full, overbooked };
  }, [techCapacities, todayDayIndex]);

  const items = [
    {
      key: "available" as const,
      label: "Ledige",
      count: counts.free,
      icon: UserCheck,
      colorClass: "text-success bg-success/10 border-success/20",
      activeClass: "ring-2 ring-success/40",
    },
    {
      key: "partial" as const,
      label: "Delvis",
      count: counts.partial,
      icon: UserMinus,
      colorClass: "text-warning bg-warning/10 border-warning/20",
      activeClass: "ring-2 ring-warning/40",
    },
    {
      key: "full" as const,
      label: "Fullbooket",
      count: counts.full,
      icon: Users,
      colorClass: "text-destructive bg-destructive/10 border-destructive/20",
      activeClass: "ring-2 ring-destructive/40",
    },
    {
      key: "overbooked" as const,
      label: "Overbooket",
      count: counts.overbooked,
      icon: AlertTriangle,
      colorClass: "text-destructive bg-destructive/15 border-destructive/30",
      activeClass: "ring-2 ring-destructive/50",
      hide: counts.overbooked === 0,
    },
  ];

  return (
    <div className="flex items-center gap-2 mb-3">
      {items
        .filter((item) => !item.hide)
        .map((item) => {
          const Icon = item.icon;
          const isActive = activeFilter === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onFilterClick(isActive ? "all" : item.key)}
              className={`
                inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold
                transition-all cursor-pointer hover:scale-[1.02]
                ${item.colorClass}
                ${isActive ? item.activeClass : ""}
              `}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="text-lg font-bold tabular-nums">{item.count}</span>
              <span className="hidden sm:inline">{item.label}</span>
            </button>
          );
        })}
      <span className="text-xs text-muted-foreground ml-1">
        av {techCapacities.length} montører i dag
      </span>
    </div>
  );
});
