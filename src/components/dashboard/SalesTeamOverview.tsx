import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { STATUS_WEIGHTS } from "@/components/dashboard/OfferSummaryCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Users, TrendingUp, Flame, AlertTriangle, ClipboardList, ArrowRight,
  FileText, ExternalLink,
} from "lucide-react";

type Period = "7d" | "30d" | "quarter";

interface SellerRow {
  userId: string;
  name: string;
  activeOffers: number;
  totalValue: number;
  weightedValue: number;
  openTasks: number;
  hotOffers: number;
  staleOffers: number;
  convertedCount: number;
}

function periodToDate(period: Period): Date {
  const now = new Date();
  if (period === "7d") return new Date(now.getTime() - 7 * 86400000);
  if (period === "30d") return new Date(now.getTime() - 30 * 86400000);
  // quarter — start of current quarter
  const q = Math.floor(now.getMonth() / 3) * 3;
  return new Date(now.getFullYear(), q, 1);
}

function statusColor(count: number, warn: number, crit: number) {
  if (count >= crit) return "bg-destructive/10 text-destructive";
  if (count >= warn) return "bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400";
  return "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400";
}

const fmt = (v: number) =>
  v >= 1_000_000
    ? `${(v / 1_000_000).toLocaleString("nb-NO", { maximumFractionDigits: 1 })}M`
    : v >= 1_000
      ? `${(v / 1_000).toLocaleString("nb-NO", { maximumFractionDigits: 0 })}k`
      : v.toLocaleString("nb-NO", { maximumFractionDigits: 0 });

export function SalesTeamOverview() {
  const nav = useNavigate();
  const [period, setPeriod] = useState<Period>("30d");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<SellerRow[]>([]);
  const [totals, setTotals] = useState({
    activeOffers: 0,
    openPipeline: 0,
    weightedPipeline: 0,
    openTasks: 0,
    hotOffers: 0,
    staleOffers: 0,
  });

  useEffect(() => {
    (async () => {
      setLoading(true);
      const now = new Date();
      const periodStart = periodToDate(period);
      const d24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const d5 = new Date(now.getTime() - 5 * 86400000);

      // Fetch all calculations (not deleted)
      const { data: calcs } = await supabase
        .from("calculations")
        .select("id, created_by, customer_name, status, total_price, created_at, updated_at")
        .is("deleted_at", null);

      // Fetch followup tasks
      const { data: tasks } = await supabase
        .from("offer_followup_tasks" as any)
        .select("offer_id, assigned_to, status, priority")
        .in("status", ["open", "snoozed"]);

      // Fetch activity events (recent)
      const { data: actEvents } = await supabase
        .from("offer_activity_events" as any)
        .select("offer_id, actor_type, event_at")
        .in("actor_type", ["customer"])
        .gte("event_at", d24h);

      // Fetch user names
      const { data: userAccounts } = await supabase
        .from("user_accounts")
        .select("auth_user_id, display_name, person_id, people:person_id(full_name)")
        .eq("is_active", true);

      const allCalcs = calcs || [];
      const allTasks = (tasks || []) as any[];
      const allActivity = (actEvents || []) as any[];
      const users = (userAccounts || []) as any[];

      // Map user_id -> name
      const nameMap = new Map<string, string>();
      for (const u of users) {
        const name = u.people?.full_name || u.display_name || u.auth_user_id?.slice(0, 8);
        if (u.auth_user_id) nameMap.set(u.auth_user_id, name);
      }

      // Hot offer IDs (customer activity in 24h)
      const hotOfferIds = new Set(allActivity.map((a: any) => a.offer_id));

      // Activity count per offer for "hot" detection
      const actCountPerOffer = new Map<string, number>();
      for (const a of allActivity) {
        actCountPerOffer.set(a.offer_id, (actCountPerOffer.get(a.offer_id) || 0) + 1);
      }

      // Open tasks per user
      const tasksByUser = new Map<string, number>();
      for (const t of allTasks) {
        const uid = t.assigned_to;
        if (uid) tasksByUser.set(uid, (tasksByUser.get(uid) || 0) + 1);
      }

      // Group calcs by created_by
      const byUser = new Map<string, typeof allCalcs>();
      for (const c of allCalcs) {
        const uid = c.created_by;
        if (!uid) continue;
        if (!byUser.has(uid)) byUser.set(uid, []);
        byUser.get(uid)!.push(c);
      }

      const sellerRows: SellerRow[] = [];
      let tActive = 0, tPipeline = 0, tWeighted = 0, tTasks = 0, tHot = 0, tStale = 0;

      for (const [userId, userCalcs] of byUser) {
        const active = userCalcs.filter((c: any) => !["accepted", "rejected", "converted"].includes(c.status));
        const totalValue = active.reduce((s: number, c: any) => s + Number(c.total_price || 0), 0);
        const weightedValue = active.reduce((s: number, c: any) => {
          const w = STATUS_WEIGHTS[c.status as string] ?? 0.1;
          return s + Number(c.total_price || 0) * w;
        }, 0);

        const hot = active.filter((c: any) => hotOfferIds.has(c.id) || (actCountPerOffer.get(c.id) || 0) >= 2).length;
        const stale = active.filter((c: any) => {
          if (c.status !== "sent") return false;
          return new Date(c.updated_at || c.created_at) < d5;
        }).length;

        const converted = userCalcs.filter((c: any) =>
          c.status === "converted" && new Date(c.updated_at || c.created_at) >= periodStart
        ).length;

        const openTaskCount = tasksByUser.get(userId) || 0;

        // Only include users with activity
        if (active.length === 0 && converted === 0 && openTaskCount === 0) continue;

        sellerRows.push({
          userId,
          name: nameMap.get(userId) || userId.slice(0, 8),
          activeOffers: active.length,
          totalValue,
          weightedValue,
          openTasks: openTaskCount,
          hotOffers: hot,
          staleOffers: stale,
          convertedCount: converted,
        });

        tActive += active.length;
        tPipeline += totalValue;
        tWeighted += weightedValue;
        tTasks += openTaskCount;
        tHot += hot;
        tStale += stale;
      }

      // Sort: most urgent first
      sellerRows.sort((a, b) => {
        // Hot + stale + tasks composite
        const scoreA = a.hotOffers * 3 + a.staleOffers * 2 + a.openTasks;
        const scoreB = b.hotOffers * 3 + b.staleOffers * 2 + b.openTasks;
        return scoreB - scoreA;
      });

      setRows(sellerRows);
      setTotals({
        activeOffers: tActive,
        openPipeline: tPipeline,
        weightedPipeline: tWeighted,
        openTasks: tTasks,
        hotOffers: tHot,
        staleOffers: tStale,
      });
      setLoading(false);
    })();
  }, [period]);

  const kpis = [
    { label: "Aktive tilbud", value: totals.activeOffers, icon: FileText },
    { label: "Åpen pipeline", value: `kr ${fmt(totals.openPipeline)}`, icon: TrendingUp },
    { label: "Vektet prognose", value: `kr ${fmt(totals.weightedPipeline)}`, icon: TrendingUp },
    { label: "Åpne oppgaver", value: totals.openTasks, icon: ClipboardList, color: statusColor(totals.openTasks, 5, 10) },
    { label: "Varme tilbud", value: totals.hotOffers, icon: Flame, color: totals.hotOffers > 0 ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400" : undefined },
    { label: "Uten oppfølging", value: totals.staleOffers, icon: AlertTriangle, color: statusColor(totals.staleOffers, 3, 6) },
  ];

  return (
    <div className="rounded-2xl border border-border/40 bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border/30">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Users className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Teamoversikt salg</h3>
            <p className="text-[11px] text-muted-foreground/60">Tilbudsarbeid og pipeline per selger</p>
          </div>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-[140px] h-8 text-xs rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Siste 7 dager</SelectItem>
            <SelectItem value="30d">Siste 30 dager</SelectItem>
            <SelectItem value="quarter">Dette kvartalet</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 p-4 sm:p-5">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-muted/20 p-3">
                <Skeleton className="h-6 w-12 mb-1" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))
          : kpis.map((kpi) => (
              <div
                key={kpi.label}
                className={`rounded-xl p-3 ${kpi.color || "bg-muted/20"}`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <kpi.icon className="h-3.5 w-3.5 opacity-60" />
                  <span className="text-lg font-bold">{kpi.value}</span>
                </div>
                <p className="text-[10px] opacity-70">{kpi.label}</p>
              </div>
            ))}
      </div>

      {/* Team table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border/30">
              <TableHead className="text-xs font-semibold uppercase tracking-wider">Selger</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-right">Aktive</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-right hidden sm:table-cell">Tilbudsverdi</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-right hidden md:table-cell">Vektet</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-center">Oppgaver</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-center">Varme</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-center hidden sm:table-cell">Uten aktivitet</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-right hidden lg:table-cell">Konvertert</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider w-8"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 9 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-10">
                  Ingen selgere med aktive tilbud
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow
                  key={r.userId}
                  className="cursor-pointer hover:bg-secondary/40 transition-colors"
                  onClick={() => nav(`/sales/offers?owner=${r.userId}`)}
                >
                  <TableCell className="font-medium text-sm">{r.name}</TableCell>
                  <TableCell className="text-right text-sm font-mono">{r.activeOffers}</TableCell>
                  <TableCell className="text-right text-sm font-mono hidden sm:table-cell">
                    {r.totalValue > 0 ? `kr ${fmt(r.totalValue)}` : "—"}
                  </TableCell>
                  <TableCell className="text-right text-sm font-mono hidden md:table-cell">
                    {r.weightedValue > 0 ? `kr ${fmt(r.weightedValue)}` : "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary" className={`text-xs rounded-lg ${statusColor(r.openTasks, 3, 6)}`}>
                      {r.openTasks}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {r.hotOffers > 0 ? (
                      <Badge variant="secondary" className="text-xs rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400">
                        <Flame className="h-3 w-3 mr-0.5" />
                        {r.hotOffers}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground/40 text-sm">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center hidden sm:table-cell">
                    <Badge variant="secondary" className={`text-xs rounded-lg ${statusColor(r.staleOffers, 2, 4)}`}>
                      {r.staleOffers}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm font-mono hidden lg:table-cell">
                    {r.convertedCount > 0 ? r.convertedCount : "—"}
                  </TableCell>
                  <TableCell>
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/30" />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
