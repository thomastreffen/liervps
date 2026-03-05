import { X, MapPin, Box, Tag } from "lucide-react";
import { type MessageContext } from "@/hooks/useContextBinding";
import { cn } from "@/lib/utils";

interface ContextChipsProps {
  context: MessageContext;
  onRemoveLocation?: () => void;
  onRemoveObjectType?: () => void;
  onRemoveTag?: (tag: string) => void;
  editable?: boolean;
}

export function ContextChips({ context, onRemoveLocation, onRemoveObjectType, onRemoveTag, editable = true }: ContextChipsProps) {
  const chips: { key: string; icon: typeof MapPin; label: string; onRemove?: () => void }[] = [];

  if (context.location_text) {
    chips.push({
      key: "loc",
      icon: MapPin,
      label: context.location_text,
      onRemove: editable ? onRemoveLocation : undefined,
    });
  }

  if (context.object_type) {
    const labels: Record<string, string> = { room: "Rom", board: "Tavle", field: "Område", other: "Objekt" };
    const label = labels[context.object_type] || context.object_type;
    const ref = context.object_ref ? ` ${context.object_ref}` : "";
    chips.push({
      key: "obj",
      icon: Box,
      label: `${label}${ref}`,
      onRemove: editable ? onRemoveObjectType : undefined,
    });
  }

  for (const tag of context.tags) {
    const tagLabels: Record<string, string> = {
      service: "Service", avvik: "Avvik", fdv: "FDV", tilbud: "Tilbud", montasje: "Montasje", annet: "Annet",
    };
    chips.push({
      key: `tag-${tag}`,
      icon: Tag,
      label: tagLabels[tag] || tag,
      onRemove: editable ? () => onRemoveTag?.(tag) : undefined,
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {chips.map(chip => {
        const Icon = chip.icon;
        return (
          <span
            key={chip.key}
            className={cn(
              "inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full",
              "bg-accent/10 text-accent-foreground/80 border border-accent/20"
            )}
          >
            <Icon className="h-2.5 w-2.5" />
            {chip.label}
            {chip.onRemove && (
              <button onClick={chip.onRemove} className="ml-0.5 hover:text-destructive cursor-pointer">
                <X className="h-2.5 w-2.5" />
              </button>
            )}
          </span>
        );
      })}
    </div>
  );
}
