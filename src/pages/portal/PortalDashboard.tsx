import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, FolderOpen, FileText, MessageSquare, LogOut, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PortalProject {
  project_id: string;
  project: {
    id: string;
    title: string;
    status: string;
    address: string | null;
    start_time: string | null;
    end_time: string | null;
  } | null;
}

export default function PortalDashboard() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<PortalProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/portal/login", { replace: true });
        return;
      }

      const user = session.user;
      setUserName(
        user.user_metadata?.full_name || user.email?.split("@")[0] || "Kunde"
      );

      // Update last login
      await supabase
        .from("customer_portal_users")
        .update({ last_login_at: new Date().toISOString() })
        .eq("auth_user_id", user.id);

      // Fetch accessible projects
      const { data: portalUser } = await supabase
        .from("customer_portal_users")
        .select("id")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (portalUser) {
        const { data: accessRows } = await supabase
          .from("customer_portal_project_access")
          .select("project_id")
          .eq("portal_user_id", portalUser.id);

        if (accessRows && accessRows.length > 0) {
          const projectIds = accessRows.map((r) => r.project_id);
          const { data: projectData } = await supabase
            .from("events")
            .select("id, title, status, address, start_time, end_time")
            .in("id", projectIds)
            .is("deleted_at", null);

          const mapped = (projectData || []).map((p) => ({
            project_id: p.id,
            project: p,
          }));
          setProjects(mapped);
        }
      }

      setLoading(false);
    };

    load();
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/portal/login", { replace: true });
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "planned": return "Planlagt";
      case "active": case "in_progress": return "Pågår";
      case "completed": return "Ferdig";
      default: return status;
    }
  };

  const statusVariant = (status: string) => {
    switch (status) {
      case "planned": return "secondary" as const;
      case "active": case "in_progress": return "default" as const;
      case "completed": return "outline" as const;
      default: return "secondary" as const;
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Wrench className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-card-foreground">
                Kundeportal
              </h1>
              <p className="text-xs text-muted-foreground">MCS Service</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{userName}</span>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="mr-1 h-4 w-4" />
              Logg ut
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-foreground">
            Hei, {userName}!
          </h2>
          <p className="text-muted-foreground">
            Her finner du oversikt over dine prosjekter og leveranser.
          </p>
        </div>

        {projects.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-12">
              <FolderOpen className="h-12 w-12 text-muted-foreground/50" />
              <div className="text-center">
                <p className="font-medium text-card-foreground">
                  Ingen prosjekter ennå
                </p>
                <p className="text-sm text-muted-foreground">
                  Du vil få tilgang til prosjekter når de deles med deg.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {projects.map(({ project }) =>
              project ? (
                <Link
                  key={project.id}
                  to={`/portal/projects/${project.id}`}
                  className="block"
                >
                  <Card className="transition-shadow hover:shadow-md">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-base">
                          {project.title}
                        </CardTitle>
                        <Badge variant={statusVariant(project.status)}>
                          {statusLabel(project.status)}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {project.address && (
                        <p className="text-sm text-muted-foreground">
                          {project.address}
                        </p>
                      )}
                      <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <FileText className="h-3.5 w-3.5" />
                          Dokumenter
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="h-3.5 w-3.5" />
                          Meldinger
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ) : null
            )}
          </div>
        )}
      </main>
    </div>
  );
}
