import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePortal } from "@/hooks/usePortal";
import {
  FolderOpen, FileText, Clock, CheckCircle, AlertTriangle, ArrowRight,
  Wrench, Sparkles, Bell
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, isAfter, subDays } from "date-fns";
import { nb } from "date-fns/locale";

interface ProjectSummary {
  id: string;
  title: string;
  status: string;
  address: string | null;
  start_time: string | null;
  updated_at: string | null;
}

function PortalActivityBadge({ label, variant }: { label: string; variant: "new" | "updated" | "waiting" | "done" }) {
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
      {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-xl bg-muted" />)}
    </div>;
  }

  return (
    <div className="space-y-8">
      {/* Welcome hero */}
      <div className="rounded-2xl border bg-card p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Wrench className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold text-card-foreground">
              Velkommen til kundeportalen{user?.fullName ? `, ${user.fullName.split(" ")[0]}` : ""}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-lg">
              Her finner du prosjekter, leveranser og dokumentasjon knyttet til samarbeidet vårt.
            </p>
            {user?.accountName && (
              <Badge variant="secondary" className="mt-2 text-xs">{user.accountName}</Badge>
            )}
          </div>
        </div>
      </div>

      {/* Activity indicators */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="relative overflow-hidden">
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <FolderOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-card-foreground">{activeProjects.length}</p>
              <p className="text-xs text-muted-foreground">Aktive prosjekter</p>
            </div>
          </CardContent>
          {recentlyUpdatedProjects.length > 0 && (
            <div className="absolute right-3 top-3">
              <PortalActivityBadge label={`${recentlyUpdatedProjects.length} oppdatert`} variant="updated" />
            </div>
          )}
        </Card>

        <Card className="relative overflow-hidden">
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10">
              <Clock className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-2xl font-bold text-card-foreground">
                {nextScheduled
                  ? format(new Date(nextScheduled.start_time!), "d. MMM", { locale: nb })
                  : "—"
                }
              </p>
              <p className="text-xs text-muted-foreground">Neste arbeid</p>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-card-foreground">{journals.length}</p>
              <p className="text-xs text-muted-foreground">Leveranser</p>
            </div>
          </CardContent>
          {recentJournals.length > 0 && (
            <div className="absolute right-3 top-3">
              <PortalActivityBadge label={`${recentJournals.length} ny`} variant="new" />
            </div>
          )}
        </Card>

        <Card className="relative overflow-hidden">
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-warning/10">
              <AlertTriangle className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-card-foreground">{pendingApprovals.length}</p>
              <p className="text-xs text-muted-foreground">Venter godkjenning</p>
            </div>
          </CardContent>
          {pendingApprovals.length > 0 && (
            <div className="absolute right-3 top-3">
              <PortalActivityBadge label="Venter på deg" variant="waiting" />
            </div>
          )}
        </Card>
      </div>

      {/* Pending approvals - prominent */}
      {pendingApprovals.length > 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-4 w-4 text-warning" />
              Venter på din godkjenning
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingApprovals.map((j) => (
                <Link
                  key={j.id}
                  to={`/portal/projects/${j.project_id}`}
                  className="flex items-center justify-between rounded-lg border border-warning/20 bg-card p-3 transition-colors hover:bg-muted/50"
                >
                  <div>
                    <p className="text-sm font-medium text-card-foreground">
                      Servicejournal v{j.version}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {j.updated_at && format(new Date(j.updated_at), "d. MMM yyyy", { locale: nb })}
                    </p>
                  </div>
                  <PortalActivityBadge label="Venter på deg" variant="waiting" />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active projects */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Aktive prosjekter</CardTitle>
          <Link to="/portal/projects" className="text-xs text-primary hover:underline flex items-center gap-1">
            Se alle <ArrowRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent>
          {activeProjects.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Ingen aktive prosjekter akkurat nå.
            </p>
          ) : (
            <div className="space-y-2">
              {activeProjects.slice(0, 4).map((p) => {
                const isRecent = p.updated_at && isAfter(new Date(p.updated_at), recentCutoff);
                return (
                  <Link
                    key={p.id}
                    to={`/portal/projects/${p.id}`}
                    className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-card-foreground">{p.title}</p>
                        {isRecent && <PortalActivityBadge label="Oppdatert" variant="updated" />}
                      </div>
                      {p.address && <p className="text-xs text-muted-foreground">{p.address}</p>}
                    </div>
                    <Badge variant="default" className="text-xs">{statusLabel(p.status)}</Badge>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent deliveries */}
      {recentJournals.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Nye leveranser
            </CardTitle>
            <Link to="/portal/deliveries" className="text-xs text-primary hover:underline flex items-center gap-1">
              Se alle <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentJournals.slice(0, 3).map((j) => (
                <Link
                  key={j.id}
                  to={`/portal/projects/${j.project_id}`}
                  className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-card-foreground">
                      Servicejournal v{j.version}
                    </p>
                    <PortalActivityBadge label="Ny" variant="new" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {j.created_at && format(new Date(j.created_at), "d. MMM", { locale: nb })}
                  </p>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
