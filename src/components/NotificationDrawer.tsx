import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bell, CheckCheck, Clock, AlertTriangle, XCircle, CalendarCheck,
  Plug, AtSign, MessageSquare, Mail, UserPlus, FileWarning,
  FilePlus, Receipt, CalendarX, Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Notification, NotificationPriority } from "@/hooks/useNotifications";

interface NotificationDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  time_change_proposed: Clock,
  approval_pending: CalendarCheck,
  rejected: XCircle,
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
  task_thread_reminder_important: AlertTriangle,
  task_thread_reminder_urgent: AlertTriangle,
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

export function NotificationDrawer({
  open,
  onOpenChange,
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
}: NotificationDrawerProps) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const unread = notifications.filter((n) => !n.read);
  const displayed = filter === "unread" ? unread : notifications;

  const handleClick = (notification: Notification) => {
    if (!notification.read) {
      onMarkAsRead(notification.id);
    }
    if (notification.link_url) {
      navigate(notification.link_url);
      onOpenChange(false);
      return;
    }
    if (notification.type === "ms_connect_request") {
      navigate("/settings/integrations");
      onOpenChange(false);
      return;
    }
    if (notification.event_id) {
      navigate(`/projects/${notification.event_id}`);
      onOpenChange(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-0">
          <SheetTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Varsler
          </SheetTitle>
          <SheetDescription className="sr-only">Varslinger og handlinger som krever oppmerksomhet</SheetDescription>
        </SheetHeader>

        <div className="px-4 pt-3 pb-2 flex items-center justify-between border-b border-border/40">
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
          {unread.length > 0 && (
            <Button variant="ghost" size="sm" onClick={onMarkAllAsRead} className="gap-1.5 text-xs h-7">
              <CheckCheck className="h-3.5 w-3.5" />
              Merk alle
            </Button>
          )}
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {displayed.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Bell className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">
                  {filter === "unread" ? "Ingen uleste varsler" : "Ingen varsler ennå"}
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
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
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
