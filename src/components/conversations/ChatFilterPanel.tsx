import { useState } from "react";
import { Filter, X, MapPin, Box, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface ChatFilter {
  location?: string;
  objectType?: string;
  tags?: string[];
  search?: string;
}

const OBJECT_TYPES = [
  { value: "room", label: "Rom" },
  { value: "board", label: "Tavle" },
  { value: "field", label: "Område" },
];

const WORK_TAGS = [
  { value: "service", label: "Service" },
  { value: "avvik", label: "Avvik" },
  { value: "fdv", label: "FDV" },
  { value: "tilbud", label: "Tilbud" },
  { value: "montasje", label: "Montasje" },
];

interface ChatFilterPanelProps {
  filter: ChatFilter;
  onFilterChange: (filter: ChatFilter) => void;
  activeCount: number;
}

export function ChatFilterPanel({ filter, onFilterChange, activeCount }: ChatFilterPanelProps) {
  const [open, setOpen] = useState(false);

  const clearAll = () => onFilterChange({});

  const toggleTag = (tag: string) => {
    const current = filter.tags || [];
    const next = current.includes(tag) ? current.filter(t => t !== tag) : [...current, tag];
    onFilterChange({ ...filter, tags: next.length > 0 ? next : undefined });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className={cn(
          "relative inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md transition-colors cursor-pointer",
          activeCount > 0
            ? "text-primary bg-primary/10 hover:bg-primary/15"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
        )}>
          <Filter className="h-3 w-3" />
          Filter
          {activeCount > 0 && (
            <span className="ml-0.5 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[9px] flex items-center justify-center font-bold">
              {activeCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3 space-y-3">
        {/* Location search */}
        <div>
          <label className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1 mb-1">
            <MapPin className="h-2.5 w-2.5" /> Lokasjon
          </label>
          <Input
            value={filter.location || ""}
            onChange={e => onFilterChange({ ...filter, location: e.target.value || undefined })}
            placeholder="Søk lokasjon..."
            className="h-7 text-[11px]"
          />
        </div>

        {/* Object type */}
        <div>
          <label className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1 mb-1">
            <Box className="h-2.5 w-2.5" /> Objekt-type
          </label>
          <div className="flex flex-wrap gap-1">
            {OBJECT_TYPES.map(opt => (
              <button
                key={opt.value}
                onClick={() => onFilterChange({
                  ...filter,
                  objectType: filter.objectType === opt.value ? undefined : opt.value,
                })}
                className={cn(
                  "text-[10px] px-2 py-0.5 rounded-full border cursor-pointer transition-colors",
                  filter.objectType === opt.value
                    ? "border-primary bg-primary/10 text-primary font-medium"
                    : "border-border/40 text-muted-foreground hover:bg-muted/50"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1 mb-1">
            <Tag className="h-2.5 w-2.5" /> Arbeidstype
          </label>
          <div className="flex flex-wrap gap-1">
            {WORK_TAGS.map(opt => (
              <button
                key={opt.value}
                onClick={() => toggleTag(opt.value)}
                className={cn(
                  "text-[10px] px-2 py-0.5 rounded-full border cursor-pointer transition-colors",
                  (filter.tags || []).includes(opt.value)
                    ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 font-medium"
                    : "border-border/40 text-muted-foreground hover:bg-muted/50"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {activeCount > 0 && (
          <Button variant="ghost" size="sm" className="w-full text-xs h-7 text-destructive" onClick={clearAll}>
            <X className="h-3 w-3 mr-1" /> Nullstill filter
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
