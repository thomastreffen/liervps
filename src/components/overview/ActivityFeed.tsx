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

const iconMap: Record<string, React.ReactNode> = {
  message: <MessageSquare className="h-3.5 w-3.5" />,
  image: <Image className="h-3.5 w-3.5" />,
  ai: <Sparkles className="h-3.5 w-3.5" />,
  task: <ListChecks className="h-3.5 w-3.5" />,
};

function getIcon(item: ActivityItem) {
  if (item.type === "message" || item.action.includes("message")) return iconMap.message;
  if (item.action.includes("image") || item.action.includes("photo")) return iconMap.image;
  if (item.action.includes("ai") || item.type === "ai_action") return iconMap.ai;
  if (item.action.includes("task") || item.type === "task") return iconMap.task;
  return <Activity className="h-3.5 w-3.5" />;
}

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <div className="text-center py-10">
        <Activity className="h-7 w-7 text-muted-foreground/30 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground/60">Ingen nylig aktivitet</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-start gap-3 rounded-xl px-3.5 py-2.5"
        >
          <div className="h-7 w-7 rounded-lg bg-muted/60 flex items-center justify-center shrink-0 mt-0.5 text-muted-foreground">
            {getIcon(item)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-foreground">
              {item.title || item.description || item.action}
            </p>
            <p className="text-[11px] text-muted-foreground/60">
              {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: nb })}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
