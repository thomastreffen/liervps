import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, Search, ShieldCheck, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";

interface ProfileRow {
  id: string;
  user_account_id: string;
  is_active: boolean;
  ruleset_id: string | null;
  display_name?: string | null;
}

interface AlertRow {
  id: string;
  user_account_id: string;
  severity: "info" | "warning" | "critical";
  status: string;
  rule_key: string | null;
  why: string | null;
}

export default function HmsAmlPage() {
  const { activeCompanyId } = useCompanyContext();
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["hms-aml", activeCompanyId],
    enabled: !!activeCompanyId,
    queryFn: async () => {
      const sb = supabase as any;
      const { data: profiles } = await sb
        .from("employee_work_profiles")
        .select("id, user_account_id, is_active, ruleset_id")
        .eq("company_id", activeCompanyId)
        .eq("is_active", true);

      const userIds = (profiles ?? []).map((p: ProfileRow) => p.user_account_id);

      let names: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: accs } = await sb
          .from("user_accounts")
          .select("id, full_name, email")
          .in("id", userIds);
        names = Object.fromEntries(
          (accs ?? []).map((a: any) => [a.id, a.full_name || a.email || "Ukjent"])
        );
      }

      const { data: alerts } = await sb
        .from("worktime_alerts")
        .select("id, user_account_id, severity, status, rule_key, why")
        .eq("company_id", activeCompanyId)
        .eq("status", "open");

      const byUser = new Map<string, AlertRow[]>();
      for (const a of (alerts ?? []) as AlertRow[]) {
        const arr = byUser.get(a.user_account_id) ?? [];
        arr.push(a);
        byUser.set(a.user_account_id, arr);
      }

      return {
        rows: ((profiles ?? []) as ProfileRow[]).map((p) => ({
          ...p,
          display_name: names[p.user_account_id] ?? "Ukjent ansatt",
          alerts: byUser.get(p.user_account_id) ?? [],
        })),
      };
    },
  });

  const filtered = (data?.rows ?? []).filter((r) =>
    !q ? true : (r.display_name ?? "").toLowerCase().includes(q.toLowerCase())
  );

  const totalCritical = (data?.rows ?? []).reduce(
    (n, r) => n + r.alerts.filter((a) => a.severity === "critical").length,
    0
  );
  const totalWarning = (data?.rows ?? []).reduce(
    (n, r) => n + r.alerts.filter((a) => a.severity === "warning").length,
    0
  );

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
          <ShieldCheck className="h-3.5 w-3.5" />
          HMS &amp; HR
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Arbeidsmiljølov</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Status per ansatt på arbeidstid, hviletid og overtid. AML-motoren regner automatisk i
          runde B – her ser du allerede registrerte varsler.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SummaryCard
          title="Aktive ansatte"
          value={data?.rows.length ?? 0}
          icon={Users}
          tone="neutral"
        />
        <SummaryCard
          title="Kritiske varsler"
          value={totalCritical}
          icon={AlertTriangle}
          tone={totalCritical ? "alert" : "ok"}
        />
        <SummaryCard
          title="Advarsler"
          value={totalWarning}
          icon={AlertTriangle}
          tone={totalWarning ? "warn" : "ok"}
        />
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Søk ansatt"
          className="pl-8"
        />
      </div>

      {isLoading ? (
        <Skeleton className="h-40" />
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground space-y-2">
            <Users className="h-8 w-8 mx-auto text-muted-foreground/40" />
            <div className="font-medium text-foreground">Ingen ansatte med arbeidstidsprofil</div>
            <p>Opprett arbeidstidsprofiler i runde B for å aktivere AML-overvåking.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const crit = r.alerts.filter((a) => a.severity === "critical").length;
            const warn = r.alerts.filter((a) => a.severity === "warning").length;
            const tone = crit ? "alert" : warn ? "warn" : "ok";
            return (
              <Card key={r.id} className="border-border/60">
                <CardContent className="py-3 flex items-center gap-3">
                  <div
                    className={
                      tone === "alert"
                        ? "h-2 w-2 rounded-full bg-destructive"
                        : tone === "warn"
                        ? "h-2 w-2 rounded-full bg-amber-500"
                        : "h-2 w-2 rounded-full bg-emerald-500"
                    }
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{r.display_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.alerts.length === 0
                        ? "Innenfor grenser"
                        : `${r.alerts.length} åpne varsler`}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {crit > 0 && (
                      <Badge variant="destructive" className="text-[10px]">
                        {crit} kritisk
                      </Badge>
                    )}
                    {warn > 0 && (
                      <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-600">
                        {warn} advarsel
                      </Badge>
                    )}
                    {r.alerts.length === 0 && (
                      <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-600 gap-1">
                        <CheckCircle2 className="h-3 w-3" /> OK
                      </Badge>
                    )}
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

function SummaryCard({
  title,
  value,
  icon: Icon,
  tone,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  tone: "ok" | "warn" | "alert" | "neutral";
}) {
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm text-muted-foreground font-medium">{title}</CardTitle>
        <Icon
          className={
            tone === "alert"
              ? "h-4 w-4 text-destructive"
              : tone === "warn"
              ? "h-4 w-4 text-amber-500"
              : tone === "ok"
              ? "h-4 w-4 text-emerald-500"
              : "h-4 w-4 text-muted-foreground"
          }
        />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}
