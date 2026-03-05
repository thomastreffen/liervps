import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { nb } from "date-fns/locale";
import {
  MessageSquare, Image, Sparkles, ListChecks, Activity,
  FileText, UserPlus, Zap, ChevronRight, Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ActivityItem {
  id: string;
  type: string;
  action: string;
  title: string | null;
  description: string | null;
  entity_type: string;
  entity_id: string;
  created_at: string;
  performed_by?: string | null;
}

type ActivityFilter = "all" | "mine" | "my_projects";

function getIcon(item: ActivityItem) {
  const a = item.action.toLowerCase();
  const t = item.type.toLowerCase();
  if (t === "message" || a.includes("message") || a.includes("melding")) return <MessageSquare className="h-4 w-4" />;
  if (a.includes("image") || a.includes("photo") || a.includes("bilde")) return <Image className="h-4 w-4" />;
  if (a.includes("ai") || t === "ai_action") return <Sparkles className="h-4 w-4" />;
  if (a.includes("task") || t === "task" || a.includes("oppgave")) return <ListChecks className="h-4 w-4" />;
  if (a.includes("offer") || a.includes("tilbud")) return <FileText className="h-4 w-4" />;
  if (a.includes("contact") || a.includes("kontakt") || a.includes("customer")) return <UserPlus className="h-4 w-4" />;
  if (a.includes("case") || a.includes("henvendelse") || a.includes("inquiry")) return <Zap className="h-4 w-4" />;
  return <Activity className="h-4 w-4" />;
}

function getAccent(item: ActivityItem): string {
  const a = item.action.toLowerCase();
  const t = item.type.toLowerCase();
  if (t === "message" || a.includes("message") || a.includes("melding")) return "bg-info/10 text-info";
  if (a.includes("ai") || t === "ai_action") return "bg-accent/10 text-accent";
  if (a.includes("task") || t === "task" || a.includes("oppgave")) return "bg-success/10 text-success";
  if (a.includes("offer") || a.includes("tilbud")) return "bg-primary/10 text-primary";
  if (a.includes("contact") || a.includes("kontakt")) return "bg-info/10 text-info";
  if (a.includes("image") || a.includes("bilde")) return "bg-accent/10 text-accent";
  if (a.includes("case") || a.includes("henvendelse")) return "bg-destructive/10 text-destructive";
  return "bg-muted/60 text-muted-foreground";
}

function getRoute(item: ActivityItem): string | null {
  const et = item.entity_type?.toLowerCase();
  const eid = item.entity_id;
  if (!eid) return null;
  if (et === "event" || et === "job" || et === "project") return `/projects/${eid}`;
  if (et === "lead") return `/leads/${eid}`;
  if (et === "offer") return `/offers`;
  if (et === "customer") return `/customers/${eid}`;
  if (et === "case") return `/inbox`;
  return null;
}

interface ActivityFeedProps {
  items: ActivityItem[];
  maxItems?: number;
  userId?: string;
  followedProjectIds?: string[];
}

export function ActivityFeed({ items, maxItems = 8, userId, followedProjectIds }: ActivityFeedProps) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<ActivityFilter>("all");

  let filtered = items;
  if (filter === "mine" && userId) {
    filtered = items.filter((i) => i.performed_by === userId);
  } else if (filter === "my_projects" && followedProjectIds && followedProjectIds.length > 0) {
    const pids = new Set(followedProjectIds);
    filtered = items.filter(
      (i) => (i.entity_type === "event" || i.entity_type === "job" || i.entity_type === "project") && pids.has(i.entity_id)
    );
  }

  const visible = filtered.slice(0, maxItems);

  const filterButtons: { key: ActivityFilter; label: string }[] = [
    { key: "all", label: "Alle" },
    { key: "mine", label: "Kun mine" },
    { key: "my_projects", label: "Mine prosjekter" },
  ];

  return (
    <div>
      {/* Filter bar */}
      <div className="flex items-center gap-1 px-4 pt-3 pb-1">
        <Filter className="h-3 w-3 text-muted-foreground/40 mr-1" />
        {filterButtons.map((fb) => (
          <button
            key={fb.key}
            onClick={() => setFilter(fb.key)}
            className={`text-[11px] px-2.5 py-1 rounded-full font-medium transition-colors ${
              filter === fb.key
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/50"
            }`}
          >
            {fb.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="text-center py-12">
          <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-2 border-2 border-border/40">
            <Activity className="h-5 w-5 text-muted-foreground/25" />
          </div>
          <p className="text-sm text-muted-foreground/50 font-medium">Ingen aktivitet å vise</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-4 pt-2">
          {visible.map((item) => {
            const route = getRoute(item);
            return (
              <button
                key={item.id}
                onClick={() => route && navigate(route)}
                disabled={!route}
                className="flex items-start gap-3 rounded-xl border border-border/40 bg-card px-4 py-3
                  hover:border-primary/20 hover:bg-primary/[0.02] transition-all text-left group
                  disabled:cursor-default cursor-pointer"
              >
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${getAccent(item)}`}>
                  {getIcon(item)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-foreground leading-snug line-clamp-2 font-medium group-hover:text-primary transition-colors">
                    {item.title || item.description || item.action}
                  </p>
                  <p className="text-[11px] text-muted-foreground/50 mt-1">
                    {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: nb })}
                  </p>
                </div>
                {route && (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/15 group-hover:text-primary/40 shrink-0 mt-1" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {filtered.length > maxItems && (
        <div className="px-4 pb-4 pt-1">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground hover:text-primary"
            onClick={() => navigate("/admin/data-integrity")}
          >
            Se all aktivitet →
          </Button>
        </div>
      )}
    </div>
  );
}
