import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Task {
  id: string;
  company_id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_at: string | null;
  planned_start_at: string | null;
  planned_end_at: string | null;
  estimated_minutes: number | null;
  created_by: string;
  owner_user_id: string | null;
  assigned_user_id: string | null;
  calendar_provider: string | null;
  calendar_event_id: string | null;
  source_case_id: string | null;
  source_case_item_id: string | null;
  linked_work_order_id: string | null;
  linked_project_id: string | null;
  linked_lead_id: string | null;
  linked_offer_id: string | null;
  ai_suggested: boolean;
  ai_confidence: number | null;
  ai_rationale: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskAssignee {
  id: string;
  task_id: string;
  user_id: string;
  role: string;
  notified_at: string | null;
  calendar_event_id: string | null;
  created_at: string;
}

interface UseTasksFilters {
  status?: string;
  assigneeUserId?: string;
  projectFilter?: "all" | "project" | "personal";
  timeFilter?: "all" | "overdue" | "today" | "week";
}

export function useTasks(filters?: UseTasksFilters) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    let query = supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (filters?.status && filters.status !== "all") {
      query = query.eq("status", filters.status);
    } else {
      // Exclude done/cancelled by default
      query = query.not("status", "in", "(done,cancelled)");
    }

    if (filters?.projectFilter === "project") {
      query = query.not("linked_project_id", "is", null);
    } else if (filters?.projectFilter === "personal") {
      query = query.is("linked_project_id", null);
    }

    if (filters?.timeFilter === "overdue") {
      query = query.lt("due_at", new Date().toISOString());
    } else if (filters?.timeFilter === "today") {
      const today = new Date();
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();
      query = query.gte("due_at", start).lt("due_at", end);
    } else if (filters?.timeFilter === "week") {
      const today = new Date();
      const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7).toISOString();
      query = query.lte("due_at", end);
    }

    const { data } = await query;
    setTasks((data as Task[]) || []);
    setLoading(false);
  }, [user, filters?.status, filters?.projectFilter, filters?.timeFilter]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const createTask = useCallback(async (
    task: Partial<Task> & { title: string; company_id: string },
    assigneeIds?: string[],
    attachmentDocIds?: string[]
  ) => {
    const insertData = {
      ...task,
      created_by: user!.id,
      owner_user_id: task.owner_user_id || user!.id,
    };

    const { data, error } = await supabase
      .from("tasks")
      .insert(insertData as any)
      .select("id")
      .single();

    if (error) throw error;
    const taskId = (data as any).id;

    if (assigneeIds && assigneeIds.length > 0) {
      await (supabase as any).from("task_assignees").insert(
        assigneeIds.map((uid: string, i: number) => ({ task_id: taskId, user_id: uid, role: i === 0 ? "owner" : "executor" }))
      );

      const { data: taskData } = await supabase.from("tasks").select("company_id, title").eq("id", taskId).single();
      if (taskData) {
        await (supabase as any).from("notifications").insert(
          assigneeIds.map((uid: string) => ({
            user_id: uid,
            company_id: (taskData as any).company_id,
            type: "task_assigned",
            title: "Ny oppgave tildelt",
            message: (taskData as any).title,
            link_url: `/tasks/${taskId}`,
            read: false,
          }))
        );
      }
    }

    if (attachmentDocIds && attachmentDocIds.length > 0) {
      await (supabase as any).from("task_attachments").insert(
        attachmentDocIds.map((docId: string) => ({ task_id: taskId, document_id: docId }))
      );
    }

    await fetchTasks();
    return taskId;
  }, [user, fetchTasks]);

  const updateTask = useCallback(async (taskId: string, updates: Partial<Task>) => {
    await supabase.from("tasks").update(updates as any).eq("id", taskId);

    if (updates.planned_start_at || updates.planned_end_at) {
      try {
        await supabase.functions.invoke("sync-task-to-calendar", {
          body: { task_id: taskId },
        });
      } catch (e) {
        console.warn("Calendar sync failed:", e);
      }
    }

    await fetchTasks();
  }, [fetchTasks]);

  const completeTask = useCallback(async (taskId: string) => {
    await updateTask(taskId, { status: "done" });
  }, [updateTask]);

  const deleteTask = useCallback(async (taskId: string) => {
    await supabase.from("tasks").delete().eq("id", taskId);
    await fetchTasks();
  }, [fetchTasks]);

  const fetchDoneTasks = useCallback(async () => {
    if (!user) return [];
    const { data } = await supabase
      .from("tasks")
      .select("*")
      .eq("status", "done")
      .order("updated_at", { ascending: false })
      .limit(50);
    return (data as Task[]) || [];
  }, [user]);

  return { tasks, loading, createTask, updateTask, completeTask, deleteTask, fetchDoneTasks, refetch: fetchTasks };
}
