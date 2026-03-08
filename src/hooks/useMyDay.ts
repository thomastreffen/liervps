import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { startOfDay, endOfDay, addDays, format } from "date-fns";

export interface MyDayBlock {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  project_id: string | null;
  job_id: string | null;
  location: string | null;
  description: string | null;
  outlook_subject: string | null;
  outlook_weblink: string | null;
  source: string;
  // Joined project data
  project_title: string | null;
  customer: string | null;
  address: string | null;
  project_status: string | null;
  project_description: string | null;
  contact_person: string | null;
  contact_phone: string | null;
}

export function useMyDay() {
  const { user } = useAuth();
  const [todayBlocks, setTodayBlocks] = useState<MyDayBlock[]>([]);
  const [upcomingBlocks, setUpcomingBlocks] = useState<MyDayBlock[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBlocks = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const sb = supabase as any;
    const now = new Date();
    const todayStart = startOfDay(now).toISOString();
    const todayEnd = endOfDay(now).toISOString();
    const weekEnd = endOfDay(addDays(now, 7)).toISOString();

    try {
      // Get person_id for this user
      const { data: account } = await sb
        .from("user_accounts")
        .select("person_id")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      const personId = account?.person_id;
      if (!personId) {
        setLoading(false);
        return;
      }

      // Today's blocks
      const { data: today } = await sb
        .from("schedule_blocks")
        .select("id, title, start_at, end_at, project_id, job_id, location, description, outlook_subject, outlook_weblink, source")
        .eq("technician_id", personId)
        .is("deleted_at", null)
        .gte("start_at", todayStart)
        .lte("start_at", todayEnd)
        .order("start_at", { ascending: true });

      // Upcoming blocks (next 7 days, excluding today)
      const tomorrowStart = startOfDay(addDays(now, 1)).toISOString();
      const { data: upcoming } = await sb
        .from("schedule_blocks")
        .select("id, title, start_at, end_at, project_id, job_id, location, description, outlook_subject, outlook_weblink, source")
        .eq("technician_id", personId)
        .is("deleted_at", null)
        .gte("start_at", tomorrowStart)
        .lte("start_at", weekEnd)
        .order("start_at", { ascending: true });

      // Get project details for blocks that have project_id
      const allBlocks = [...(today || []), ...(upcoming || [])];
      const projectIds = [...new Set(allBlocks.filter((b: any) => b.project_id).map((b: any) => b.project_id))];

      let projectMap: Record<string, any> = {};
      if (projectIds.length > 0) {
        const { data: projects } = await sb
          .from("events")
          .select("id, title, customer, address, status, description")
          .in("id", projectIds);
        for (const p of projects || []) {
          projectMap[p.id] = p;
        }
      }

      const mapBlock = (b: any): MyDayBlock => {
        const proj = b.project_id ? projectMap[b.project_id] : null;
        return {
          ...b,
          project_title: proj?.title || null,
          customer: proj?.customer || null,
          address: proj?.address || b.location || null,
          project_status: proj?.status || null,
          project_description: proj?.description || null,
          contact_person: null,
          contact_phone: null,
        };
      };

      setTodayBlocks((today || []).map(mapBlock));
      setUpcomingBlocks((upcoming || []).map(mapBlock));
    } catch (err) {
      console.error("[MyDay]", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchBlocks();
  }, [fetchBlocks]);

  return { todayBlocks, upcomingBlocks, loading, refetch: fetchBlocks };
}
