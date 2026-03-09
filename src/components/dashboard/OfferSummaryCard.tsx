import { useNavigate } from "react-router-dom";
import { FileText, ArrowRight, Send, TrendingUp, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BiggestOffer {
  id: string;
  customer: string;
  amount: number;
}

interface OfferSummaryProps {
  totalActive: number;
  readyToSend: number;
  openPipeline: number;
  weightedPipeline: number;
  biggestOffer: BiggestOffer | null;
  needsFollowup: number;
  loading: boolean;
}

const STATUS_WEIGHTS: Record<string, number> = {
  draft: 0.1,
  generated: 0.1,
  sent: 0.4,
  accepted: 1.0,
  rejected: 0,
  converted: 0,
};

export { STATUS_WEIGHTS };

export function OfferSummaryCard({
  totalActive,
  readyToSend,
  openPipeline,
  weightedPipeline,
  biggestOffer,
  needsFollowup,
  loading,
}: OfferSummaryProps) {
  const nav = useNavigate();

  const fmt = (v: number) =>
    v >= 1_000_000
      ? `${(v / 1_000_000).toLocaleString("nb-NO", { maximumFractionDigits: 1 })}M`
      : v >= 1_000
        ? `${(v / 1_000).toLocaleString("nb-NO", { maximumFractionDigits: 0 })}k`
        : v.toLocaleString("nb-NO", { maximumFractionDigits: 0 });

  return (
    <div
      onClick={() => nav("/sales/offers")}
      className="relative rounded-2xl bg-card border border-border/40 shadow-sm overflow-hidden
                 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group"
    >
      <div className="h-1 bg-gradient-to-r from-primary to-primary/40" />
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <h4 className="text-sm font-semibold text-foreground">Tilbud</h4>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-colors" />
        </div>

        {loading ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-5 bg-muted/40 rounded w-2/3" />
            <div className="h-4 bg-muted/40 rounded w-1/2" />
            <div className="h-4 bg-muted/40 rounded w-3/4" />
          </div>
        ) : (
          <div className="space-y-3">
            {/* Row 1: Active + Ready to send */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-2xl font-bold text-foreground">{totalActive}</p>
                <p className="text-[11px] text-muted-foreground/60">Aktive tilbud</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground flex items-center gap-1">
                  {readyToSend}
                  {readyToSend > 0 && <Send className="h-3.5 w-3.5 text-primary/60" />}
                </p>
                <p className="text-[11px] text-muted-foreground/60">Klare til sending</p>
              </div>
            </div>

            {/* Row 2: Pipeline KPIs */}
            <div className="grid grid-cols-2 gap-3 pt-1 border-t border-border/30">
              <div>
                <p className="text-lg font-bold text-foreground font-mono">
                  {openPipeline > 0 ? fmt(openPipeline) : "—"}
                </p>
                <p className="text-[11px] text-muted-foreground/60">Åpen pipeline</p>
              </div>
              <div>
                <p className="text-lg font-bold text-foreground font-mono flex items-center gap-1">
                  {weightedPipeline > 0 ? fmt(weightedPipeline) : "—"}
                  {weightedPipeline > 0 && <TrendingUp className="h-3 w-3 text-primary/50" />}
                </p>
                <p className="text-[11px] text-muted-foreground/60">Forventet verdi</p>
              </div>
            </div>

            {/* Biggest open offer */}
            {biggestOffer && (
              <div
                className="rounded-xl bg-muted/30 px-3 py-2 text-xs cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  nav(`/sales/offers/${biggestOffer.id}`);
                }}
              >
                <p className="text-muted-foreground/60 text-[10px] uppercase tracking-wider mb-0.5">Største åpne tilbud</p>
                <p className="font-medium text-foreground truncate">
                  {biggestOffer.customer} — <span className="font-mono">kr {fmt(biggestOffer.amount)}</span>
                </p>
              </div>
            )}

            {/* Action buttons */}
            <div className="space-y-1.5">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs gap-1.5 rounded-xl"
                onClick={(e) => { e.stopPropagation(); nav("/sales/offers"); }}
              >
                Se alle tilbud <ArrowRight className="h-3 w-3" />
              </Button>
              {needsFollowup > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs gap-1.5 rounded-xl text-destructive hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    nav("/sales/offers?filter=followup");
                  }}
                >
                  <AlertTriangle className="h-3 w-3" />
                  {needsFollowup} tilbud trenger oppfølging
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
