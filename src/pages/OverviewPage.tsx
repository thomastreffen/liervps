import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay, isPast } from "date-fns";
import { nb } from "date-fns/locale";
import {
  FolderKanban, Clock, CheckCircle2, Activity, Loader2,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { ProjectCards, type ProjectCardData } from "@/components/overview/ProjectCards";
import { YourDay, type DayBlock } from "@/components/overview/YourDay";
import { MyTasks, type OverviewTask } from "@/components/overview/MyTasks";
import { ActivityFeed, type ActivityItem } from "@/components/overview/ActivityFeed";
import { SectionHeader } from "@/components/overview/SectionHeader";
import type { JobStatus } from "@/lib/job-status";

export default function OverviewPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<ProjectCardData[]>([]);
  const [dayBlocks, setDayBlocks] = useState<DayBlock[]>([]);
  const [tasks, setTasks] = useState<OverviewTask[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  useEffect(() => {
    if (!user) return;
    fetchAll();
  }, [user]);

  async function fetchAll() {
    setLoading(true);
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

    const [taskCountsRes, nextActivitiesRes, blocksRes, userTasksRes, activityRes] = await Promise.all([
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
        .select("id, type, action, title, description, entity_type, entity_id, created_at")
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    // Build project cards
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

    setProjects(rawProjects.map((p) => ({
      id: p.id,
      title: p.title,
      internal_number: p.internal_number,
      customer: p.customer,
      nextActivity: nextByProject[p.id] || null,
      taskCount: tasksByProject[p.id] || 0,
      messageCount: 0,
      deviationCount: 0,
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
    setLoading(false);
  }

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 10) return "God morgen";
    if (h < 17) return "Hei";
    return "God kveld";
  };

  const firstName = user?.name?.split(" ")[0] || "";

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-12">
      {/* Greeting */}
      <div className="text-center sm:text-left">
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
          {greeting()}, {firstName} 👋
        </h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          {format(new Date(), "EEEE d. MMMM yyyy", { locale: nb })} · Uke {format(new Date(), "w")}
        </p>
      </div>

      {/* Project cards - desktop top */}
      <div className="hidden sm:block">
        <SectionHeader icon={<FolderKanban className="h-4 w-4 text-primary" />} title="Prosjekter" count={projects.length} />
        <ProjectCards projects={projects} />
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <SectionHeader icon={<Clock className="h-4 w-4 text-primary" />} title="Din dag" count={dayBlocks.length} />
          <div className="rounded-2xl border border-border/40 bg-card shadow-sm overflow-hidden">
            <YourDay blocks={dayBlocks} />
          </div>
        </div>
        <div>
          <SectionHeader icon={<CheckCircle2 className="h-4 w-4 text-primary" />} title="Mine oppgaver" count={tasks.length} />
          <div className="rounded-2xl border border-border/40 bg-card shadow-sm overflow-hidden">
            <MyTasks tasks={tasks} />
          </div>
        </div>
      </div>

      {/* Mobile projects */}
      <div className="sm:hidden">
        <SectionHeader icon={<FolderKanban className="h-4 w-4 text-primary" />} title="Prosjekter" count={projects.length} />
        <ProjectCards projects={projects} />
      </div>

      {/* Activity */}
      <div>
        <SectionHeader icon={<Activity className="h-4 w-4 text-primary" />} title="Aktivitet" count={activity.length} />
        <div className="rounded-2xl border border-border/40 bg-card shadow-sm overflow-hidden">
          <ActivityFeed items={activity} />
        </div>
      </div>
    </div>
  );
}
