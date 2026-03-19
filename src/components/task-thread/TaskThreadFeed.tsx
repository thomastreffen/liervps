import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { Loader2, MessageSquare } from "lucide-react";
import type { TaskMessage } from "@/hooks/useTaskThread";
import { TaskThreadMessageItem } from "./TaskThreadMessageItem";
import { TaskThreadSystemEventItem } from "./TaskThreadSystemEventItem";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { ActionType } from "./MessageActionMenu";

interface Props {
  messages: TaskMessage[];
  loading: boolean;
  currentUserId: string | null;
  lastReadAt: string | null;
  onReply?: (message: TaskMessage) => void;
  onCreateAction?: (type: ActionType, message: TaskMessage) => void;
}

export function TaskThreadFeed({ messages, loading, currentUserId, lastReadAt, onReply, onCreateAction }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const unreadRef = useRef<HTMLDivElement>(null);
  const [hasScrolledToUnread, setHasScrolledToUnread] = useState(false);
  const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set());

  // Find first unread message index
  const firstUnreadIndex = lastReadAt
    ? messages.findIndex(
        (m) =>
          m.message_type !== "system_event" &&
          m.author_user_id !== currentUserId &&
          new Date(m.created_at) > new Date(lastReadAt)
      )
    : -1;

  // Scroll to first unread on initial load, or bottom if all read
  useEffect(() => {
    if (loading || messages.length === 0 || hasScrolledToUnread) return;

    if (firstUnreadIndex > 0 && unreadRef.current) {
      unreadRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      // Highlight unread messages briefly
      const unreadIds = new Set(
        messages.slice(firstUnreadIndex).filter(m => m.message_type !== "system_event" && m.author_user_id !== currentUserId).map(m => m.id)
      );
      setHighlightIds(unreadIds);
      setTimeout(() => setHighlightIds(new Set()), 3000);
    } else {
      bottomRef.current?.scrollIntoView({ behavior: "auto" });
    }
    setHasScrolledToUnread(true);
  }, [loading, messages.length, hasScrolledToUnread, firstUnreadIndex]);

  // Auto-scroll to bottom for new messages after initial load
  const prevCountRef = useRef(messages.length);
  useEffect(() => {
    if (hasScrolledToUnread && messages.length > prevCountRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevCountRef.current = messages.length;
  }, [messages.length, hasScrolledToUnread]);

  // Scroll to a specific message (for quote click)
  const scrollToMessage = useCallback((messageId: string) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-primary/30");
      setTimeout(() => el.classList.remove("ring-2", "ring-primary/30"), 2000);
    }
  }, []);

  // Build linked actions map: source_message_id → action info
  const linkedActionsMap = useMemo(() => {
    const map = new Map<string, { event_type: string; title: string; created_id?: string }>();
    for (const msg of messages) {
      if (msg.message_type === "system_event") {
        const meta = msg.metadata as any;
        if (meta?.source_message_id && meta?.event_type) {
          map.set(meta.source_message_id, {
            event_type: meta.event_type,
            title: meta.title || meta.details || "",
            created_id: meta.created_id,
          });
        }
      }
    }
    return map;
  }, [messages]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center px-4">
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-3">
          <MessageSquare className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">
          Ingen meldinger ennå
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Bruk feltet under for å starte en tråd
        </p>
      </div>
    );
  }


  return (
    <ScrollArea className="flex-1">
      <div className="space-y-4 p-4">
        {messages.map((msg, idx) => {
          const showUnreadDivider = idx === firstUnreadIndex && firstUnreadIndex > 0;

          return (
            <div key={msg.id}>
              {showUnreadDivider && (
                <div ref={unreadRef} className="flex items-center gap-3 py-2 mb-3">
                  <div className="h-px flex-1 bg-primary/30" />
                  <span className="text-[11px] font-medium text-primary shrink-0">
                    Nye meldinger
                  </span>
                  <div className="h-px flex-1 bg-primary/30" />
                </div>
              )}

              <div
                id={`msg-${msg.id}`}
                className={cn(
                  "transition-all duration-500 rounded-lg",
                  highlightIds.has(msg.id) && "bg-primary/5",
                  msg.priority === "urgent" && highlightIds.has(msg.id) && "bg-destructive/10",
                  msg.priority === "important" && highlightIds.has(msg.id) && "bg-amber-50 dark:bg-amber-950/20"
                )}
              >
                {msg.message_type === "system_event" ? (
                  <TaskThreadSystemEventItem message={msg} />
                ) : (
                  <TaskThreadMessageItem
                    message={msg}
                    isOwnMessage={msg.author_user_id === currentUserId}
                    onReply={onReply}
                    onScrollToMessage={scrollToMessage}
                    allMessages={messages}
                    onCreateAction={onCreateAction}
                    linkedAction={linkedActionsMap.get(msg.id) || null}
                  />
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
