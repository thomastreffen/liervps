import { useNavigate } from "react-router-dom";
import { FileText, ArrowRight, Send, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface OfferSummaryProps {
  totalActive: number;
  readyToSend: number;
  totalValue: number;
  loading: boolean;
}

export function OfferSummaryCard({ totalActive, readyToSend, totalValue, loading }: OfferSummaryProps) {
  const nav = useNavigate();

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
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
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
              <div>
                <p className="text-lg font-bold text-foreground font-mono">
                  {totalValue > 0 ? `${(totalValue / 1000).toLocaleString("nb-NO", { maximumFractionDigits: 0 })}k` : "—"}
                </p>
                <p className="text-[11px] text-muted-foreground/60">Total verdi</p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs gap-1.5 rounded-xl"
              onClick={(e) => { e.stopPropagation(); nav("/sales/offers"); }}
            >
              Se alle tilbud <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
