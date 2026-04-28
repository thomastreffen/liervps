import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Loader2, Layers, ExternalLink, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { getStatusBadge, formatDateTime } from "@/lib/calc-engine/status-labels";
import { DeleteCalcDialog, type DeleteTarget } from "@/components/calc-engine/DeleteCalcDialog";

function formatNok(n: number): string {
  return new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 }).format(n ?? 0);
}

interface SubCalc {
  id: string;
  project_title: string;
  case_system_key: string | null;
  case_sort_order: number;
  status: string;
  total_price: number;
  total_labor: number;
  totals_snapshot: any;
  package_id: string | null;
  calc_packages?: { name: string } | null;
}

export default function CalcCaseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [caseRow, setCaseRow] = useState<any>(null);
  const [subs, setSubs] = useState<SubCalc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const [c, s] = await Promise.all([
        supabase.from("calc_cases").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("calculations")
          .select("id, project_title, case_system_key, case_sort_order, status, total_price, total_labor, totals_snapshot, package_id, calc_packages(name)")
          .eq("case_id", id)
          .is("deleted_at", null)
          .order("case_sort_order"),
      ]);
      setCaseRow(c.data);
      setSubs((s.data ?? []) as any);
      setLoading(false);
    })();
  }, [id]);

  // Live aggregering av totaler
  const totals = useMemo(() => {
    let sales = 0, cost = 0, norm = 0, adjusted = 0;
    for (const s of subs) {
      const t = s.totals_snapshot ?? {};
      sales += Number(t.total_sales ?? s.total_price ?? 0);
      cost += Number(t.total_cost ?? s.total_labor ?? 0);
      norm += Number(t.total_norm_hours ?? 0);
      adjusted += Number(t.total_adjusted_hours ?? 0);
    }
    const margin = sales - cost;
    const marginPct = sales > 0 ? Math.round((margin / sales) * 1000) / 10 : 0;
    return { sales, cost, norm, adjusted, margin, marginPct };
  }, [subs]);

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!caseRow) return <div className="p-8 text-center">Kalkylesak ikke funnet.</div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/sales/calc-engine")} className="rounded-xl">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            <Badge variant="outline" className="rounded-lg text-[10px] uppercase tracking-wide">Kalkylesak</Badge>
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight truncate mt-1">{caseRow.title}</h1>
          <p className="text-xs text-muted-foreground">
            {caseRow.customer_name ?? "Ukjent kunde"} • {format(new Date(caseRow.created_at), "d. MMM yyyy", { locale: nb })} • {subs.length} delkalkyler
          </p>
        </div>
        <Badge variant="outline" className="rounded-lg">{caseRow.status}</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5">
        <div className="space-y-5">
          {caseRow.description && (
            <Card className="p-5 rounded-2xl">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">Underlag</h3>
              <p className="text-sm whitespace-pre-wrap text-foreground/80">{caseRow.description}</p>
            </Card>
          )}

          <Card className="p-5 rounded-2xl">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
              <Layers className="h-4 w-4" /> Delkalkyler ({subs.length})
            </h3>
            {subs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Ingen delkalkyler enda.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>System</TableHead>
                    <TableHead>Tittel</TableHead>
                    <TableHead>Pakke</TableHead>
                    <TableHead className="text-right">Salg</TableHead>
                    <TableHead className="text-right">Kost</TableHead>
                    <TableHead className="text-right">Handlinger</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subs.map((s) => {
                    const t = s.totals_snapshot ?? {};
                    return (
                      <TableRow key={s.id}>
                        <TableCell>
                          {s.case_system_key ? (
                            <Badge variant="outline" className="rounded-md font-mono text-xs">{s.case_system_key}</Badge>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="font-medium text-sm">{s.project_title}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{s.calc_packages?.name ?? "—"}</TableCell>
                        <TableCell className="text-right font-mono text-sm">kr {formatNok(t.total_sales ?? s.total_price)}</TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">kr {formatNok(t.total_cost ?? s.total_labor)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2 rounded-lg"
                              onClick={() => {
                                if (s.package_id) {
                                  navigate(`/sales/calc-engine/new/editor?package=${s.package_id}&calculation=${s.id}`);
                                } else {
                                  navigate(`/sales/calc-engine/${s.id}`);
                                }
                              }}
                              title="Rediger"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2 rounded-lg"
                              onClick={() => navigate(`/sales/calc-engine/${s.id}`)}
                              title="Åpne"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-5 rounded-2xl bg-gradient-to-br from-primary-soft/40 to-transparent">
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Samlet salgspris</div>
            <div className="text-3xl font-semibold tracking-tight">kr {formatNok(totals.sales)}</div>
            <Separator className="my-4" />
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Normtid</dt><dd className="font-mono">{totals.norm} t</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Justert tid</dt><dd className="font-mono">{totals.adjusted} t</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Samlet kost</dt><dd className="font-mono">kr {formatNok(totals.cost)}</dd></div>
              <Separator className="my-1" />
              <div className="flex justify-between"><dt className="text-muted-foreground">Dekningsbidrag</dt><dd className="font-mono font-semibold">kr {formatNok(totals.margin)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Dekningsgrad</dt><dd className="font-mono font-semibold">{totals.marginPct} %</dd></div>
            </dl>
          </Card>

          {caseRow.source_draft_id && (
            <Button
              variant="outline"
              className="w-full rounded-xl"
              onClick={() => navigate(`/sales/calc-engine/ai-review/${caseRow.source_draft_id}`)}
            >
              Tilbake til AI-review
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
