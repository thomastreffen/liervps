import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay, isPast } from "date-fns";
import { nb } from "date-fns/locale";
import { Loader2, Plus, Settings2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useDashboardConfig, type ModuleKey } from "@/hooks/useDashboardConfig";
import { ProjectCards, type ProjectCardData } from "@/components/overview/ProjectCards";
import { YourDay, type DayBlock } from "@/components/overview/YourDay";
import { MyTasks, type OverviewTask } from "@/components/overview/MyTasks";
import { ActivityFeed, type ActivityItem } from "@/components/overview/ActivityFeed";
import { RiskWidget } from "@/components/overview/RiskWidget";
import { SectionHeader } from "@/components/overview/SectionHeader";
import { DashboardModuleManager } from "@/components/overview/DashboardModuleManager";
import type { JobStatus } from "@/lib/job-status";
import { Button } from "@/components/ui/button";

export default function OverviewPage() {
  const { user, isSuperAdmin } = useAuth();
  const { modules, enabledModules, loading: configLoading, saveModules, isEnabled } = useDashboardConfig();
  const [dataLoading, setDataLoading] = useState(true);
  const [projects, setProjects] = useState<ProjectCardData[]>([]);
  const [dayBlocks, setDayBlocks] = useState<DayBlock[]>([]);
  const [tasks, setTasks] = useState<OverviewTask[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [showModuleManager, setShowModuleManager] = useState(false);

  useEffect(() => {
    if (!user || configLoading) return;
    fetchAll();
  }, [user, configLoading]);

  async function fetchAll() {
    setDataLoading(true);
    const now = new Date();
    const dayStart = startOfDay(now).toISOString();
    const dayEnd = endOfDay(now).toISOString();
    const activeStatuses: JobStatus[] = ["requested", "approved", "scheduled", "in_progress", "time_change_proposed"];

    const techPromise = supabase
      .from("technicians")
      .select("id")
      .eq("user_id", user!.id)
      .maybeSingle();

    const [projectsRes, techRes] = await Promise.all([
      supabase.from("events")
        .select("id, title, customer, status, internal_number")
        .in("status", activeStatuses)
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

    const [taskCountsRes, nextActivitiesRes, blocksRes, userTasksRes, activityRes, plannedBlocksRes, messageCountsRes] = await Promise.all([
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
      supabase.from("tasks" as any)
        .select("id, title, due_at, linked_project_id, priority, status")
        .neq("status", "done")
        .neq("status", "cancelled")
        .order("due_at", { ascending: true, nullsFirst: false })
        .limit(10),
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

    const rawTasks = ((userTasksRes.data || []) as any[]).map((t) => ({
      id: t.id, title: t.title, due_at: t.due_at, linked_project_id: t.linked_project_id, priority: t.priority,
    }));
    rawTasks.sort((a, b) => {
      const aOverdue = a.due_at && isPast(new Date(a.due_at)) ? 0 : 1;
      const bOverdue = b.due_at && isPast(new Date(b.due_at)) ? 0 : 1;
      if (aOverdue !== bOverdue) return aOverdue - bOverdue;
      if (!a.due_at) return 1;
      if (!b.due_at) return -1;
      return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
    });
    setTasks(rawTasks);
    setActivity((activityRes.data as ActivityItem[]) || []);
    setDataLoading(false);
  }

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
            <div className="rounded-2xl border-2 border-border/50 bg-card overflow-hidden">
              <YourDay blocks={dayBlocks} />
            </div>
          </div>
        );
      case "tasks":
        return (
          <div key={key}>
            <SectionHeader title="Mine oppgaver" />
            <div className="rounded-2xl border-2 border-border/50 bg-card overflow-hidden">
              <MyTasks tasks={tasks} onTaskCreated={() => fetchAll()} />
            </div>
          </div>
        );
      case "activity":
        return (
          <div key={key}>
            <SectionHeader title="Aktivitet" />
            <div className="rounded-2xl border-2 border-border/50 bg-card overflow-hidden">
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
            <div className="rounded-2xl border-2 border-border/50 bg-card overflow-hidden">
              <RiskWidget />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  // Group modules by column
  const fullWidthModules = enabledModules.filter((m) => m.column_placement === "full");
  const leftModules = enabledModules.filter((m) => m.column_placement === "left");
  const rightModules = enabledModules.filter((m) => m.column_placement === "right");
  const hasTwoCol = leftModules.length > 0 || rightModules.length > 0;

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-8 py-10 sm:py-14">
      {/* Greeting */}
      <div className="text-center mb-12">
        <h1 className="text-3xl sm:text-[2.5rem] font-bold text-foreground tracking-tight leading-tight">
          {greeting()}, {firstName} 👋
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          {format(new Date(), "EEEE d. MMMM yyyy", { locale: nb })} · Uke {format(new Date(), "w")}
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="mt-3 text-xs text-muted-foreground/50 hover:text-primary gap-1"
          onClick={() => setShowModuleManager(true)}
        >
          <Settings2 className="h-3.5 w-3.5" />
          Tilpass dashboard
        </Button>
      </div>

      {/* Render modules in order: full-width first, then two-col, interleaved by sort_order */}
      <div className="space-y-10">
        {/* Render all modules in sort order, grouping left/right into grid rows */}
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
              // Collect consecutive left/right modules into a grid row
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
    </div>
  );
}
