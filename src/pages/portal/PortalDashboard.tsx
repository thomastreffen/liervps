import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePortal } from "@/hooks/usePortal";
import {
  FolderOpen, FileText, Clock, CheckCircle, AlertTriangle, ArrowRight,
  Wrench, Sparkles, Bell, Info
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, isAfter, subDays } from "date-fns";
import { nb } from "date-fns/locale";
import { TimeAgo } from "@/components/portal/TimeAgo";

interface ProjectSummary {
  id: string;
  title: string;
  status: string;
  address: string | null;
  start_time: string | null;
  updated_at: string | null;
}

function ActivityBadge({ label, variant }: { label: string; variant: "new" | "updated" | "waiting" | "done" }) {
  const styles = {
    new: "bg-primary/10 text-primary border-primary/20",
    updated: "bg-info/10 text-info border-info/20",
    waiting: "bg-warning/10 text-warning border-warning/20",
    done: "bg-success/10 text-success border-success/20",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${styles[variant]}`}>
      {variant === "new" && <Sparkles className="h-2.5 w-2.5" />}
      {variant === "waiting" && <Bell className="h-2.5 w-2.5" />}
      {variant === "done" && <CheckCircle className="h-2.5 w-2.5" />}
      {label}
    </span>
  );
}

export default function PortalDashboard() {
  const { user } = usePortal();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [journals, setJournals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const recentCutoff = subDays(new Date(), 3);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: accessRows } = await supabase
        .from("customer_portal_project_access")
        .select("project_id")
        .or(`portal_user_id.eq.${user.id}${user.accountId ? `,account_id.eq.${user.accountId}` : ""}`);

      const projectIds = [...new Set((accessRows || []).map((r) => r.project_id))];

      if (projectIds.length > 0) {
        const { data: projectData } = await supabase
          .from("events")
          .select("id, title, status, address, start_time, updated_at")
          .in("id", projectIds)
          .is("deleted_at", null)
          .order("start_time", { ascending: false });

        setProjects(projectData || []);

        const { data: sjData } = await supabase
          .from("service_journals")
          .select("id, project_id, version, status, updated_at, created_at")
          .in("project_id", projectIds)
          .order("updated_at", { ascending: false })
          .limit(10);

        setJournals(sjData || []);
      }

      setLoading(false);
    };
    load();
  }, [user]);

  const activeProjects = projects.filter((p) => ["active", "in_progress"].includes(p.status));
  const pendingApprovals = journals.filter((j) => j.status === "review");
  const recentJournals = journals.filter((j) => j.created_at && isAfter(new Date(j.created_at), recentCutoff));
  const recentlyUpdatedProjects = projects.filter((p) => p.updated_at && isAfter(new Date(p.updated_at), recentCutoff));
  const nextScheduled = projects.find((p) => p.status === "planned" && p.start_time);

  const statusLabel = (s: string) => {
    switch (s) {
      case "planned": return "Planlagt";
      case "active": case "in_progress": return "Pågår";
      case "completed": return "Ferdig";
      default: return s;
    }
  };

  if (loading) {
    return <div className="animate-pulse space-y-4">
      {[1, 2, 3].map(i => <div key={i} className="h-28 rounded-2xl bg-muted" />)}
    </div>;
  }

  return (
    <div className="space-y-8">
      {/* Welcome hero */}
      <div className="rounded-2xl border bg-card p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <Wrench className="h-7 w-7" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-2xl font-bold tracking-tight text-card-foreground">
              Hei, {user?.fullName?.split(" ")[0] || "velkommen"}!
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-md">
              {user?.accountName
                ? `Her finner du oppdrag, rapporter og dokumentasjon fra samarbeidet med ${user.accountName}.`
                : "Her finner du oppdrag, rapporter og dokumentasjon knyttet til vårt samarbeid."}
            </p>
          </div>
        </div>
      </div>

      {/* First-time welcome tip */}
      {projects.length === 0 && journals.length === 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
          <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-card-foreground">Velkommen til kundeportalen!</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Her kan du følge oppdrag, se rapporter og godkjenne arbeid. Du får varsel når det er noe nytt.
            </p>
          </div>
        </div>
      )}

      {/* 1. Pending approvals – top priority */}
      {pendingApprovals.length > 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Bell className="h-4 w-4 text-warning" />
              Godkjenn arbeid
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {pendingApprovals.length === 1
                ? "Du har 1 rapport som venter på din godkjenning"
                : `Du har ${pendingApprovals.length} rapporter som venter på din godkjenning`}
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingApprovals.map((j) => (
                <Link
                  key={j.id}
                  to={`/portal/projects/${j.project_id}`}
                  className="flex items-center justify-between rounded-xl border border-warning/20 bg-card p-4 transition-all hover:shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning/10">
                      <FileText className="h-5 w-5 text-warning" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-card-foreground">
                        Rapport v{j.version}
                      </p>
                      <TimeAgo date={j.updated_at} />
                    </div>
                  </div>
                  <ActivityBadge label="Venter på deg" variant="waiting" />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 2. New reports & documentation */}
      {recentJournals.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Nye rapporter
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Siste 3 dager</p>
            </div>
            <Link to="/portal/deliveries" className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
              Se alle <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentJournals.slice(0, 3).map((j) => (
                <Link
                  key={j.id}
                  to={`/portal/projects/${j.project_id}`}
                  className="flex items-center justify-between rounded-xl border p-4 transition-all hover:shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-card-foreground">
                        Rapport v{j.version}
                      </p>
                      <TimeAgo date={j.created_at} />
                    </div>
                  </div>
                  <ActivityBadge label="Ny" variant="new" />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 3. Summary strip */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="relative overflow-hidden">
          <CardContent className="flex items-center gap-3 p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <FolderOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-card-foreground">{activeProjects.length}</p>
              <p className="text-[11px] text-muted-foreground leading-tight">Aktive oppdrag</p>
            </div>
          </CardContent>
          {recentlyUpdatedProjects.length > 0 && (
            <div className="absolute right-2.5 top-2.5">
              <ActivityBadge label="Oppdatert" variant="updated" />
            </div>
          )}
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/10">
              <Clock className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-2xl font-bold text-card-foreground">
                {nextScheduled
                  ? format(new Date(nextScheduled.start_time!), "d. MMM", { locale: nb })
                  : "—"}
              </p>
              <p className="text-[11px] text-muted-foreground leading-tight">Neste arbeid</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-card-foreground">{journals.length}</p>
              <p className="text-[11px] text-muted-foreground leading-tight">Rapporter</p>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <CardContent className="flex items-center gap-3 p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-warning/10">
              <AlertTriangle className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-card-foreground">{pendingApprovals.length}</p>
              <p className="text-[11px] text-muted-foreground leading-tight">Godkjenn arbeid</p>
            </div>
          </CardContent>
          {pendingApprovals.length > 0 && (
            <div className="absolute right-2.5 top-2.5">
              <ActivityBadge label="Venter på deg" variant="waiting" />
            </div>
          )}
        </Card>
      </div>

      {/* 4. Active projects */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base font-bold">Aktive oppdrag</CardTitle>
          <Link to="/portal/projects" className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
            Se alle <ArrowRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent>
          {activeProjects.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10">
              <FolderOpen className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Ingen aktive oppdrag akkurat nå.</p>
              <p className="text-xs text-muted-foreground/70">Du får varsel når nye oppdrag starter.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activeProjects.slice(0, 4).map((p) => {
                const isRecent = p.updated_at && isAfter(new Date(p.updated_at), recentCutoff);
                return (
                  <Link
                    key={p.id}
                    to={`/portal/projects/${p.id}`}
                    className="flex items-center justify-between rounded-xl border p-4 transition-all hover:shadow-md"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-card-foreground truncate">{p.title}</p>
                        {isRecent && <ActivityBadge label="Oppdatert" variant="updated" />}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {p.address && <p className="text-xs text-muted-foreground truncate">{p.address}</p>}
                        <TimeAgo date={p.updated_at} className="text-[10px] text-muted-foreground/70 shrink-0" />
                      </div>
                    </div>
                    <Badge variant="default" className="text-xs shrink-0 ml-2">{statusLabel(p.status)}</Badge>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
