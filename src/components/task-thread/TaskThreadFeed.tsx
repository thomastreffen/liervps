import { useRef, useEffect } from "react";
import { Loader2, MessageSquare } from "lucide-react";
import type { TaskMessage } from "@/hooks/useTaskThread";
import { TaskThreadMessageItem } from "./TaskThreadMessageItem";
import { TaskThreadSystemEventItem } from "./TaskThreadSystemEventItem";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
  messages: TaskMessage[];
  loading: boolean;
  currentUserId: string | null;
}

export function TaskThreadFeed({ messages, loading, currentUserId }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

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
          Ingen meldinger på denne oppgaven ennå
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Bruk feltet under for å starte en tråd
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="space-y-3 p-3">
        {messages.map((msg) => {
          if (msg.message_type === "system_event") {
            return <TaskThreadSystemEventItem key={msg.id} message={msg} />;
          }
          return (
            <TaskThreadMessageItem
              key={msg.id}
              message={msg}
              isOwnMessage={msg.author_user_id === currentUserId}
            />
          );
        })}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
