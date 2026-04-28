import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Calculator, Loader2, Layers, Sparkles, Trash2 } from "lucide-react";
import { getStatusBadge, formatDateTime } from "@/lib/calc-engine/status-labels";
import { DeleteCalcDialog, type DeleteTarget } from "@/components/calc-engine/DeleteCalcDialog";

interface CalcRow {
  id: string;
  project_title: string;
  customer_name: string;
  status: string;
  total_price: number;
  total_labor: number;
  totals_snapshot: any;
  created_at: string;
  updated_at: string;
  case_id: string | null;
  case_system_key: string | null;
  package: { name: string; slug: string } | null;
}

interface CaseRow {
  id: string;
  title: string;
  customer_name: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  sub_count: number;
  total_sales: number;
  total_cost: number;
}

interface DraftRow {
  id: string;
  status: string;
  initial_description: string | null;
  ai_summary: string | null;
  created_at: string;
  updated_at: string;
  case_id: string | null;
}

export default function CalcEngineListPage() {
  const navigate = useNavigate();
  const { activeCompanyId, allowedCompanyIds } = useCompanyContext();
  const [calcRows, setCalcRows] = useState<CalcRow[]>([]);
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);

      let calcQ = supabase
        .from("calculations")
        .select("id, project_title, customer_name, status, total_price, total_labor, totals_snapshot, case_id, case_system_key, created_at, updated_at, calc_packages(name, slug)")
        .not("package_id", "is", null)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false });
      if (activeCompanyId) calcQ = calcQ.eq("company_id", activeCompanyId);
      else if (allowedCompanyIds.length) calcQ = calcQ.in("company_id", allowedCompanyIds);

      let caseQ = supabase
        .from("calc_cases")
        .select("id, title, customer_name, status, created_at, updated_at")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false });
      if (activeCompanyId) caseQ = caseQ.eq("company_id", activeCompanyId);
      else if (allowedCompanyIds.length) caseQ = caseQ.in("company_id", allowedCompanyIds);

      let draftQ = supabase
        .from("calc_ai_drafts")
        .select("id, status, initial_description, ai_summary, created_at, updated_at, case_id")
        .order("updated_at", { ascending: false });
      if (activeCompanyId) draftQ = draftQ.eq("company_id", activeCompanyId);
      else if (allowedCompanyIds.length) draftQ = draftQ.in("company_id", allowedCompanyIds);

      const [calcRes, caseRes, draftRes] = await Promise.all([calcQ, caseQ, draftQ]);

      const calcs = (calcRes.data ?? []).map((r: any) => ({ ...r, package: r.calc_packages }));
      setCalcRows(calcs as any);

      const aggMap = new Map<string, { sales: number; cost: number; count: number }>();
      for (const c of calcs as any[]) {
        if (!c.case_id) continue;
        const t = c.totals_snapshot ?? {};
        const a = aggMap.get(c.case_id) ?? { sales: 0, cost: 0, count: 0 };
        a.sales += Number(t.total_sales ?? c.total_price ?? 0);
        a.cost += Number(t.total_cost ?? c.total_labor ?? 0);
        a.count += 1;
        aggMap.set(c.case_id, a);
      }
      const enrichedCases: CaseRow[] = (caseRes.data ?? []).map((c: any) => {
        const a = aggMap.get(c.id) ?? { sales: 0, cost: 0, count: 0 };
        return { ...c, sub_count: a.count, total_sales: a.sales, total_cost: a.cost };
      });
      setCases(enrichedCases);
      setDrafts((draftRes.data ?? []) as any);
      setLoading(false);
    })();
  }, [activeCompanyId, refreshTick]);

  const caseTitleById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of cases) m.set(c.id, c.title);
    return m;
  }, [cases]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Calculator className="h-6 w-6 text-primary" /> Kalkylemotor
          </h1>
          <p className="text-sm text-muted-foreground">
            Pakke-baserte kalkyler med normtid, justeringer og pris.
          </p>
        </div>
        <Button onClick={() => navigate("/sales/calc-engine/new")} className="gap-1.5 rounded-xl self-start">
          <Plus className="h-4 w-4" /> Ny kalkyle
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Tabs defaultValue="cases" className="space-y-4">
          <TabsList className="rounded-xl">
            <TabsTrigger value="cases" className="rounded-lg gap-1.5">
              <Layers className="h-3.5 w-3.5" /> Saker ({cases.length})
            </TabsTrigger>
            <TabsTrigger value="all" className="rounded-lg gap-1.5">
              <Calculator className="h-3.5 w-3.5" /> Alle kalkyler ({calcRows.length})
            </TabsTrigger>
            <TabsTrigger value="drafts" className="rounded-lg gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> AI-utkast ({drafts.length})
            </TabsTrigger>
          </TabsList>

          {/* SAKER */}
          <TabsContent value="cases">
            <Card className="rounded-2xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sak</TableHead>
                    <TableHead>Kunde</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Delkalk.</TableHead>
                    <TableHead>Sist endret</TableHead>
                    <TableHead className="text-right">Samlet salg</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cases.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                        <Layers className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        Ingen kalkylesaker enda. AI-review oppretter en sak automatisk når et underlag har 2+ systemer.
                      </TableCell>
                    </TableRow>
                  ) : cases.map((c) => {
                    const badge = getStatusBadge("case", c.status);
                    return (
                      <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate(`/sales/calc-engine/case/${c.id}`)}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Layers className="h-3.5 w-3.5 text-primary" />
                            {c.title}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{c.customer_name ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`rounded-md text-[11px] ${badge.className}`}>{badge.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className="rounded-md text-xs font-mono">{c.sub_count}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground tabular-nums">{formatDateTime(c.updated_at)}</TableCell>
                        <TableCell className="text-right font-mono text-sm font-semibold">
                          kr {Number(c.total_sales).toLocaleString("nb-NO", { maximumFractionDigits: 0 })}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            title="Slett kalkylesak"
                            onClick={() => setDeleteTarget({ kind: "case", id: c.id, label: c.title, subCount: c.sub_count })}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* ALLE KALKYLER */}
          <TabsContent value="all">
            <Card className="rounded-2xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Prosjekt</TableHead>
                    <TableHead>Kunde</TableHead>
                    <TableHead>Pakke</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tilhører sak</TableHead>
                    <TableHead>Sist endret</TableHead>
                    <TableHead className="text-right">Pris</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calcRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                        <Calculator className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        Ingen kalkyler enda.
                      </TableCell>
                    </TableRow>
                  ) : calcRows.map((r) => {
                    const badge = getStatusBadge("calculation", r.status);
                    return (
                      <TableRow key={r.id} className="cursor-pointer" onClick={() => navigate(`/sales/calc-engine/${r.id}`)}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {r.case_system_key && (
                              <Badge variant="outline" className="rounded-md font-mono text-[10px]">{r.case_system_key}</Badge>
                            )}
                            <span>{r.project_title}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{r.customer_name}</TableCell>
                        <TableCell>
                          {r.package && <Badge variant="outline" className="rounded-lg text-xs">{r.package.name}</Badge>}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`rounded-md text-[11px] ${badge.className}`}>{badge.label}</Badge>
                        </TableCell>
                        <TableCell>
                          {r.case_id && caseTitleById.has(r.case_id) ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 rounded-lg gap-1 text-xs"
                              onClick={(e) => { e.stopPropagation(); navigate(`/sales/calc-engine/case/${r.case_id}`); }}
                            >
                              <Layers className="h-3 w-3" /> {caseTitleById.get(r.case_id)}
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground tabular-nums">{formatDateTime(r.updated_at)}</TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          kr {Number(r.total_price).toLocaleString("nb-NO", { maximumFractionDigits: 0 })}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            title="Slett kalkyle"
                            onClick={() => setDeleteTarget({ kind: "calculation", id: r.id, label: r.project_title })}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* AI-UTKAST */}
          <TabsContent value="drafts">
            <Card className="rounded-2xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Underlag</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Knyttet sak</TableHead>
                    <TableHead>Opprettet</TableHead>
                    <TableHead>Sist endret</TableHead>
                    <TableHead className="w-24 text-right">Handlinger</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drafts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                        <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        Ingen AI-utkast.
                      </TableCell>
                    </TableRow>
                  ) : drafts.map((d) => {
                    const badge = getStatusBadge("draft", d.status);
                    const preview = (d.ai_summary ?? d.initial_description ?? "Uten beskrivelse").slice(0, 80);
                    return (
                      <TableRow key={d.id} className="cursor-pointer" onClick={() => navigate(`/sales/calc-engine/ai-review/${d.id}`)}>
                        <TableCell className="max-w-[420px]">
                          <div className="font-medium text-sm truncate">{preview}{preview.length >= 80 ? "…" : ""}</div>
                          <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{d.id.slice(0, 8)}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`rounded-md text-[11px] ${badge.className}`}>{badge.label}</Badge>
                        </TableCell>
                        <TableCell>
                          {d.case_id && caseTitleById.has(d.case_id) ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 rounded-lg gap-1 text-xs"
                              onClick={(e) => { e.stopPropagation(); navigate(`/sales/calc-engine/case/${d.case_id}`); }}
                            >
                              <Layers className="h-3 w-3" /> {caseTitleById.get(d.case_id)}
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground tabular-nums">{formatDateTime(d.created_at)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground tabular-nums">{formatDateTime(d.updated_at)}</TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()} className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            title="Slett utkast"
                            onClick={() => setDeleteTarget({ kind: "draft", id: d.id, label: preview })}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      <DeleteCalcDialog
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={() => setRefreshTick((n) => n + 1)}
      />
    </div>
  );
}
