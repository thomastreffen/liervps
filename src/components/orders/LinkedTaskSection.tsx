import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDays, User, ExternalLink, CheckCircle2, Clock, PlayCircle } from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface LinkedTaskSectionProps {
  submissionId: string;
  convertedToId?: string | null;
  convertedToType?: string | null;
}

const EXECUTION_STATUS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  draft: { label: "Utkast", color: "bg-muted text-muted-foreground", icon: <Clock className="h-3 w-3" /> },
  scheduled: { label: "Planlagt", color: "bg-cyan-100 text-cyan-800", icon: <CalendarDays className="h-3 w-3" /> },
  confirmed: { label: "Bekreftet", color: "bg-blue-100 text-blue-800", icon: <CheckCircle2 className="h-3 w-3" /> },
  in_progress: { label: "Under arbeid", color: "bg-purple-100 text-purple-800", icon: <PlayCircle className="h-3 w-3" /> },
  completed: { label: "Ferdig", color: "bg-green-100 text-green-800", icon: <CheckCircle2 className="h-3 w-3" /> },
};

export function LinkedTaskSection({ submissionId, convertedToId, convertedToType }: LinkedTaskSectionProps) {
  const navigate = useNavigate();

  // Find linked event via source_order_form_id or converted_to_id
  const { data: linkedTask } = useQuery({
    queryKey: ["linked-task-for-order", submissionId, convertedToId],
    queryFn: async () => {
      // First try source_order_form_id
      let { data } = await supabase
        .from("events")
        .select("id, title, internal_number, project_number, start_time, end_time, status, address, customer, deleted_at")
        .eq("source_order_form_id", submissionId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!data && convertedToId && convertedToType !== "case") {
        const res = await supabase
          .from("events")
          .select("id, title, internal_number, project_number, start_time, end_time, status, address, customer, deleted_at")
          .eq("id", convertedToId)
          .is("deleted_at", null)
          .maybeSingle();
        data = res.data;
      }

      if (!data) return null;

      // Get technicians
      const { data: techs } = await supabase
        .from("event_technicians")
        .select("technician:technicians(id, user_id, person:people(full_name))")
        .eq("event_id", data.id);

      return {
        ...data,
        technicians: (techs || []).map((t: any) => ({
          name: t.technician?.person?.full_name || "Ukjent",
        })),
      };
    },
  });

  if (!linkedTask) return null;

  const statusCfg = EXECUTION_STATUS[linkedTask.status] || EXECUTION_STATUS.scheduled;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <CalendarDays className="h-4 w-4" />
          Koblet oppgave
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Task title + number */}
        <div>
          <p className="text-sm font-medium text-foreground">{linkedTask.title}</p>
          <p className="text-xs text-muted-foreground">{linkedTask.project_number || linkedTask.internal_number}</p>
        </div>

        {/* Status */}
        <div className="flex items-center gap-2">
          <Badge className={`text-[10px] ${statusCfg.color}`}>
            {statusCfg.icon}
            <span className="ml-1">{statusCfg.label}</span>
          </Badge>
        </div>

        {/* Planned time */}
        {linkedTask.start_time && (
          <div className="text-xs">
            <span className="text-muted-foreground">Planlagt: </span>
            <span className="font-medium">
              {format(new Date(linkedTask.start_time), "d. MMM yyyy HH:mm", { locale: nb })}
              {linkedTask.end_time && ` – ${format(new Date(linkedTask.end_time), "HH:mm", { locale: nb })}`}
            </span>
          </div>
        )}

        {/* Technicians */}
        {linkedTask.technicians.length > 0 && (
          <div className="text-xs">
            <span className="text-muted-foreground">Utfører: </span>
            <span className="font-medium">
              {linkedTask.technicians.map((t: any) => t.name).join(", ")}
            </span>
          </div>
        )}

        {/* Open in resource plan */}
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs h-8"
          onClick={() => navigate(`/projects/plan?openTask=${linkedTask.id}`)}
        >
          <ExternalLink className="h-3 w-3 mr-1.5" />
          Åpne i ressursplan
        </Button>
      </CardContent>
    </Card>
  );
}
