import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Briefcase, ChevronRight, Loader2 } from "lucide-react";
import { useCommercialCase, phaseLabel } from "@/hooks/useCommercialCase";

interface Props {
  caseId: string | null | undefined;
  /** Compact mode for inline use */
  compact?: boolean;
}

function phaseBadgeVariant(phase: string): any {
  if (phase === "won") return "success";
  if (phase === "lost") return "destructive";
  if (phase === "quoted" || phase === "negotiating") return "warning";
  return "secondary";
}

/**
 * Read-only badge that surfaces the commercial case (CRM-eier) in module headers.
 * Click navigates to the case for full editing. Modulene eier ikke fase/eier/neste steg —
 * de speiler kun dataene fra commercial_cases.
 */
export function CommercialCaseHeaderBadge({ caseId, compact }: Props) {
  const navigate = useNavigate();
  const { data, loading } = useCommercialCase(caseId);

  if (!caseId) return null;
  if (loading && !data) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Sak…
      </span>
    );
  }
  if (!data) return null;

  if (compact) {
    return (
      <button
        onClick={() => navigate(`/sales/cases/${data.id}`)}
        className="inline-flex items-center gap-1.5 text-xs hover:underline"
        title="Åpne sak"
      >
        <Briefcase className="h-3 w-3 text-muted-foreground" />
        <span className="font-mono text-muted-foreground">{data.case_number || "Sak"}</span>
        <Badge variant={phaseBadgeVariant(data.phase)} className="text-[10px] py-0">
          {phaseLabel(data.phase)}
        </Badge>
      </button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => navigate(`/sales/cases/${data.id}`)}
      className="gap-2 h-8"
      title="Åpne saken — eier av fase, ansvarlig og neste steg"
    >
      <Briefcase className="h-3.5 w-3.5 text-primary" />
      {data.case_number && <span className="font-mono text-xs text-muted-foreground">{data.case_number}</span>}
      <Badge variant={phaseBadgeVariant(data.phase)} className="text-[10px] py-0">
        {phaseLabel(data.phase)}
      </Badge>
      <ChevronRight className="h-3 w-3 text-muted-foreground -mr-1" />
    </Button>
  );
}
