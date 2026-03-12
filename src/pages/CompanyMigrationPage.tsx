import { useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import {
  ArrowRightLeft, Loader2, Search, AlertTriangle, CheckCircle2,
  FolderKanban, Users2, FileText, Target, Inbox, Shield, ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

interface Customer {
  id: string;
  name: string;
  org_number: string | null;
  billing_city: string | null;
}

interface AnalyzeResult {
  customers: Customer[];
  related: { projects: number; offers: number; leads: number; cases: number };
  duplicates: { id: string; name: string; org_number: string | null }[];
}

interface IntegrityMismatch {
  type: string;
  entity_type: string;
  entity_id: string;
  entity_name: string;
  entity_company_id: string;
  entity_company_name: string;
  related_company_id: string;
  related_company_name: string;
}

interface IntegrityScanResult {
  mismatches: IntegrityMismatch[];
  summary: { projects: number; offers: number; leads: number; total: number };
  companies: Record<string, string>;
}

type Strategy = "customer_only" | "customer_projects" | "customer_all";

const strategyLabels: Record<Strategy, { label: string; desc: string }> = {
  customer_only: { label: "Kun kunder", desc: "Flytt kun kundene, relaterte objekter forblir" },
  customer_projects: { label: "Kunder + prosjekter", desc: "Flytt kundene og alle tilknyttede prosjekter" },
  customer_all: { label: "Kunder + alt relatert", desc: "Flytt kunder, prosjekter, tilbud, leads og saker" },
};

export default function CompanyMigrationPage() {
  const { companies } = useCompanyContext();
  const [fromCompanyId, setFromCompanyId] = useState<string>("");
  const [toCompanyId, setToCompanyId] = useState<string>("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalyzeResult | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [strategy, setStrategy] = useState<Strategy>("customer_only");
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<any>(null);

  // Integrity scan state
  const [integrityScanning, setIntegrityScanning] = useState(false);
  const [integrityScan, setIntegrityScan] = useState<IntegrityScanResult | null>(null);

  const invoke = useCallback(async (body: any) => {
    const { data, error } = await supabase.functions.invoke("company-migrate", { body });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    return data;
  }, []);

  const runAnalysis = async () => {
    if (!fromCompanyId || !toCompanyId || fromCompanyId === toCompanyId) {
      toast.error("Velg to ulike selskaper");
      return;
    }
    setAnalyzing(true);
    setAnalysis(null);
    setSelectedIds(new Set());
    try {
      const data = await invoke({ action: "analyze", from_company_id: fromCompanyId, to_company_id: toCompanyId });
      setAnalysis(data);
      // Select all by default
      setSelectedIds(new Set((data.customers || []).map((c: Customer) => c.id)));
    } catch (e: any) {
      toast.error("Analyse feilet: " + e.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const runIntegrityScan = async () => {
    setIntegrityScanning(true);
    try {
      const data = await invoke({ action: "integrity_scan" });
      setIntegrityScan(data);
      toast.success(`Skanning fullført — ${data.summary.total} avvik funnet`);
    } catch (e: any) {
      toast.error("Integritetsskanning feilet: " + e.message);
    } finally {
      setIntegrityScanning(false);
    }
  };

  const runMigration = async () => {
    setMigrating(true);
    try {
      const data = await invoke({
        action: "migrate",
        customer_ids: Array.from(selectedIds),
        to_company_id: toCompanyId,
        strategy,
        note: note.trim() || null,
      });
      setMigrationResult(data.results);
      setConfirmOpen(false);
      toast.success("Migrering fullført!");
      // Refresh analysis
      setAnalysis(null);
    } catch (e: any) {
      toast.error("Migrering feilet: " + e.message);
    } finally {
      setMigrating(false);
    }
  };

  const toggleAll = () => {
    if (!analysis) return;
    const filtered = filteredCustomers;
    const allSelected = filtered.every((c) => selectedIds.has(c.id));
    if (allSelected) {
      const newSet = new Set(selectedIds);
      filtered.forEach((c) => newSet.delete(c.id));
      setSelectedIds(newSet);
    } else {
      const newSet = new Set(selectedIds);
      filtered.forEach((c) => newSet.add(c.id));
      setSelectedIds(newSet);
    }
  };

  const filteredCustomers = useMemo(() => {
    if (!analysis) return [];
    if (!search.trim()) return analysis.customers;
    const q = search.toLowerCase();
    return analysis.customers.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.org_number || "").includes(q) || (c.billing_city || "").toLowerCase().includes(q)
    );
  }, [analysis, search]);

  const fromCompany = companies.find((c) => c.id === fromCompanyId);
  const toCompany = companies.find((c) => c.id === toCompanyId);
  const duplicateIds = new Set(analysis?.duplicates.map((d) => d.id) || []);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          Selskapsmigrering
        </h1>
        <p className="text-sm text-muted-foreground/70">Flytt kunder og relaterte objekter mellom selskaper</p>
      </div>

      <Tabs defaultValue="migrate">
        <TabsList className="rounded-xl">
          <TabsTrigger value="migrate" className="rounded-lg gap-1.5">
            <ArrowRightLeft className="h-3.5 w-3.5" />
            Migrering
          </TabsTrigger>
          <TabsTrigger value="integrity" className="rounded-lg gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" />
            Dataintegritet
          </TabsTrigger>
        </TabsList>

        {/* ===================== MIGRATE TAB ===================== */}
        <TabsContent value="migrate" className="space-y-6 mt-6">
          {/* Step 1: Company selection */}
          <Card className="rounded-2xl">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">1. Velg selskaper</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
                <div className="flex-1 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Fra selskap</Label>
                  <Select value={fromCompanyId} onValueChange={setFromCompanyId}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Velg…" /></SelectTrigger>
                    <SelectContent>
                      {companies.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0 hidden sm:block" />
                <div className="flex-1 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Til selskap</Label>
                  <Select value={toCompanyId} onValueChange={setToCompanyId}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Velg…" /></SelectTrigger>
                    <SelectContent>
                      {companies.filter((c) => c.id !== fromCompanyId).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={runAnalysis} disabled={analyzing || !fromCompanyId || !toCompanyId || fromCompanyId === toCompanyId} className="rounded-xl gap-1.5">
                  {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Analyser
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Migration result */}
          {migrationResult && (
            <Card className="rounded-2xl border-primary/20 bg-primary/5">
              <CardContent className="py-6 flex items-center gap-4">
                <CheckCircle2 className="h-8 w-8 text-primary shrink-0" />
                <div>
                  <p className="font-semibold text-foreground">Migrering fullført</p>
                  <p className="text-sm text-muted-foreground">
                    {migrationResult.customers} kunder, {migrationResult.projects} prosjekter,{" "}
                    {migrationResult.offers} tilbud, {migrationResult.leads} leads, {migrationResult.cases} saker flyttet
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Analysis results */}
          {analysis && (
            <>
              {/* Impact preview cards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <ImpactCard icon={<Users2 className="h-5 w-5" />} label="Kunder" count={analysis.customers.length} accent="text-primary" />
                <ImpactCard icon={<FolderKanban className="h-5 w-5" />} label="Prosjekter" count={analysis.related.projects} accent="text-info" />
                <ImpactCard icon={<FileText className="h-5 w-5" />} label="Tilbud" count={analysis.related.offers} accent="text-accent" />
                <ImpactCard icon={<Target className="h-5 w-5" />} label="Leads" count={analysis.related.leads} accent="text-warning" />
                <ImpactCard icon={<Inbox className="h-5 w-5" />} label="Saker" count={analysis.related.cases} accent="text-destructive" />
              </div>

              {/* Duplicates warning */}
              {analysis.duplicates.length > 0 && (
                <div className="flex items-start gap-3 bg-warning/5 border border-warning/20 rounded-xl p-4">
                  <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {analysis.duplicates.length} potensielle duplikater i {toCompany?.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {analysis.duplicates.slice(0, 5).map((d) => d.name).join(", ")}
                      {analysis.duplicates.length > 5 && ` +${analysis.duplicates.length - 5} flere`}
                    </p>
                  </div>
                </div>
              )}

              {/* Strategy selection */}
              <Card className="rounded-2xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">2. Velg flyttestrategi</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(Object.entries(strategyLabels) as [Strategy, { label: string; desc: string }][]).map(([key, { label, desc }]) => (
                    <button
                      key={key}
                      onClick={() => setStrategy(key)}
                      className={`flex items-start gap-3 w-full rounded-xl border p-4 text-left transition-all ${
                        strategy === key ? "border-primary bg-primary/5 shadow-sm" : "border-border/40 hover:border-border"
                      }`}
                    >
                      <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                        strategy === key ? "border-primary" : "border-border"
                      }`}>
                        {strategy === key && <div className="h-2.5 w-2.5 rounded-full bg-primary" />}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{label}</p>
                        <p className="text-xs text-muted-foreground">{desc}</p>
                      </div>
                    </button>
                  ))}
                </CardContent>
              </Card>

              {/* Customer selection table */}
              <Card className="rounded-2xl">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">3. Velg kunder ({selectedIds.size} av {analysis.customers.length})</CardTitle>
                    <div className="relative w-48">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Søk…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-8 h-8 text-xs rounded-lg"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="rounded-xl border border-border/40 overflow-x-auto max-h-[400px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b border-border/30">
                          <TableHead className="w-10">
                            <Checkbox
                              checked={filteredCustomers.length > 0 && filteredCustomers.every((c) => selectedIds.has(c.id))}
                              onCheckedChange={toggleAll}
                            />
                          </TableHead>
                          <TableHead className="text-xs font-semibold uppercase">Kundenavn</TableHead>
                          <TableHead className="text-xs font-semibold uppercase">Org.nr</TableHead>
                          <TableHead className="text-xs font-semibold uppercase">By</TableHead>
                          <TableHead className="text-xs font-semibold uppercase">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredCustomers.length === 0 ? (
                          <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Ingen kunder funnet</TableCell></TableRow>
                        ) : (
                          filteredCustomers.map((c) => (
                            <TableRow key={c.id} className="hover:bg-secondary/40">
                              <TableCell>
                                <Checkbox
                                  checked={selectedIds.has(c.id)}
                                  onCheckedChange={(v) => {
                                    const s = new Set(selectedIds);
                                    v ? s.add(c.id) : s.delete(c.id);
                                    setSelectedIds(s);
                                  }}
                                />
                              </TableCell>
                              <TableCell className="text-sm font-medium">{c.name}</TableCell>
                              <TableCell className="text-sm text-muted-foreground font-mono">{c.org_number || "—"}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{c.billing_city || "—"}</TableCell>
                              <TableCell>
                                {duplicateIds.has(c.id) ? (
                                  <Badge variant="outline" className="text-warning border-warning/30 text-[10px]">Mulig duplikat</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-primary border-primary/20 text-[10px]">OK</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Note + execute */}
              <Card className="rounded-2xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">4. Notat og kjør</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Valgfritt notat (logges med migreringen)</Label>
                    <Textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="F.eks. 'Flytt kunder importert fra Tripletex med feil selskap'"
                      rows={2}
                    />
                  </div>
                  <Button
                    onClick={() => setConfirmOpen(true)}
                    disabled={selectedIds.size === 0}
                    className="rounded-xl gap-1.5"
                    size="lg"
                  >
                    <ArrowRightLeft className="h-4 w-4" />
                    Flytt {selectedIds.size} kunder til {toCompany?.name || "…"}
                  </Button>
                </CardContent>
              </Card>
            </>
          )}

          {/* Confirmation dialog */}
          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                  Bekreft migrering
                </DialogTitle>
                <DialogDescription>
                  Denne handlingen vil flytte {selectedIds.size} kunder fra{" "}
                  <strong>{fromCompany?.name}</strong> til <strong>{toCompany?.name}</strong>.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 py-3">
                <p className="text-sm"><strong>Strategi:</strong> {strategyLabels[strategy].label}</p>
                <p className="text-sm text-muted-foreground">{strategyLabels[strategy].desc}</p>
                {analysis?.duplicates && analysis.duplicates.length > 0 && (
                  <p className="text-sm text-warning font-medium">
                    ⚠ {analysis.duplicates.length} potensielle duplikater oppdaget
                  </p>
                )}
                {note.trim() && <p className="text-xs text-muted-foreground">Notat: {note}</p>}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmOpen(false)} className="rounded-xl">Avbryt</Button>
                <Button onClick={runMigration} disabled={migrating} className="rounded-xl gap-1.5">
                  {migrating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
                  {migrating ? "Flytter…" : "Bekreft og flytt"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ===================== INTEGRITY TAB ===================== */}
        <TabsContent value="integrity" className="space-y-6 mt-6">
          <Card className="rounded-2xl">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Selskapsavvik</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Finn objekter der kunde og relatert entitet har ulikt selskap
                  </p>
                </div>
                <Button onClick={runIntegrityScan} disabled={integrityScanning} className="rounded-xl gap-1.5">
                  {integrityScanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Skann
                </Button>
              </div>
            </CardHeader>
          </Card>

          {integrityScan && (
            <>
              {/* Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <ImpactCard icon={<FolderKanban className="h-5 w-5" />} label="Prosjektavvik" count={integrityScan.summary.projects} accent="text-warning" />
                <ImpactCard icon={<FileText className="h-5 w-5" />} label="Tilbudsavvik" count={integrityScan.summary.offers} accent="text-warning" />
                <ImpactCard icon={<Target className="h-5 w-5" />} label="Leadavvik" count={integrityScan.summary.leads} accent="text-warning" />
                <ImpactCard icon={<AlertTriangle className="h-5 w-5" />} label="Totalt" count={integrityScan.summary.total} accent={integrityScan.summary.total > 0 ? "text-destructive" : "text-primary"} />
              </div>

              {integrityScan.mismatches.length === 0 ? (
                <Card className="rounded-2xl">
                  <CardContent className="py-12 text-center">
                    <CheckCircle2 className="h-10 w-10 mx-auto text-primary mb-3" />
                    <p className="text-sm font-semibold">Ingen avvik funnet</p>
                    <p className="text-xs text-muted-foreground mt-1">Alle objekter har konsistent selskapstilknytning</p>
                  </CardContent>
                </Card>
              ) : (
                <Card className="rounded-2xl">
                  <CardContent className="pt-6">
                    <div className="rounded-xl border border-border/40 overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs font-semibold uppercase">Type</TableHead>
                            <TableHead className="text-xs font-semibold uppercase">Objekt</TableHead>
                            <TableHead className="text-xs font-semibold uppercase">Objektets selskap</TableHead>
                            <TableHead className="text-xs font-semibold uppercase">Kundens selskap</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {integrityScan.mismatches.map((m, i) => (
                            <TableRow key={i}>
                              <TableCell>
                                <Badge variant="outline" className="text-[10px]">
                                  {m.entity_type === "project" ? "Prosjekt" : m.entity_type === "offer" ? "Tilbud" : "Lead"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm font-medium">{m.entity_name || m.entity_id.slice(0, 8)}</TableCell>
                              <TableCell className="text-sm">{m.entity_company_name}</TableCell>
                              <TableCell className="text-sm text-warning font-medium">{m.related_company_name}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ImpactCard({ icon, label, count, accent }: { icon: React.ReactNode; label: string; count: number; accent: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/30 bg-card px-4 py-3">
      <div className={`${accent} opacity-60`}>{icon}</div>
      <div>
        <p className={`text-xl font-extrabold ${count > 0 ? accent : "text-foreground"}`}>{count}</p>
        <p className="text-[11px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
