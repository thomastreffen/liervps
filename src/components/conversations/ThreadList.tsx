import { useState } from "react";
import { useConversationThreads, type ConversationThread, type ThreadFilter } from "@/hooks/useConversations";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { nb } from "date-fns/locale";
import {
  MessageSquare, Mail, Loader2, Plus, Lock,
  AlertTriangle, Repeat, Gavel, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ThreadListProps {
  projectId: string;
}

const FILTERS: { key: ThreadFilter; label: string }[] = [
  { key: "all", label: "Alle" },
  { key: "risk", label: "Risiko" },
  { key: "change", label: "Endring" },
  { key: "decision", label: "Beslutning" },
  { key: "closed", label: "Lukkede" },
];

const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700", "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700", "bg-rose-100 text-rose-700",
  "bg-purple-100 text-purple-700", "bg-teal-100 text-teal-700",
];

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

export function ThreadList({ projectId }: ThreadListProps) {
  const [filter, setFilter] = useState<ThreadFilter>("all");
  const { threads, loading } = useConversationThreads(projectId, filter);
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <Button
          onClick={() => navigate(`/projects/${projectId}/conversations/new`)}
          className="gap-2 rounded-xl h-10 text-sm font-semibold shrink-0"
        >
          <Plus className="h-4 w-4" />
          Ny samtale
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer",
              filter === f.key
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted/60"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {threads.length === 0 ? (
        <div className="text-center py-20 space-y-3">
          <MessageSquare className="h-10 w-10 text-muted-foreground/30 mx-auto" />
          <p className="text-muted-foreground text-sm">
            {filter === "all" ? "Ingen samtaler ennå." : "Ingen treff for dette filteret."}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {threads.map((thread) => (
            <ThreadRow
              key={thread.id}
              thread={thread}
              onClick={() => navigate(`/projects/${projectId}/conversations/${thread.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ThreadRow({ thread, onClick }: { thread: ConversationThread; onClick: () => void }) {
  const isClosed = thread.status === "closed";
  const category = thread.thread_category;
  const authorName = thread.last_author_name || "";
  const firstName = authorName.split(" ")[0] || "";
  const color = avatarColor(authorName || thread.title);
  const ini = initials(authorName || thread.title);

  // Derive time display
  const timeAgo = formatDistanceToNow(new Date(thread.last_activity_at), { addSuffix: false, locale: nb });

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 w-full text-left px-4 py-3.5 transition-all rounded-xl cursor-pointer",
        "hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isClosed && "opacity-60"
      )}
    >
      {/* Avatar */}
      <div className={cn(
        "flex h-10 w-10 items-center justify-center rounded-full text-[12px] font-bold shrink-0",
        color
      )}>
        {ini}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <h4 className={cn(
              "text-sm font-semibold truncate",
              isClosed ? "text-muted-foreground" : "text-foreground"
            )}>
              {thread.title}
            </h4>
            {thread.participants_only && !isClosed && (
              <Lock className="h-3 w-3 text-muted-foreground/50 shrink-0" />
            )}
            {/* Category icons */}
            {category === "risk" && <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />}
            {category === "change" && <Repeat className="h-3 w-3 text-orange-500 shrink-0" />}
            {thread.is_formal_decision && <Gavel className="h-3 w-3 text-primary shrink-0" />}
            {isClosed && <XCircle className="h-3 w-3 text-muted-foreground shrink-0" />}
          </div>
          <span className="text-[11px] text-muted-foreground/60 shrink-0 whitespace-nowrap">{timeAgo}</span>
        </div>

        {/* Last message preview */}
        <p className="text-[13px] text-muted-foreground truncate mt-0.5">
          {firstName ? (
            <>
              <span className="text-foreground/70 font-medium">{firstName}:</span>{" "}
              <span>{thread.post_count} melding{thread.post_count !== 1 ? "er" : ""}</span>
            </>
          ) : (
            <span>{thread.post_count} melding{thread.post_count !== 1 ? "er" : ""}</span>
          )}
        </p>
      </div>

      {/* Unread dot placeholder - future: use real unread state */}
      {thread.post_count > 0 && !isClosed && (
        <div className="flex items-center shrink-0">
          <Badge variant="secondary" className="h-5 min-w-[20px] text-[10px] font-bold px-1.5 rounded-full bg-primary/10 text-primary border-0">
            {thread.post_count}
          </Badge>
        </div>
      )}
    </button>
  );
}
