import { Badge } from "@/components/ui/badge";
import { Tag, MapPin, FileCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface MediaAnnotation {
  id: string;
  doc_type: string | null;
  linked_object_label: string | null;
  linked_object_type: string | null;
}

interface MediaAnnotationBadgesProps {
  annotations: MediaAnnotation[];
  onFilterByDocType?: (docType: string) => void;
  onFilterByObjectLabel?: (label: string) => void;
  beforeAfterPair?: boolean;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  deviation: "Avvik",
  fdv: "FDV",
  control: "Kontroll",
  before: "Før",
  after: "Etter",
};

const DOC_TYPE_COLORS: Record<string, string> = {
  deviation: "bg-destructive/10 text-destructive border-destructive/20",
  fdv: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800",
  control: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400",
  before: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400",
  after: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400",
};

export function MediaAnnotationBadges({
  annotations, onFilterByDocType, onFilterByObjectLabel, beforeAfterPair,
}: MediaAnnotationBadgesProps) {
  if (!annotations || annotations.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {annotations.map(a => (
        <div key={a.id} className="flex gap-0.5">
          {a.doc_type && (
            <button
              onClick={() => onFilterByDocType?.(a.doc_type!)}
              className={cn(
                "inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full border transition-colors cursor-pointer",
                DOC_TYPE_COLORS[a.doc_type] || "bg-muted text-muted-foreground border-border"
              )}
            >
              <FileCheck className="h-2.5 w-2.5" />
              {DOC_TYPE_LABELS[a.doc_type] || a.doc_type}
            </button>
          )}
          {a.linked_object_label && (
            <button
              onClick={() => onFilterByObjectLabel?.(a.linked_object_label!)}
              className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-muted/60 text-foreground/70 border border-border/30 hover:bg-muted transition-colors cursor-pointer"
            >
              <MapPin className="h-2.5 w-2.5" />
              {a.linked_object_label}
            </button>
          )}
        </div>
      ))}
      {beforeAfterPair && (
        <Badge variant="outline" className="text-[8px] bg-gradient-to-r from-amber-100 to-purple-100 dark:from-amber-900/20 dark:to-purple-900/20 border-amber-200 dark:border-amber-800">
          Før/Etter-par
        </Badge>
      )}
    </div>
  );
}
