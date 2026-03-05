import { MapPin, Box, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

interface MessageContextBadgesProps {
  locationText?: string | null;
  objectType?: string | null;
  objectRef?: string | null;
  tags?: string[] | null;
  isOwn?: boolean;
  onFilterByTag?: (tag: string) => void;
  onFilterByObjectType?: (type: string) => void;
  onFilterByLocation?: (loc: string) => void;
}

const OBJ_LABELS: Record<string, string> = { room: "Rom", board: "Tavle", field: "Område", other: "Objekt" };
const TAG_LABELS: Record<string, string> = {
  service: "Service", avvik: "Avvik", fdv: "FDV", tilbud: "Tilbud", montasje: "Montasje", annet: "Annet",
};

export function MessageContextBadges({
  locationText, objectType, objectRef, tags,
  isOwn, onFilterByTag, onFilterByObjectType, onFilterByLocation,
}: MessageContextBadgesProps) {
  const hasContent = locationText || objectType || (tags && tags.length > 0);
  if (!hasContent) return null;

  return (
    <div className={cn("flex flex-wrap gap-1 mb-1", isOwn ? "justify-end" : "justify-start")}>
      {locationText && (
        <button
          onClick={() => onFilterByLocation?.(locationText)}
          className={cn(
            "inline-flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded-full cursor-pointer transition-colors",
            isOwn
              ? "bg-white/10 text-primary-foreground/70 hover:bg-white/20"
              : "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30"
          )}
        >
          <MapPin className="h-2 w-2" />
          {locationText}
        </button>
      )}
      {objectType && (
        <button
          onClick={() => onFilterByObjectType?.(objectType)}
          className={cn(
            "inline-flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded-full cursor-pointer transition-colors",
            isOwn
              ? "bg-white/10 text-primary-foreground/70 hover:bg-white/20"
              : "bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30"
          )}
        >
          <Box className="h-2 w-2" />
          {OBJ_LABELS[objectType] || objectType}{objectRef ? ` ${objectRef}` : ""}
        </button>
      )}
      {tags?.map(tag => (
        <button
          key={tag}
          onClick={() => onFilterByTag?.(tag)}
          className={cn(
            "inline-flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded-full cursor-pointer transition-colors",
            isOwn
              ? "bg-white/10 text-primary-foreground/70 hover:bg-white/20"
              : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30"
          )}
        >
          <Tag className="h-2 w-2" />
          {TAG_LABELS[tag] || tag}
        </button>
      ))}
    </div>
  );
}
