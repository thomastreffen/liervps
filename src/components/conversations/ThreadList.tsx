import { useConversationThreads, type ConversationThread } from "@/hooks/useConversations";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { nb } from "date-fns/locale";
import { MessageSquare, Mail, Loader2, Plus, ChevronRight, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ThreadListProps {
  projectId: string;
}

export function ThreadList({ projectId }: ThreadListProps) {
  const { threads, loading } = useConversationThreads(projectId);
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* New conversation button */}
      <Button
        onClick={() => navigate(`/projects/${projectId}/conversations/new`)}
        className="w-full gap-2 rounded-xl h-11 text-sm font-semibold"
        style={{ backgroundColor: "hsl(var(--success))", color: "white" }}
      >
        <Plus className="h-4 w-4" />
        Start ny samtale
      </Button>

      {threads.length === 0 ? (
        <div className="text-center py-20 space-y-3">
          <MessageSquare className="h-10 w-10 text-muted-foreground/30 mx-auto" />
          <p className="text-muted-foreground text-sm">Ingen samtaler ennå.</p>
          <p className="text-muted-foreground/60 text-xs">
            Start en samtale for å diskutere prosjektet med teamet.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border/40">
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

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 w-full text-left px-3 py-4 transition-colors rounded-lg",
        "hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isEmail ? "hover:bg-accent/[0.06]" : "hover:bg-primary/[0.04]"
      )}
    >
      {/* Icon */}
      <div className={cn(
        "mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl shrink-0",
        isEmail ? "bg-accent/10 text-accent" : "bg-primary/10 text-primary"
      )}>
        {isEmail ? <Mail className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold text-foreground truncate">{thread.title}</h4>
          <Badge
            variant="outline"
            className={cn(
              "text-[9px] px-1.5 py-0 shrink-0",
              isEmail ? "border-accent/30 text-accent" : "border-primary/30 text-primary"
            )}
          >
            {isEmail ? "E-post" : "Samtale"}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {thread.last_author_name && (
            <span className="font-medium text-foreground/70">{thread.last_author_name}</span>
          )}
          <span>·</span>
          <span>{thread.post_count} innlegg</span>
          <span>·</span>
          <span>{formatDistanceToNow(new Date(thread.last_activity_at), { addSuffix: true, locale: nb })}</span>
          {(thread as any).participants_only && (
            <>
              <span>·</span>
              <span className="inline-flex items-center gap-0.5 text-warning">
                <Lock className="h-2.5 w-2.5" />
                Lukket
              </span>
            </>
          )}
        </div>
      </div>

      <ChevronRight className="h-4 w-4 text-muted-foreground/30 mt-2 shrink-0" />
    </button>
  );
}
