import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertTriangle, CalendarX, Clock, ShieldAlert, ChevronRight,
} from "lucide-react";

interface RiskItem {
  icon: React.ReactNode;
  label: string;
  count: number;
  accent: string;
  iconBg: string;
  route: string;
}

export function RiskWidget() {
  const navigate = useNavigate();
  const [risks, setRisks] = useState<RiskItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRisks();
  }, []);

  async function fetchRisks() {
    const now = new Date().toISOString();
    const [unplannedRes, overdueTasksRes, deviationsRes, overbookedRes] = await Promise.all([
      supabase.from("events")
        .select("id")
        .in("status", ["approved", "in_progress", "scheduled"])
        .is("deleted_at", null),
      supabase.from("tasks" as any)
        .select("id")
        .lt("due_at", now)
        .not("status", "in", "(done,cancelled)"),
      supabase.from("job_risk_items" as any)
        .select("id")
        .eq("status", "open"),
      supabase.from("schedule_blocks")
        .select("technician_id, start_at, end_at")
        .is("deleted_at", null)
        .gte("start_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
        .lt("start_at", new Date(new Date().setHours(24, 0, 0, 0)).toISOString()),
    ]);

    const projectIds = (unplannedRes.data || []).map((p: any) => p.id);
    let unplannedCount = 0;
    if (projectIds.length > 0) {
      const { data: plannedBlocks } = await supabase
        .from("schedule_blocks")
        .select("project_id")
        .in("project_id", projectIds)
        .is("deleted_at", null)
        .gte("start_at", now);
      const plannedIds = new Set((plannedBlocks || []).map((b: any) => b.project_id));
      unplannedCount = projectIds.filter((id: string) => !plannedIds.has(id)).length;
    }

    const techHours: Record<string, number> = {};
    (overbookedRes.data || []).forEach((b: any) => {
      if (!b.technician_id) return;
      const hours = (new Date(b.end_at).getTime() - new Date(b.start_at).getTime()) / 3600000;
      techHours[b.technician_id] = (techHours[b.technician_id] || 0) + hours;
    });
    const overbookedCount = Object.values(techHours).filter((h) => h > 8).length;

    const items: RiskItem[] = [
      {
        icon: <CalendarX className="h-5 w-5" />,
        label: "Uplanlagte prosjekter",
        count: unplannedCount,
        accent: "text-warning",
        iconBg: "bg-warning/12",
        route: "/jobs",
      },
      {
        icon: <Clock className="h-5 w-5" />,
        label: "Forfalte arbeidspakker",
        count: (overdueTasksRes.data || []).length,
        accent: "text-destructive",
        iconBg: "bg-destructive/10",
        route: "/tasks",
      },
      {
        icon: <AlertTriangle className="h-5 w-5" />,
        label: "Overbooking i dag",
        count: overbookedCount,
        accent: "text-warning",
        iconBg: "bg-warning/12",
        route: "/resource-plan",
      },
      {
        icon: <ShieldAlert className="h-5 w-5" />,
        label: "Åpne avvik",
        count: (deviationsRes.data || []).length,
        accent: "text-destructive",
        iconBg: "bg-destructive/10",
        route: "/jobs",
      },
    ];

    setRisks(items);
    setLoading(false);
  }

  const activeRisks = risks.filter((r) => r.count > 0);

  if (loading) return null;

  if (activeRisks.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="h-14 w-14 rounded-2xl bg-success/10 flex items-center justify-center mx-auto mb-3">
          <ShieldAlert className="h-6 w-6 text-success/60" />
        </div>
        <p className="text-sm text-muted-foreground font-medium">Ingen aktive risikoer</p>
        <p className="text-xs text-muted-foreground/50 mt-1">Alt ser bra ut 🎉</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5">
      {risks.map((r, i) => (
        <button
          key={i}
          onClick={() => r.count > 0 && navigate(r.route)}
          disabled={r.count === 0}
          className="flex flex-col items-center gap-3 rounded-2xl border border-border/30 px-4 py-5
            hover:shadow-card-hover hover:-translate-y-0.5
            transition-all duration-200 disabled:opacity-30 disabled:cursor-default group cursor-pointer"
        >
          <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${r.iconBg} ${r.accent}`}>
            {r.icon}
          </div>
          <span className={`text-3xl font-extrabold ${r.count > 0 ? r.accent : 'text-foreground'}`}>{r.count}</span>
          <span className="text-[11px] text-muted-foreground text-center leading-tight font-medium">{r.label}</span>
        </button>
      ))}
    </div>
  );
}
