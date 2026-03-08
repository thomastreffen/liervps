import { useState } from "react";
import { Link } from "react-router-dom";
import { Bell, FileText, CheckCircle, MessageSquare, Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { TimeAgo } from "@/components/portal/TimeAgo";
import type { PortalNotification } from "@/hooks/usePortalNotifications";

const typeIcon: Record<string, React.ReactNode> = {
  new_report: <FileText className="h-4 w-4 text-primary" />,
  pending_approval: <CheckCircle className="h-4 w-4 text-warning" />,
  new_message: <MessageSquare className="h-4 w-4 text-info" />,
};

const typeBg: Record<string, string> = {
  new_report: "bg-primary/10",
  pending_approval: "bg-warning/10",
  new_message: "bg-info/10",
};

interface Props {
  notifications: PortalNotification[];
  unreadCount: number;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
}

export function NotificationBell({ notifications, unreadCount, onMarkAsRead, onMarkAllAsRead }: Props) {
  const [open, setOpen] = useState(false);
  const recent = notifications.slice(0, 15);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 p-0 sm:w-96"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-bold text-card-foreground">Varsler</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-2 py-1 text-xs text-primary"
              onClick={onMarkAllAsRead}
            >
              <Check className="mr-1 h-3 w-3" />
              Merk alle som lest
            </Button>
          )}
        </div>

        {/* List */}
        <ScrollArea className="max-h-80">
          {recent.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10">
              <Bell className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Ingen varsler ennå</p>
              <p className="text-xs text-muted-foreground/70">Du får varsler når det skjer noe viktig.</p>
            </div>
          ) : (
            <div className="divide-y">
              {recent.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    "flex gap-3 px-4 py-3 transition-colors",
                    !n.read_at && "bg-primary/[0.03]"
                  )}
                >
                  <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", typeBg[n.notification_type] || "bg-muted")}>
                    {typeIcon[n.notification_type] || <Bell className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn("text-sm leading-tight", !n.read_at ? "font-semibold text-card-foreground" : "text-muted-foreground")}>
                        {n.subject}
                      </p>
                      {!n.read_at && (
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      )}
                    </div>
                    {n.body_preview && (
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.body_preview}</p>
                    )}
                    <div className="mt-1 flex items-center gap-2">
                      <TimeAgo date={n.created_at} className="text-[10px] text-muted-foreground/70" />
                      {n.portal_link && (
                        <Link
                          to={new URL(n.portal_link, window.location.origin).pathname}
                          onClick={() => {
                            if (!n.read_at) onMarkAsRead(n.id);
                            setOpen(false);
                          }}
                          className="inline-flex items-center gap-0.5 text-[10px] font-medium text-primary hover:underline"
                        >
                          Åpne <ExternalLink className="h-2.5 w-2.5" />
                        </Link>
                      )}
                      {!n.read_at && !n.portal_link && (
                        <button
                          onClick={() => onMarkAsRead(n.id)}
                          className="text-[10px] font-medium text-primary hover:underline"
                        >
                          Merk som lest
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="border-t px-4 py-2">
            <Link
              to="/portal/notifications"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-primary hover:underline"
            >
              Se alle varsler
            </Link>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
