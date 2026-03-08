import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePortal } from "@/hooks/usePortal";
import { FolderOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { nb } from "date-fns/locale";

interface Project {
  id: string;
  title: string;
  status: string;
  address: string | null;
  start_time: string | null;
  end_time: string | null;
}

export default function PortalProjects() {
  const { user } = usePortal();
  const [projects, setProjects] = useState<Project[]>([]);
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
        const { data } = await supabase
          .from("events")
          .select("id, title, status, address, start_time, end_time")
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

  const renderList = (list: Project[], emptyMsg: string) => (
    list.length === 0 ? (
      <div className="py-8 text-center">
        <FolderOpen className="mx-auto h-10 w-10 text-muted-foreground/40" />
        <p className="mt-2 text-sm text-muted-foreground">{emptyMsg}</p>
      </div>
    ) : (
      <div className="grid gap-3 sm:grid-cols-2">
        {list.map((p) => (
          <Link key={p.id} to={`/portal/projects/${p.id}`}>
            <Card className="transition-shadow hover:shadow-md h-full">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm">{p.title}</CardTitle>
                  <Badge variant={statusVariant(p.status)} className="text-[10px] shrink-0">
                    {statusLabel(p.status)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {p.address && <p className="text-xs text-muted-foreground">{p.address}</p>}
                {p.start_time && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Oppstart: {format(new Date(p.start_time), "d. MMM yyyy", { locale: nb })}
                  </p>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    )
  );

  if (loading) {
    return <div className="animate-pulse space-y-4">
      {[1, 2].map(i => <div key={i} className="h-24 rounded-xl bg-muted" />)}
    </div>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-foreground">Prosjekter</h2>
      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Pågående ({active.length})</TabsTrigger>
          <TabsTrigger value="planned">Planlagte ({planned.length})</TabsTrigger>
          <TabsTrigger value="completed">Fullførte ({completed.length})</TabsTrigger>
          <TabsTrigger value="all">Alle ({projects.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="active" className="mt-4">{renderList(active, "Ingen pågående prosjekter.")}</TabsContent>
        <TabsContent value="planned" className="mt-4">{renderList(planned, "Ingen planlagte prosjekter.")}</TabsContent>
        <TabsContent value="completed" className="mt-4">{renderList(completed, "Ingen fullførte prosjekter ennå.")}</TabsContent>
        <TabsContent value="all" className="mt-4">{renderList(projects, "Ingen prosjekter tilgjengelig.")}</TabsContent>
      </Tabs>
    </div>
  );
}
