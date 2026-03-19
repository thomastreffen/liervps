import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type NotificationPriority = "critical" | "important" | "info";

export interface Notification {
  id: string;
  event_id: string | null;
  type: string;
  priority: NotificationPriority;
  title: string;
  message: string | null;
  link_url: string | null;
  read: boolean;
  read_at: string | null;
  created_at: string;
  entity_type?: string | null;
  entity_id?: string | null;
  actor_user_id?: string | null;
  actor_name?: string | null;
  company_id?: string | null;
}

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const fetchRef = useRef(0);

  // Derive unreadCount from notifications array – single source of truth
  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const fetchId = ++fetchRef.current;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      // Only apply if this is still the latest fetch (avoid race conditions)
      if (fetchId !== fetchRef.current) return;

      if (!error && data) {
        const mapped = (data as any[]).map((n) => ({
          ...n,
          priority: n.priority || "info",
        })) as Notification[];
        setNotifications(mapped);
      }
    } finally {
      if (fetchId === fetchRef.current) {
        setLoading(false);
      }
    }
  }, [user]);

  const markAsRead = useCallback(async (id: string) => {
    await supabase
      .from("notifications")
      .update({ read: true, read_at: new Date().toISOString() } as any)
      .eq("id", id);

    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true, read_at: new Date().toISOString() } : n))
    );
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!user) return;
    await supabase
      .from("notifications")
      .update({ read: true, read_at: new Date().toISOString() } as any)
      .eq("user_id", user.id)
      .eq("read", false);

    setNotifications((prev) => prev.map((n) => ({ ...n, read: true, read_at: new Date().toISOString() })));
  }, [user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Realtime subscription filtered to current user
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchNotifications]);

  return { notifications, unreadCount, loading, markAsRead, markAllAsRead, refetch: fetchNotifications };
}
