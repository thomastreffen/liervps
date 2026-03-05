import { useState } from "react";
import { type ConversationPost } from "@/hooks/useConversations";
import {
  Reply, Smile, MoreHorizontal, Pin, ListTodo, X, AlertTriangle, FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const REACTION_EMOJIS = ["👍", "✔️", "⚠️", "🔥", "👀"];

interface MessageActionsProps {
  post: ConversationPost;
  isOwn: boolean;
  isPinned: boolean;
  onReply: (post: ConversationPost) => void;
  onCreateTask: (post: ConversationPost) => void;
  onPinToggle: (post: ConversationPost) => void;
  onToggleReaction: (postId: string, emoji: string) => void;
  onAddDocument?: (post: ConversationPost) => void;
}

export function MessageActions({
  post, isOwn, isPinned, onReply, onCreateTask, onPinToggle, onToggleReaction, onAddDocument,
}: MessageActionsProps) {
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  return (
    <>
      {/* Hover action bar */}
      <div className={cn(
        "absolute -top-3 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 z-10",
        "bg-card border border-border/40 rounded-lg shadow-sm px-1 py-0.5",
        isOwn ? "right-0" : "left-0"
      )}>
        <button
          onClick={() => setShowReactionPicker(!showReactionPicker)}
          className="h-6 w-6 rounded-md flex items-center justify-center hover:bg-muted/80 transition-colors cursor-pointer"
          title="Reaksjon"
        >
          <Smile className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <button
          onClick={() => onReply(post)}
          className="h-6 w-6 rounded-md flex items-center justify-center hover:bg-muted/80 transition-colors cursor-pointer"
          title="Svar"
        >
          <Reply className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="h-6 w-6 rounded-md flex items-center justify-center hover:bg-muted/80 transition-colors cursor-pointer">
              <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={isOwn ? "end" : "start"} className="w-48">
            <DropdownMenuItem onClick={() => onReply(post)} className="gap-2 text-xs">
              <Reply className="h-3.5 w-3.5" /> Svar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onCreateTask(post)} className="gap-2 text-xs">
              <ListTodo className="h-3.5 w-3.5" /> Opprett oppgave
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onPinToggle(post)} className="gap-2 text-xs">
              <Pin className="h-3.5 w-3.5" /> {isPinned ? "Løsne" : "Fest melding"}
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 text-xs text-amber-600">
              <AlertTriangle className="h-3.5 w-3.5" /> Registrer avvik
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAddDocument?.(post)} className="gap-2 text-xs">
              <FileText className="h-3.5 w-3.5" /> Legg til dokument
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Reaction picker popup */}
      {showReactionPicker && (
        <div className={cn(
          "absolute z-20 flex gap-0.5 bg-card border border-border/40 rounded-lg px-1.5 py-1 shadow-lg -top-11",
          isOwn ? "right-0" : "left-0"
        )}>
          {REACTION_EMOJIS.map(emoji => (
            <button
              key={emoji}
              onClick={() => {
                onToggleReaction(post.id, emoji);
                setShowReactionPicker(false);
              }}
              className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted/80 transition-colors cursor-pointer text-sm hover:scale-110"
            >
              {emoji}
            </button>
          ))}
          <button
            onClick={() => setShowReactionPicker(false)}
            className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted/80 cursor-pointer"
          >
            <X className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>
      )}
    </>
  );
}
