import { useState, useEffect } from "react";
import { type ConversationPost, type ConversationAttachment } from "@/hooks/useConversations";
import { type ReactionSummary } from "@/hooks/useMessageReactions";
import { type SuggestedMessageAction } from "@/hooks/useAIMessageActions";
import { type MediaAnnotation } from "@/hooks/useMediaAnnotations";
import {
  ChevronDown, ExternalLink, FileText, Paperclip, Check, CheckCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MessageActions } from "./MessageActions";
import { ReplyPreview } from "./ReplyPreview";
import { ImagePreviewModal } from "./ImagePreviewModal";
import { VoicePlayer } from "./VoicePlayer";
import { MessageContextBadges } from "./MessageContextBadges";
import { ChatAIActionChips } from "./ChatAIActionChips";
import { MediaAnnotationBadges } from "./MediaAnnotationBadges";

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
  readCount?: number;
  // Sprint 3: Context filtering
  onFilterByTag?: (tag: string) => void;
  onFilterByObjectType?: (type: string) => void;
  onFilterByLocation?: (loc: string) => void;
  // Sprint 4: AI actions
  aiSuggestions?: SuggestedMessageAction[] | null;
  aiDismissed?: boolean;
  onDismissAI?: (postId: string) => void;
  onClickAIAction?: (postId: string, action: SuggestedMessageAction) => void;
  // Annotation props
  annotations?: MediaAnnotation[];
  hasBeforeAfterPair?: boolean;
  projectId?: string;
  companyId?: string;
  onFilterByDocType?: (docType: string) => void;
  onFilterByObjectLabel?: (label: string) => void;
  onAnnotationSaved?: () => void;
  // Admin moderation
  canModerate?: boolean;
  onDeleteMessage?: (postId: string) => void;
  adminSelectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (postId: string) => void;
}

export function ChatBubble({
  post, isOwn, isFirst, isLast,
  reactions, onToggleReaction, onReply, onCreateTask, onPinToggle,
  replyToPost, onScrollToPost, readCount = 0,
  onFilterByTag, onFilterByObjectType, onFilterByLocation,
  aiSuggestions, aiDismissed, onDismissAI, onClickAIAction,
  annotations, hasBeforeAfterPair, projectId, companyId,
  onFilterByDocType, onFilterByObjectLabel, onAnnotationSaved,
}: ChatBubbleProps) {
  const [showRaw, setShowRaw] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxAlt, setLightboxAlt] = useState<string>("");

  const isEmail = post.post_type === "email";
  const cleanBody = (post as any).body_clean || post.body_text || "";
  const rawBody = (post as any).body_raw || post.body_html || "";
  const hasRawContent = isEmail && rawBody && rawBody !== cleanBody;
  const isPinned = (post as any).is_pinned === true;

  // Context fields
  const contextLocation = (post as any).context_location_text;
  const contextObjectType = (post as any).context_object_type;
  const contextObjectRef = (post as any).context_object_ref;
  const contextTags = (post as any).context_tags;

  // Check if this post has a voice attachment
  const voiceAttachment = post.attachments?.find(a => a.mime_type?.startsWith("audio/"));

  // Render @mentions as highlighted spans
  const renderBody = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(@"[^"]+"|@\w{2,30})/g);
    return parts.map((part, i) => {
      if (part.startsWith("@")) {
        return (
          <span key={i} className={cn(
            "font-semibold rounded px-0.5",
            isOwn ? "text-primary-foreground/90 bg-white/15" : "text-primary bg-primary/10"
          )}>
            {part}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div
      id={`post-${post.id}`}
      className={cn("mb-0.5 max-w-full group relative transition-colors duration-500 rounded-lg")}
    >
      {/* Reply quote */}
      {replyToPost && (
        <ReplyPreview replyToPost={replyToPost} isOwn={isOwn} onScrollToPost={onScrollToPost} />
      )}

      {/* Context badges */}
      <MessageContextBadges
        locationText={contextLocation}
        objectType={contextObjectType}
        objectRef={contextObjectRef}
        tags={contextTags}
        isOwn={isOwn}
        onFilterByTag={onFilterByTag}
        onFilterByObjectType={onFilterByObjectType}
        onFilterByLocation={onFilterByLocation}
      />

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
          isPinned && "ring-1 ring-amber-400/40",
        )}
      >
        {isPinned && (
          <div className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
            <span className="text-[8px]">📌</span>
          </div>
        )}

        {cleanBody && (
          <p className="whitespace-pre-wrap break-words">{renderBody(cleanBody)}</p>
        )}

        {/* Voice player inline */}
        {voiceAttachment && (
          <VoiceAttachmentPlayer attachment={voiceAttachment} isOwn={isOwn} />
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

        {/* Read status for own messages */}
        {isOwn && isLast && (
          <div className={cn(
            "flex items-center gap-0.5 mt-1 justify-end",
            "text-primary-foreground/50"
          )}>
            {readCount > 0 ? (
              <>
                <CheckCheck className="h-3 w-3" />
                <span className="text-[9px]">Sett av {readCount}</span>
              </>
            ) : (
              <Check className="h-3 w-3" />
            )}
          </div>
        )}
      </div>

      {/* AI Action Chips (Sprint 4) */}
      {aiSuggestions && aiSuggestions.length > 0 && onClickAIAction && onDismissAI && (
        <ChatAIActionChips
          actions={aiSuggestions}
          dismissed={!!aiDismissed}
          isOwn={isOwn}
          onClickAction={(action) => onClickAIAction(post.id, action)}
          onDismiss={() => onDismissAI(post.id)}
        />
      )}

      {/* Hover actions */}
      <MessageActions
        post={post}
        isOwn={isOwn}
        isPinned={isPinned}
        onReply={onReply}
        onCreateTask={onCreateTask}
        onPinToggle={onPinToggle}
        onToggleReaction={onToggleReaction}
      />

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

      {/* Attachments (non-voice) */}
      {post.attachments && post.attachments.filter(a => !a.mime_type?.startsWith("audio/")).length > 0 && (
        <div className={cn("flex flex-wrap gap-2 mt-1.5", isOwn ? "justify-end" : "justify-start")}>
          {post.attachments.filter(a => !a.mime_type?.startsWith("audio/")).map(a => (
            <AttachmentCard
              key={a.id}
              attachment={a}
              onImageClick={(url, name) => { setLightboxUrl(url); setLightboxAlt(name); }}
            />
          ))}
        </div>
      )}

      <ImagePreviewModal
        url={lightboxUrl}
        alt={lightboxAlt}
        onClose={() => setLightboxUrl(null)}
        postId={post.id}
        projectId={projectId}
        companyId={companyId}
        onAnnotationSaved={onAnnotationSaved}
      />

      {/* Annotation badges */}
      {annotations && annotations.length > 0 && (
        <div className={cn("px-1", isOwn ? "text-right" : "text-left")}>
          <MediaAnnotationBadges
            annotations={annotations}
            beforeAfterPair={hasBeforeAfterPair}
            onFilterByDocType={onFilterByDocType}
            onFilterByObjectLabel={onFilterByObjectLabel}
          />
        </div>
      )}
    </div>
  );
}

/* ── Voice Attachment Player ── */
function VoiceAttachmentPlayer({ attachment, isOwn }: { attachment: ConversationAttachment; isOwn: boolean }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!attachment.storage_path) return;
    (async () => {
      const { data } = await supabase.storage
        .from("conversation-files")
        .createSignedUrl(attachment.storage_path!, 3600);
      if (data?.signedUrl) setUrl(data.signedUrl);
    })();
  }, [attachment.storage_path]);

  if (!url) return null;

  return <VoicePlayer url={url} isOwn={isOwn} />;
}

/* ── Attachment Card ── */
function AttachmentCard({
  attachment,
  onImageClick,
}: {
  attachment: ConversationAttachment;
  onImageClick: (url: string, name: string) => void;
}) {
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
      onImageClick(thumbUrl, attachment.file_name);
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
        <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
      )}
      <div className="text-left min-w-0">
        <p className="text-[12px] font-medium text-foreground truncate max-w-[180px]">{attachment.file_name}</p>
        {sizeStr && <p className="text-[10px] text-muted-foreground">{sizeStr}</p>}
      </div>
    </button>
  );
}
