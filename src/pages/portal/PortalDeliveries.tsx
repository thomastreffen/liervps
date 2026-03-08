import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePortal } from "@/hooks/usePortal";
import { FileText, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { nb } from "date-fns/locale";

export default function PortalDeliveries() {
  const { user } = usePortal();
  const [journals, setJournals] = useState<any[]>([]);
  const [projectMap, setProjectMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: accessRows } = await supabase
        .from("customer_portal_project_access")
        .select("project_id")
        .or(`portal_user_id.eq.${user.id}${user.accountId ? `,account_id.eq.${user.accountId}` : ""}`);

      const ids = [...new Set((accessRows || []).map((r) => r.project_id))];
      if (ids.length > 0) {
        const { data: sjData } = await supabase
          .from("service_journals")
          .select("id, project_id, version, status, updated_at, content")
          .in("project_id", ids)
          .order("updated_at", { ascending: false });
        setJournals(sjData || []);

        const { data: projects } = await supabase
          .from("events")
          .select("id, title")
          .in("id", ids);
        const map: Record<string, string> = {};
        (projects || []).forEach((p) => { map[p.id] = p.title; });
        setProjectMap(map);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const statusLabel = (s: string) => {
    switch (s) {
      case "approved": return "Godkjent";
      case "sent": return "Sendt";
      case "review": return "Til gjennomgang";
      default: return "Utkast";
    }
  };

  if (loading) {
    return <div className="animate-pulse space-y-4">
      {[1, 2].map(i => <div key={i} className="h-20 rounded-xl bg-muted" />)}
    </div>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-foreground">Leveranser</h2>

      {journals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <FileText className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Ingen leveranser tilgjengelig ennå.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {journals.map((j) => (
            <Link key={j.id} to={`/portal/projects/${j.project_id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-card-foreground">
                        Servicejournal v{j.version}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {projectMap[j.project_id] || "Prosjekt"} •{" "}
                        {j.updated_at && format(new Date(j.updated_at), "d. MMM yyyy", { locale: nb })}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={j.status === "approved" || j.status === "sent" ? "default" : "outline"}
                    className="text-xs"
                  >
                    {(j.status === "approved" || j.status === "sent") && (
                      <CheckCircle className="mr-1 h-3 w-3" />
                    )}
                    {statusLabel(j.status)}
                  </Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
