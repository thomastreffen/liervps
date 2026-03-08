import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus, ChevronRight, User, Eye, EyeOff, Package, RefreshCw, Info,
} from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { WP_TYPE_CONFIG, DOC_STATUS_CONFIG, type WorkPackageType } from "@/lib/work-package-types";
import { CreateWorkPackageDialog } from "./CreateWorkPackageDialog";

interface WorkPackage {
  id: string;
  title: string;
  status: string;
  work_package_type: WorkPackageType;
  customer_visible: boolean;
  documentation_status: string;
  created_at: string;
  assigned_techs: string[];
}

interface Props {
  projectId: string;
  isAdmin?: boolean;
}

export function WorkPackageList({ projectId, isAdmin }: Props) {
  const navigate = useNavigate();
  const [packages, setPackages] = useState<WorkPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const fetchPackages = useCallback(async () => {
    const { data, error } = await supabase
      .from("events")
      .select(`
        id, title, status, work_package_type, customer_visible,
        documentation_status, created_at,
        event_technicians ( technician_id, technicians ( name ) )
      `)
      .eq("parent_project_id", projectId)
      .not("work_package_type", "is", null)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setPackages(data.map((d: any) => ({
        id: d.id,
        title: d.title,
        status: d.status,
        work_package_type: d.work_package_type,
        customer_visible: d.customer_visible ?? false,
        documentation_status: d.documentation_status ?? "pending",
        created_at: d.created_at,
        assigned_techs: (d.event_technicians || [])
          .filter((et: any) => et.technicians)
          .map((et: any) => et.technicians.name),
      })));
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchPackages(); }, [fetchPackages]);

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      requested: "Planlagt", approved: "Planlagt", scheduled: "Planlagt",
      in_progress: "Pågår", completed: "Ferdig", ready_for_invoicing: "Ferdig",
    };
    return map[s] || s;
  };

  const statusColor = (s: string) => {
    if (s === "completed" || s === "ready_for_invoicing") return "bg-success/10 text-success";
    if (s === "in_progress") return "bg-warning/10 text-warning";
    return "bg-info/10 text-info";
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Arbeidspakker</h2>
          {packages.length > 0 && (
            <span className="text-[10px] text-muted-foreground">({packages.length})</span>
          )}
        </div>
        {isAdmin && (
          <Button size="sm" variant="outline" className="gap-1.5 text-xs rounded-xl" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Ny arbeidspakke
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      ) : packages.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <Package className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Ingen arbeidspakker ennå.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Arbeidspakker brukes til avvik, tilleggsarbeid og endringer.
            </p>
            {isAdmin && (
              <Button size="sm" variant="outline" className="mt-3 gap-1.5 text-xs" onClick={() => setCreateOpen(true)}>
                <Plus className="h-3 w-3" /> Opprett første
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {packages.map((wp) => {
            const typeConfig = WP_TYPE_CONFIG[wp.work_package_type];
            const docConfig = DOC_STATUS_CONFIG[wp.documentation_status] || DOC_STATUS_CONFIG.pending;
            const TypeIcon = typeConfig.icon;

            return (
              <Card
                key={wp.id}
                className="cursor-pointer hover:bg-muted/40 active:scale-[0.995] transition-all"
                onClick={() => navigate(`/projects/${wp.id}`)}
              >
                <CardContent className="p-3 sm:p-4 flex items-center gap-3">
                  <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center shrink-0", typeConfig.bgColor)}>
                    <TypeIcon className={cn("h-4 w-4", typeConfig.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{wp.title}</p>
                      {wp.customer_visible ? (
                        <Eye className="h-3 w-3 text-primary shrink-0" />
                      ) : (
                        <EyeOff className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 border-0 rounded-md", typeConfig.bgColor, typeConfig.color)}>
                        {typeConfig.label}
                      </Badge>
                      <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 border-0 rounded-md", statusColor(wp.status))}>
                        {statusLabel(wp.status)}
                      </Badge>
                      <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 border-0 rounded-md", docConfig.color)}>
                        {docConfig.label}
                      </Badge>
                      {wp.assigned_techs.length > 0 && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <User className="h-2.5 w-2.5" /> {wp.assigned_techs.join(", ")}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <CreateWorkPackageDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        projectId={projectId}
        onCreated={fetchPackages}
      />
    </section>
  );
}
