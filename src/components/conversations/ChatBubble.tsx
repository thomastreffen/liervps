import { useState, useEffect } from "react";
import { type ConversationPost, type ConversationAttachment } from "@/hooks/useConversations";
import { type ReactionSummary } from "@/hooks/useMessageReactions";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import {
  ChevronDown, ExternalLink, FileText, Paperclip,
  Reply, MoreHorizontal, Pin, ListTodo, Smile, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const REACTION_EMOJIS = ["👍", "✔️", "⚠️", "🔥", "👀"];

interface ChatBubbleProps {
  post: ConversationPost;
  isOwn: boolean;
  isFirst: boolean;
  isLast: boolean;
  reactions: ReactionSummary[];
  onToggleReaction: (postId: string, emoji: string) => void;
  onReply: (post: ConversationPost) => void;
  onCreateTask: (post: ConversationPost) => void;
  onPinToggle: (post: ConversationPost) => void;
  replyToPost?: ConversationPost | null;
  onScrollToPost?: (postId: string) => void;
}

export function ChatBubble({
  post, isOwn, isFirst, isLast,
  reactions, onToggleReaction, onReply, onCreateTask, onPinToggle,
  replyToPost, onScrollToPost,
}: ChatBubbleProps) {
  const [showRaw, setShowRaw] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  const isEmail = post.post_type === "email";
  const cleanBody = (post as any).body_clean || post.body_text || "";
  const rawBody = (post as any).body_raw || post.body_html || "";
  const hasRawContent = isEmail && rawBody && rawBody !== cleanBody;
  const isPinned = (post as any).is_pinned === true;

  return (
    <div
      id={`post-${post.id}`}
      className={cn("mb-0.5 max-w-full group relative")}
    >
      {/* Reply quote */}
      {replyToPost && (
        <button
          onClick={() => onScrollToPost?.(replyToPost.id)}
          className={cn(
            "flex items-start gap-1.5 mb-1 px-3 py-1.5 rounded-lg text-[11px] cursor-pointer transition-colors max-w-full",
            isOwn
              ? "bg-primary/20 text-primary-foreground/70 hover:bg-primary/30"
              : "bg-muted/80 text-muted-foreground hover:bg-muted"
          )}
        >
          <Reply className="h-3 w-3 mt-0.5 shrink-0 rotate-180" />
          <div className="min-w-0">
            <span className="font-semibold block truncate">
              {replyToPost.author_name || replyToPost.from_name || "Ukjent"}
            </span>
            <span className="block truncate opacity-80">
              {(replyToPost as any).body_clean || replyToPost.body_text || ""}
            </span>
          </div>
        </button>
      )}

      {/* Bubble */}
      <div
        className={cn(
          "px-3.5 py-2 text-[13px] leading-relaxed inline-block max-w-full relative",
          isOwn
            ? "bg-primary text-primary-foreground rounded-2xl rounded-br-md"
            : "bg-muted/60 text-foreground rounded-2xl rounded-bl-md",
          isOwn && !isFirst && "rounded-tr-md",
          isOwn && !isLast && "rounded-br-2xl",
          !isOwn && !isFirst && "rounded-tl-md",
          !isOwn && !isLast && "rounded-bl-2xl",
          isPinned && "ring-1 ring-amber-400/50",
        )}
      >
        {isPinned && (
          <Pin className="h-2.5 w-2.5 text-amber-500 absolute -top-1 -right-1" />
        )}

        {cleanBody && (
          <p className="whitespace-pre-wrap break-words">{cleanBody}</p>
        )}

        {hasRawContent && (
          <div className="mt-1">
            <button
              onClick={() => setShowRaw(!showRaw)}
              className={cn(
                "inline-flex items-center gap-1 text-[10px] transition-colors cursor-pointer",
                isOwn ? "text-primary-foreground/60 hover:text-primary-foreground/90" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ChevronDown className={cn("h-3 w-3 transition-transform", showRaw && "rotate-180")} />
              {showRaw ? "Skjul e-posthistorikk" : "Vis e-posthistorikk"}
            </button>
            {showRaw && (
              <div className="mt-2 p-3 rounded-lg bg-background/50 border border-border/30 overflow-x-auto">
                <div
                  className="prose prose-xs max-w-none text-foreground/70 text-[11px] [&_p]:my-0.5 [&_a]:text-primary [&_blockquote]:border-l-2 [&_blockquote]:border-muted-foreground/20 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground"
                  dangerouslySetInnerHTML={{ __html: rawBody }}
                />
              </div>
            )}
          </div>
        )}

        {isEmail && post.outlook_weblink && (
          <a
            href={post.outlook_weblink}
            target="_blank" rel="noopener noreferrer"
            className={cn(
              "inline-flex items-center gap-1 mt-1 text-[10px] transition-colors",
              isOwn ? "text-primary-foreground/60 hover:text-primary-foreground/90" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <ExternalLink className="h-2.5 w-2.5" />
            Åpne i Outlook
          </a>
        )}
      </div>

      {/* Hover actions */}
      <div className={cn(
        "absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 -mt-3 z-10",
        isOwn ? "right-0" : "left-10"
      )}>
        <button
          onClick={() => setShowReactionPicker(!showReactionPicker)}
          className="h-6 w-6 rounded-full bg-card border border-border/40 shadow-sm flex items-center justify-center hover:bg-muted/80 transition-colors cursor-pointer"
        >
          <Smile className="h-3 w-3 text-muted-foreground" />
        </button>
        <button
          onClick={() => onReply(post)}
          className="h-6 w-6 rounded-full bg-card border border-border/40 shadow-sm flex items-center justify-center hover:bg-muted/80 transition-colors cursor-pointer"
        >
          <Reply className="h-3 w-3 text-muted-foreground" />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="h-6 w-6 rounded-full bg-card border border-border/40 shadow-sm flex items-center justify-center hover:bg-muted/80 transition-colors cursor-pointer">
              <MoreHorizontal className="h-3 w-3 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={isOwn ? "end" : "start"} className="w-44">
            <DropdownMenuItem onClick={() => onReply(post)} className="gap-2 text-xs">
              <Reply className="h-3.5 w-3.5" /> Svar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onCreateTask(post)} className="gap-2 text-xs">
              <ListTodo className="h-3.5 w-3.5" /> Opprett oppgave
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onPinToggle(post)} className="gap-2 text-xs">
              <Pin className="h-3.5 w-3.5" /> {isPinned ? "Løsne" : "Fest melding"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Reaction picker popup */}
      {showReactionPicker && (
        <div className={cn(
          "absolute z-20 flex gap-1 bg-card border border-border/40 rounded-full px-2 py-1 shadow-lg -mt-1",
          isOwn ? "right-0" : "left-10"
        )}>
          {REACTION_EMOJIS.map(emoji => (
            <button
              key={emoji}
              onClick={() => {
                onToggleReaction(post.id, emoji);
                setShowReactionPicker(false);
              }}
              className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-muted/80 transition-colors cursor-pointer text-sm"
            >
              {emoji}
            </button>
          ))}
          <button
            onClick={() => setShowReactionPicker(false)}
            className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-muted/80 cursor-pointer"
          >
            <X className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>
      )}

      {/* Reactions display */}
      {reactions.length > 0 && (
        <div className={cn("flex flex-wrap gap-1 mt-1", isOwn ? "justify-end" : "justify-start")}>
          {reactions.map(r => (
            <button
              key={r.emoji}
              onClick={() => onToggleReaction(post.id, r.emoji)}
              className={cn(
                "inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full border transition-colors cursor-pointer",
                r.myReaction
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "bg-muted/40 border-border/30 text-muted-foreground hover:bg-muted/60"
              )}
            >
              <span>{r.emoji}</span>
              <span className="text-[10px] font-medium">{r.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Attachments */}
      {post.attachments && post.attachments.length > 0 && (
        <div className={cn("flex flex-wrap gap-2 mt-1", isOwn ? "justify-end" : "justify-start")}>
          {post.attachments.map(a => (
            <AttachmentCard key={a.id} attachment={a} onImageClick={setLightboxUrl} />
          ))}
        </div>
      )}

      {lightboxUrl && (
        <Dialog open={!!lightboxUrl} onOpenChange={() => setLightboxUrl(null)}>
          <DialogContent className="max-w-3xl p-2 bg-black/90 border-none">
            <img src={lightboxUrl} alt="Vedlegg" className="w-full h-auto max-h-[80vh] object-contain rounded" />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

/* ── Attachment Card ── */
function AttachmentCard({ attachment, onImageClick }: { attachment: ConversationAttachment; onImageClick: (url: string) => void }) {
  const isImage = attachment.mime_type?.startsWith("image/");
  const isPdf = attachment.mime_type === "application/pdf";
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isImage || !attachment.storage_path) return;
    (async () => {
      const { data } = await supabase.storage
        .from("conversation-files")
        .createSignedUrl(attachment.storage_path!, 3600);
      if (data?.signedUrl) setThumbUrl(data.signedUrl);
    })();
  }, [attachment.storage_path, isImage]);

  const sizeStr = attachment.file_size
    ? attachment.file_size > 1_000_000
      ? `${(attachment.file_size / 1_000_000).toFixed(1)} MB`
      : `${Math.round(attachment.file_size / 1_000)} KB`
    : null;

  const handleClick = async () => {
    if (isImage && thumbUrl) {
      onImageClick(thumbUrl);
      return;
    }
    if (!attachment.storage_path) {
      if (attachment.sharepoint_web_url) window.open(attachment.sharepoint_web_url, "_blank");
      return;
    }
    const { data } = await supabase.storage
      .from("conversation-files")
      .createSignedUrl(attachment.storage_path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    else toast.error("Kunne ikke åpne fil");
  };

  if (isImage && thumbUrl) {
    return (
      <button
        onClick={handleClick}
        className="relative rounded-xl overflow-hidden border border-border/30 hover:border-border/60 transition-colors cursor-pointer group"
        style={{ maxWidth: 260 }}
      >
        <img src={thumbUrl} alt={attachment.file_name} className="h-auto w-full max-h-48 object-cover" />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border border-border/30 px-3 py-2 text-xs hover:bg-muted/50 transition-colors cursor-pointer",
        isPdf ? "bg-red-50/50 dark:bg-red-900/10" : "bg-muted/20"
      )}
    >
      {isPdf ? (
        <FileText className="h-4 w-4 text-red-500 shrink-0" />
      ) : (
        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
      )}
      <div className="text-left min-w-0">
        <p className="text-[12px] font-medium text-foreground truncate max-w-[180px]">{attachment.file_name}</p>
        {sizeStr && <p className="text-[10px] text-muted-foreground">{sizeStr}</p>}
      </div>
    </button>
  );
}
