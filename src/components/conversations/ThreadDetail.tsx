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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
  return post.author_name || "unknown";
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
}

function groupPosts(posts: ConversationPost[]): { date: Date; groups: PostGroup[] }[] {
  const days: { date: Date; groups: PostGroup[] }[] = [];
  let currentDay: { date: Date; groups: PostGroup[] } | null = null;
  let currentGroup: PostGroup | null = null;

  for (const post of posts) {
    if (post.post_type === "system") {
      // System messages get their own group
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
      });
      continue;
    }

    const ts = new Date(post.sent_at || post.created_at);
    const key = authorKey(post);

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const grouped = useMemo(() => groupPosts(posts), [posts]);

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

    const { data: ua } = await supabase
      .from("user_accounts")
      .select("id")
      .eq("auth_user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    const { data: post, error } = await (supabase as any).from("conversation_posts").insert({
      thread_id: threadId,
      company_id: companyId,
      author_id: ua?.id || null,
      post_type: "internal_message",
      body_text: replyText.trim() || null,
      body_html: replyText.trim() ? `<p>${replyText.trim().replace(/\n/g, "<br/>")}</p>` : null,
      body_clean: replyText.trim() || null,
    }).select("id").single();

    if (error) {
      toast.error("Kunne ikke sende svar");
      setSending(false);
      return;
    }

    if (pendingFiles.length > 0 && post) {
      setUploading(true);
      await uploadAttachments(post.id);
      setUploading(false);
    }

    if (post) triggerEmailSend(post.id);

    toast.success("Svar lagt til");
    setReplyText("");
    setPendingFiles([]);
    setSending(false);
    refresh();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
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

      {/* Chat messages */}
      <div className="px-4 sm:px-5 py-4 space-y-1">
        {grouped.map((day, di) => (
          <div key={di}>
            {/* Day separator */}
            <div className="flex items-center gap-3 py-3">
              <div className="h-px flex-1 bg-border/40" />
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                {format(day.date, "EEEE d. MMMM yyyy", { locale: nb })}
              </span>
              <div className="h-px flex-1 bg-border/40" />
            </div>

            {day.groups.map((group, gi) => {
              if (group.sender === "__system__") {
                const p = group.posts[0];
                return (
                  <div key={`sys-${gi}`} className="flex items-center gap-2 py-2 px-3 text-xs text-muted-foreground">
                    <div className="h-px flex-1 bg-border/30" />
                    <span className="italic text-[11px]">{p.body_text || p.subject || "Systemhendelse"}</span>
                    <div className="h-px flex-1 bg-border/30" />
                  </div>
                );
              }

              const colorClass = avatarColor(group.sender);
              const ini = initials(group.senderDisplay);

              return (
                <div key={`g-${gi}`} className="flex gap-2.5 mb-3">
                  {/* Avatar */}
                  <div className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold shrink-0 mt-0.5",
                    colorClass
                  )}>
                    {ini}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Sender + time header */}
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <span className="text-[13px] font-semibold text-foreground">{group.senderDisplay}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {format(group.posts[0].sent_at ? new Date(group.posts[0].sent_at) : new Date(group.posts[0].created_at), "HH:mm", { locale: nb })}
                      </span>
                      {group.posts[0].post_type === "email" && group.posts[0].direction === "inbound" && (
                        <Badge variant="outline" className="text-[8px] px-1 py-0 border-accent/30 text-accent">
                          E-post
                        </Badge>
                      )}
                    </div>

                    {/* Messages in group */}
                    {group.posts.map((post) => (
                      <ChatBubble key={post.id} post={post} />
                    ))}
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
        <div className="border-t border-border/20 p-4">
          <Textarea
            ref={textareaRef}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Skriv et svar…"
            className="min-h-[60px] border-0 bg-transparent p-0 focus-visible:ring-0 resize-none text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleReply();
            }}
          />

          {pendingFiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {pendingFiles.map((f, i) => (
                <Badge key={i} variant="outline" className="text-[10px] gap-1 pr-1">
                  <Paperclip className="h-2.5 w-2.5" />
                  <span className="max-w-[120px] truncate">{f.name}</span>
                  <button onClick={() => removePendingFile(i)} className="ml-0.5 hover:text-destructive">×</button>
                </Badge>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-2">
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-md px-2 py-1.5 hover:bg-muted/50 cursor-pointer"
              >
                <Paperclip className="h-3.5 w-3.5" />
                Vedlegg
              </button>
            </div>
            <Button
              size="sm" onClick={handleReply}
              disabled={(!replyText.trim() && pendingFiles.length === 0) || sending || uploading}
              className="gap-1.5 text-xs rounded-lg h-8"
            >
              {sending || uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Svar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Chat Bubble ── */

function ChatBubble({ post }: { post: ConversationPost }) {
  const [showRaw, setShowRaw] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const isEmail = post.post_type === "email";

  // Use body_clean if available, fall back to body_text
  const cleanBody = (post as any).body_clean || post.body_text || "";
  const rawBody = (post as any).body_raw || post.body_html || "";
  const hasRawContent = isEmail && rawBody && rawBody !== cleanBody;

  return (
    <div className="mb-1.5">
      {/* Clean message text */}
      {cleanBody && (
        <p className="text-[13px] text-foreground/90 whitespace-pre-wrap leading-relaxed">{cleanBody}</p>
      )}

      {/* Attachments */}
      {post.attachments && post.attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-1.5">
          {post.attachments.map((a) => (
            <AttachmentCard key={a.id} attachment={a} onImageClick={setLightboxUrl} />
          ))}
        </div>
      )}

      {/* Show raw email toggle */}
      {hasRawContent && (
        <div className="mt-1">
          <button
            onClick={() => setShowRaw(!showRaw)}
            className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <ChevronDown className={cn("h-3 w-3 transition-transform", showRaw && "rotate-180")} />
            {showRaw ? "Skjul e-posthistorikk" : "Vis e-posthistorikk"}
          </button>
          {showRaw && (
            <div className="mt-2 p-3 rounded-lg bg-muted/40 border border-border/30 overflow-x-auto">
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
          className="inline-flex items-center gap-1 mt-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <ExternalLink className="h-2.5 w-2.5" />
          Åpne i Outlook
        </a>
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
