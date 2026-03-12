import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 15-minute interval time selector (06:00–23:45).
 * Existing non-15-min values are displayed correctly via freeform fallback.
 */

const TIME_OPTIONS: { value: string; label: string }[] = [];
for (let h = 0; h < 24; h++) {
  for (const m of [0, 15, 30, 45]) {
    const val = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    TIME_OPTIONS.push({ value: val, label: val });
  }
}

interface TimeSelectProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

export function TimeSelect({ value, onChange, className, disabled }: TimeSelectProps) {
  // If value is not in standard 15-min list, add it so it displays correctly
  const hasValue = TIME_OPTIONS.some((o) => o.value === value);
  const options = hasValue
    ? TIME_OPTIONS
    : [{ value, label: `${value} ●` }, ...TIME_OPTIONS];

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={cn("h-9 w-[100px]", className)}>
        <Clock className="h-3.5 w-3.5 mr-1 text-muted-foreground shrink-0" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-60">
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
