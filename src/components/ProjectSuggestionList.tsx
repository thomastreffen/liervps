import { type ProjectSuggestion } from "@/hooks/useProjectSuggestions";
import { Badge } from "@/components/ui/badge";
import { Link2, Loader2, AlertTriangle } from "lucide-react";
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

  const hasExactMatch = suggestions.some(s => s.matchScore >= 90);

  return (
    <div className={cn(
      "rounded-lg border overflow-hidden",
      hasExactMatch
        ? "border-primary/40 bg-primary/5"
        : "border-amber-500/30 bg-amber-500/5"
    )}>
      <div className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 border-b",
        hasExactMatch
          ? "border-primary/20 bg-primary/10"
          : "border-amber-500/20 bg-amber-500/10"
      )}>
        {hasExactMatch ? (
          <Link2 className="h-3 w-3 text-primary" />
        ) : (
          <AlertTriangle className="h-3 w-3 text-amber-600" />
        )}
        <span className={cn(
          "text-[10px] font-semibold uppercase tracking-wider",
          hasExactMatch ? "text-primary" : "text-amber-700"
        )}>
          {hasExactMatch ? "Mente du dette prosjektet?" : "Mulig duplikat – koble til eksisterende?"}
        </span>
      </div>
      <div className="max-h-48 overflow-y-auto p-1 space-y-0.5">
        {suggestions.map((s) => {
          // Prefer project_number as primary display ID
          const displayId = s.project_number
            ? s.project_number
            : s.internal_number
              ? (s.internal_number.startsWith("JOB-") ? s.internal_number : `JOB-${s.internal_number}`)
              : s.job_number
                ? `#${s.job_number}`
                : null;

          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect(s)}
              className={cn(
                "w-full text-left rounded-md px-3 py-2 text-sm transition-colors",
                selectedId === s.id
                  ? "bg-primary/10 border border-primary/30"
                  : s.matchScore >= 90
                    ? "bg-primary/5 hover:bg-primary/10 border border-transparent"
                    : "hover:bg-muted"
              )}
            >
              <div className="flex items-center gap-2">
                {displayId && (
                  <span className="text-[10px] font-mono font-bold bg-primary/15 text-primary rounded px-1.5 py-0.5 shrink-0">
                    {displayId}
                  </span>
                )}
                <span className="font-medium truncate flex-1">{s.title}</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                {s.customer && <span>{s.customer}</span>}
                <Badge variant="outline" className="text-[9px] h-4 px-1">
                  {s.matchField}
                </Badge>
                {s.external_tripletex_id && (
                  <span className="text-[9px] opacity-60">TX: {s.external_tripletex_id}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
