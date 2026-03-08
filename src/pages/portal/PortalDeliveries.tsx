import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePortal } from "@/hooks/usePortal";
import { FileText, CheckCircle, Sparkles, Bell } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { isAfter, subDays, format } from "date-fns";
import { nb } from "date-fns/locale";

function DeliveryBadge({ status, createdAt }: { status: string; createdAt: string | null }) {
  const isNew = createdAt && isAfter(new Date(createdAt), subDays(new Date(), 3));

  if (status === "review") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-warning/20 bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">
        <Bell className="h-2.5 w-2.5" /> Venter på deg
      </span>
    );
  }
  if (status === "approved" || status === "sent") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-success/20 bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
        <CheckCircle className="h-2.5 w-2.5" /> Godkjent
      </span>
    );
  }
  if (isNew) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
        <Sparkles className="h-2.5 w-2.5" /> Ny
      </span>
    );
  }
  return <Badge variant="outline" className="text-xs">Utkast</Badge>;
}

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
          .select("id, project_id, version, status, updated_at, created_at, content")
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

  if (loading) {
    return <div className="animate-pulse space-y-4">
      {[1, 2].map(i => <div key={i} className="h-20 rounded-2xl bg-muted" />)}
    </div>;
  }

  const pendingReview = journals.filter((j) => j.status === "review");
  const otherJournals = journals.filter((j) => j.status !== "review");

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-foreground">Rapporter og dokumentasjon</h2>

      {journals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14">
            <FileText className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Ingen rapporter tilgjengelig ennå.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {pendingReview.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-warning">
                Venter på din godkjenning ({pendingReview.length})
              </p>
              {pendingReview.map((j) => (
                <Link key={j.id} to={`/portal/projects/${j.project_id}`}>
                  <Card className="border-warning/30 transition-all hover:shadow-md">
                    <CardContent className="flex items-center justify-between p-5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning/10">
                          <FileText className="h-5 w-5 text-warning" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-card-foreground">
                            Rapport v{j.version}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {projectMap[j.project_id] || "Oppdrag"} •{" "}
                            {j.updated_at && format(new Date(j.updated_at), "d. MMM yyyy", { locale: nb })}
                          </p>
                        </div>
                      </div>
                      <DeliveryBadge status={j.status} createdAt={j.created_at} />
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}

          {otherJournals.length > 0 && (
            <div className="space-y-2">
              {pendingReview.length > 0 && (
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Alle rapporter
                </p>
              )}
              {otherJournals.map((j) => (
                <Link key={j.id} to={`/portal/projects/${j.project_id}`}>
                  <Card className="transition-all hover:shadow-md">
                    <CardContent className="flex items-center justify-between p-5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-card-foreground">
                            Rapport v{j.version}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {projectMap[j.project_id] || "Oppdrag"} •{" "}
                            {j.updated_at && format(new Date(j.updated_at), "d. MMM yyyy", { locale: nb })}
                          </p>
                        </div>
                      </div>
                      <DeliveryBadge status={j.status} createdAt={j.created_at} />
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
