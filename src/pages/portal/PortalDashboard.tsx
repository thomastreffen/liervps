import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePortal } from "@/hooks/usePortal";
import {
  FolderOpen, FileText, Clock, CheckCircle, AlertTriangle, ArrowRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { nb } from "date-fns/locale";

interface ProjectSummary {
  id: string;
  title: string;
  status: string;
  address: string | null;
  start_time: string | null;
}

export default function PortalDashboard() {
  const { user } = usePortal();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [journals, setJournals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      // Get project IDs accessible to this user (direct + account-level)
      const { data: accessRows } = await supabase
        .from("customer_portal_project_access")
        .select("project_id")
        .or(`portal_user_id.eq.${user.id}${user.accountId ? `,account_id.eq.${user.accountId}` : ""}`);

      const projectIds = [...new Set((accessRows || []).map((r) => r.project_id))];

      if (projectIds.length > 0) {
        const { data: projectData } = await supabase
          .from("events")
          .select("id, title, status, address, start_time")
          .in("id", projectIds)
          .is("deleted_at", null)
          .order("start_time", { ascending: false });

        setProjects(projectData || []);

        // Fetch recent journals across accessible projects
        const { data: sjData } = await supabase
          .from("service_journals")
          .select("id, project_id, version, status, updated_at")
          .in("project_id", projectIds)
          .order("updated_at", { ascending: false })
          .limit(5);

        setJournals(sjData || []);
      }

      setLoading(false);
    };
    load();
  }, [user]);

  const activeProjects = projects.filter((p) => ["active", "in_progress"].includes(p.status));
  const pendingApprovals = journals.filter((j) => j.status === "review");
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
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">
          Hei, {user?.fullName}!
        </h2>
        {user?.accountName && (
          <p className="text-muted-foreground">{user.accountName}</p>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <FolderOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-card-foreground">{activeProjects.length}</p>
              <p className="text-xs text-muted-foreground">Aktive prosjekter</p>
            </div>
          </CardContent>
        </Card>

        <Card>
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

        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-card-foreground">{journals.length}</p>
              <p className="text-xs text-muted-foreground">Leveranser</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-warning/10">
              <AlertTriangle className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-card-foreground">{pendingApprovals.length}</p>
              <p className="text-xs text-muted-foreground">Venter godkjenning</p>
            </div>
          </CardContent>
        </Card>
      </div>

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
              {activeProjects.slice(0, 4).map((p) => (
                <Link
                  key={p.id}
                  to={`/portal/projects/${p.id}`}
                  className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                >
                  <div>
                    <p className="text-sm font-medium text-card-foreground">{p.title}</p>
                    {p.address && <p className="text-xs text-muted-foreground">{p.address}</p>}
                  </div>
                  <Badge variant="default" className="text-xs">{statusLabel(p.status)}</Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending approvals */}
      {pendingApprovals.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-warning" />
              Ventende godkjenninger
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingApprovals.map((j) => (
                <Link
                  key={j.id}
                  to={`/portal/projects/${j.project_id}`}
                  className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                >
                  <div>
                    <p className="text-sm font-medium text-card-foreground">
                      Servicejournal v{j.version}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {j.updated_at && format(new Date(j.updated_at), "d. MMM yyyy", { locale: nb })}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">Til gjennomgang</Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
