/**
 * Order analysis panel – shows savings potential and split recommendations.
 */
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingDown, SplitSquareHorizontal, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { OrderAnalysis } from "@/hooks/usePurchaseOrderDetail";

function formatKr(val: number) {
  return new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK", maximumFractionDigits: 0 }).format(val);
}

interface OrderAnalysisPanelProps {
  analysis: OrderAnalysis;
  lineCount: number;
}

export function OrderAnalysisPanel({ analysis, lineCount }: OrderAnalysisPanelProps) {
  const { totalCost, totalBestCost, totalSaving, linesWithSaving, supplierBreakdown, splitRecommendation } = analysis;
  const savingPercent = totalCost > 0 ? (totalSaving / totalCost) * 100 : 0;
  const hasSaving = totalSaving > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <TrendingDown className="h-4 w-4 text-primary" />
          Innkjøpsintelligens
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Cost summary */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <dt className="text-[11px] text-muted-foreground uppercase tracking-wider">Nåværende kostnad</dt>
            <dd className="text-lg font-bold font-mono">{formatKr(totalCost)}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-muted-foreground uppercase tracking-wider">Optimal kostnad</dt>
            <dd className="text-lg font-bold font-mono text-emerald-600">{formatKr(totalBestCost)}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-muted-foreground uppercase tracking-wider">Sparepotensial</dt>
            <dd className="text-lg font-bold font-mono">
              {hasSaving ? (
                <span className="text-emerald-600">{formatKr(totalSaving)}</span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </dd>
          </div>
        </div>

        {hasSaving && (
          <>
            {/* Saving bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {linesWithSaving} av {lineCount} linjer kan bli billigere
                </span>
                <span className="font-mono font-medium text-emerald-600">
                  -{savingPercent.toFixed(1)}%
                </span>
              </div>
              <Progress value={savingPercent} className="h-2" />
            </div>

            {/* Recommendation */}
            {splitRecommendation && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
                <SplitSquareHorizontal className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <p className="text-sm">{splitRecommendation}</p>
              </div>
            )}

            {/* Supplier breakdown */}
            {supplierBreakdown.length > 1 && (
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2">Optimal fordeling</p>
                <div className="space-y-2">
                  {supplierBreakdown.map((sb) => (
                    <div key={sb.supplier_id} className="flex items-center justify-between text-sm p-2 rounded bg-muted/30">
                      <span className="font-medium">{sb.supplier_name}</span>
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary" className="text-[10px]">{sb.lineCount} linjer</Badge>
                        <span className="font-mono">{formatKr(sb.total)}</span>
                        {sb.saving > 0 && (
                          <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[10px]">
                            -{formatKr(sb.saving)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {!hasSaving && lineCount > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Alle linjer er allerede hos billigste leverandør
          </div>
        )}

        {lineCount === 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4" />
            Legg til produkter for å se prisanalyse
          </div>
        )}
      </CardContent>
    </Card>
  );
}
