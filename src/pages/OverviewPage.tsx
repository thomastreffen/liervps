import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay, addDays } from "date-fns";
import { nb } from "date-fns/locale";
import { Loader2, ArrowRight, AlertCircle, CalendarX, ShieldAlert, AlertTriangle, Clock, Send, ListX, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { ProjectCards, type ProjectCardData } from "@/components/overview/ProjectCards";
import { YourDay, type DayBlock } from "@/components/overview/YourDay";
import { MyTasks, type OverviewEvent } from "@/components/overview/MyTasks";
import { SectionHeader } from "@/components/overview/SectionHeader";
import type { JobStatus } from "@/lib/job-status";
import { Button } from "@/components/ui/button";
import { EventDrawer } from "@/components/EventDrawer";
import { fetchActiveLeads } from "@/lib/lead-queries";

interface AttentionItem {
  icon: React.ReactNode;
  label: string;
  count: number;
  accent: string;
  iconBg: string;
  route: string;
}

interface ActionItem {
  icon: React.ReactNode;
  label: string;
  count: number;
  route: string;
}

export default function OverviewPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeCompanyId, allowedCompanyIds } = useCompanyContext();
  const [dataLoading, setDataLoading] = useState(true);
  const [projects, setProjects] = useState<ProjectCardData[]>([]);
  const [dayBlocks, setDayBlocks] = useState<DayBlock[]>([]);
  const [myEvents, setMyEvents] = useState<OverviewEvent[]>([]);
  const [showTaskDrawer, setShowTaskDrawer] = useState(false);
  const [attentionItems, setAttentionItems] = useState<AttentionItem[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setDataLoading(true);
    const now = new Date();
    const dayStart = startOfDay(now).toISOString();
    const dayEnd = endOfDay(now).toISOString();
    const weekEnd = endOfDay(addDays(now, 7)).toISOString();
    const activeStatuses: JobStatus[] = ["requested", "approved", "scheduled", "in_progress", "time_change_proposed"];
    const d7 = new Date(now.getTime() - 7 * 86400000).toISOString();

    const techPromise = supabase
      .from("technicians")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    let projectQuery = supabase.from("events")
      .select("id, title, customer, status, internal_number")
      .in("status", activeStatuses)
      .neq("project_type", "task")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(6);
    if (activeCompanyId) projectQuery = projectQuery.eq("company_id", activeCompanyId);
    else if (allowedCompanyIds.length > 0) projectQuery = projectQuery.in("company_id", allowedCompanyIds);

    const [projectsRes, techRes] = await Promise.all([projectQuery, techPromise]);

    const rawProjects = (projectsRes.data || []) as Array<{
      id: string; title: string; customer: string; status: JobStatus; internal_number: string | null;
    }>;

    const techId = techRes.data?.id;
    const projectIds = rawProjects.map((p) => p.id);

    // My events query
    let myEventsPromise: PromiseLike<any>;
    if (techId) {
      myEventsPromise = supabase
        .from("event_technicians")
        .select("event_id, events!inner(id, title, start_time, end_time, project_type, status, customer, description)")
        .eq("technician_id", techId)
        .then(({ data }) => {
          const events = (data || []).map((et: any) => et.events).filter((e: any) => e && !e.deleted_at);
          return supabase
            .from("events")
            .select("id, title, start_time, end_time, project_type, status, customer, description")
            .eq("created_by", user.id)
            .eq("project_type", "task")
            .is("deleted_at", null)
            .gte("start_time", startOfDay(now).toISOString())
            .lte("start_time", weekEnd)
            .order("start_time", { ascending: true })
            .limit(20)
            .then(({ data: taskData }) => {
              const combined = [...events, ...(taskData || [])];
              const seen = new Set<string>();
              return combined.filter((e: any) => {
                if (seen.has(e.id)) return false;
                seen.add(e.id);
                const start = new Date(e.start_time);
                return start >= startOfDay(now) && start <= new Date(weekEnd);
              }).sort((a: any, b: any) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
            });
        });
    } else {
      myEventsPromise = supabase
        .from("events")
        .select("id, title, start_time, end_time, project_type, status, customer, description")
        .eq("created_by", user.id)
        .is("deleted_at", null)
        .gte("start_time", startOfDay(now).toISOString())
        .lte("start_time", weekEnd)
        .order("start_time", { ascending: true })
        .limit(30)
        .then(({ data }) => data || []);
    }

    // Fetch attention data: unplanned, overbooking, deviations
    let allProjectsQuery = supabase.from("events")
      .select("id")
      .in("status", ["approved", "in_progress", "scheduled"])
      .is("deleted_at", null);
    if (activeCompanyId) allProjectsQuery = allProjectsQuery.eq("company_id", activeCompanyId);
    else if (allowedCompanyIds.length > 0) allProjectsQuery = allProjectsQuery.in("company_id", allowedCompanyIds);

    let overbookedQuery = supabase.from("schedule_blocks")
      .select("technician_id, start_at, end_at")
      .is("deleted_at", null)
      .gte("start_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
      .lt("start_at", new Date(new Date().setHours(24, 0, 0, 0)).toISOString());
    if (activeCompanyId) overbookedQuery = overbookedQuery.eq("company_id", activeCompanyId);

    // Fetch sales action data
    const leadsPromise = fetchActiveLeads("id, status, updated_at, next_action_type, next_action_date", activeCompanyId);
    let calcsQuery = supabase
      .from("calculations")
      .select("id, status, lead_id, created_at")
      .is("deleted_at", null)
      .in("status", ["sent", "generated"])
      .limit(100);
    if (activeCompanyId) calcsQuery = calcsQuery.eq("company_id", activeCompanyId);

    const [
      taskCountsRes, blocksRes, myEventsResult, plannedBlocksRes,
      allProjectsRes, overbookedRes, deviationsRes,
      leadsRes, calcsRes
    ] = await Promise.all([
      projectIds.length > 0
        ? supabase.from("job_tasks").select("job_id, status").in("job_id", projectIds).neq("status", "completed")
        : Promise.resolve({ data: [] }),
      techId
        ? supabase.from("schedule_blocks")
            .select("id, start_at, end_at, title, project_id, location, technicians!inner(name), events!schedule_blocks_project_id_fkey(title)")
            .eq("technician_id", techId)
            .is("deleted_at", null)
            .gte("start_at", dayStart)
            .lt("start_at", dayEnd)
            .order("start_at", { ascending: true })
            .limit(10)
        : Promise.resolve({ data: [] }),
      myEventsPromise,
      projectIds.length > 0
        ? supabase.from("schedule_blocks")
            .select("project_id")
            .in("project_id", projectIds)
            .is("deleted_at", null)
            .gte("start_at", now.toISOString())
        : Promise.resolve({ data: [] }),
      allProjectsQuery,
      overbookedQuery,
      supabase.from("job_risk_items" as any).select("id").eq("status", "open"),
      leadsPromise,
      calcsQuery,
    ]);

    // Process projects
    const tasksByProject: Record<string, number> = {};
    (taskCountsRes.data || []).forEach((t: any) => {
      tasksByProject[t.job_id] = (tasksByProject[t.job_id] || 0) + 1;
    });

    const plannedProjectIds = new Set(
      (plannedBlocksRes.data || []).map((b: any) => b.project_id).filter(Boolean)
    );

    setProjects(rawProjects.map((p) => ({
      id: p.id,
      title: p.title,
      internal_number: p.internal_number,
      customer: p.customer,
      nextActivity: null,
      taskCount: tasksByProject[p.id] || 0,
      messageCount: 0,
      deviationCount: 0,
      hasPlanned: plannedProjectIds.has(p.id),
    })));

    setDayBlocks((blocksRes.data || []).map((b: any) => ({
      id: b.id,
      start_at: b.start_at,
      end_at: b.end_at,
      title: b.title,
      project_id: b.project_id,
      project_title: b.events?.title ?? null,
      location: b.location,
      technician_name: b.technicians?.name ?? null,
    })));

    const rawMyEvents: OverviewEvent[] = ((myEventsResult as any) || []).map((e: any) => ({
      id: e.id,
      title: e.title,
      start_time: e.start_time,
      end_time: e.end_time,
      project_type: e.project_type || "project",
      status: e.status,
      customer: e.customer,
      description: e.description,
    }));
    setMyEvents(rawMyEvents);

    // Build attention items (operational risks)
    const allProjectIds = (allProjectsRes.data || []).map((p: any) => p.id);
    let unplannedCount = 0;
    if (allProjectIds.length > 0) {
      const { data: plannedBlocks } = await supabase
        .from("schedule_blocks")
        .select("project_id")
        .in("project_id", allProjectIds)
        .is("deleted_at", null)
        .gte("start_at", now.toISOString());
      const pIds = new Set((plannedBlocks || []).map((b: any) => b.project_id));
      unplannedCount = allProjectIds.filter((id: string) => !pIds.has(id)).length;
    }

    const techHours: Record<string, number> = {};
    (overbookedRes.data || []).forEach((b: any) => {
      if (!b.technician_id) return;
      const hours = (new Date(b.end_at).getTime() - new Date(b.start_at).getTime()) / 3600000;
      techHours[b.technician_id] = (techHours[b.technician_id] || 0) + hours;
    });
    const overbookedCount = Object.values(techHours).filter((h) => h > 8).length;
    const deviationCount = (deviationsRes.data || []).length;

    const attention: AttentionItem[] = [];
    if (overbookedCount > 0) attention.push({
      icon: <AlertTriangle className="h-4 w-4" />, label: "Overbooking i dag",
      count: overbookedCount, accent: "text-destructive", iconBg: "bg-destructive/10", route: "/resource-plan",
    });
    if (unplannedCount > 0) attention.push({
      icon: <CalendarX className="h-4 w-4" />, label: "Uplanlagte prosjekter",
      count: unplannedCount, accent: "text-warning", iconBg: "bg-warning/12", route: "/jobs",
    });
    if (deviationCount > 0) attention.push({
      icon: <ShieldAlert className="h-4 w-4" />, label: "Åpne avvik",
      count: deviationCount, accent: "text-destructive", iconBg: "bg-destructive/10", route: "/jobs",
    });
    setAttentionItems(attention);

    // Build action items (cross-domain)
    const leads = leadsRes.data || [];
    const calcs = calcsRes.data || [];
    const activeLeads = leads.filter((l: any) => !["won", "lost"].includes(l.status));
    const inactiveLeads = activeLeads.filter((l: any) => !l.updated_at || new Date(l.updated_at) < new Date(d7)).length;
    const leadsWithoutNextStep = activeLeads.filter((l: any) => !l.next_action_type && !l.next_action_date).length;
    const sentOffers = calcs.filter((c: any) => c.status === "sent");
    const offersWithoutFollowup = sentOffers.filter((c: any) => (now.getTime() - new Date(c.created_at).getTime()) / 86400000 > 5).length;

    const actions: ActionItem[] = [];
    if (offersWithoutFollowup > 0) actions.push({
      icon: <Send className="h-3.5 w-3.5" />, label: "Tilbud uten oppfølging",
      count: offersWithoutFollowup, route: "/sales/offers?filter=no_followup",
    });
    if (inactiveLeads > 0) actions.push({
      icon: <Clock className="h-3.5 w-3.5" />, label: "Leads uten aktivitet > 7 dager",
      count: inactiveLeads, route: "/sales/leads?filter=inactive_7d",
    });
    if (leadsWithoutNextStep > 0) actions.push({
      icon: <ListX className="h-3.5 w-3.5" />, label: "Leads uten neste steg",
      count: leadsWithoutNextStep, route: "/sales/leads?filter=no_next_step",
    });
    if (unplannedCount > 0) actions.push({
      icon: <CalendarX className="h-3.5 w-3.5" />, label: "Prosjekter uten plan",
      count: unplannedCount, route: "/jobs",
    });
    setActionItems(actions.slice(0, 5));

    setDataLoading(false);
  }, [user, activeCompanyId]);

  useEffect(() => {
    if (!user) return;
    fetchAll();
  }, [user, fetchAll]);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 10) return "God morgen";
    if (h < 17) return "Hei";
    return "God kveld";
  };

  const firstName = user?.name?.split(" ")[0] || "";

  if (dataLoading) {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-8 py-8 sm:py-12">
      {/* Compact greeting */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
          {greeting()}, {firstName}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {format(new Date(), "EEEE d. MMMM yyyy", { locale: nb })} · Uke {format(new Date(), "w")}
        </p>
      </div>

      <div className="space-y-10">
        {/* 1. Krever oppmerksomhet — operational risks */}
        {attentionItems.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {attentionItems.map((r, i) => (
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
        )}

        {/* 2. Din dag + Mine gjøremål side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <SectionHeader title="Din dag" />
            <div className="rounded-2xl border border-border/30 bg-card shadow-card overflow-hidden">
              <YourDay blocks={dayBlocks} />
            </div>
          </div>
          <div>
            <SectionHeader title="Mine gjøremål" />
            <div className="rounded-2xl border border-border/30 bg-card shadow-card overflow-hidden">
              <MyTasks
                events={myEvents}
                onNewTask={() => setShowTaskDrawer(true)}
              />
            </div>
          </div>
        </div>

        {/* 3. Krever handling — cross-domain action list */}
        {actionItems.length > 0 && (
          <div>
            <SectionHeader title="Krever handling" />
            <div className="rounded-2xl border border-border/30 bg-card shadow-card overflow-hidden">
              <div className="p-2">
                {actionItems.map((a, i) => (
                  <button
                    key={i}
                    onClick={() => navigate(a.route)}
                    className="flex items-center gap-3 w-full rounded-xl px-4 py-3.5 text-left
                      hover:bg-primary/5 transition-all group cursor-pointer"
                  >
                    <span className="text-muted-foreground/40 group-hover:text-foreground/60 transition-colors shrink-0">
                      {a.icon}
                    </span>
                    <span className="text-sm text-foreground/70 flex-1 truncate group-hover:text-foreground transition-colors">
                      {a.label}
                    </span>
                    <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-lg shrink-0
                      text-destructive bg-destructive/8 border border-destructive/15">
                      {a.count}
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/10 group-hover:text-primary/40 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 4. Mine prosjekter (max 6) */}
        {projects.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <SectionHeader title="Mine prosjekter" count={projects.length} />
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-primary gap-1"
                onClick={() => navigate("/jobs")}
              >
                Se alle <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
            <ProjectCards projects={projects} />
          </div>
        )}
      </div>

      {/* Task creation drawer */}
      <EventDrawer
        open={showTaskDrawer}
        onOpenChange={setShowTaskDrawer}
        onSaved={() => {
          setShowTaskDrawer(false);
          fetchAll();
        }}
      />
    </div>
  );
}
