import { useState } from "react";
import { MapPin, Tag, Box, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { type MessageContext } from "@/hooks/useContextBinding";

interface ContextPickerProps {
  context: MessageContext;
  recentLocations: string[];
  workTypeOptions: { value: string; label: string }[];
  objectTypeOptions: { value: string; label: string }[];
  onSetLocation: (text: string) => void;
  onSetObjectType: (type: string | null) => void;
  onSetObjectRef: (ref: string | null) => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
}

export function ContextPicker({
  context, recentLocations, workTypeOptions, objectTypeOptions,
  onSetLocation, onSetObjectType, onSetObjectRef, onAddTag, onRemoveTag,
}: ContextPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer px-2 py-1 rounded-md hover:bg-muted/50"
        >
          <MapPin className="h-3 w-3" />
          Legg til kontekst
          <ChevronDown className="h-2.5 w-2.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3 space-y-3">
        {/* Location */}
        <div>
          <Label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3 w-3" /> Lokasjon
          </Label>
          <Input
            value={context.location_text}
            onChange={e => onSetLocation(e.target.value)}
            placeholder="F.eks. Rom 2.14"
            className="mt-1 h-8 text-xs"
          />
          {recentLocations.length > 0 && !context.location_text && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {recentLocations.slice(0, 5).map(loc => (
                <button
                  key={loc}
                  onClick={() => onSetLocation(loc)}
                  className="text-[10px] px-2 py-0.5 rounded-full border border-border/40 bg-muted/30 hover:bg-muted/60 text-muted-foreground cursor-pointer transition-colors"
                >
                  {loc}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Object type */}
        <div>
          <Label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
            <Box className="h-3 w-3" /> Objekt-type
          </Label>
          <div className="flex flex-wrap gap-1 mt-1">
            {objectTypeOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => onSetObjectType(context.object_type === opt.value ? null : opt.value)}
                className={cn(
                  "text-[10px] px-2 py-1 rounded-full border transition-colors cursor-pointer",
                  context.object_type === opt.value
                    ? "border-primary bg-primary/10 text-primary font-medium"
                    : "border-border/40 bg-muted/20 text-muted-foreground hover:bg-muted/50"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {context.object_type && (
            <Input
              value={context.object_ref || ""}
              onChange={e => onSetObjectRef(e.target.value || null)}
              placeholder="Referanse (valgfritt)"
              className="mt-1.5 h-7 text-[11px]"
            />
          )}
        </div>

        {/* Work type tags */}
        <div>
          <Label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
            <Tag className="h-3 w-3" /> Arbeidstype
          </Label>
          <div className="flex flex-wrap gap-1 mt-1">
            {workTypeOptions.map(opt => {
              const active = context.tags.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  onClick={() => active ? onRemoveTag(opt.value) : onAddTag(opt.value)}
                  className={cn(
                    "text-[10px] px-2 py-1 rounded-full border transition-colors cursor-pointer",
                    active
                      ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 font-medium"
                      : "border-border/40 bg-muted/20 text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <Button size="sm" variant="outline" className="w-full text-xs h-7" onClick={() => setOpen(false)}>
          Ferdig
        </Button>
      </PopoverContent>
    </Popover>
  );
}
