import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CustomerValueLevel } from "@/hooks/useCustomerValueLevels";

interface BadgeProps {
  level: CustomerValueLevel | null;
}

export function CustomerValueBadge({ level }: BadgeProps) {
  if (!level) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <Badge
      className="text-[10px] rounded-lg font-bold"
      style={{ backgroundColor: level.color + "20", color: level.color, borderColor: level.color + "40" }}
    >
      {level.code}
    </Badge>
  );
}

interface SelectorProps {
  value: string | null;
  levels: CustomerValueLevel[];
  onChange: (code: string | null) => void;
}

export function CustomerValueSelector({ value, levels, onChange }: SelectorProps) {
  return (
    <Select value={value || "__none__"} onValueChange={(v) => onChange(v === "__none__" ? null : v)}>
      <SelectTrigger className="h-8 text-xs rounded-lg w-32">
        <SelectValue placeholder="Velg verdi" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">Ikke satt</SelectItem>
        {levels.map((l) => (
          <SelectItem key={l.code} value={l.code}>
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: l.color }} />
              {l.code} – {l.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
