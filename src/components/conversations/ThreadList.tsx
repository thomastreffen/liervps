import { useState } from "react";
import { useConversationThreads, type ConversationThread, type ThreadFilter } from "@/hooks/useConversations";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { nb } from "date-fns/locale";
import {
  MessageSquare, Mail, Loader2, Plus, ChevronRight, Lock,
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
          style={{ backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
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
              "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap",
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
        <div className="space-y-2">
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
  const isEmail = thread.thread_type === "email_thread";
  const isClosed = thread.status === "closed";
  const category = thread.thread_category;

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 w-full text-left px-4 py-4 transition-all rounded-[10px] border",
        "bg-card hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isClosed
          ? "border-border/30 opacity-70"
          : "border-border/40 hover:border-border/60"
      )}
    >
      {/* Icon */}
      <div className={cn(
        "mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl shrink-0",
        category === "risk"
          ? "bg-destructive/10 text-destructive"
          : category === "change"
          ? "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
          : isEmail
          ? "bg-accent/10 text-accent"
          : "bg-primary/10 text-primary"
      )}>
        {category === "risk" ? (
          <AlertTriangle className="h-4 w-4" />
        ) : category === "change" ? (
          <Repeat className="h-4 w-4" />
        ) : isEmail ? (
          <Mail className="h-4 w-4" />
        ) : (
          <MessageSquare className="h-4 w-4" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className={cn(
            "text-sm font-semibold truncate",
            isClosed ? "text-muted-foreground" : "text-foreground"
          )}>
            {thread.title}
          </h4>

          {/* Type badge */}
          <Badge
            variant="outline"
            className={cn(
              "text-[9px] px-1.5 py-0 shrink-0",
              isEmail ? "border-accent/30 text-accent" : "border-primary/30 text-primary"
            )}
          >
            {isEmail ? "E-post" : "Samtale"}
          </Badge>

          {/* Category badge */}
          {category === "risk" && (
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-destructive/30 text-destructive gap-0.5">
              <AlertTriangle className="h-2.5 w-2.5" />
              Risiko
            </Badge>
          )}
          {category === "change" && (
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-orange-400/30 text-orange-600 dark:text-orange-400 gap-0.5">
              <Repeat className="h-2.5 w-2.5" />
              Endring
            </Badge>
          )}

          {/* Decision badge */}
          {thread.is_formal_decision && (
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-primary/30 text-primary gap-0.5">
              <Gavel className="h-2.5 w-2.5" />
              Beslutning
            </Badge>
          )}

          {/* Closed badge */}
          {isClosed && (
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-muted-foreground/30 text-muted-foreground gap-0.5">
              <XCircle className="h-2.5 w-2.5" />
              Lukket
            </Badge>
          )}

          {/* Participants only */}
          {thread.participants_only && !isClosed && (
            <Lock className="h-3 w-3 text-muted-foreground/50 shrink-0" />
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {thread.last_author_name && (
            <span className="font-medium text-foreground/70">{thread.last_author_name}</span>
          )}
          <span>·</span>
          <span>{thread.post_count} innlegg</span>
          <span>·</span>
          <span>{formatDistanceToNow(new Date(thread.last_activity_at), { addSuffix: true, locale: nb })}</span>
        </div>
      </div>

      <ChevronRight className="h-4 w-4 text-muted-foreground/30 mt-2 shrink-0" />
    </button>
  );
}
