import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  CalendarCheck,
  ListChecks,
  FileText,
  Mail,
  AlertTriangle,
  DollarSign,
  ClipboardList,
  Hammer,
  Clock,
  Users,
  ArrowRight,
} from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface ProjectToolCardsProps {
  jobId: string;
  technicianNames: string[];
  start: Date;
  end: Date;
  onNavigateTool: (tool: string) => void;
}

interface ToolCardProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  badge?: string | number;
  badgeVariant?: "default" | "warning" | "danger";
  children?: React.ReactNode;
  onClick: () => void;
}

function ToolCard({ icon, title, description, badge, badgeVariant = "default", children, onClick }: ToolCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group flex flex-col items-start gap-3 rounded-2xl border border-border/50 bg-card p-5",
        "text-left transition-all duration-200",
        "hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 hover:-translate-y-0.5",
        "active:translate-y-0 active:shadow-sm",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
    >
      <div className="flex w-full items-start justify-between">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary transition-colors group-hover:bg-primary/12">
          {icon}
        </div>
        {badge !== undefined && badge !== 0 && (
          <span className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
            badgeVariant === "danger" && "bg-destructive/10 text-destructive",
            badgeVariant === "warning" && "bg-accent/10 text-accent",
            badgeVariant === "default" && "bg-muted text-muted-foreground",
          )}>
            {badge}
          </span>
        )}
      </div>
      <div className="space-y-0.5">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{description}</p>
        )}
      </div>
      {children}
      <span className="text-xs text-primary/70 font-medium flex items-center gap-1 mt-auto opacity-0 group-hover:opacity-100 transition-opacity">
        Åpne <ArrowRight className="h-3 w-3" />
      </span>
    </button>
  );
}

export function ProjectToolCards({ jobId, technicianNames, start, end, onNavigateTool }: ProjectToolCardsProps) {
  const [openTasks, setOpenTasks] = useState(0);
  const [overdueTasks, setOverdueTasks] = useState(0);
  const [riskCount, setRiskCount] = useState(0);
  const [criticalRiskCount, setCriticalRiskCount] = useState(0);
  const [formCount, setFormCount] = useState(0);
  const [docCount, setDocCount] = useState(0);
  const [serviceJobCount, setServiceJobCount] = useState(0);
  const [nextActivity, setNextActivity] = useState<{ title: string; date: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCounts = useCallback(async () => {
    const today = new Date().toISOString().split("T")[0];

    const [tasksRes, risksRes, formsRes, docsRes, serviceRes] = await Promise.all([
      supabase.from("job_tasks").select("id, title, status, scheduled_date").eq("job_id", jobId),
      supabase.from("job_risk_items").select("id, severity").eq("job_id", jobId).eq("status", "open"),
      supabase.from("form_instances").select("id").eq("project_id", jobId),
      supabase.from("documents").select("id").eq("entity_id", jobId).eq("entity_type", "job").is("deleted_at", null),
      supabase.from("service_jobs").select("id").eq("project_id", jobId),
    ]);

    if (tasksRes.data) {
      const pending = tasksRes.data.filter((t: any) => t.status !== "completed");
      setOpenTasks(pending.length);
      setOverdueTasks(pending.filter((t: any) => t.scheduled_date && t.scheduled_date < today).length);
      const upcoming = pending
        .filter((t: any) => t.scheduled_date && t.scheduled_date >= today)
        .sort((a: any, b: any) => a.scheduled_date.localeCompare(b.scheduled_date))[0];
      if (upcoming) {
        setNextActivity({ title: upcoming.title, date: upcoming.scheduled_date });
      }
    }

    if (risksRes.data) {
      setRiskCount(risksRes.data.length);
      setCriticalRiskCount(risksRes.data.filter((r: any) => r.severity === "critical" || r.severity === "high").length);
    }

    setFormCount(formsRes.data?.length ?? 0);
    setDocCount(docsRes.data?.length ?? 0);
    setServiceJobCount(serviceRes.data?.length ?? 0);
    setLoading(false);
  }, [jobId]);

  useEffect(() => { fetchCounts(); }, [fetchCounts]);

  if (loading) {
    return (
      <div className="py-16 flex justify-center">
        <Clock className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const period = `${format(start, "d. MMM", { locale: nb })} – ${format(end, "d. MMM yyyy", { locale: nb })}`;

  return (
    <div className="space-y-6">
      {/* Quick info strip */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          {period}
        </span>
        {technicianNames.length > 0 && (
          <span className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {technicianNames.slice(0, 3).join(", ")}
            {technicianNames.length > 3 && ` +${technicianNames.length - 3}`}
          </span>
        )}
        {nextActivity && (
          <span className="flex items-center gap-1.5 text-primary font-medium">
            <CalendarCheck className="h-3.5 w-3.5" />
            Neste: {nextActivity.title} ({format(new Date(nextActivity.date), "d. MMM", { locale: nb })})
          </span>
        )}
      </div>

      {/* Tool cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <ToolCard
          icon={<ListChecks className="h-5 w-5" />}
          title="Oppgaver & Plan"
          description="Aktiviteter, ressurser og tidsplan"
          badge={openTasks > 0 ? `${openTasks} åpne` : undefined}
          badgeVariant={overdueTasks > 0 ? "danger" : "warning"}
          onClick={() => onNavigateTool("plan")}
        />

        <ToolCard
          icon={<Mail className="h-5 w-5" />}
          title="Meldinger"
          description="E-post og kommunikasjon"
          onClick={() => onNavigateTool("epost")}
        />

        <ToolCard
          icon={<FileText className="h-5 w-5" />}
          title="Dokumenter"
          description="Filer, SharePoint og vedlegg"
          badge={docCount > 0 ? docCount : undefined}
          onClick={() => onNavigateTool("dokumenter")}
        />

        <ToolCard
          icon={<ClipboardList className="h-5 w-5" />}
          title="Skjemaer"
          description="Sjekklister og rapportskjemaer"
          badge={formCount > 0 ? formCount : undefined}
          onClick={() => onNavigateTool("skjemaer")}
        />

        <ToolCard
          icon={<Hammer className="h-5 w-5" />}
          title="Servicearbeid"
          description="Service-jobber under prosjektet"
          badge={serviceJobCount > 0 ? serviceJobCount : undefined}
          onClick={() => onNavigateTool("servicearbeid")}
        />

        <ToolCard
          icon={<AlertTriangle className="h-5 w-5" />}
          title="Risiko"
          description="Avvik og risikohåndtering"
          badge={riskCount > 0 ? `${riskCount} aktive` : undefined}
          badgeVariant={criticalRiskCount > 0 ? "danger" : "warning"}
          onClick={() => onNavigateTool("risiko")}
        />

        <ToolCard
          icon={<DollarSign className="h-5 w-5" />}
          title="Økonomi"
          description="Tilbud, kostnader og tillegg"
          onClick={() => onNavigateTool("okonomi")}
        />
      </div>
    </div>
  );
}
