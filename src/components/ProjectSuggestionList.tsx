import { type ProjectSuggestion } from "@/hooks/useProjectSuggestions";
import { Badge } from "@/components/ui/badge";
import { Link2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProjectSuggestionListProps {
  suggestions: ProjectSuggestion[];
  loading: boolean;
  onSelect: (project: ProjectSuggestion) => void;
  selectedId?: string | null;
}

export function ProjectSuggestionList({ suggestions, loading, onSelect, selectedId }: ProjectSuggestionListProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2 px-3 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Søker etter eksisterende prosjekter…
      </div>
    );
  }

  if (suggestions.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 overflow-hidden">
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-amber-500/20 bg-amber-500/10">
        <Link2 className="h-3 w-3 text-amber-600" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700">
          Mulig duplikat – koble til eksisterende?
        </span>
      </div>
      <div className="max-h-40 overflow-y-auto p-1 space-y-0.5">
        {suggestions.map((s) => {
          const num = s.internal_number || s.job_number;
          const displayId = num ? (num.startsWith("JOB-") ? num : `JOB-${num}`) : null;

          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect(s)}
              className={cn(
                "w-full text-left rounded-md px-3 py-2 text-sm transition-colors",
                selectedId === s.id
                  ? "bg-primary/10 border border-primary/30"
                  : "hover:bg-muted"
              )}
            >
              <div className="flex items-center gap-2">
                <span className="font-medium truncate flex-1">{s.title}</span>
                {displayId && (
                  <span className="text-[9px] font-mono font-bold bg-primary/15 text-primary rounded px-1 py-0.5 shrink-0">
                    {displayId}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                {s.customer && <span>{s.customer}</span>}
                <Badge variant="outline" className="text-[9px] h-4 px-1">
                  treff: {s.matchField}
                </Badge>
                {s.external_tripletex_number && (
                  <span className="text-[9px] opacity-60">TX: {s.external_tripletex_number}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
