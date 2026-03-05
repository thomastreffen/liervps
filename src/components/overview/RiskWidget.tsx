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
      // Projects with no future schedule_blocks
      supabase.from("events")
        .select("id")
        .in("status", ["approved", "in_progress", "scheduled"])
        .is("deleted_at", null),
      // Overdue tasks
      supabase.from("tasks" as any)
        .select("id")
        .lt("due_at", now)
        .not("status", "in", "(done,cancelled)"),
      // Open deviations
      supabase.from("job_risk_items" as any)
        .select("id")
        .eq("status", "open"),
      // Overbooking: technicians with >8h today
      supabase.from("schedule_blocks")
        .select("technician_id, start_at, end_at")
        .is("deleted_at", null)
        .gte("start_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
        .lt("start_at", new Date(new Date().setHours(24, 0, 0, 0)).toISOString()),
    ]);

    // Check unplanned - projects without future blocks
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

    // Overbooking calc
    const techHours: Record<string, number> = {};
    (overbookedRes.data || []).forEach((b: any) => {
      if (!b.technician_id) return;
      const hours = (new Date(b.end_at).getTime() - new Date(b.start_at).getTime()) / 3600000;
      techHours[b.technician_id] = (techHours[b.technician_id] || 0) + hours;
    });
    const overbookedCount = Object.values(techHours).filter((h) => h > 8).length;

    const items: RiskItem[] = [
      {
        icon: <CalendarX className="h-4 w-4" />,
        label: "Uplanlagte prosjekter",
        count: unplannedCount,
        accent: "bg-warning/10 text-warning",
        route: "/jobs",
      },
      {
        icon: <Clock className="h-4 w-4" />,
        label: "Forfalte oppgaver",
        count: (overdueTasksRes.data || []).length,
        accent: "bg-destructive/10 text-destructive",
        route: "/tasks",
      },
      {
        icon: <AlertTriangle className="h-4 w-4" />,
        label: "Overbooking i dag",
        count: overbookedCount,
        accent: "bg-warning/10 text-warning",
        route: "/resource-plan",
      },
      {
        icon: <ShieldAlert className="h-4 w-4" />,
        label: "Åpne avvik",
        count: (deviationsRes.data || []).length,
        accent: "bg-destructive/10 text-destructive",
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
      <div className="text-center py-10">
        <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-2 border-2 border-success/20">
          <ShieldAlert className="h-5 w-5 text-success/50" />
        </div>
        <p className="text-sm text-muted-foreground/50 font-medium">Ingen aktive risikoer</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4">
      {risks.map((r, i) => (
        <button
          key={i}
          onClick={() => r.count > 0 && navigate(r.route)}
          disabled={r.count === 0}
          className="flex flex-col items-center gap-2 rounded-xl border border-border/40 px-3 py-4 hover:border-primary/20 hover:bg-primary/[0.02] transition-all disabled:opacity-40 disabled:cursor-default group"
        >
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${r.accent}`}>
            {r.icon}
          </div>
          <span className="text-2xl font-bold text-foreground">{r.count}</span>
          <span className="text-[11px] text-muted-foreground text-center leading-tight font-medium">{r.label}</span>
        </button>
      ))}
    </div>
  );
}
