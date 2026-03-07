import { memo } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, RotateCcw, UserCheck, UserMinus } from "lucide-react";
import { format, addWeeks, startOfWeek } from "date-fns";
import { nb } from "date-fns/locale";
import { MobileFilterSheet } from "./MobileFilterSheet";

type CalendarViewType = "timeGridDay" | "timeGridWeek" | "dayGridMonth" | "listWeek";

interface Technician {
  id: string;
  name: string;
  color: string | null;
}

interface MobileResourceHeaderProps {
  technicians: Technician[];
  selectedTechId: string | null;
  onSelectTech: (id: string | null) => void;
  capacityFilter: "all" | "available" | "partial";
  onCapacityFilterChange: (v: "all" | "available" | "partial") => void;
  calendarView: CalendarViewType;
  onCalendarViewChange: (v: CalendarViewType) => void;
  referenceDate: Date;
  isCurrentPeriod: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  // Filter sheet props
  externalBlocksCapacity: boolean;
  onExternalBlocksCapacityChange: (v: boolean) => void;
  hideExternalEvents: boolean;
  onHideExternalEventsChange: (v: boolean) => void;
  isSuperAdmin: boolean;
  minFreeMinutes: number | null;
  onMinFreeMinutesChange: (v: number | null) => void;
}

const VIEW_OPTIONS: { value: CalendarViewType; label: string }[] = [
  { value: "timeGridDay", label: "Dag" },
  { value: "timeGridWeek", label: "Uke" },
  { value: "dayGridMonth", label: "Mnd" },
  { value: "listWeek", label: "Liste" },
];

export const MobileResourceHeader = memo(function MobileResourceHeader(props: MobileResourceHeaderProps) {
  const {
    technicians, selectedTechId, onSelectTech,
    capacityFilter, onCapacityFilterChange,
    calendarView, onCalendarViewChange,
    referenceDate, isCurrentPeriod, onPrev, onNext, onToday,
    ...filterProps
  } = props;

  const weekStart = startOfWeek(referenceDate, { weekStartsOn: 1 });

  const periodLabel = calendarView === "dayGridMonth"
    ? format(referenceDate, "MMM yyyy", { locale: nb })
    : calendarView === "timeGridDay"
    ? format(referenceDate, "EEE d. MMM", { locale: nb })
    : `Uke ${format(weekStart, "w", { locale: nb })}`;

  return (
    <div className="space-y-2 mb-3">
      {/* Row 1: Technician + capacity filter */}
      <div className="flex items-center gap-2">
        <Select value={selectedTechId || "all"} onValueChange={(v) => onSelectTech(v === "all" ? null : v)}>
          <SelectTrigger className="flex-1 h-8 text-xs rounded-lg">
            <SelectValue placeholder="Alle montører" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle montører</SelectItem>
            {technicians.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: t.color || "#6366f1" }} />
                  {t.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-0.5 border border-border/40 rounded-lg p-0.5 shrink-0">
          <Button
            variant={capacityFilter === "all" ? "default" : "ghost"}
            size="sm"
            className="h-7 text-[11px] rounded-md px-2"
            onClick={() => onCapacityFilterChange("all")}
          >
            Alle
          </Button>
          <Button
            variant={capacityFilter === "available" ? "default" : "ghost"}
            size="sm"
            className="h-7 text-[11px] rounded-md px-1.5 gap-0.5"
            onClick={() => onCapacityFilterChange("available")}
          >
            <UserCheck className="h-3 w-3" />
            Ledig
          </Button>
          <Button
            variant={capacityFilter === "partial" ? "default" : "ghost"}
            size="sm"
            className="h-7 text-[11px] rounded-md px-1.5 gap-0.5"
            onClick={() => onCapacityFilterChange("partial")}
          >
            <UserMinus className="h-3 w-3" />
            Delvis
          </Button>
        </div>
      </div>

      {/* Row 2: Period nav + view switcher + filter icon */}
      <div className="flex items-center gap-1.5">
        <Button variant="ghost" size="icon" onClick={onPrev} className="h-7 w-7 rounded-lg shrink-0">
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="flex-1 text-center">
          <span className="text-sm font-semibold">{periodLabel}</span>
        </div>

        {!isCurrentPeriod && (
          <Button variant="ghost" size="icon" onClick={onToday} className="h-7 w-7 rounded-lg shrink-0">
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        )}

        <Button variant="ghost" size="icon" onClick={onNext} className="h-7 w-7 rounded-lg shrink-0">
          <ChevronRight className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-0.5 border border-border/40 rounded-lg p-0.5 shrink-0">
          {VIEW_OPTIONS.map((v) => (
            <Button
              key={v.value}
              variant={calendarView === v.value ? "default" : "ghost"}
              size="sm"
              className="h-6 text-[10px] rounded-md px-1.5"
              onClick={() => onCalendarViewChange(v.value)}
            >
              {v.label}
            </Button>
          ))}
        </div>

        <MobileFilterSheet {...filterProps} />
      </div>
    </div>
  );
});
