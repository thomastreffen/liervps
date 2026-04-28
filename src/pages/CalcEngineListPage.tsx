import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Plus, Calculator, Loader2, Layers, Sparkles, Trash2, Settings2, FileText, ChevronRight,
} from "lucide-react";
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

// Et "tomt" element = ingen meningsfullt innhold enda
function isEmptyCalc(r: CalcRow): boolean {
  const t = r.totals_snapshot ?? {};
  const sales = Number(t.total_sales ?? r.total_price ?? 0);
  const cost = Number(t.total_cost ?? r.total_labor ?? 0);
  const noTitle = !r.project_title || /uten navn/i.test(r.project_title);
  return sales === 0 && cost === 0 && noTitle;
}

function isEmptyDraft(d: DraftRow): boolean {
  // Drafts som er konvertert til sak, eller som ikke har noe AI-output enda og er gamle
  if (d.case_id) return false; // tilknyttet sak = ikke tomt
  const hasContent = (d.ai_summary && d.ai_summary.length > 10) || (d.initial_description && d.initial_description.length > 10);
  return !hasContent;
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
  const [adminOpen, setAdminOpen] = useState(false);

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

      const aggMap = new Map<string, { sales: number; cost: number; count: number; lastSub: string }>();
      for (const c of calcs as any[]) {
        if (!c.case_id) continue;
        const t = c.totals_snapshot ?? {};
        const a = aggMap.get(c.case_id) ?? { sales: 0, cost: 0, count: 0, lastSub: c.updated_at };
        a.sales += Number(t.total_sales ?? c.total_price ?? 0);
        a.cost += Number(t.total_cost ?? c.total_labor ?? 0);
        a.count += 1;
        if (c.updated_at > a.lastSub) a.lastSub = c.updated_at;
        aggMap.set(c.case_id, a);
      }
      const enrichedCases: CaseRow[] = (caseRes.data ?? []).map((c: any) => {
        const a = aggMap.get(c.id) ?? { sales: 0, cost: 0, count: 0, lastSub: c.updated_at };
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

  // ============ HOVED-SAKER (samlet rekke) ============
  // Inkluderer samlekalkyler + frittstående enkeltkalkyler med innhold
  type UnifiedRow =
    | { kind: "case"; row: CaseRow; sortAt: string }
    | { kind: "single"; row: CalcRow; sortAt: string };

  const unifiedRows: UnifiedRow[] = useMemo(() => {
    const rows: UnifiedRow[] = [];
    for (const c of cases) {
      // Skjul saker som ikke har noen delkalkyler enda
      if (c.sub_count === 0) continue;
      rows.push({ kind: "case", row: c, sortAt: c.updated_at });
    }
    for (const r of calcRows) {
      if (r.case_id) continue; // tilhører en sak — vises som del av saken
      if (isEmptyCalc(r)) continue; // tomme skjules
      rows.push({ kind: "single", row: r, sortAt: r.updated_at });
    }
    rows.sort((a, b) => (b.sortAt > a.sortAt ? 1 : -1));
    return rows;
  }, [cases, calcRows]);

  // ============ ADMIN-DRAWER DATA ============
  const emptyCalcs = useMemo(() => calcRows.filter((r) => !r.case_id && isEmptyCalc(r)), [calcRows]);
  const emptyDrafts = useMemo(() => drafts.filter(isEmptyDraft), [drafts]);
  const adminCount = emptyCalcs.length + emptyDrafts.length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Calculator className="h-6 w-6 text-primary" /> Kalkyler
          </h1>
          <p className="text-sm text-muted-foreground">
            Saker og delkalkyler — opprydding finner du i admin-panelet.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start">
          <Sheet open={adminOpen} onOpenChange={setAdminOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" className="gap-1.5 rounded-xl">
                <Settings2 className="h-4 w-4" /> Admin
                {adminCount > 0 && (
                  <Badge variant="outline" className="ml-1 rounded-md text-[10px] h-5 px-1.5 border-amber-300 text-amber-700 dark:text-amber-400">
                    {adminCount}
                  </Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
              <SheetHeader className="mb-4">
                <SheetTitle className="flex items-center gap-2">
                  <Settings2 className="h-5 w-5" /> Admin og opprydding
                </SheetTitle>
                <SheetDescription>
                  Tomme utkast, alle kalkyler og rå AI-data. Tomme elementer vises ikke i hovedlisten.
                </SheetDescription>
              </SheetHeader>

              <Tabs defaultValue="empty" className="space-y-3">
                <TabsList className="rounded-xl">
                  <TabsTrigger value="empty" className="rounded-lg gap-1.5 text-xs">
                    Tomme ({emptyCalcs.length + emptyDrafts.length})
                  </TabsTrigger>
                  <TabsTrigger value="all" className="rounded-lg gap-1.5 text-xs">
                    Alle kalkyler ({calcRows.length})
                  </TabsTrigger>
                  <TabsTrigger value="drafts" className="rounded-lg gap-1.5 text-xs">
                    AI-utkast ({drafts.length})
                  </TabsTrigger>
                </TabsList>

                {/* TOMME */}
                <TabsContent value="empty" className="space-y-3">
                  {emptyCalcs.length === 0 && emptyDrafts.length === 0 ? (
                    <Card className="p-8 text-center text-sm text-muted-foreground rounded-2xl">
                      Ingen tomme elementer. Alt er ryddig her ✨
                    </Card>
                  ) : (
                    <>
                      {emptyDrafts.length > 0 && (
                        <Card className="p-3 rounded-2xl">
                          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 px-1">
                            Forlatte AI-utkast ({emptyDrafts.length})
                          </div>
                          <div className="space-y-1">
                            {emptyDrafts.map((d) => (
                              <div key={d.id} className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-muted/50 group">
                                <Sparkles className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-mono text-muted-foreground truncate">{d.id.slice(0, 8)}</div>
                                  <div className="text-[10px] text-muted-foreground">{formatDateTime(d.created_at)}</div>
                                </div>
                                <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100"
                                  onClick={() => setDeleteTarget({ kind: "draft", id: d.id, label: "AI-utkast " + d.id.slice(0, 8) })}>
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </Card>
                      )}
                      {emptyCalcs.length > 0 && (
                        <Card className="p-3 rounded-2xl">
                          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 px-1">
                            Tomme kalkyler ({emptyCalcs.length})
                          </div>
                          <div className="space-y-1">
                            {emptyCalcs.map((r) => (
                              <div key={r.id} className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-muted/50 group">
                                <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs truncate">{r.project_title || "Uten navn"}</div>
                                  <div className="text-[10px] text-muted-foreground">{formatDateTime(r.created_at)}</div>
                                </div>
                                <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100"
                                  onClick={() => setDeleteTarget({ kind: "calculation", id: r.id, label: r.project_title || "Tom kalkyle" })}>
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </Card>
                      )}
                    </>
                  )}
                </TabsContent>

                {/* ALLE KALKYLER */}
                <TabsContent value="all">
                  <Card className="rounded-2xl overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tittel</TableHead>
                          <TableHead>Sak</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Pris</TableHead>
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {calcRows.map((r) => {
                          const badge = getStatusBadge("calculation", r.status);
                          return (
                            <TableRow key={r.id} className="cursor-pointer text-xs" onClick={() => navigate(`/sales/calc-engine/${r.id}`)}>
                              <TableCell className="font-medium">
                                {r.case_system_key && (
                                  <Badge variant="outline" className="rounded-md font-mono text-[10px] mr-1.5">{r.case_system_key}</Badge>
                                )}
                                {r.project_title || <span className="text-muted-foreground italic">Uten navn</span>}
                              </TableCell>
                              <TableCell>
                                {r.case_id && caseTitleById.has(r.case_id) ? (
                                  <span className="text-muted-foreground truncate block max-w-[140px]">{caseTitleById.get(r.case_id)}</span>
                                ) : <span className="text-muted-foreground">—</span>}
                              </TableCell>
                              <TableCell><Badge variant="outline" className={`rounded-md text-[10px] ${badge.className}`}>{badge.label}</Badge></TableCell>
                              <TableCell className="text-right font-mono">kr {Number(r.total_price).toLocaleString("nb-NO", { maximumFractionDigits: 0 })}</TableCell>
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  onClick={() => setDeleteTarget({ kind: "calculation", id: r.id, label: r.project_title })}>
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
                          <TableHead>Sak</TableHead>
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {drafts.map((d) => {
                          const badge = getStatusBadge("draft", d.status);
                          const preview = (d.ai_summary ?? d.initial_description ?? "Uten beskrivelse").slice(0, 50);
                          return (
                            <TableRow key={d.id} className="cursor-pointer text-xs" onClick={() => navigate(`/sales/calc-engine/ai-review/${d.id}`)}>
                              <TableCell className="font-medium max-w-[260px] truncate">{preview}</TableCell>
                              <TableCell><Badge variant="outline" className={`rounded-md text-[10px] ${badge.className}`}>{badge.label}</Badge></TableCell>
                              <TableCell>
                                {d.case_id && caseTitleById.has(d.case_id) ? (
                                  <span className="text-muted-foreground truncate block max-w-[120px]">{caseTitleById.get(d.case_id)}</span>
                                ) : <span className="text-muted-foreground">—</span>}
                              </TableCell>
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  onClick={() => setDeleteTarget({ kind: "draft", id: d.id, label: preview })}>
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
            </SheetContent>
          </Sheet>

          <Button onClick={() => navigate("/sales/calc-engine/new")} className="gap-1.5 rounded-xl">
            <Plus className="h-4 w-4" /> Ny kalkyle
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card className="rounded-2xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sak / Kalkyle</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Kunde</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Innhold</TableHead>
                <TableHead>Sist endret</TableHead>
                <TableHead className="text-right">Salg</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {unifiedRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-16">
                    <Layers className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <div className="font-medium mb-1">Ingen kalkyler enda</div>
                    <div className="text-xs">Start med en AI-analyse eller opprett ny kalkyle.</div>
                  </TableCell>
                </TableRow>
              ) : unifiedRows.map((u) => {
                if (u.kind === "case") {
                  const c = u.row;
                  const badge = getStatusBadge("case", c.status);
                  return (
                    <TableRow key={`case-${c.id}`} className="cursor-pointer group" onClick={() => navigate(`/sales/calc-engine/case/${c.id}`)}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Layers className="h-4 w-4 text-primary shrink-0" />
                          <span className="truncate">{c.title}</span>
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="rounded-md text-[10px] uppercase tracking-wide bg-primary-soft/40 border-primary/30">
                          Samlekalkyle
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.customer_name ?? "—"}</TableCell>
                      <TableCell><Badge variant="outline" className={`rounded-md text-[11px] ${badge.className}`}>{badge.label}</Badge></TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="rounded-md text-xs font-mono">{c.sub_count} delkalk.</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground tabular-nums">{formatDateTime(c.updated_at)}</TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold">
                        kr {Number(c.total_sales).toLocaleString("nb-NO", { maximumFractionDigits: 0 })}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
                          title="Slett kalkylesak"
                          onClick={() => setDeleteTarget({ kind: "case", id: c.id, label: c.title, subCount: c.sub_count })}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                }
                const r = u.row;
                const badge = getStatusBadge("calculation", r.status);
                return (
                  <TableRow key={`single-${r.id}`} className="cursor-pointer group bg-muted/20" onClick={() => navigate(`/sales/calc-engine/${r.id}`)}>
                    <TableCell className="font-medium pl-6">
                      <div className="flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
                        <span className="truncate text-sm text-foreground/80">{r.project_title}</span>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="rounded-md text-[10px] uppercase tracking-wide text-muted-foreground border-muted-foreground/20">
                        Enkel
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.customer_name || "—"}</TableCell>
                    <TableCell><Badge variant="outline" className={`rounded-md text-[11px] ${badge.className}`}>{badge.label}</Badge></TableCell>
                    <TableCell className="text-right">
                      {r.package ? <Badge variant="outline" className="rounded-md text-[10px]">{r.package.name}</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground tabular-nums">{formatDateTime(r.updated_at)}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-muted-foreground">
                      kr {Number(r.total_price).toLocaleString("nb-NO", { maximumFractionDigits: 0 })}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
                        title="Slett kalkyle"
                        onClick={() => setDeleteTarget({ kind: "calculation", id: r.id, label: r.project_title })}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <DeleteCalcDialog
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={() => { setDeleteTarget(null); setRefreshTick((n) => n + 1); }}
      />
    </div>
  );
}
