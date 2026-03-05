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

function getAccent(item: ActivityItem) {
  if (item.type === "message" || item.action.includes("message")) return "bg-primary/10 text-primary";
  if (item.action.includes("ai") || item.type === "ai_action") return "bg-amber-500/10 text-amber-600";
  if (item.action.includes("task") || item.type === "task") return "bg-emerald-500/10 text-emerald-600";
  return "bg-muted/60 text-muted-foreground";
}

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <div className="text-center py-14">
        <div className="h-14 w-14 rounded-full bg-muted/40 flex items-center justify-center mx-auto mb-3">
          <Activity className="h-7 w-7 text-muted-foreground/25" />
        </div>
        <p className="text-sm text-muted-foreground/50 font-medium">Ingen nylig aktivitet</p>
      </div>
    );
  }

  // Show as a compact grid: 2 columns on desktop, 1 on mobile
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-start gap-3 rounded-xl bg-muted/20 border border-border/30 px-4 py-3 hover:bg-muted/40 transition-colors"
        >
          <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${getAccent(item)}`}>
            {getIcon(item)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] text-foreground leading-snug line-clamp-2">
              {item.title || item.description || item.action}
            </p>
            <p className="text-[11px] text-muted-foreground/50 mt-0.5">
              {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: nb })}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
