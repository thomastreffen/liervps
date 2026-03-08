import { useState } from "react";
import { Link } from "react-router-dom";
import { Bell, FileText, CheckCircle, MessageSquare, Check, Filter } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { TimeAgo } from "@/components/portal/TimeAgo";
import { usePortalNotifications, type PortalNotification } from "@/hooks/usePortalNotifications";

const typeIcon: Record<string, React.ReactNode> = {
  new_report: <FileText className="h-5 w-5 text-primary" />,
  pending_approval: <CheckCircle className="h-5 w-5 text-warning" />,
  new_message: <MessageSquare className="h-5 w-5 text-info" />,
};

const typeBg: Record<string, string> = {
  new_report: "bg-primary/10",
  pending_approval: "bg-warning/10",
  new_message: "bg-info/10",
};

const typeLabel: Record<string, string> = {
  new_report: "Rapporter",
  pending_approval: "Godkjenninger",
  new_message: "Meldinger",
};

function NotificationRow({ n, onMarkAsRead }: { n: PortalNotification; onMarkAsRead: (id: string) => void }) {
  const portalPath = n.portal_link ? new URL(n.portal_link, window.location.origin).pathname : null;

  return (
    <Card className={cn("transition-all", !n.read_at && "border-primary/20 bg-primary/[0.02]")}>
      <CardContent className="flex gap-3 p-4">
        <div className={cn("mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", typeBg[n.notification_type] || "bg-muted")}>
          {typeIcon[n.notification_type] || <Bell className="h-5 w-5 text-muted-foreground" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className={cn("text-sm leading-tight", !n.read_at ? "font-semibold text-card-foreground" : "text-muted-foreground")}>
              {n.subject}
            </p>
            {!n.read_at && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
          </div>
          {n.body_preview && (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{n.body_preview}</p>
          )}
          <div className="mt-2 flex items-center gap-3">
            <TimeAgo date={n.created_at} className="text-[10px] text-muted-foreground/70" />
            {portalPath && (
              <Link
                to={portalPath}
                onClick={() => { if (!n.read_at) onMarkAsRead(n.id); }}
                className="text-xs font-medium text-primary hover:underline"
              >
                Åpne
              </Link>
            )}
            {!n.read_at && (
              <button
                onClick={() => onMarkAsRead(n.id)}
                className="text-xs font-medium text-muted-foreground hover:text-primary"
              >
                Merk som lest
              </button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PortalNotificationsPage() {
  const { notifications, loading, unreadCount, markAsRead, markAllAsRead } = usePortalNotifications();

  const byType = (type: string) => notifications.filter((n) => n.notification_type === type);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-2xl bg-muted" />)}
      </div>
    );
  }

  const renderList = (list: PortalNotification[], emptyMsg: string) =>
    list.length === 0 ? (
      <div className="flex flex-col items-center gap-2 py-12">
        <Bell className="h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">{emptyMsg}</p>
        <p className="text-xs text-muted-foreground/70">Du får varsler når det skjer noe viktig.</p>
      </div>
    ) : (
      <div className="space-y-2">
        {list.map((n) => (
          <NotificationRow key={n.id} n={n} onMarkAsRead={markAsRead} />
        ))}
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Varsler</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {unreadCount > 0 ? `${unreadCount} uleste varsler` : "Alle varsler er lest"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={markAllAsRead}>
            <Check className="h-3.5 w-3.5" />
            Merk alle som lest
          </Button>
        )}
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">Alle ({notifications.length})</TabsTrigger>
          <TabsTrigger value="new_report">{typeLabel.new_report} ({byType("new_report").length})</TabsTrigger>
          <TabsTrigger value="pending_approval">{typeLabel.pending_approval} ({byType("pending_approval").length})</TabsTrigger>
          <TabsTrigger value="new_message">{typeLabel.new_message} ({byType("new_message").length})</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="mt-4">
          {renderList(notifications, "Ingen varsler ennå.")}
        </TabsContent>
        <TabsContent value="new_report" className="mt-4">
          {renderList(byType("new_report"), "Ingen rapportvarsler.")}
        </TabsContent>
        <TabsContent value="pending_approval" className="mt-4">
          {renderList(byType("pending_approval"), "Ingen godkjenningsvarsler.")}
        </TabsContent>
        <TabsContent value="new_message" className="mt-4">
          {renderList(byType("new_message"), "Ingen meldingsvarsler.")}
        </TabsContent>
      </Tabs>
    </div>
  );
}
