import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, ArrowLeft, FileText, Clock, User, MapPin,
  CheckCircle, Download, Image as ImageIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
import { nb } from "date-fns/locale";

export default function PortalProject() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<any>(null);
  const [journals, setJournals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/portal/login", { replace: true });
        return;
      }

      // Verify access
      const { data: portalUser } = await supabase
        .from("customer_portal_users")
        .select("id")
        .eq("auth_user_id", session.user.id)
        .maybeSingle();

      if (!portalUser) {
        navigate("/portal", { replace: true });
        return;
      }

      const { data: access } = await supabase
        .from("customer_portal_project_access")
        .select("project_id")
        .eq("portal_user_id", portalUser.id)
        .eq("project_id", id)
        .maybeSingle();

      if (!access) {
        navigate("/portal", { replace: true });
        return;
      }

      // Fetch project
      const { data: proj } = await supabase
        .from("events")
        .select("id, title, status, address, description, start_time, end_time, customer_name")
        .eq("id", id!)
        .maybeSingle();

      setProject(proj);

      // Fetch service journals
      const { data: sj } = await supabase
        .from("service_journals")
        .select("*")
        .eq("project_id", id!)
        .order("version", { ascending: false });

      setJournals(sj || []);
      setLoading(false);
    };

    load();
  }, [id, navigate]);

  const statusLabel = (s: string) => {
    switch (s) {
      case "planned": return "Planlagt";
      case "active": case "in_progress": return "Pågår";
      case "completed": return "Ferdig";
      default: return s;
    }
  };

  const progressValue = (s: string) => {
    switch (s) {
      case "planned": return 15;
      case "active": case "in_progress": return 55;
      case "completed": return 100;
      default: return 0;
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Prosjekt ikke funnet</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/portal">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-base font-semibold text-card-foreground">
              {project.title}
            </h1>
            <p className="text-xs text-muted-foreground">Prosjektdetaljer</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        {/* Status card */}
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-card-foreground">Status</h3>
              <Badge>{statusLabel(project.status)}</Badge>
            </div>
            <Progress value={progressValue(project.status)} className="h-2" />
            <div className="grid grid-cols-2 gap-4 text-sm">
              {project.address && (
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{project.address}</span>
                </div>
              )}
              {project.start_time && (
                <div className="flex items-start gap-2">
                  <Clock className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    Oppstart: {format(new Date(project.start_time), "d. MMM yyyy", { locale: nb })}
                  </span>
                </div>
              )}
              {project.customer_name && (
                <div className="flex items-start gap-2">
                  <User className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{project.customer_name}</span>
                </div>
              )}
            </div>
            {project.description && (
              <p className="text-sm text-muted-foreground border-t pt-3">
                {project.description}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Leveranser / Service Journals */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              Leveranser
            </CardTitle>
          </CardHeader>
          <CardContent>
            {journals.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Ingen leveranser tilgjengelig ennå.
              </p>
            ) : (
              <div className="space-y-3">
                {journals.map((j) => (
                  <div
                    key={j.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-card-foreground">
                        Servicejournal v{j.version}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {j.status === "approved" ? "Godkjent" : 
                         j.status === "sent" ? "Sendt" :
                         j.status === "review" ? "Til gjennomgang" : "Utkast"}
                        {j.updated_at && ` • ${format(new Date(j.updated_at), "d. MMM yyyy", { locale: nb })}`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {j.status === "review" && (
                        <Badge variant="outline" className="text-xs">
                          Venter godkjenning
                        </Badge>
                      )}
                      {(j.status === "approved" || j.status === "sent") && (
                        <Badge variant="default" className="text-xs">
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Godkjent
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dokumenter placeholder */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ImageIcon className="h-4 w-4" />
              Dokumentasjon
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground py-4 text-center">
              Dokumenter og bilder deles her når de er klare.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
