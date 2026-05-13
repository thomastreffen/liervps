import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, AlertTriangle, CheckCircle2, ShieldCheck, Clock, Plus, Pencil } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { ManualEntryDialog } from "@/components/hms/ManualEntryDialog";

function isoWeekStart(d: Date) {
  const dt = new Date(d);
  const day = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - day);
  return dt.toISOString().slice(0, 10);
}
function addDays(d: Date, n: number) {
  const dt = new Date(d);
  dt.setDate(dt.getDate() + n);
  return dt;
}

export default function HmsEmployeeAmlPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { activeCompanyId } = useCompanyContext();

  const { data, isLoading } = useQuery({
    queryKey: ["hms-aml-employee", activeCompanyId, id],
    enabled: !!activeCompanyId && !!id,
    queryFn: async () => {
      const sb = supabase as any;
      const since = addDays(new Date(), -56).toISOString().slice(0, 10);
      const since365 = addDays(new Date(), -365).toISOString().slice(0, 10);
      const [{ data: acct }, { data: alerts }, { data: entries }, { data: ot }] = await Promise.all([
        sb.from("user_accounts").select("id, full_name, email").eq("id", id).maybeSingle(),
        sb.from("worktime_alerts").select("*").eq("company_id", activeCompanyId).eq("user_id", id).order("created_at", { ascending: false }),
        sb.from("worktime_entries").select("*").eq("company_id", activeCompanyId).eq("user_id", id).gte("work_date", since365).order("work_date", { ascending: false }),
        sb.from("overtime_approvals").select("*").eq("company_id", activeCompanyId).eq("user_id", id).order("created_at", { ascending: false }),
      ]);
      return { acct, alerts: alerts ?? [], entries: entries ?? [], approvals: ot ?? [], since };
    },
  });

  const stats = useMemo(() => {
    if (!data) return null;
    const today = new Date();
    const weekStart = isoWeekStart(today);
    const this7 = addDays(today, -7).toISOString().slice(0, 10);
    const this28 = addDays(today, -28).toISOString().slice(0, 10);
    const this365 = addDays(today, -365).toISOString().slice(0, 10);

    const sumWeek = data.entries.filter((e: any) => e.work_date >= weekStart).reduce((s: number, e: any) => s + Number(e.total_hours || e.hours || 0), 0);

    // 8-week avg
    const byWeek: Record<string, number> = {};
    for (const e of data.entries) {
      const ws = isoWeekStart(new Date(e.work_date + "T00:00:00Z"));
      byWeek[ws] = (byWeek[ws] ?? 0) + Number(e.total_hours || e.hours || 0);
    }
    const last8 = Object.entries(byWeek).sort().slice(-8);
    const avg8 = last8.length ? last8.reduce((s, [, v]) => s + v, 0) / last8.length : 0;

    const ot7 = data.entries.filter((e: any) => e.work_date >= this7).reduce((s: number, e: any) => s + Number(e.hours_overtime || 0), 0);
    const ot28 = data.entries.filter((e: any) => e.work_date >= this28).reduce((s: number, e: any) => s + Number(e.hours_overtime || 0), 0);
    const ot365 = data.entries.filter((e: any) => e.work_date >= this365).reduce((s: number, e: any) => s + Number(e.hours_overtime || 0), 0);

    return { sumWeek, avg8, ot7, ot28, ot365, weeks8: last8 };
  }, [data]);

  const ackMut = useMutation({
    mutationFn: async (alertId: string) => {
      await (supabase as any)
        .from("worktime_alerts")
        .update({ status: "acknowledged", acknowledged_at: new Date().toISOString() })
        .eq("id", alertId);
    },
    onSuccess: () => {
      toast({ title: "Kvittert" });
      qc.invalidateQueries({ queryKey: ["hms-aml-employee"] });
    },
  });

  const resolveMut = useMutation({
    mutationFn: async (alertId: string) => {
      const comment = prompt("Kommentar / tiltak:") ?? "";
      await (supabase as any)
        .from("worktime_alerts")
        .update({ status: "resolved", resolved_at: new Date().toISOString(), resolution_comment: comment })
        .eq("id", alertId);
    },
    onSuccess: () => {
      toast({ title: "Løst" });
      qc.invalidateQueries({ queryKey: ["hms-aml-employee"] });
    },
  });

  const chartData = (stats?.weeks8 ?? []).map(([week, hours]) => ({
    week: week.slice(5),
    hours: Number((hours as number).toFixed(1)),
  }));
  const [editEntry, setEditEntry] = useState<any | null>(null);

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3 justify-between flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/hms/aml")}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
              <ShieldCheck className="h-3.5 w-3.5" /> AML-detalj
            </div>
            <h1 className="text-2xl font-semibold">{data.acct?.full_name || data.acct?.email || "Ukjent"}</h1>
          </div>
        </div>
        <ManualEntryDialog
          userId={id!}
          trigger={<Button size="sm"><Plus className="h-4 w-4 mr-1" />Manuell timelinje</Button>}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatCard label="Denne uken" value={`${stats?.sumWeek.toFixed(1)}t`} />
        <StatCard label="8-ukers snitt" value={`${stats?.avg8.toFixed(1)}t/uke`} accent={stats && stats.avg8 > 48 ? "alert" : undefined} />
        <StatCard label="OT 7d" value={`${stats?.ot7.toFixed(1)}t`} />
        <StatCard label="OT 4u" value={`${stats?.ot28.toFixed(1)}t`} />
        <StatCard label="OT 52u" value={`${stats?.ot365.toFixed(1)}t`} />
      </div>

      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Timer per uke (siste 8)</CardTitle></CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <ReferenceLine y={48} stroke="hsl(var(--destructive))" strokeDasharray="3 3" />
                  <ReferenceLine y={40} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                  <Bar dataKey="hours" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Åpne varsler ({open.length})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {open.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              <CheckCircle2 className="inline h-4 w-4 mr-1 text-emerald-500" /> Ingen åpne varsler
            </p>
          )}
          {open.map((a: any) => (
            <div key={a.id} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={a.severity === "critical" ? "destructive" : "outline"}
                      className={a.severity === "warning" ? "border-amber-500/40 text-amber-600" : ""}>
                      {a.severity}
                    </Badge>
                    <span className="text-sm font-medium">{a.title || a.rule_key}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{a.explanation || a.why}</p>
                  {a.recommended_action && (
                    <p className="text-xs mt-1"><strong>Tiltak:</strong> {a.recommended_action}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {a.period_start} – {a.period_end} · {a.value} / {a.threshold}
                  </p>
                </div>
                <div className="flex flex-col gap-1">
                  {a.status === "open" && (
                    <Button size="sm" variant="outline" onClick={() => ackMut.mutate(a.id)}>Kvitter</Button>
                  )}
                  <Button size="sm" onClick={() => resolveMut.mutate(a.id)}>Løs</Button>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" /> Siste timeoppføringer</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {data.entries.slice(0, 30).map((e: any) => (
              <div key={e.id} className="flex items-center justify-between text-xs py-1 border-b last:border-0 group">
                <span>{e.work_date}</span>
                <span className="text-muted-foreground flex items-center gap-1">
                  {e.source_system === "manual" && <Badge variant="outline" className="text-[9px] py-0">Manuell</Badge>}
                  {e.status === "cancelled" && <Badge variant="destructive" className="text-[9px] py-0">Annullert</Badge>}
                  {e.project_number_raw || e.activity || e.time_type || "—"}
                </span>
                <span className="font-medium flex items-center gap-2">
                  {Number(e.total_hours || e.hours).toFixed(1)}t
                  {e.hours_overtime > 0 && <span className="text-amber-600">(+{Number(e.hours_overtime).toFixed(1)} OT)</span>}
                  {(e.source_system === "manual" || e.manually_adjusted) && (
                    <Button size="icon" variant="ghost" className="h-5 w-5 opacity-0 group-hover:opacity-100" onClick={() => setEditEntry(e)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                  )}
                </span>
              </div>
            ))}
            {data.entries.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">Ingen timer registrert.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {editEntry && (
        <ManualEntryDialog userId={id!} initial={editEntry} onClose={() => setEditEntry(null)} />
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Overtidsgodkjenninger ({data.approvals.length})</CardTitle></CardHeader>
        <CardContent>
          {data.approvals.length === 0 && <p className="text-sm text-muted-foreground">Ingen registrert.</p>}
          <div className="space-y-1">
            {data.approvals.map((o: any) => (
              <div key={o.id} className="flex items-center justify-between text-xs py-1 border-b last:border-0">
                <span>{o.period_start} – {o.period_end}</span>
                <span>{o.reason_type || "—"}</span>
                <Badge variant="outline">{o.status}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base text-muted-foreground">Historikk</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {history.slice(0, 20).map((a: any) => (
              <div key={a.id} className="flex items-center justify-between text-xs py-1 border-b last:border-0">
                <span>{a.title || a.rule_key}</span>
                <Badge variant="outline">{a.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: "alert" }) {
  return (
    <Card className="border-border/60">
      <CardContent className="py-3">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={"text-lg font-semibold " + (accent === "alert" ? "text-destructive" : "")}>{value}</div>
      </CardContent>
    </Card>
  );
}
