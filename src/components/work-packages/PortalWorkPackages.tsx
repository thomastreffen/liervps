import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, CheckCircle, Clock } from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { WP_TYPE_CONFIG, type WorkPackageType } from "@/lib/work-package-types";

interface PortalWP {
  id: string;
  title: string;
  status: string;
  work_package_type: WorkPackageType;
  documentation_status: string;
  updated_at: string;
}

interface Props {
  projectId: string;
}

export function PortalWorkPackages({ projectId }: Props) {
  const [packages, setPackages] = useState<PortalWP[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("events")
        .select("id, title, status, work_package_type, documentation_status, updated_at")
        .eq("parent_project_id", projectId)
        .eq("customer_visible", true)
        .not("work_package_type", "is", null)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (data) setPackages(data as any);
      setLoading(false);
    })();
  }, [projectId]);

  if (loading || packages.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-bold">
          <Package className="h-4 w-4" />
          Arbeidsdetaljer
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">
          Oversikt over deler av arbeidet utført på oppdraget.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {packages.map((wp) => {
          const cfg = WP_TYPE_CONFIG[wp.work_package_type];
          const Icon = cfg.icon;
          const isDone = wp.status === "completed" || wp.status === "ready_for_invoicing";
          const isDocumented = wp.documentation_status === "complete";

          return (
            <div key={wp.id} className="rounded-xl border border-border/40 p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center shrink-0", cfg.bgColor)}>
                    <Icon className={cn("h-3.5 w-3.5", cfg.color)} />
                  </div>
                  <span className="text-sm font-semibold truncate">{wp.title}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {isDone ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-success/20 bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
                      <CheckCircle className="h-2.5 w-2.5" /> Ferdig
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-warning/20 bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">
                      <Clock className="h-2.5 w-2.5" /> Pågår
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 border-0", cfg.bgColor, cfg.color)}>
                  {cfg.portalLabel}
                </Badge>
                <span>{format(new Date(wp.updated_at), "d. MMM yyyy", { locale: nb })}</span>
                {isDocumented && (
                  <span className="text-success text-[10px] font-medium">Dokumentert ✓</span>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
