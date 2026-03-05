import { type ConversationPost } from "@/hooks/useConversations";
import { Reply } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReplyPreviewProps {
  replyToPost: ConversationPost;
  isOwn: boolean;
  onScrollToPost?: (postId: string) => void;
}

export function ReplyPreview({ replyToPost, isOwn, onScrollToPost }: ReplyPreviewProps) {
  return (
    <button
      onClick={() => onScrollToPost?.(replyToPost.id)}
      className={cn(
        "flex items-center gap-2 mb-1 px-3 py-1.5 rounded-lg text-[11px] cursor-pointer transition-colors max-w-full",
        "border-l-2",
        isOwn
          ? "bg-primary/10 border-primary/40 text-primary-foreground/70 hover:bg-primary/20"
          : "bg-muted/60 border-primary/40 text-muted-foreground hover:bg-muted/80"
      )}
    >
      <Reply className="h-3 w-3 shrink-0 rotate-180 text-primary/60" />
      <div className="min-w-0 text-left">
        <span className="font-semibold block truncate text-foreground/70">
          {replyToPost.author_name || replyToPost.from_name || "Ukjent"}
        </span>
        <span className="block truncate opacity-70">
          {(replyToPost as any).body_clean || replyToPost.body_text || ""}
        </span>
      </div>
    </button>
  );
}
