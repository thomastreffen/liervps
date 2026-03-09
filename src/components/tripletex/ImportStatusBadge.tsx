import { Badge } from "@/components/ui/badge";
import type { MatchStatus } from "@/hooks/useTripletexImport";

const config: Record<MatchStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  match: { label: "Match funnet", variant: "default" },
  new: { label: "Ny", variant: "secondary" },
  possible_duplicate: { label: "Mulig eksisterende", variant: "outline" },
  needs_review: { label: "Trenger avklaring", variant: "outline" },
  ignored: { label: "Ignoreres", variant: "outline" },
  error: { label: "Feil", variant: "destructive" },
  imported: { label: "Importert", variant: "default" },
};

export function ImportStatusBadge({ status }: { status: MatchStatus }) {
  const c = config[status] || config.new;
  return (
    <Badge
      variant={c.variant}
      className={`text-[10px] font-medium ${
        status === "possible_duplicate" ? "border-orange-500 text-orange-700" : ""
      }`}
    >
      {c.label}
    </Badge>
  );
}
