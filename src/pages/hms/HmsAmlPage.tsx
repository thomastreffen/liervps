import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Search,
  ShieldCheck,
  Users,
  Upload,
  PlayCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

type Severity = "info" | "warning" | "critical";

interface AlertRow {
  id: string;
  user_id: string;
  severity: Severity;
  status: string;
  rule_key: string | null;
  title: string | null;
  explanation: string | null;
  why: string | null;
  period_start: string | null;
  period_end: string | null;
}

export default function HmsAmlPage() {
  const navigate = useNavigate();
  const { activeCompanyId } = useCompanyContext();
  const [q, setQ] = useState("");
  const [sevFilter, setSevFilter] = useState<"all" | Severity>("all");
  const [statusFilter, setStatusFilter] = useState<"open_ack" | "open" | "acknowledged" | "resolved" | "all">("open_ack");
  const [ruleFilter, setRuleFilter] = useState<string>("all");
  const [running, setRunning] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["hms-aml-v3", activeCompanyId, statusFilter, ruleFilter],
    enabled: !!activeCompanyId,
    queryFn: async () => {
      const sb = supabase as any;

      // 1) Alerts
      let query = sb
        .from("worktime_alerts")
        .select(
          "id, user_id, severity, status, rule_key, title, explanation, why, period_start, period_end, value, threshold, recommended_action, updated_at"
        )
        .eq("company_id", activeCompanyId);
      if (statusFilter === "open_ack") query = query.in("status", ["open", "acknowledged"]);
      else if (statusFilter !== "all") query = query.eq("status", statusFilter);
      if (ruleFilter !== "all") query = query.eq("rule_key", ruleFilter);
      const { data: alerts } = await query;

      // 2) Recent worktime entries (last 90d) → ansatte med timer, selv uten varsler
      const since = new Date(); since.setDate(since.getDate() - 90);
      const { data: entries } = await sb
        .from("worktime_entries")
        .select("user_id, total_hours, hours_overtime, work_date")
        .eq("company_id", activeCompanyId)
        .gte("work_date", since.toISOString().slice(0, 10))
        .not("user_id", "is", null);

      const stats = new Map<string, { hours: number; overtime: number; lastDate: string | null }>();
      for (const e of entries ?? []) {
        const s = stats.get(e.user_id) ?? { hours: 0, overtime: 0, lastDate: null };
        s.hours += Number(e.total_hours || 0);
        s.overtime += Number(e.hours_overtime || 0);
        if (!s.lastDate || e.work_date > s.lastDate) s.lastDate = e.work_date;
        stats.set(e.user_id, s);
      }

      // 3) Resolve names via auth_user_id → user_accounts → people
      const userIds = Array.from(new Set([
        ...((alerts ?? []) as AlertRow[]).map((a) => a.user_id),
        ...stats.keys(),
      ]));
      let names: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: accs } = await sb
          .from("user_accounts")
          .select("auth_user_id, person:people!user_accounts_person_id_fkey(full_name, email)")
          .in("auth_user_id", userIds);
        names = Object.fromEntries(
          (accs ?? []).map((a: any) => [a.auth_user_id, a.person?.full_name || a.person?.email || "Ukjent"])
        );
      }

      // 4) Last AML run (max updated_at across alerts)
      const lastRun = (alerts ?? []).reduce<string | null>((mx, a: any) => {
        if (!a.updated_at) return mx;
        return !mx || a.updated_at > mx ? a.updated_at : mx;
      }, null);

      // 5) Build per-user view
      const byUser = new Map<string, { name: string; alerts: AlertRow[]; hours: number; overtime: number; lastDate: string | null }>();
      for (const uid of userIds) {
        const s = stats.get(uid) ?? { hours: 0, overtime: 0, lastDate: null };
        byUser.set(uid, { name: names[uid] ?? "Ukjent", alerts: [], hours: s.hours, overtime: s.overtime, lastDate: s.lastDate });
      }
      for (const a of (alerts ?? []) as AlertRow[]) {
        const v = byUser.get(a.user_id);
        if (v) v.alerts.push(a);
      }

      return {
        users: Array.from(byUser.entries()).map(([user_id, v]) => ({ user_id, ...v })),
        lastRun,
        totalEntries: entries?.length ?? 0,
      };
    },
  });

  const users = data?.users ?? [];
  const filtered = users.filter((u) => {
    if (q && !u.name.toLowerCase().includes(q.toLowerCase())) return false;
    if (sevFilter !== "all" && !u.alerts.some((a) => a.severity === sevFilter)) return false;
    return true;
  });

  const counts = { critical: 0, warning: 0, info: 0 };
  for (const u of users) for (const a of u.alerts) counts[a.severity]++;

  async function runEvaluator() {
    if (!activeCompanyId) return;
    setRunning(true);
    try {
      await (supabase as any).functions.invoke("worktime-aml-evaluate", {
        body: { company_id: activeCompanyId },
      });
      toast({ title: "AML-motor kjørt" });
      refetch();
    } catch (e: any) {
      toast({ title: "Feil", description: String(e.message || e), variant: "destructive" });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
            <ShieldCheck className="h-3.5 w-3.5" /> HMS &amp; HR
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Arbeidsmiljølov</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Status per ansatt på arbeidstid, hviletid og overtid. AML-motoren oppdateres automatisk
            etter import og manuelle endringer.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/hms/import")}>
            <Upload className="h-4 w-4 mr-2" /> Importer timer
          </Button>
          <Button onClick={runEvaluator} disabled={running}>
            <PlayCircle className="h-4 w-4 mr-2" />
            {running ? "Kjører…" : "Kjør AML-motor"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard title="Kritisk" value={counts.critical} icon={AlertTriangle} tone={counts.critical ? "alert" : "ok"} />
        <SummaryCard title="Advarsel" value={counts.warning} icon={AlertTriangle} tone={counts.warning ? "warn" : "ok"} />
        <SummaryCard title="Info" value={counts.info} icon={AlertTriangle} tone="neutral" />
        <SummaryCard title="Ansatte" value={data?.length ?? 0} icon={Users} tone="neutral" />
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Søk ansatt" className="pl-8" />
        </div>
        <Select value={sevFilter} onValueChange={(v) => setSevFilter(v as any)}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle alvorligheter</SelectItem>
            <SelectItem value="critical">Kritisk</SelectItem>
            <SelectItem value="warning">Advarsel</SelectItem>
            <SelectItem value="info">Info</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="open_ack">Åpne + kvitterte</SelectItem>
            <SelectItem value="open">Kun åpne</SelectItem>
            <SelectItem value="acknowledged">Kun kvitterte</SelectItem>
            <SelectItem value="resolved">Løst</SelectItem>
            <SelectItem value="all">Alle</SelectItem>
          </SelectContent>
        </Select>
        <Select value={ruleFilter} onValueChange={setRuleFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle regler</SelectItem>
            <SelectItem value="max_hours_per_day">Maks t/dag</SelectItem>
            <SelectItem value="max_hours_per_week">Maks t/uke</SelectItem>
            <SelectItem value="avg_8w">8-ukers snitt</SelectItem>
            <SelectItem value="min_rest">Hviletid</SelectItem>
            <SelectItem value="max_overtime_7d">OT 7 dager</SelectItem>
            <SelectItem value="max_overtime_4w">OT 4 uker</SelectItem>
            <SelectItem value="max_overtime_52w">OT 52 uker</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Skeleton className="h-40" />
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground space-y-2">
            <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-500/60" />
            <div className="font-medium text-foreground">Ingen åpne AML-varsler</div>
            <p>Importer timer eller kjør motoren for å oppdatere status.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((u) => {
            const crit = u.alerts.filter((a) => a.severity === "critical").length;
            const warn = u.alerts.filter((a) => a.severity === "warning").length;
            const tone = crit ? "alert" : warn ? "warn" : "ok";
            return (
              <Card
                key={u.user_id}
                className="border-border/60 cursor-pointer hover:border-primary/40 transition"
                onClick={() => navigate(`/hms/aml/${u.user_id}`)}
              >
                <CardContent className="py-3 flex items-center gap-3">
                  <div className={
                    tone === "alert" ? "h-2 w-2 rounded-full bg-destructive"
                      : tone === "warn" ? "h-2 w-2 rounded-full bg-amber-500"
                      : "h-2 w-2 rounded-full bg-emerald-500"
                  } />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{u.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {u.alerts[0]?.title || u.alerts[0]?.explanation || u.alerts[0]?.why || `${u.alerts.length} åpne varsler`}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {crit > 0 && <Badge variant="destructive" className="text-[10px]">{crit} kritisk</Badge>}
                    {warn > 0 && <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-600">{warn} advarsel</Badge>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ title, value, icon: Icon, tone }: {
  title: string; value: number; icon: React.ElementType;
  tone: "ok" | "warn" | "alert" | "neutral";
}) {
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm text-muted-foreground font-medium">{title}</CardTitle>
        <Icon className={
          tone === "alert" ? "h-4 w-4 text-destructive"
            : tone === "warn" ? "h-4 w-4 text-amber-500"
            : tone === "ok" ? "h-4 w-4 text-emerald-500"
            : "h-4 w-4 text-muted-foreground"
        } />
      </CardHeader>
      <CardContent><div className="text-2xl font-semibold">{value}</div></CardContent>
    </Card>
  );
}
