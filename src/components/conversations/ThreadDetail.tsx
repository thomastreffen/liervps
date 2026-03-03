import { useState, useRef } from "react";
import { useConversationPosts, type ConversationPost, type ConversationAttachment } from "@/hooks/useConversations";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import {
  MessageSquare, Mail, Send, Loader2, Paperclip,
  ExternalLink, Copy, FileText, Image, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ThreadDetailProps {
  threadId: string;
  threadTitle: string;
  threadType: "conversation" | "email_thread";
  projectId: string;
  companyId: string;
  isClosed?: boolean;
}

export function ThreadDetail({ threadId, threadTitle, threadType, projectId, companyId, isClosed = false }: ThreadDetailProps) {
  const { posts, loading, refresh } = useConversationPosts(threadId);
  const { user } = useAuth();
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    <div>
      <div className="divide-y divide-border/20">
        {posts.map((post, i) => (
          <PostCard key={post.id} post={post} isFirst={i === 0} />
        ))}
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
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-md px-2 py-1 hover:bg-muted/50"
              >
                <Paperclip className="h-3.5 w-3.5" />
                Vedlegg
              </button>
            </div>
            <Button
              size="sm"
              onClick={handleReply}
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

/* ── Post Card ── */

function PostCard({ post, isFirst }: { post: ConversationPost; isFirst: boolean }) {
  const [expanded, setExpanded] = useState(isFirst || post.post_type === "internal_message");
  const isEmail = post.post_type === "email";
  const isSystem = post.post_type === "system";

  if (isSystem) {
    return (
      <div className="flex items-center gap-2 py-3 px-5 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border/40" />
        <span className="italic">{post.body_text || post.subject || "Systemhendelse"}</span>
        <div className="h-px flex-1 bg-border/40" />
      </div>
    );
  }

  const authorDisplay = isEmail
    ? post.from_name || post.from_email || "Ukjent"
    : post.author_name || "Ukjent";

  const timeDisplay = post.sent_at
    ? format(new Date(post.sent_at), "d. MMM yyyy, HH:mm", { locale: nb })
    : format(new Date(post.created_at), "d. MMM yyyy, HH:mm", { locale: nb });

  const handleCopyEmail = () => {
    const text = `${post.subject || ""}\n\n${post.body_text || ""}`;
    navigator.clipboard.writeText(text);
    toast.success("Kopiert til utklippstavle");
  };

  return (
    <div className={cn("py-5 px-5")}>
      <div className="flex items-start gap-3">
        <div className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold shrink-0",
          isEmail ? "bg-accent/10 text-accent" : "bg-primary/10 text-primary"
        )}>
          {isEmail ? <Mail className="h-4 w-4" /> : authorDisplay.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground">{authorDisplay}</span>
            {isEmail && (
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-accent/30 text-accent">
                {post.direction === "outbound" ? "Sendt" : "Mottatt"}
              </Badge>
            )}
            <span className="text-[11px] text-muted-foreground ml-auto">{timeDisplay}</span>
          </div>

          {isEmail && post.to_emails && post.to_emails.length > 0 && (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Til: {post.to_emails.join(", ")}
            </p>
          )}

          {expanded ? (
            <div className="mt-3 space-y-3">
              {post.body_html ? (
                <div
                  className="prose prose-sm max-w-none text-foreground/90 [&_p]:my-1 [&_a]:text-primary"
                  dangerouslySetInnerHTML={{ __html: post.body_html }}
                />
              ) : post.body_text ? (
                <p className="text-sm text-foreground/90 whitespace-pre-wrap">{post.body_text}</p>
              ) : null}

              {post.attachments && post.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {post.attachments.map((a) => (
                    <AttachmentChip key={a.id} attachment={a} />
                  ))}
                </div>
              )}

              {isEmail && (
                <div className="flex items-center gap-2 pt-2">
                  {post.outlook_weblink && (
                    <a
                      href={post.outlook_weblink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-md px-2.5 py-1.5 border border-border/40 hover:bg-muted/50"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Åpne i Outlook
                    </a>
                  )}
                  <button
                    onClick={handleCopyEmail}
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-md px-2.5 py-1.5 border border-border/40 hover:bg-muted/50"
                  >
                    <Copy className="h-3 w-3" />
                    Kopier
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setExpanded(true)}
              className="mt-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ChevronDown className="h-3 w-3 inline mr-1" />
              Vis innhold
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Attachment Chip ── */

function AttachmentChip({ attachment }: { attachment: ConversationAttachment }) {
  const isImage = attachment.mime_type?.startsWith("image/");
  const sizeStr = attachment.file_size
    ? attachment.file_size > 1_000_000
      ? `${(attachment.file_size / 1_000_000).toFixed(1)} MB`
      : `${Math.round(attachment.file_size / 1_000)} KB`
    : null;

  const handleClick = async () => {
    if (!attachment.storage_path) {
      if (attachment.sharepoint_web_url) {
        window.open(attachment.sharepoint_web_url, "_blank");
      }
      return;
    }
    const { data } = await supabase.storage
      .from("conversation-files")
      .createSignedUrl(attachment.storage_path, 3600);
    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    } else {
      toast.error("Kunne ikke åpne fil");
    }
  };

  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border/40 bg-muted/30 px-2.5 py-1.5 text-xs text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
    >
      {isImage ? <Image className="h-3 w-3 text-muted-foreground" /> : <FileText className="h-3 w-3 text-muted-foreground" />}
      <span className="max-w-[150px] truncate">{attachment.file_name}</span>
      {sizeStr && <span className="text-muted-foreground/60">{sizeStr}</span>}
    </button>
  );
}
