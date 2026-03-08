import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePortal } from "@/hooks/usePortal";
import {
  ArrowLeft, FileText, Clock, User, MapPin,
  CheckCircle, Image as ImageIcon, Bell
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { TimeAgo } from "@/components/portal/TimeAgo";
import { StatusProgression } from "@/components/portal/StatusProgression";

export default function PortalProject() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = usePortal();
  const [project, setProject] = useState<any>(null);
  const [journals, setJournals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: access } = await supabase
        .from("customer_portal_project_access")
        .select("project_id")
        .or(`portal_user_id.eq.${user.id}${user.accountId ? `,account_id.eq.${user.accountId}` : ""}`)
        .eq("project_id", id!)
        .maybeSingle();

      if (!access) {
        navigate("/portal/projects", { replace: true });
        return;
      }

      const { data: proj } = await supabase
        .from("events")
        .select("id, title, status, address, description, start_time, end_time, customer_name, updated_at")
        .eq("id", id!)
        .maybeSingle();

      setProject(proj);

      const { data: sj } = await supabase
        .from("service_journals")
        .select("*")
        .eq("project_id", id!)
        .order("version", { ascending: false });

      setJournals(sj || []);
      setLoading(false);
    };
    load();
  }, [id, user, navigate]);

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

  if (!project) {
    return <p className="py-12 text-center text-muted-foreground">Oppdrag ikke funnet</p>;
  }

  const hasReport = journals.length > 0;
  const hasApprovedReport = journals.some(j => j.status === "approved" || j.status === "sent");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/portal/projects">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-foreground truncate">{project.title}</h2>
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">Oppdragsdetaljer</p>
            <TimeAgo date={project.updated_at} className="text-[10px] text-muted-foreground/70" />
          </div>
        </div>
      </div>

      {/* Status progression */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-card-foreground">Fremdrift</h3>
            <Badge>{statusLabel(project.status)}</Badge>
          </div>
          <StatusProgression
            projectStatus={project.status}
            hasReport={hasReport}
            hasApprovedReport={hasApprovedReport}
          />
        </CardContent>
      </Card>

      {/* Details */}
      <Card>
        <CardContent className="space-y-4 p-6">
          <h3 className="font-bold text-card-foreground">Detaljer</h3>
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
            <p className="text-sm text-muted-foreground border-t pt-3">{project.description}</p>
          )}
        </CardContent>
      </Card>

      {/* Rapporter */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-bold">
            <FileText className="h-4 w-4" />
            Rapporter og dokumentasjon
          </CardTitle>
        </CardHeader>
        <CardContent>
          {journals.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8">
              <FileText className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Ingen rapporter ennå.</p>
              <p className="text-xs text-muted-foreground/70">Du får varsel når nye rapporter er klare.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {journals.map((j) => (
                <div key={j.id} className="flex items-center justify-between rounded-xl border p-4">
                  <div>
                    <p className="text-sm font-semibold text-card-foreground">
                      Rapport v{j.version}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-muted-foreground">
                        {j.status === "approved" ? "Godkjent" :
                         j.status === "sent" ? "Sendt" :
                         j.status === "review" ? "Venter på godkjenning" : "Utkast"}
                      </p>
                      <TimeAgo date={j.updated_at} className="text-[10px] text-muted-foreground/70" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {j.status === "review" && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-warning/20 bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">
                        <Bell className="h-2.5 w-2.5" /> Venter på deg
                      </span>
                    )}
                    {(j.status === "approved" || j.status === "sent") && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-success/20 bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
                        <CheckCircle className="h-2.5 w-2.5" /> Godkjent
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dokumentasjon */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-bold">
            <ImageIcon className="h-4 w-4" />
            Bilder og filer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-2 py-8">
            <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Ingen dokumenter ennå.</p>
            <p className="text-xs text-muted-foreground/70">Dokumenter og bilder deles her når de er klare.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
