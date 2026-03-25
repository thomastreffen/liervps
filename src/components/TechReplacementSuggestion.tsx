import { useMemo } from "react";
import { UserPlus, TrendingUp, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ApprovalSummary } from "@/hooks/useApprovalSummaries";
import type { TechInsight } from "@/hooks/useTechnicianInsights";

interface TechOption {
  id: string;
  name: string;
  responseLabel: string;
  avgMinutes: number | null;
}

interface Props {
  summary: ApprovalSummary;
  eventStart: Date;
  /** All available technicians (already assigned excluded) */
  availableTechs: Array<{ id: string; name: string }>;
  /** Currently assigned tech IDs */
  assignedTechIds: string[];
  insights: Map<string, TechInsight>;
  onSelectTech: (techId: string) => void;
}

export function TechReplacementSuggestion({ summary, eventStart, availableTechs, assignedTechIds, insights, onSelectTech }: Props) {
  const shouldShow = summary.declined > 0 || summary.changeRequest > 0 ||
    (summary.pending > 0 && (eventStart.getTime() - Date.now()) / (1000 * 60 * 60) < 12);

  const suggestions = useMemo(() => {
    if (!shouldShow) return [];
    
    const unassigned = availableTechs.filter(t => !assignedTechIds.includes(t.id));

    // Score by response speed
    const scored: TechOption[] = unassigned.map(t => {
      const insight = insights.get(t.id);
      return {
        id: t.id,
        name: t.name,
        responseLabel: insight?.label || "",
        avgMinutes: insight?.avgResponseMinutes ?? null,
      };
    });

    // Sort: fast responders first, then unknown, then slow
    scored.sort((a, b) => {
      if (a.responseLabel === "Svarer raskt" && b.responseLabel !== "Svarer raskt") return -1;
      if (b.responseLabel === "Svarer raskt" && a.responseLabel !== "Svarer raskt") return 1;
      if (a.avgMinutes !== null && b.avgMinutes !== null) return a.avgMinutes - b.avgMinutes;
      if (a.avgMinutes !== null) return -1;
      return 1;
    });

    return scored.slice(0, 3);
  }, [shouldShow, availableTechs, assignedTechIds, insights]);

  if (!shouldShow || suggestions.length === 0) return null;

  return (
    <div className="rounded-lg border border-border/40 bg-muted/30 p-2.5 space-y-2">
      <div className="flex items-center gap-1.5">
        <UserPlus className="h-3 w-3 text-muted-foreground shrink-0" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Foreslåtte montører
        </span>
      </div>
      <div className="space-y-1">
        {suggestions.map((tech) => (
          <div key={tech.id} className="flex items-center gap-2 rounded-md border border-border/30 bg-card px-2.5 py-1.5">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium truncate">{tech.name}</p>
              {tech.responseLabel && (
                <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  {tech.responseLabel === "Svarer raskt" ? (
                    <TrendingUp className="h-2.5 w-2.5 text-emerald-500" />
                  ) : (
                    <Clock className="h-2.5 w-2.5 text-amber-500" />
                  )}
                  {tech.responseLabel}
                  {tech.avgMinutes !== null && (
                    <span className="opacity-60">
                      · snitt {tech.avgMinutes < 60 ? `${tech.avgMinutes}m` : `${Math.round(tech.avgMinutes / 60)}t`}
                    </span>
                  )}
                </p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-[10px] px-2 shrink-0"
              onClick={() => onSelectTech(tech.id)}
            >
              Legg til
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
