import { formatDistanceToNow } from "date-fns";
import { nb } from "date-fns/locale";
import { MessageSquare, Image, Sparkles, ListChecks, Activity } from "lucide-react";

export interface ActivityItem {
  id: string;
  type: string;
  action: string;
  title: string | null;
  description: string | null;
  entity_type: string;
  entity_id: string;
  created_at: string;
}

function getIcon(item: ActivityItem) {
  if (item.type === "message" || item.action.includes("message"))
    return <MessageSquare className="h-3.5 w-3.5" />;
  if (item.action.includes("image") || item.action.includes("photo"))
    return <Image className="h-3.5 w-3.5" />;
  if (item.action.includes("ai") || item.type === "ai_action")
    return <Sparkles className="h-3.5 w-3.5" />;
  if (item.action.includes("task") || item.type === "task")
    return <ListChecks className="h-3.5 w-3.5" />;
  return <Activity className="h-3.5 w-3.5" />;
}

function getAccent(item: ActivityItem): string {
  if (item.type === "message" || item.action.includes("message")) return "bg-info/10 text-info";
  if (item.action.includes("ai") || item.type === "ai_action") return "bg-accent/10 text-accent";
  if (item.action.includes("task") || item.type === "task") return "bg-success/10 text-success";
  return "bg-muted/60 text-muted-foreground";
}

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3 border-2 border-border/40">
          <Activity className="h-7 w-7 text-muted-foreground/25" />
        </div>
        <p className="text-sm text-muted-foreground/50 font-medium">Ingen nylig aktivitet</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-start gap-3 rounded-xl border-2 border-border/40 bg-card px-4 py-3.5 hover:border-primary/20 transition-colors"
        >
          <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${getAccent(item)}`}>
            {getIcon(item)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] text-foreground leading-snug line-clamp-2 font-medium">
              {item.title || item.description || item.action}
            </p>
            <p className="text-[11px] text-muted-foreground/50 mt-1">
              {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: nb })}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
