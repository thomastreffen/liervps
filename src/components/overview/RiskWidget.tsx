import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
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
  const { activeCompanyId } = useCompanyContext();
  const [risks, setRisks] = useState<RiskItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRisks();
  }, [activeCompanyId]);

  async function fetchRisks() {
    const now = new Date().toISOString();

    let unplannedQuery = supabase.from("events")
      .select("id")
      .in("status", ["approved", "in_progress", "scheduled"])
      .is("deleted_at", null);
    if (activeCompanyId) unplannedQuery = unplannedQuery.eq("company_id", activeCompanyId);

    let deviationsQuery = supabase.from("job_risk_items" as any)
      .select("id")
      .eq("status", "open");

    let overbookedQuery = supabase.from("schedule_blocks")
      .select("technician_id, start_at, end_at")
      .is("deleted_at", null)
      .gte("start_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
      .lt("start_at", new Date(new Date().setHours(24, 0, 0, 0)).toISOString());
    if (activeCompanyId) overbookedQuery = overbookedQuery.eq("company_id", activeCompanyId);

    const [unplannedRes, deviationsRes, overbookedRes] = await Promise.all([
      unplannedQuery,
      deviationsQuery,
      overbookedQuery,
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

  if (activeRisks.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {activeRisks.map((r, i) => (
        <button
          key={i}
          onClick={() => navigate(r.route)}
          className="flex items-center gap-3 rounded-xl border border-border/30 bg-card px-4 py-3
            hover:shadow-card-hover transition-all duration-200 group cursor-pointer text-left"
        >
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${r.iconBg} ${r.accent}`}>
            {r.icon}
          </div>
          <div className="min-w-0 flex-1">
            <span className={`text-xl font-extrabold ${r.accent}`}>{r.count}</span>
            <p className="text-[11px] text-muted-foreground leading-tight">{r.label}</p>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/20 group-hover:text-primary/40 shrink-0" />
        </button>
      ))}
    </div>
  );
}
