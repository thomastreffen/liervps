import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "@/hooks/useNotifications";
import type { Notification, NotificationPriority } from "@/hooks/useNotifications";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  Bell, CheckCheck, Clock, AlertTriangle, XCircle, CalendarCheck,
  Plug, AtSign, MessageSquare, Mail, UserPlus, FileWarning,
  FilePlus, Receipt, CalendarX, ShoppingBag, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const TYPE_ICONS: Record<string, React.ElementType> = {
  time_change_proposed: Clock,
  approval_pending: CalendarCheck,
  approved: CheckCircle2,
  all_approved: CheckCircle2,
  rejected: XCircle,
  new_order: ShoppingBag,
  conflict: AlertTriangle,
  ms_connect_request: Plug,
  mention: AtSign,
  assignment: CalendarCheck,
  triage: AlertTriangle,
  task_thread_message: MessageSquare,
  task_thread_inbound_email: Mail,
  task_assigned: UserPlus,
  task_changed: Clock,
  deviation_created: FileWarning,
  addition_created: FilePlus,
  offer_followup: Receipt,
  absence_approval: CalendarX,
};

const PRIORITY_STYLES: Record<NotificationPriority, string> = {
  critical: "border-l-4 border-l-destructive",
  important: "border-l-4 border-l-amber-500",
  info: "",
};

const PRIORITY_DOT: Record<NotificationPriority, string> = {
  critical: "bg-destructive",
  important: "bg-amber-500",
  info: "bg-primary",
};

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { notifications, markAsRead, markAllAsRead } = useNotifications();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const unread = notifications.filter((n) => !n.read);
  const displayed = filter === "unread" ? unread : notifications;

  const handleClick = (n: Notification) => {
    if (!n.read) markAsRead(n.id);
    if (n.link_url) {
      navigate(n.link_url);
    } else if (n.event_id) {
      navigate(`/projects/${n.event_id}`);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Varsler</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {unread.length > 0 ? `${unread.length} uleste` : "Alle varsler er lest"}
          </p>
        </div>
        {unread.length > 0 && (
          <Button variant="outline" size="sm" onClick={markAllAsRead} className="gap-1.5 text-xs">
            <CheckCheck className="h-3.5 w-3.5" />
            Merk alle som lest
          </Button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => setFilter("all")}
          className={cn(
            "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
            filter === "all"
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          Alle ({notifications.length})
        </button>
        <button
          onClick={() => setFilter("unread")}
          className={cn(
            "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
            filter === "unread"
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          Uleste ({unread.length})
        </button>
      </div>

      <div className="space-y-1.5">
        {displayed.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16">
            <Bell className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              {filter === "unread" ? "Ingen uleste varsler" : "Ingen varsler ennå"}
            </p>
            <p className="text-xs text-muted-foreground/60">
              Du får varsler når det skjer noe viktig.
            </p>
          </div>
        ) : (
          displayed.map((n) => {
            const Icon = TYPE_ICONS[n.type] || Bell;
            const priority = n.priority || "info";

            return (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={cn(
                  "w-full rounded-lg border p-3 text-left transition-all hover:shadow-sm",
                  PRIORITY_STYLES[priority],
                  !n.read
                    ? "bg-accent/50 border-accent-foreground/10"
                    : "bg-card hover:bg-secondary/50 border-transparent"
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                      !n.read ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={cn("text-sm truncate", !n.read && "font-medium")}>
                        {n.title}
                      </p>
                      {!n.read && (
                        <span className={cn("h-2 w-2 shrink-0 rounded-full", PRIORITY_DOT[priority])} />
                      )}
                    </div>
                    {n.message && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {n.message}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      {n.actor_name && (
                        <span className="text-[10px] text-muted-foreground/80 font-medium">
                          {n.actor_name}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(n.created_at), "d. MMM HH:mm", { locale: nb })}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
