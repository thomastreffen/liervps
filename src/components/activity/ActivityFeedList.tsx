import { formatDistanceToNow, isPast, isToday, parseISO } from "date-fns";
import { nb } from "date-fns/locale";
import {
  MessageSquare, CheckCircle2, Mail, CalendarDays, Phone,
  FileText, AlertTriangle, ArrowRightLeft, StickyNote, Activity,
  Clock, ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ActivityEntry } from "@/components/entity/ActivityTimeline";

/* ── Icon mapping ── */
const TYPE_ICONS: Record<string, React.ReactNode> = {
  email: <Mail className="h-4 w-4 text-primary" />,
  meeting: <CalendarDays className="h-4 w-4 text-status-scheduled" />,
  call: <Phone className="h-4 w-4 text-success" />,
  note: <StickyNote className="h-4 w-4 text-muted-foreground" />,
  task: <CheckCircle2 className="h-4 w-4 text-success" />,
  document: <FileText className="h-4 w-4 text-primary" />,
  status_change: <ArrowRightLeft className="h-4 w-4 text-accent" />,
  message: <MessageSquare className="h-4 w-4 text-primary" />,
};

const TYPE_LABELS: Record<string, string> = {
  email: "E-post",
  meeting: "Møte",
  call: "Samtale",
  note: "Notat",
  task: "Oppgave",
  document: "Dokument",
  status_change: "Status",
  message: "Melding",
};

function getAccentClass(type: string): string {
  switch (type) {
    case "email": return "bg-primary/10 text-primary";
    case "meeting": return "bg-accent/10 text-accent";
    case "task": return "bg-success/10 text-success";
    case "status_change": return "bg-accent/10 text-accent";
    case "note": return "bg-muted text-muted-foreground";
    default: return "bg-muted text-muted-foreground";
  }
}

/* ── Sections: overdue → upcoming → history ── */
function categorise(a: ActivityEntry): "overdue" | "upcoming" | "history" {
  const meta = a.metadata as Record<string, any> | undefined;
  const scheduledDate = meta?.scheduled_date || meta?.next_action_date;
  if (!scheduledDate) return "history";
  const d = parseISO(scheduledDate);
  if (isPast(d) && !isToday(d)) return "overdue";
  return "upcoming";
}

interface ActivityFeedListProps {
  activities: ActivityEntry[];
  maxItems?: number;
  showSections?: boolean;
  onItemClick?: (activity: ActivityEntry) => void;
  emptyMessage?: string;
}

export function ActivityFeedList({
  activities,
  maxItems,
  showSections = false,
  onItemClick,
  emptyMessage = "Ingen aktivitet ennå",
}: ActivityFeedListProps) {
  const items = maxItems ? activities.slice(0, maxItems) : activities;

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="h-12 w-12 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto mb-3">
          <Activity className="h-5 w-5 text-muted-foreground/25" />
        </div>
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  if (showSections) {
    const overdue = items.filter(a => categorise(a) === "overdue");
    const upcoming = items.filter(a => categorise(a) === "upcoming");
    const history = items.filter(a => categorise(a) === "history");

    return (
      <div className="space-y-4">
        {overdue.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2 px-1">
              <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-destructive">Forfalt</span>
            </div>
            <FeedItems items={overdue} onItemClick={onItemClick} highlight="destructive" />
          </div>
        )}
        {upcoming.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2 px-1">
              <Clock className="h-3.5 w-3.5 text-primary" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">Kommende</span>
            </div>
            <FeedItems items={upcoming} onItemClick={onItemClick} />
          </div>
        )}
        {history.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2 px-1">
              <Activity className="h-3.5 w-3.5 text-muted-foreground/50" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">Historikk</span>
            </div>
            <FeedItems items={history} onItemClick={onItemClick} />
          </div>
        )}
      </div>
    );
  }

  return <FeedItems items={items} onItemClick={onItemClick} />;
}

/* ── Render items ── */
function FeedItems({
  items,
  onItemClick,
  highlight,
}: {
  items: ActivityEntry[];
  onItemClick?: (a: ActivityEntry) => void;
  highlight?: "destructive";
}) {
  return (
    <div className="space-y-1">
      {items.map(item => (
        <button
          key={item.id}
          onClick={() => onItemClick?.(item)}
          disabled={!onItemClick}
          className={cn(
            "flex items-start gap-3 w-full rounded-xl px-3.5 py-3 text-left transition-all",
            onItemClick && "hover:bg-muted/40 cursor-pointer",
            !onItemClick && "cursor-default",
            highlight === "destructive" && "bg-destructive/[0.04] border border-destructive/20"
          )}
        >
          <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5", getAccentClass(item.type))}>
            {TYPE_ICONS[item.type] || <Activity className="h-4 w-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider font-medium">
                {TYPE_LABELS[item.type] || item.type}
              </span>
              <span className="text-[11px] text-muted-foreground/40 ml-auto shrink-0">
                {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: nb })}
              </span>
            </div>
            <p className="text-[13px] text-foreground leading-snug mt-0.5 font-medium">
              {item.title || item.description || item.action}
            </p>
            {item.description && item.title && item.title !== item.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>
            )}
            {item.performer_name && (
              <p className="text-[10px] text-muted-foreground/40 mt-1">{item.performer_name}</p>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
