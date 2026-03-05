import { useState, useRef, useEffect, useMemo } from "react";
import { useConversationPosts, type ConversationPost, type ConversationAttachment } from "@/hooks/useConversations";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { triggerConversationEmailSend } from "@/lib/conversation-email";
import { format, isSameDay, differenceInMinutes } from "date-fns";
import { nb } from "date-fns/locale";
import {
  Send, Loader2, Paperclip, ExternalLink, Copy, FileText,
  Image as ImageIcon, AlertTriangle, RotateCw, ChevronDown, X,
  Smile,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface ThreadDetailProps {
  threadId: string;
  threadTitle: string;
  threadType: "conversation" | "email_thread";
  projectId: string;
  companyId: string;
  isClosed?: boolean;
  emailEnabled?: boolean;
}

interface FailedEmail {
  id: string;
  post_id: string;
  subject: string | null;
  error: string | null;
  created_at: string;
}

/* ── Avatar color from email/name ── */
const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700", "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700", "bg-rose-100 text-rose-700",
  "bg-purple-100 text-purple-700", "bg-teal-100 text-teal-700",
  "bg-indigo-100 text-indigo-700", "bg-orange-100 text-orange-700",
];

function avatarColor(identifier: string): string {
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash = identifier.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

function authorKey(post: ConversationPost): string {
  if (post.post_type === "email") return post.from_email || post.from_name || "unknown";
  return post.author_id || post.author_name || "unknown";
}

function authorDisplay(post: ConversationPost): string {
  if (post.post_type === "email") return post.from_name || post.from_email || "Ukjent";
  return post.author_name || "Ukjent";
}

/* ── Group messages from same sender within 3 min ── */
interface PostGroup {
  sender: string;
  senderDisplay: string;
  senderEmail: string;
  timestamp: Date;
  posts: ConversationPost[];
  isOwn: boolean;
}

function groupPosts(posts: ConversationPost[], currentUserAccountId: string | null): { date: Date; groups: PostGroup[] }[] {
  const days: { date: Date; groups: PostGroup[] }[] = [];
  let currentDay: { date: Date; groups: PostGroup[] } | null = null;
  let currentGroup: PostGroup | null = null;

  for (const post of posts) {
    if (post.post_type === "system") {
      const ts = new Date(post.sent_at || post.created_at);
      if (!currentDay || !isSameDay(currentDay.date, ts)) {
        currentDay = { date: ts, groups: [] };
        days.push(currentDay);
      }
      currentGroup = null;
      currentDay.groups.push({
        sender: "__system__",
        senderDisplay: "System",
        senderEmail: "",
        timestamp: ts,
        posts: [post],
        isOwn: false,
      });
      continue;
    }

    const ts = new Date(post.sent_at || post.created_at);
    const key = authorKey(post);
    const isOwn = !!(currentUserAccountId && post.author_id === currentUserAccountId);

    if (!currentDay || !isSameDay(currentDay.date, ts)) {
      currentDay = { date: ts, groups: [] };
      days.push(currentDay);
      currentGroup = null;
    }

    if (
      currentGroup &&
      currentGroup.sender === key &&
      differenceInMinutes(ts, currentGroup.timestamp) <= 3
    ) {
      currentGroup.posts.push(post);
      currentGroup.timestamp = ts;
    } else {
      currentGroup = {
        sender: key,
        senderDisplay: authorDisplay(post),
        senderEmail: post.from_email || "",
        timestamp: ts,
        posts: [post],
        isOwn,
      };
      currentDay.groups.push(currentGroup);
    }
  }

  return days;
}

export function ThreadDetail({ threadId, threadTitle, threadType, projectId, companyId, isClosed = false, emailEnabled = true }: ThreadDetailProps) {
  const { posts, loading, refresh } = useConversationPosts(threadId);
  const { user } = useAuth();
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [failedEmail, setFailedEmail] = useState<FailedEmail | null>(null);
  const [resending, setResending] = useState(false);
  const [currentUaId, setCurrentUaId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Get current user account id
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("user_accounts")
        .select("id")
        .eq("auth_user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();
      setCurrentUaId(data?.id || null);
    })();
  }, [user]);

  const grouped = useMemo(() => groupPosts(posts, currentUaId), [posts, currentUaId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [posts.length]);

  // Check for last failed outbound email
  useEffect(() => {
    if (!threadId) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("conversation_email_messages")
        .select("id, post_id, subject, error, created_at")
        .eq("thread_id", threadId)
        .eq("direction", "outbound")
        .eq("status", "failed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setFailedEmail(data ?? null);
    })();
  }, [threadId, sending]);

  const handleResendEmail = async () => {
    if (!failedEmail) return;
    setResending(true);
    try {
      const result = await triggerConversationEmailSend(threadId, "resend", { post_id: failedEmail.post_id });
      if (result.sent) {
        await (supabase as any)
          .from("conversation_email_messages")
          .update({ status: "resent" })
          .eq("id", failedEmail.id);
        toast.success("E-post sendt på nytt");
        setFailedEmail(null);
      } else {
        toast.error(result.error || "Sending feilet igjen");
      }
    } catch (err: any) {
      toast.error(err.message || "Kunne ikke sende på nytt");
    } finally {
      setResending(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) setPendingFiles(prev => [...prev, ...files]);
    e.target.value = "";
  };

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadAttachments = async (postId: string) => {
    for (const file of pendingFiles) {
      const filePath = `${companyId}/${projectId}/${threadId}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from("conversation-files")
        .upload(filePath, file);
      if (uploadErr) {
        toast.error(`Kunne ikke laste opp ${file.name}`);
        continue;
      }
      await (supabase as any).from("conversation_attachments").insert({
        post_id: postId,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type || null,
        storage_path: filePath,
      });
    }
  };

  const triggerEmailSend = async (postId: string) => {
    if (!emailEnabled) return;
    try {
      const result = await triggerConversationEmailSend(threadId, "new_post", { post_id: postId });
      if (result.sent) console.log("Email sent for post", postId);
      else if (!result.skipped) console.warn("Email send failed", result.error);
    } catch { console.warn("Email send failed silently"); }
  };

  const handleReply = async () => {
    if ((!replyText.trim() && pendingFiles.length === 0) || !user) return;
    setSending(true);

    const uaId = currentUaId || (() => {
      // fallback fetch
      return null;
    })();

    const { data: post, error } = await (supabase as any).from("conversation_posts").insert({
      thread_id: threadId,
      company_id: companyId,
      author_id: uaId || null,
      post_type: "internal_message",
      body_text: replyText.trim() || null,
      body_html: replyText.trim() ? `<p>${replyText.trim().replace(/\n/g, "<br/>")}</p>` : null,
      body_clean: replyText.trim() || null,
    }).select("id").single();

    if (error) {
      toast.error("Kunne ikke sende melding");
      setSending(false);
      return;
    }

    if (pendingFiles.length > 0 && post) {
      setUploading(true);
      await uploadAttachments(post.id);
      setUploading(false);
    }

    if (post) triggerEmailSend(post.id);

    setReplyText("");
    setPendingFiles([]);
    setSending(false);
    refresh();
  };

  // Handle paste for images
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    const imageItems = items.filter(i => i.type.startsWith("image/"));
    if (imageItems.length > 0) {
      e.preventDefault();
      const files = imageItems.map(i => i.getAsFile()).filter(Boolean) as File[];
      setPendingFiles(prev => [...prev, ...files]);
    }
  };

  // Handle drag and drop
  const [dragOver, setDragOver] = useState(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) setPendingFiles(prev => [...prev, ...files]);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-full"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Failed email banner */}
      {failedEmail && (
        <div className="flex items-center gap-3 px-5 py-3 bg-destructive/5 border-b border-destructive/20">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-destructive">E-postsending feilet</p>
            <p className="text-[10px] text-destructive/70 truncate">
              {failedEmail.error || "Ukjent feil"} — {format(new Date(failedEmail.created_at), "d. MMM HH:mm", { locale: nb })}
            </p>
          </div>
          <Button
            size="sm" variant="outline"
            className="h-7 text-xs gap-1 border-destructive/30 text-destructive hover:bg-destructive/10 shrink-0"
            onClick={handleResendEmail} disabled={resending}
          >
            {resending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCw className="h-3 w-3" />}
            Send på nytt
          </Button>
        </div>
      )}

      {/* Drag overlay */}
      {dragOver && (
        <div className="absolute inset-0 z-50 bg-primary/5 border-2 border-dashed border-primary/30 rounded-[14px] flex items-center justify-center pointer-events-none">
          <p className="text-sm font-medium text-primary">Slipp filer her</p>
        </div>
      )}

      {/* Chat messages */}
      <div className="flex-1 px-4 sm:px-5 py-4 space-y-1 relative">
        {grouped.map((day, di) => (
          <div key={di}>
            {/* Day separator */}
            <div className="flex items-center justify-center py-4">
              <span className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-widest bg-card px-3 py-1 rounded-full">
                {format(day.date, "EEEE d. MMMM", { locale: nb })}
              </span>
            </div>

            {day.groups.map((group, gi) => {
              if (group.sender === "__system__") {
                const p = group.posts[0];
                return (
                  <div key={`sys-${gi}`} className="flex items-center justify-center py-2">
                    <span className="text-[11px] text-muted-foreground/60 italic px-3 py-1">
                      {p.body_text || p.subject || "Systemhendelse"}
                    </span>
                  </div>
                );
              }

              const colorClass = avatarColor(group.sender);
              const ini = initials(group.senderDisplay);
              const isOwn = group.isOwn;

              return (
                <div
                  key={`g-${gi}`}
                  className={cn(
                    "flex gap-2 mb-4",
                    isOwn ? "flex-row-reverse" : "flex-row"
                  )}
                >
                  {/* Avatar - only for others */}
                  {!isOwn ? (
                    <div className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold shrink-0 self-end",
                      colorClass
                    )}>
                      {ini}
                    </div>
                  ) : (
                    <div className="w-8 shrink-0" />
                  )}

                  <div className={cn("flex flex-col max-w-[75%]", isOwn ? "items-end" : "items-start")}>
                    {/* Sender name - only for others, only first in group */}
                    {!isOwn && (
                      <div className="flex items-center gap-2 mb-1 px-1">
                        <span className="text-[12px] font-semibold text-muted-foreground">{group.senderDisplay}</span>
                        {group.posts[0].post_type === "email" && group.posts[0].direction === "inbound" && (
                          <Badge variant="outline" className="text-[8px] px-1 py-0 border-accent/30 text-accent">
                            E-post
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Message bubbles */}
                    {group.posts.map((post, pi) => (
                      <ChatBubble
                        key={post.id}
                        post={post}
                        isOwn={isOwn}
                        isFirst={pi === 0}
                        isLast={pi === group.posts.length - 1}
                      />
                    ))}

                    {/* Timestamp */}
                    <span className={cn(
                      "text-[10px] text-muted-foreground/50 mt-1 px-1",
                      isOwn ? "text-right" : "text-left"
                    )}>
                      {format(group.timestamp, "HH:mm", { locale: nb })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Reply composer */}
      {isClosed ? (
        <div className="px-5 py-4 bg-muted/30 border-t border-border/20">
          <p className="text-xs text-muted-foreground text-center">
            Denne tråden er lukket. Kun administratorer kan gjenåpne den.
          </p>
        </div>
      ) : (
        <div className="border-t border-border/20 p-3 bg-card">
          {/* Pending files */}
          {pendingFiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2 px-1">
              {pendingFiles.map((f, i) => {
                const isImage = f.type.startsWith("image/");
                return (
                  <div key={i} className="relative group">
                    {isImage ? (
                      <div className="relative h-16 w-16 rounded-lg overflow-hidden border border-border/40">
                        <img src={URL.createObjectURL(f)} alt={f.name} className="h-full w-full object-cover" />
                        <button
                          onClick={() => removePendingFile(i)}
                          className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    ) : (
                      <Badge variant="outline" className="text-[10px] gap-1 pr-1">
                        <Paperclip className="h-2.5 w-2.5" />
                        <span className="max-w-[120px] truncate">{f.name}</span>
                        <button onClick={() => removePendingFile(i)} className="ml-0.5 hover:text-destructive">×</button>
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-end gap-2">
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center h-9 w-9 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-muted/50 cursor-pointer shrink-0 mb-0.5"
            >
              <Paperclip className="h-4 w-4" />
            </button>

            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onPaste={handlePaste}
                placeholder="Skriv melding..."
                rows={1}
                className={cn(
                  "w-full resize-none rounded-2xl border border-border/40 bg-muted/30 px-4 py-2.5 text-sm",
                  "placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30",
                  "max-h-32 overflow-y-auto"
                )}
                style={{ minHeight: "40px" }}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = "40px";
                  el.style.height = Math.min(el.scrollHeight, 128) + "px";
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleReply();
                  }
                }}
              />
            </div>

            <button
              onClick={handleReply}
              disabled={(!replyText.trim() && pendingFiles.length === 0) || sending || uploading}
              className={cn(
                "flex items-center justify-center h-9 w-9 rounded-full shrink-0 mb-0.5 transition-colors",
                (!replyText.trim() && pendingFiles.length === 0) || sending || uploading
                  ? "text-muted-foreground/30 cursor-not-allowed"
                  : "bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
              )}
            >
              {sending || uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Chat Bubble ── */

function ChatBubble({ post, isOwn, isFirst, isLast }: { post: ConversationPost; isOwn: boolean; isFirst: boolean; isLast: boolean }) {
  const [showRaw, setShowRaw] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const isEmail = post.post_type === "email";

  // Use body_clean if available, fall back to body_text
  const cleanBody = (post as any).body_clean || post.body_text || "";
  const rawBody = (post as any).body_raw || post.body_html || "";
  const hasRawContent = isEmail && rawBody && rawBody !== cleanBody;

  return (
    <div className={cn("mb-0.5 max-w-full")}>
      {/* Bubble */}
      <div
        className={cn(
          "px-3.5 py-2 text-[13px] leading-relaxed inline-block max-w-full",
          isOwn
            ? "bg-primary text-primary-foreground rounded-2xl rounded-br-md"
            : "bg-muted/60 text-foreground rounded-2xl rounded-bl-md",
          // Adjust corners for grouped messages
          isOwn && !isFirst && "rounded-tr-md",
          isOwn && !isLast && "rounded-br-2xl",
          !isOwn && !isFirst && "rounded-tl-md",
          !isOwn && !isLast && "rounded-bl-2xl",
        )}
      >
        {cleanBody && (
          <p className="whitespace-pre-wrap break-words">{cleanBody}</p>
        )}

        {/* Show raw email toggle */}
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

        {/* Outlook link for email posts */}
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

      {/* Attachments - outside bubble */}
      {post.attachments && post.attachments.length > 0 && (
        <div className={cn("flex flex-wrap gap-2 mt-1", isOwn ? "justify-end" : "justify-start")}>
          {post.attachments.map((a) => (
            <AttachmentCard key={a.id} attachment={a} onImageClick={setLightboxUrl} />
          ))}
        </div>
      )}

      {/* Lightbox */}
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
        className="relative rounded-lg overflow-hidden border border-border/30 hover:border-border/60 transition-colors cursor-pointer group"
      >
        <img src={thumbUrl} alt={attachment.file_name} className="h-24 w-auto max-w-[200px] object-cover" />
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
