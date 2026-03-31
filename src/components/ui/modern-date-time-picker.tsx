import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { Calendar as CalendarIcon, Clock, X, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

/* ─── 24/7 time slots ─── */
const TIME_SLOTS: string[] = [];
for (let h = 0; h < 24; h++) {
  for (const m of [0, 30]) {
    TIME_SLOTS.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
}

const QUICK_PRESETS = [
  { label: "Morgen", value: "07:00" },
  { label: "Formiddag", value: "10:00" },
  { label: "Ettermiddag", value: "13:00" },
  { label: "Kveld", value: "18:00" },
  { label: "Natt", value: "22:00" },
  { label: "Fleksibelt", value: "flex" },
] as const;

/* ─── Types ─── */
interface ModernDateTimePickerProps {
  dateValue?: string;
  timeValue?: string;
  onDateChange: (date: string) => void;
  onTimeChange?: (time: string) => void;
  showTime?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

/* ─── Main Component ─── */
export function ModernDateTimePicker({
  dateValue, timeValue, onDateChange, onTimeChange,
  showTime = false, disabled = false, placeholder = "Velg dato", className,
}: ModernDateTimePickerProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"date" | "time">("date");

  const selectedDate = useMemo(() => {
    if (!dateValue) return undefined;
    const d = new Date(dateValue + "T00:00:00");
    return isNaN(d.getTime()) ? undefined : d;
  }, [dateValue]);

  const displayText = useMemo(() => {
    if (!dateValue) return "";
    const d = selectedDate;
    if (!d) return dateValue;
    let text = format(d, "d. MMM yyyy", { locale: nb });
    if (showTime && timeValue) {
      text += timeValue === "flex" ? " · Fleksibelt" : ` · ${timeValue}`;
    }
    return text;
  }, [dateValue, timeValue, selectedDate, showTime]);

  const handleDateSelect = useCallback((day: Date | undefined) => {
    if (!day) return;
    const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
    onDateChange(iso);
    if (showTime && onTimeChange) setStep("time");
    else setOpen(false);
  }, [onDateChange, onTimeChange, showTime]);

  const handleTimeSelect = useCallback((t: string) => {
    onTimeChange?.(t);
    setOpen(false);
    setStep("date");
  }, [onTimeChange]);

  const handleOpen = useCallback((v: boolean) => {
    setOpen(v);
    if (v) setStep("date");
  }, []);

  const pickerContent = (
    <div className="flex flex-col">
      {showTime && (
        <div className="flex items-center gap-2 px-3 pt-3 pb-1">
          <button type="button" onClick={() => setStep("date")}
            className={cn("flex items-center gap-1 text-xs font-medium rounded-full px-2.5 py-1 transition-colors",
              step === "date" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}>
            <CalendarIcon className="h-3 w-3" /> Dato
          </button>
          <div className="h-px w-3 bg-border" />
          <button type="button" onClick={() => dateValue && setStep("time")} disabled={!dateValue}
            className={cn("flex items-center gap-1 text-xs font-medium rounded-full px-2.5 py-1 transition-colors",
              step === "time" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80",
              !dateValue && "opacity-40 cursor-not-allowed")}>
            <Clock className="h-3 w-3" /> Tid
          </button>
        </div>
      )}
      {step === "date" && (
        <Calendar mode="single" selected={selectedDate} onSelect={handleDateSelect} locale={nb}
          disabled={(d) => { const t = new Date(); t.setHours(0,0,0,0); return d < t; }}
          className={cn("p-3 pointer-events-auto", isMobile && "[&_.rdp-day]:h-11 [&_.rdp-day]:w-11 [&_.rdp-head_cell]:w-11")}
          initialFocus />
      )}
      {step === "time" && <TimePicker value={timeValue} onSelect={handleTimeSelect} isMobile={isMobile} />}
    </div>
  );

  const triggerButton = (
    <button type="button" disabled={disabled}
      onClick={() => isMobile && handleOpen(true)}
      className={cn(
        "flex items-center gap-2 w-full rounded-xl border border-input bg-background px-3 text-left text-sm transition-colors",
        "hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        isMobile ? "h-12 text-base" : "h-10", !displayText && "text-muted-foreground", className)}>
      <CalendarIcon className={cn("shrink-0 text-muted-foreground", isMobile ? "h-5 w-5" : "h-4 w-4")} />
      <span className="flex-1 truncate">{displayText || placeholder}</span>
      {displayText && !disabled && (
        <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground shrink-0"
          onClick={(e) => { e.stopPropagation(); onDateChange(""); onTimeChange?.(""); }} />
      )}
    </button>
  );

  if (isMobile) {
    return (
      <>
        {triggerButton}
        <Sheet open={open} onOpenChange={handleOpen}>
          <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto px-2">
            <SheetHeader className="pb-0">
              <SheetTitle className="text-base">{step === "date" ? "Velg dato" : "Velg tidspunkt"}</SheetTitle>
            </SheetHeader>
            {pickerContent}
            {step === "time" && (
              <div className="px-4 pb-4 pt-2">
                <Button className="w-full h-12 text-base rounded-xl" onClick={() => setOpen(false)}>Ferdig</Button>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start" sideOffset={4} avoidCollisions={false}>
        {pickerContent}
      </PopoverContent>
    </Popover>
  );
}

/* ─── TimePicker: two-phase (presets → full grid) ─── */
function TimePicker({ value, onSelect, isMobile }: { value?: string; onSelect: (t: string) => void; isMobile: boolean }) {
  const [showGrid, setShowGrid] = useState(false);
  const activeRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showGrid && activeRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const el = activeRef.current;
      container.scrollTop = el.offsetTop - container.offsetTop - 60;
    }
  }, [showGrid]);

  if (showGrid) {
    return (
      <div className="p-3">
        <button type="button" onClick={() => setShowGrid(false)}
          className="text-xs text-muted-foreground hover:text-foreground mb-2 flex items-center gap-1">
          ← Tilbake
        </button>
        <div ref={scrollRef}
          className={cn("grid grid-cols-4 gap-1 overflow-y-auto", isMobile ? "max-h-[300px]" : "max-h-[240px]")}>
          {TIME_SLOTS.map((t) => (
            <button type="button" key={t} ref={value === t ? activeRef : undefined}
              onClick={() => onSelect(t)}
              className={cn(
                "rounded-md border text-sm tabular-nums transition-colors",
                isMobile ? "py-2.5" : "py-1.5",
                "hover:border-primary hover:bg-primary/5",
                value === t ? "border-primary bg-primary/10 text-primary font-medium" : "border-border text-foreground")}>
              {t}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {QUICK_PRESETS.map((p) => (
          <button type="button" key={p.value} onClick={() => onSelect(p.value)}
            className={cn(
              "rounded-lg border text-xs px-3 py-2 transition-colors",
              "hover:border-primary hover:bg-primary/5",
              value === p.value ? "border-primary bg-primary/10 text-primary font-medium" : "border-border text-foreground")}>
            {p.label}
          </button>
        ))}
      </div>
      <button type="button" onClick={() => setShowGrid(true)}
        className="flex items-center justify-between w-full text-xs text-muted-foreground hover:text-foreground rounded-lg border border-dashed border-border px-3 py-2 transition-colors hover:border-primary/40">
        <span>Velg eksakt klokkeslett</span>
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/* ─── Simple date-only variant ─── */
export function ModernDatePicker({ value, onChange, disabled, placeholder, className }: {
  value?: string; onChange: (v: string) => void; disabled?: boolean; placeholder?: string; className?: string;
}) {
  return <ModernDateTimePicker dateValue={value} onDateChange={onChange} showTime={false} disabled={disabled}
    placeholder={placeholder || "Velg dato"} className={className} />;
}

/* ─── Simple time-only picker ─── */
export function ModernTimePicker({ value, onChange, disabled, className }: {
  value?: string; onChange: (v: string) => void; disabled?: boolean; className?: string;
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  const handleSelect = (t: string) => { onChange(t); setOpen(false); };
  const displayText = value ? (value === "flex" ? "Fleksibelt" : value) : "";

  const trigger = (
    <button type="button" disabled={disabled} onClick={() => isMobile && setOpen(true)}
      className={cn(
        "flex items-center gap-2 w-full rounded-xl border border-input bg-background px-3 text-left text-sm transition-colors",
        "hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        isMobile ? "h-12 text-base" : "h-10", !displayText && "text-muted-foreground", className)}>
      <Clock className={cn("shrink-0 text-muted-foreground", isMobile ? "h-5 w-5" : "h-4 w-4")} />
      <span className="flex-1 truncate">{displayText || "Velg tid"}</span>
      {displayText && !disabled && (
        <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground shrink-0"
          onClick={(e) => { e.stopPropagation(); onChange(""); }} />
      )}
    </button>
  );

  if (isMobile) {
    return (
      <>
        {trigger}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto px-2">
            <SheetHeader className="pb-0"><SheetTitle className="text-base">Velg tidspunkt</SheetTitle></SheetHeader>
            <TimePicker value={value} onSelect={handleSelect} isMobile={isMobile} />
            <div className="px-4 pb-4 pt-2">
              <Button className="w-full h-12 text-base rounded-xl" onClick={() => setOpen(false)}>Ferdig</Button>
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start" sideOffset={4} avoidCollisions={false}>
        <TimePicker value={value} onSelect={handleSelect} isMobile={isMobile} />
      </PopoverContent>
    </Popover>
  );
}
