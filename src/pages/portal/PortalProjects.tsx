import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePortal } from "@/hooks/usePortal";
import { FolderOpen, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isAfter, subDays, format } from "date-fns";
import { nb } from "date-fns/locale";
import { TimeAgo } from "@/components/portal/TimeAgo";

interface Project {
  id: string;
  title: string;
  status: string;
  address: string | null;
  start_time: string | null;
  end_time: string | null;
  updated_at: string | null;
}

export default function PortalProjects() {
  const { user } = usePortal();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const recentCutoff = subDays(new Date(), 3);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: accessRows } = await supabase
        .from("customer_portal_project_access")
        .select("project_id")
        .or(`portal_user_id.eq.${user.id}${user.accountId ? `,account_id.eq.${user.accountId}` : ""}`);

      const ids = [...new Set((accessRows || []).map((r) => r.project_id))];
      if (ids.length > 0) {
        const { data } = await supabase
          .from("events")
          .select("id, title, status, address, start_time, end_time, updated_at")
          .in("id", ids)
          .is("deleted_at", null)
          .order("start_time", { ascending: false });
        setProjects(data || []);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const statusLabel = (s: string) => {
    switch (s) {
      case "planned": return "Planlagt";
      case "active": case "in_progress": return "Pågår";
      case "completed": return "Ferdig";
      default: return s;
    }
  };

  const statusVariant = (s: string) => {
    switch (s) {
      case "planned": return "secondary" as const;
      case "active": case "in_progress": return "default" as const;
      case "completed": return "outline" as const;
      default: return "secondary" as const;
    }
  };

  const active = projects.filter((p) => ["active", "in_progress"].includes(p.status));
  const planned = projects.filter((p) => p.status === "planned");
  const completed = projects.filter((p) => p.status === "completed");

  const renderList = (list: Project[], emptyMsg: string, emptyHint: string) => (
    list.length === 0 ? (
      <div className="py-10 text-center">
        <FolderOpen className="mx-auto h-10 w-10 text-muted-foreground/40" />
        <p className="mt-2 text-sm text-muted-foreground">{emptyMsg}</p>
        <p className="mt-0.5 text-xs text-muted-foreground/70">{emptyHint}</p>
      </div>
    ) : (
      <div className="grid gap-3 sm:grid-cols-2">
        {list.map((p) => {
          const isRecent = p.updated_at && isAfter(new Date(p.updated_at), recentCutoff);
          return (
            <Link key={p.id} to={`/portal/projects/${p.id}`}>
              <Card className="transition-all hover:shadow-md h-full">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-sm font-semibold text-card-foreground leading-tight">{p.title}</p>
                    <Badge variant={statusVariant(p.status)} className="text-[10px] shrink-0">
                      {statusLabel(p.status)}
                    </Badge>
                  </div>
                  {p.address && <p className="text-xs text-muted-foreground">{p.address}</p>}
                  <div className="flex items-center gap-2 mt-2">
                    {p.start_time && (
                      <p className="text-xs text-muted-foreground">
                        Oppstart: {format(new Date(p.start_time), "d. MMM yyyy", { locale: nb })}
                      </p>
                    )}
                    {isRecent && (
                      <span className="inline-flex items-center gap-0.5 rounded-full border border-info/20 bg-info/10 px-1.5 py-0.5 text-[10px] font-semibold text-info">
                        <Sparkles className="h-2.5 w-2.5" /> Oppdatert
                      </span>
                    )}
                  </div>
                  <TimeAgo date={p.updated_at} className="text-[10px] text-muted-foreground/70 mt-1 block" />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    )
  );

  if (loading) {
    return <div className="animate-pulse space-y-4">
      {[1, 2].map(i => <div key={i} className="h-28 rounded-2xl bg-muted" />)}
    </div>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-foreground">Oppdrag</h2>
      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Pågående ({active.length})</TabsTrigger>
          <TabsTrigger value="planned">Planlagte ({planned.length})</TabsTrigger>
          <TabsTrigger value="completed">Fullførte ({completed.length})</TabsTrigger>
          <TabsTrigger value="all">Alle ({projects.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="active" className="mt-4">
          {renderList(active, "Ingen pågående oppdrag.", "Du får varsel når nye oppdrag starter.")}
        </TabsContent>
        <TabsContent value="planned" className="mt-4">
          {renderList(planned, "Ingen planlagte oppdrag.", "Planlagte oppdrag vises her.")}
        </TabsContent>
        <TabsContent value="completed" className="mt-4">
          {renderList(completed, "Ingen fullførte oppdrag ennå.", "Fullførte oppdrag samles her.")}
        </TabsContent>
        <TabsContent value="all" className="mt-4">
          {renderList(projects, "Ingen oppdrag tilgjengelig.", "Oppdrag vises her når de er opprettet.")}
        </TabsContent>
      </Tabs>
    </div>
  );
}
