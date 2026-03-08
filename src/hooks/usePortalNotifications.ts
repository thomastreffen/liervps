import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePortal } from "@/hooks/usePortal";

export interface PortalNotification {
  id: string;
  notification_type: string;
  entity_id: string;
  entity_type: string;
  subject: string;
  body_preview: string | null;
  channel: string;
  status: string;
  portal_link: string | null;
  created_at: string;
  read_at: string | null;
}

export function usePortalNotifications() {
  const { user } = usePortal();
  const [notifications, setNotifications] = useState<PortalNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("portal_notifications")
      .select("*")
      .eq("portal_user_id", user.id)
      .eq("status", "sent")
      .order("created_at", { ascending: false })
      .limit(50);
    setNotifications((data as PortalNotification[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  const markAsRead = useCallback(async (id: string) => {
    await supabase
      .from("portal_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
    );
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!user) return;
    const unreadIds = notifications.filter((n) => !n.read_at).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await supabase
      .from("portal_notifications")
      .update({ read_at: new Date().toISOString() })
      .in("id", unreadIds);
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
    );
  }, [user, notifications]);

  const markByEntity = useCallback(async (entityId: string) => {
    const matching = notifications.filter((n) => n.entity_id === entityId && !n.read_at);
    if (matching.length === 0) return;
    const ids = matching.map((n) => n.id);
    await supabase
      .from("portal_notifications")
      .update({ read_at: new Date().toISOString() })
      .in("id", ids);
    setNotifications((prev) =>
      prev.map((n) =>
        ids.includes(n.id) ? { ...n, read_at: new Date().toISOString() } : n
      )
    );
  }, [notifications]);

  return { notifications, loading, unreadCount, markAsRead, markAllAsRead, markByEntity, refresh: load };
}
