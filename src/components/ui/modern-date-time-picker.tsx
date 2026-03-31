import { useState, useMemo, useCallback } from "react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

/* ─── Quick-select presets ─── */
const QUICK_TIMES = [
  { label: "Morgen", value: "08:00", desc: "kl. 08:00" },
  { label: "Formiddag", value: "10:00", desc: "kl. 10:00" },
  { label: "Ettermiddag", value: "13:00", desc: "kl. 13:00" },
  { label: "Fleksibelt", value: "flex", desc: "Ingen fast tid" },
] as const;

const TIME_SLOTS: string[] = [];
for (let h = 7; h <= 18; h++) {
  for (const m of [0, 30]) {
    TIME_SLOTS.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
}

/* ─── Types ─── */
interface ModernDateTimePickerProps {
  /** ISO date string YYYY-MM-DD */
  dateValue?: string;
  /** HH:MM or "flex" */
  timeValue?: string;
  onDateChange: (date: string) => void;
  onTimeChange?: (time: string) => void;
  /** Show time picker */
  showTime?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

/* ─── Component ─── */
export function ModernDateTimePicker({
  dateValue,
  timeValue,
  onDateChange,
  onTimeChange,
  showTime = false,
  disabled = false,
  placeholder = "Velg dato",
  className,
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
    let text = format(d, "d. MMMM yyyy", { locale: nb });
    if (showTime && timeValue) {
      text += timeValue === "flex" ? " · Fleksibelt" : ` · kl. ${timeValue}`;
    }
    return text;
  }, [dateValue, timeValue, selectedDate, showTime]);

  const handleDateSelect = useCallback(
    (day: Date | undefined) => {
      if (!day) return;
      const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
      onDateChange(iso);
      if (showTime && onTimeChange) {
        setStep("time");
      } else {
        setOpen(false);
      }
    },
    [onDateChange, onTimeChange, showTime],
  );

  const handleTimeSelect = useCallback(
    (t: string) => {
      onTimeChange?.(t);
      setOpen(false);
      setStep("date");
    },
    [onTimeChange],
  );

  const handleOpen = useCallback(
    (v: boolean) => {
      setOpen(v);
      if (v) setStep("date");
    },
    [],
  );

  /* ─── Picker content (shared between popover & sheet) ─── */
  const pickerContent = (
    <div className="flex flex-col">
      {/* Step indicator when time enabled */}
      {showTime && (
        <div className="flex items-center gap-2 px-4 pt-3 pb-1">
          <button
            type="button"
            onClick={() => setStep("date")}
            className={cn(
              "flex items-center gap-1.5 text-xs font-medium rounded-full px-3 py-1 transition-colors",
              step === "date"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
            )}
          >
            <CalendarIcon className="h-3 w-3" /> Dato
          </button>
          <div className="h-px w-4 bg-border" />
          <button
            type="button"
            onClick={() => dateValue && setStep("time")}
            disabled={!dateValue}
            className={cn(
              "flex items-center gap-1.5 text-xs font-medium rounded-full px-3 py-1 transition-colors",
              step === "time"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
              !dateValue && "opacity-40 cursor-not-allowed",
            )}
          >
            <Clock className="h-3 w-3" /> Tid
          </button>
        </div>
      )}

      {/* Date step */}
      {step === "date" && (
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleDateSelect}
          locale={nb}
          disabled={(d) => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return d < today;
          }}
          className={cn("p-3 pointer-events-auto", isMobile && "[&_.rdp-day]:h-11 [&_.rdp-day]:w-11 [&_.rdp-head_cell]:w-11")}
          initialFocus
        />
      )}

      {/* Time step */}
      {step === "time" && (
        <div className="p-4 space-y-4">
          {/* Quick presets */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Hurtigvalg</p>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_TIMES.map((q) => (
                <button
                  type="button"
                  key={q.value}
                  onClick={() => handleTimeSelect(q.value)}
                  className={cn(
                    "flex flex-col items-center justify-center rounded-xl border p-3 text-sm transition-all",
                    "hover:border-primary hover:bg-primary/5",
                    timeValue === q.value
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-border text-foreground",
                    isMobile && "p-4 text-base",
                  )}
                >
                  <span className="font-medium">{q.label}</span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">{q.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Grid of time slots */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Velg klokkeslett</p>
            <div className="grid grid-cols-4 gap-1.5 max-h-[200px] overflow-y-auto">
              {TIME_SLOTS.map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => handleTimeSelect(t)}
                  className={cn(
                    "rounded-lg border text-sm py-2 transition-all",
                    "hover:border-primary hover:bg-primary/5",
                    timeValue === t
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-border text-foreground",
                    isMobile && "py-3 text-base",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  /* ─── Trigger button ─── */
  const triggerButton = (
    <button
      type="button"
      disabled={disabled}
      onClick={() => handleOpen(true)}
      className={cn(
        "flex items-center gap-2 w-full rounded-xl border border-input bg-background px-3 text-left text-sm transition-colors",
        "hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        isMobile ? "h-12 text-base" : "h-10",
        !displayText && "text-muted-foreground",
        className,
      )}
    >
      <CalendarIcon className={cn("shrink-0 text-muted-foreground", isMobile ? "h-5 w-5" : "h-4 w-4")} />
      <span className="flex-1 truncate">{displayText || placeholder}</span>
      {displayText && !disabled && (
        <X
          className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onDateChange("");
            onTimeChange?.("");
          }}
        />
      )}
    </button>
  );

  /* ─── Mobile: bottom sheet ─── */
  if (isMobile) {
    return (
      <>
        {triggerButton}
        <Sheet open={open} onOpenChange={handleOpen}>
          <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto px-2">
            <SheetHeader className="pb-0">
              <SheetTitle className="text-base">
                {step === "date" ? "Velg dato" : "Velg tidspunkt"}
              </SheetTitle>
            </SheetHeader>
            {pickerContent}
            {step === "time" && (
              <div className="px-4 pb-4 pt-2">
                <Button className="w-full h-12 text-base rounded-xl" onClick={() => setOpen(false)}>
                  Ferdig
                </Button>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </>
    );
  }

  /* ─── Desktop: popover ─── */
  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        {pickerContent}
      </PopoverContent>
    </Popover>
  );
}

/* ─── Simple date-only variant ─── */
export function ModernDatePicker({
  value,
  onChange,
  disabled,
  placeholder,
  className,
}: {
  value?: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}) {
  return (
    <ModernDateTimePicker
      dateValue={value}
      onDateChange={onChange}
      showTime={false}
      disabled={disabled}
      placeholder={placeholder || "Velg dato"}
      className={className}
    />
  );
}

/* ─── Simple time-only picker ─── */
export function ModernTimePicker({
  value,
  onChange,
  disabled,
  className,
}: {
  value?: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  const handleSelect = (t: string) => {
    onChange(t);
    setOpen(false);
  };

  const displayText = value
    ? value === "flex"
      ? "Fleksibelt"
      : `kl. ${value}`
    : "";

  const content = (
    <div className="p-4 space-y-4">
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">Hurtigvalg</p>
        <div className="grid grid-cols-2 gap-2">
          {QUICK_TIMES.map((q) => (
            <button
              type="button"
              key={q.value}
              onClick={() => handleSelect(q.value)}
              className={cn(
                "flex flex-col items-center rounded-xl border p-3 text-sm transition-all",
                "hover:border-primary hover:bg-primary/5",
                value === q.value
                  ? "border-primary bg-primary/10 text-primary font-medium"
                  : "border-border text-foreground",
                isMobile && "p-4 text-base",
              )}
            >
              <span className="font-medium">{q.label}</span>
              <span className="text-[10px] text-muted-foreground mt-0.5">{q.desc}</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">Velg klokkeslett</p>
        <div className="grid grid-cols-4 gap-1.5 max-h-[200px] overflow-y-auto">
          {TIME_SLOTS.map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => handleSelect(t)}
              className={cn(
                "rounded-lg border text-sm py-2 transition-all",
                "hover:border-primary hover:bg-primary/5",
                value === t
                  ? "border-primary bg-primary/10 text-primary font-medium"
                  : "border-border text-foreground",
                isMobile && "py-3 text-base",
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const trigger = (
    <button
      type="button"
      disabled={disabled}
      onClick={() => setOpen(true)}
      className={cn(
        "flex items-center gap-2 w-full rounded-xl border border-input bg-background px-3 text-left text-sm transition-colors",
        "hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        isMobile ? "h-12 text-base" : "h-10",
        !displayText && "text-muted-foreground",
        className,
      )}
    >
      <Clock className={cn("shrink-0 text-muted-foreground", isMobile ? "h-5 w-5" : "h-4 w-4")} />
      <span className="flex-1 truncate">{displayText || "Velg tid"}</span>
      {displayText && !disabled && (
        <X
          className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onChange("");
          }}
        />
      )}
    </button>
  );

  if (isMobile) {
    return (
      <>
        {trigger}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto px-2">
            <SheetHeader className="pb-0">
              <SheetTitle className="text-base">Velg tidspunkt</SheetTitle>
            </SheetHeader>
            {content}
            <div className="px-4 pb-4 pt-2">
              <Button className="w-full h-12 text-base rounded-xl" onClick={() => setOpen(false)}>
                Ferdig
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        {content}
      </PopoverContent>
    </Popover>
  );
}
