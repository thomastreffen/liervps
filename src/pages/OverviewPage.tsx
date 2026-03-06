import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay, addDays } from "date-fns";
import { nb } from "date-fns/locale";
import { Loader2, Settings2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useDashboardConfig, type ModuleKey } from "@/hooks/useDashboardConfig";
import { ProjectCards, type ProjectCardData } from "@/components/overview/ProjectCards";
import { YourDay, type DayBlock } from "@/components/overview/YourDay";
import { MyTasks, type OverviewEvent } from "@/components/overview/MyTasks";
import { ActivityFeed, type ActivityItem } from "@/components/overview/ActivityFeed";
import { RiskWidget } from "@/components/overview/RiskWidget";
import { SectionHeader } from "@/components/overview/SectionHeader";
import { DashboardModuleManager } from "@/components/overview/DashboardModuleManager";
import type { JobStatus } from "@/lib/job-status";
import { Button } from "@/components/ui/button";
import { EventDrawer } from "@/components/EventDrawer";

export default function OverviewPage() {
  const { user, isSuperAdmin } = useAuth();
  const { modules, enabledModules, loading: configLoading, saveModules, isEnabled } = useDashboardConfig();
  const [dataLoading, setDataLoading] = useState(true);
  const [projects, setProjects] = useState<ProjectCardData[]>([]);
  const [dayBlocks, setDayBlocks] = useState<DayBlock[]>([]);
  const [myEvents, setMyEvents] = useState<OverviewEvent[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [showModuleManager, setShowModuleManager] = useState(false);
  const [showTaskDrawer, setShowTaskDrawer] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setDataLoading(true);
    const now = new Date();
    const dayStart = startOfDay(now).toISOString();
    const dayEnd = endOfDay(now).toISOString();
    const weekEnd = endOfDay(addDays(now, 7)).toISOString();
    const activeStatuses: JobStatus[] = ["requested", "approved", "scheduled", "in_progress", "time_change_proposed"];

    const techPromise = supabase
      .from("technicians")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    const [projectsRes, techRes] = await Promise.all([
      supabase.from("events")
        .select("id, title, customer, status, internal_number")
        .in("status", activeStatuses)
        .eq("project_type", "project")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(12),
      techPromise,
    ]);

    const rawProjects = (projectsRes.data || []) as Array<{
      id: string; title: string; customer: string; status: JobStatus; internal_number: string | null;
    }>;

    const techId = techRes.data?.id;
    const projectIds = rawProjects.map((p) => p.id);

    // Fetch my events: events created by me OR where I'm assigned as technician, coming up in the next 7 days
    const myEventsQuery = supabase
      .from("events")
      .select("id, title, start_time, end_time, project_type, status, customer, description")
      .is("deleted_at", null)
      .in("status", [...activeStatuses, "completed" as any])
      .gte("start_time", startOfDay(now).toISOString())
      .lte("start_time", weekEnd)
      .order("start_time", { ascending: true })
      .limit(30);

    // If user has a technician profile, get events assigned to them; otherwise get events created by them
    let myEventsPromise: PromiseLike<any>;
    if (techId) {
      // Get event IDs assigned to this technician
      myEventsPromise = supabase
        .from("event_technicians")
        .select("event_id, events!inner(id, title, start_time, end_time, project_type, status, customer, description)")
        .eq("technician_id", techId)
        .then(({ data }) => {
          const events = (data || [])
            .map((et: any) => et.events)
            .filter((e: any) => e && !e.deleted_at);
          // Also get task-type events created by user
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
              // Deduplicate
              const seen = new Set<string>();
              return combined.filter((e: any) => {
                if (seen.has(e.id)) return false;
                seen.add(e.id);
                // Filter by date range
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

    const [taskCountsRes, nextActivitiesRes, blocksRes, myEventsResult, activityRes, plannedBlocksRes, messageCountsRes] = await Promise.all([
      projectIds.length > 0
        ? supabase.from("job_tasks").select("job_id, status").in("job_id", projectIds).neq("status", "completed")
        : Promise.resolve({ data: [] }),
      projectIds.length > 0
        ? supabase.from("job_tasks")
            .select("job_id, title, scheduled_date")
            .in("job_id", projectIds)
            .neq("status", "completed")
            .gte("scheduled_date", now.toISOString().split("T")[0])
            .order("scheduled_date", { ascending: true })
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
      supabase.from("activity_log")
        .select("id, type, action, title, description, entity_type, entity_id, created_at, performed_by")
        .order("created_at", { ascending: false })
        .limit(20),
      projectIds.length > 0
        ? supabase.from("schedule_blocks")
            .select("project_id")
            .in("project_id", projectIds)
            .is("deleted_at", null)
            .gte("start_at", now.toISOString())
        : Promise.resolve({ data: [] }),
      projectIds.length > 0
        ? supabase.from("conversation_threads")
            .select("project_id, post_count")
            .in("project_id", projectIds)
            .eq("status", "open")
        : Promise.resolve({ data: [] }),
    ]);

    const tasksByProject: Record<string, number> = {};
    (taskCountsRes.data || []).forEach((t: any) => {
      tasksByProject[t.job_id] = (tasksByProject[t.job_id] || 0) + 1;
    });

    const nextByProject: Record<string, { title: string; scheduled_date: string }> = {};
    (nextActivitiesRes.data || []).forEach((t: any) => {
      if (!nextByProject[t.job_id] && t.scheduled_date) {
        nextByProject[t.job_id] = { title: t.title, scheduled_date: t.scheduled_date };
      }
    });

    const plannedProjectIds = new Set(
      (plannedBlocksRes.data || []).map((b: any) => b.project_id).filter(Boolean)
    );

    const messagesByProject: Record<string, number> = {};
    (messageCountsRes.data || []).forEach((t: any) => {
      if (t.project_id) {
        messagesByProject[t.project_id] = (messagesByProject[t.project_id] || 0) + 1;
      }
    });

    setProjects(rawProjects.map((p) => ({
      id: p.id,
      title: p.title,
      internal_number: p.internal_number,
      customer: p.customer,
      nextActivity: nextByProject[p.id] || null,
      taskCount: tasksByProject[p.id] || 0,
      messageCount: messagesByProject[p.id] || 0,
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

    // Map my events
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

    setActivity((activityRes.data as ActivityItem[]) || []);
    setDataLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user || configLoading) return;
    fetchAll();
  }, [user, configLoading, fetchAll]);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 10) return "God morgen";
    if (h < 17) return "Hei";
    return "God kveld";
  };

  const firstName = user?.name?.split(" ")[0] || "";

  if (dataLoading || configLoading) {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Build module render map
  const renderModule = (key: ModuleKey) => {
    switch (key) {
      case "projects":
        return (
          <div key={key}>
            <SectionHeader title="Prosjekter" count={projects.length} />
            <ProjectCards projects={projects} />
          </div>
        );
      case "yourday":
        return (
          <div key={key}>
            <SectionHeader title="Din dag" />
            <div className="rounded-2xl border border-border/30 bg-card shadow-card overflow-hidden">
              <YourDay blocks={dayBlocks} />
            </div>
          </div>
        );
      case "tasks":
        return (
          <div key={key}>
            <SectionHeader title="Mine gjøremål" />
            <div className="rounded-2xl border border-border/30 bg-card shadow-card overflow-hidden">
              <MyTasks
                events={myEvents}
                onNewTask={() => setShowTaskDrawer(true)}
              />
            </div>
          </div>
        );
      case "activity":
        return (
          <div key={key}>
            <SectionHeader title="Aktivitet" />
            <div className="rounded-2xl border border-border/30 bg-card shadow-card overflow-hidden">
              <ActivityFeed
                items={activity}
                maxItems={8}
                userId={user?.id}
                followedProjectIds={projects.map((p) => p.id)}
              />
            </div>
          </div>
        );
      case "risk":
        return (
          <div key={key}>
            <SectionHeader title="Risiko" />
            <div className="rounded-2xl border border-border/30 bg-card shadow-card overflow-hidden">
              <RiskWidget />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-8 py-12 sm:py-16">
      {/* Greeting */}
      <div className="text-center mb-16">
        <h1 className="text-3xl sm:text-[2.75rem] font-extrabold text-foreground tracking-tight leading-tight">
          {greeting()}, {firstName} 👋
        </h1>
        <p className="text-sm text-muted-foreground mt-3">
          {format(new Date(), "EEEE d. MMMM yyyy", { locale: nb })} · Uke {format(new Date(), "w")}
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="mt-4 text-xs text-muted-foreground/40 hover:text-primary gap-1.5"
          onClick={() => setShowModuleManager(true)}
        >
          <Settings2 className="h-3.5 w-3.5" />
          Tilpass dashboard
        </Button>
        <div className="mt-8 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      {/* Render modules */}
      <div className="space-y-14">
        {(() => {
          const rendered: React.ReactNode[] = [];
          let i = 0;
          const all = enabledModules;

          while (i < all.length) {
            const mod = all[i];
            if (mod.column_placement === "full") {
              rendered.push(
                <div key={`full-${mod.module_key}`}>
                  {renderModule(mod.module_key)}
                </div>
              );
              i++;
            } else {
              const gridItems: { left: typeof all; right: typeof all } = { left: [], right: [] };
              while (i < all.length && all[i].column_placement !== "full") {
                if (all[i].column_placement === "left") gridItems.left.push(all[i]);
                else gridItems.right.push(all[i]);
                i++;
              }
              const maxLen = Math.max(gridItems.left.length, gridItems.right.length);
              for (let j = 0; j < maxLen; j++) {
                rendered.push(
                  <div key={`grid-${j}-${gridItems.left[j]?.module_key || gridItems.right[j]?.module_key}`} className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    <div>{gridItems.left[j] && renderModule(gridItems.left[j].module_key)}</div>
                    <div>{gridItems.right[j] && renderModule(gridItems.right[j].module_key)}</div>
                  </div>
                );
              }
            }
          }
          return rendered;
        })()}
      </div>

      {/* Module manager dialog */}
      {showModuleManager && (
        <DashboardModuleManager
          modules={modules}
          onSave={(newModules) => {
            saveModules(newModules);
            setShowModuleManager(false);
          }}
          onClose={() => setShowModuleManager(false)}
        />
      )}

      {/* Task creation drawer (reuses EventDrawer) */}
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
