import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  UserCheck,
  AlertTriangle,
  CalendarX,
  ClipboardCheck,
  Receipt,
  ShieldAlert,
  ChevronRight,
  Bell,
  Users,
  Clock,
  CheckCircle2,
  MessageSquare,
  FileCheck,
  Eye,
} from "lucide-react";
import { useManagementData, type TechStatus, type Alert } from "@/hooks/useManagementData";
import { formatDistanceToNow } from "date-fns";
import { nb } from "date-fns/locale";
import { cn } from "@/lib/utils";

function KpiCard({
  label,
  value,
  icon: Icon,
  color,
  onClick,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  onClick?: () => void;
}) {
  return (
    <Card
      className={cn(
        "cursor-pointer hover:shadow-[var(--shadow-card-hover)] transition-shadow",
        onClick && "hover:scale-[1.01] transition-transform"
      )}
      onClick={onClick}
    >
      <CardContent className="p-5 flex items-center gap-4">
        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", color)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold tabular-nums leading-none">{value}</p>
          <p className="text-xs text-muted-foreground mt-1 truncate">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {action && onAction && (
        <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-1" onClick={onAction}>
          {action} <ChevronRight className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

const statusColors: Record<TechStatus["status"], string> = {
  ledig: "bg-success/10 text-success",
  delvis: "bg-warning/10 text-warning",
  full: "bg-destructive/10 text-destructive",
  overbooket: "bg-destructive/20 text-destructive font-bold",
};

const statusLabels: Record<TechStatus["status"], string> = {
  ledig: "Ledig",
  delvis: "Delvis",
  full: "Full",
  overbooket: "Overbooket",
};

const alertColors: Record<Alert["severity"], string> = {
  ok: "border-l-success bg-success/5",
  warning: "border-l-warning bg-warning/5",
  critical: "border-l-destructive bg-destructive/5",
};

const alertIcons: Record<Alert["severity"], React.ElementType> = {
  ok: CheckCircle2,
  warning: Bell,
  critical: AlertTriangle,
};

const activityIcons: Record<string, React.ElementType> = {
  portal_approval: ClipboardCheck,
  portal_view: Eye,
  portal_message: MessageSquare,
  journal_approved: FileCheck,
};

export default function ManagementPage() {
  const navigate = useNavigate();
  const { kpis, techStatuses, attentionProjects, invoiceItems, customerActivities, alerts, loading } = useManagementData();

  if (loading) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      {/* Page title */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Lederoversikt</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Operativt kontrollpanel – oppdatert nå</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard label="Ledige montører" value={kpis.availableTechs} icon={UserCheck} color="bg-success/10 text-success" onClick={() => navigate("/projects/plan")} />
        <KpiCard label="Overbooket" value={kpis.overbookedTechs} icon={AlertTriangle} color="bg-destructive/10 text-destructive" onClick={() => navigate("/projects/plan")} />
        <KpiCard label="Uten plan" value={kpis.unplannedProjects} icon={CalendarX} color="bg-warning/10 text-warning" onClick={() => navigate("/projects")} />
        <KpiCard label="Venter godkjenning" value={kpis.pendingApprovals} icon={ClipboardCheck} color="bg-info/10 text-info" onClick={() => navigate("/projects")} />
        <KpiCard label="Klar for faktura" value={kpis.readyForInvoice} icon={Receipt} color="bg-accent/10 text-accent" onClick={() => navigate("/invoice-basis")} />
        <KpiCard label="Åpne avvik" value={kpis.openDeviations} icon={ShieldAlert} color="bg-destructive/10 text-destructive" onClick={() => navigate("/projects")} />
      </div>

      {/* Operative alerts */}
      {alerts.length > 0 && (
        <section>
          <SectionHeader title="Dette bør sjekkes nå" />
          <div className="space-y-2">
            {alerts.map((a, i) => {
              const Icon = alertIcons[a.severity];
              return (
                <div
                  key={i}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl border-l-4 cursor-pointer transition-colors",
                    alertColors[a.severity],
                    a.link && "hover:opacity-80"
                  )}
                  onClick={() => a.link && navigate(a.link)}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="text-sm font-medium">{a.message}</span>
                  {a.link && <ChevronRight className="h-3.5 w-3.5 ml-auto shrink-0 text-muted-foreground" />}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Drift i dag */}
      <section>
        <SectionHeader title="Drift i dag" action="Ressursplan" onAction={() => navigate("/projects/plan")} />
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border/40">
              {techStatuses.length === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground">Ingen planlagt aktivitet i dag</div>
              )}
              {techStatuses.slice(0, 12).map((t) => (
                <div key={t.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                    {t.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.blocks} blokk{t.blocks !== 1 ? "er" : ""} · {Math.round(t.bookedMinutes / 60)}t planlagt</p>
                  </div>
                  <Badge variant="outline" className={cn("text-[11px] px-2 py-0.5 border-0 rounded-md", statusColors[t.status])}>
                    {statusLabels[t.status]}
                  </Badge>
                </div>
              ))}
            </div>
            {techStatuses.length > 12 && (
              <div className="px-5 py-3 border-t border-border/40">
                <Button variant="ghost" size="sm" className="text-xs w-full" onClick={() => navigate("/projects/plan")}>
                  Se alle {techStatuses.length} montører
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Krever oppmerksomhet */}
      <section>
        <SectionHeader title="Krever oppmerksomhet" />
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(attentionProjects).map(([group, projects]) => (
            <Card key={group}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-sm font-semibold">{group}</h3>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{projects.length}</Badge>
                </div>
                {projects.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">Ingen akkurat nå ✓</p>
                ) : (
                  <div className="space-y-2">
                    {projects.slice(0, 5).map((p) => (
                      <div
                        key={p.id}
                        className="flex items-start gap-2 cursor-pointer hover:bg-muted/50 rounded-lg px-2 py-1.5 -mx-2 transition-colors"
                        onClick={() => navigate(`/projects/${p.id}`)}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{p.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{p.customer || p.reason}</p>
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 mt-1 shrink-0 text-muted-foreground" />
                      </div>
                    ))}
                    {projects.length > 5 && (
                      <Button variant="ghost" size="sm" className="text-xs w-full mt-1" onClick={() => navigate("/projects")}>
                        Se alle {projects.length}
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Klar for økonomi */}
      <section>
        <SectionHeader title="Klar for økonomi" action="Fakturagrunnlag" onAction={() => navigate("/invoice-basis")} />
        <Card>
          <CardContent className="p-0">
            {invoiceItems.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Ingen leveranser klar for fakturering akkurat nå</div>
            ) : (
              <div className="divide-y divide-border/40">
                {invoiceItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-4 px-5 py-3">
                    <Receipt className="h-4 w-4 text-accent shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.project_title}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.customer_name} · {item.total_hours.toFixed(1)}t · {item.technicians.length} montør{item.technicians.length !== 1 ? "er" : ""}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-muted-foreground">
                        Godkjent {formatDistanceToNow(new Date(item.approved_at), { locale: nb, addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Kundeaktivitet */}
      <section>
        <SectionHeader title="Kundeaktivitet" />
        <Card>
          <CardContent className="p-0">
            {customerActivities.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Ingen nylig kundeaktivitet</div>
            ) : (
              <div className="divide-y divide-border/40">
                {customerActivities.map((a) => {
                  const Icon = activityIcons[a.type] || Bell;
                  return (
                    <div key={a.id} className="flex items-center gap-3 px-5 py-3">
                      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{a.title}</p>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatDistanceToNow(new Date(a.created_at), { locale: nb, addSuffix: true })}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
