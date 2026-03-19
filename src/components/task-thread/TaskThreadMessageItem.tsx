import { useState, useEffect } from "react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { User, Paperclip, Download, Mail, ArrowUpRight, ArrowDownLeft, ChevronDown, ChevronUp, Image as ImageIcon, Reply, AlertTriangle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { TaskMessage } from "@/hooks/useTaskThread";
import { cn } from "@/lib/utils";
import { filterAttachments, cleanEmailBody } from "./email-utils";
import { ImageLightbox } from "./ImageLightbox";

interface Props {
  message: TaskMessage;
  isOwnMessage: boolean;
  onReply?: (message: TaskMessage) => void;
  onScrollToMessage?: (messageId: string) => void;
  allMessages?: TaskMessage[];
}

export function TaskThreadMessageItem({ message, isOwnMessage, onReply, onScrollToMessage, allMessages }: Props) {
  const time = format(new Date(message.created_at), "d. MMM HH:mm", { locale: nb });
  const isExternalEmail = message.message_type === "external_email";
  const isOutbound = message.direction === "outbound";
  const isInbound = message.direction === "inbound";
  const alignRight = isExternalEmail ? isOutbound : isOwnMessage;

  // Email body cleanup for inbound
  const isInboundEmail = isExternalEmail && isInbound;
  const { cleaned: cleanedBody, hasMore } = isInboundEmail
    ? cleanEmailBody(message.body)
    : { cleaned: message.body || "", hasMore: false };
  const [showFull, setShowFull] = useState(false);
  const displayBody = showFull ? (message.body || "") : cleanedBody;

  // Attachment filtering for inbound emails
  const { images, files, filteredCount } = isInboundEmail
    ? filterAttachments(message.attachments)
    : { images: [] as typeof message.attachments, files: message.attachments, filteredCount: 0 };

  const recipients = (message as any).recipients as Array<{ name: string; email: string }> | null;

  // Reply-to reference
  const replyToId = (message as any).reply_to_message_id as string | undefined;
  const replyToMsg = replyToId && allMessages ? allMessages.find(m => m.id === replyToId) : null;

  const handleDownload = async (filePath: string, fileName: string) => {
    const { data } = await supabase.storage
      .from("task-thread-files")
      .createSignedUrl(filePath, 3600);
    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    }
  };

  // Hover state for reply button
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className={cn("flex gap-2.5 group", alignRight && "flex-row-reverse")}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Avatar */}
      <div className={cn(
        "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5",
        isExternalEmail
          ? isInbound
            ? "bg-green-100 dark:bg-green-900/40"
            : "bg-blue-100 dark:bg-blue-900/40"
          : "bg-muted"
      )}>
        {isExternalEmail ? (
          <Mail className={cn(
            "h-3.5 w-3.5",
            isInbound ? "text-green-600 dark:text-green-400" : "text-blue-600 dark:text-blue-400"
          )} />
        ) : (
          <User className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </div>

      {/* Content */}
      <div className={cn("max-w-[80%] space-y-1", alignRight && "items-end")}>
        {/* Header */}
        <div className={cn("flex items-center gap-2 text-[11px] text-muted-foreground", alignRight && "flex-row-reverse")}>
          <span className="font-medium text-foreground">
            {message.author_name || message.author_email || "Ukjent"}
          </span>
          <span>{time}</span>
          <MessageTypeBadge message={message} isOutbound={isOutbound} isInbound={isInbound} />

          {/* Reply button */}
          {onReply && hovered && (
            <button
              onClick={() => onReply(message)}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Reply className="h-2.5 w-2.5" />
              Svar
            </button>
          )}
        </div>

        {/* Recipients line — shown for outbound emails and internal messages with recipients */}
        {recipients && recipients.length > 0 && !isInbound && (
          <div className={cn("flex items-center gap-1 text-[11px] text-muted-foreground", alignRight && "flex-row-reverse")}>
            <Mail className="h-3 w-3 text-blue-500" />
            <span>Sendt til: {recipients.map(r => r.name).join(", ")}</span>
          </div>
        )}

        {/* Inbound sender */}
        {isInboundEmail && message.author_email && (
          <div className="text-[11px] text-muted-foreground">
            Fra: {message.author_name || message.author_email}
            {message.author_name && (
              <span className="text-muted-foreground/70"> ({message.author_email})</span>
            )}
          </div>
        )}

        {/* Reply quote */}
        {replyToMsg && (
          <button
            onClick={() => onScrollToMessage?.(replyToMsg.id)}
            className={cn(
              "flex items-start gap-1.5 rounded-md border-l-2 border-primary/40 bg-muted/50 px-2.5 py-1.5 text-[11px] text-muted-foreground hover:bg-muted transition-colors w-full text-left",
              alignRight && "ml-auto"
            )}
          >
            <Reply className="h-3 w-3 shrink-0 mt-0.5 text-primary/60" />
            <div className="min-w-0">
              <span className="font-medium text-foreground/80">
                {replyToMsg.author_name || "Ukjent"}
              </span>
              <p className="truncate mt-0.5">{replyToMsg.body?.slice(0, 100) || "…"}</p>
            </div>
          </button>
        )}

        {/* Body */}
        {displayBody && (
          <div className={cn(
            "rounded-lg px-3 py-2 text-sm leading-relaxed",
            isExternalEmail && isOutbound
              ? "bg-blue-50 dark:bg-blue-950/40 text-foreground border border-blue-100 dark:border-blue-900/50"
              : isInboundEmail
              ? "bg-green-50 dark:bg-green-950/40 text-foreground border border-green-100 dark:border-green-900/50"
              : isOwnMessage
              ? "bg-primary/10 text-foreground"
              : "bg-muted text-foreground"
          )}>
            <p className="whitespace-pre-wrap break-words">{displayBody}</p>

            {hasMore && (
              <button
                onClick={() => setShowFull(!showFull)}
                className="flex items-center gap-1 mt-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                {showFull ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {showFull ? "Skjul historikk" : "Vis hele e-posten"}
              </button>
            )}
          </div>
        )}

        {/* Inline images */}
        {images.length > 0 && (
          <InlineImageGrid images={images} onDownload={handleDownload} />
        )}

        {/* File attachments */}
        {files.length > 0 && (
          <AttachmentGroup files={files} onDownload={handleDownload} />
        )}
      </div>
    </div>
  );
}

/* ── Message Type Badge ── */

function MessageTypeBadge({ message, isOutbound, isInbound }: { message: TaskMessage; isOutbound: boolean; isInbound: boolean }) {
  if (message.message_type === "internal_message") {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary">
        Intern
      </span>
    );
  }
  if (message.message_type === "external_email" && isOutbound) {
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
        <ArrowUpRight className="h-2.5 w-2.5" />
        E-post sendt
      </span>
    );
  }
  if (message.message_type === "external_email" && isInbound) {
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300">
        <ArrowDownLeft className="h-2.5 w-2.5" />
        E-post mottatt
      </span>
    );
  }
  return null;
}

/* ── Inline Image Grid ── */

function InlineImageGrid({ images, onDownload }: {
  images: Array<{ id: string; file_path: string; file_name: string; file_size: number | null }>;
  onDownload: (path: string, name: string) => void;
}) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  useEffect(() => {
    let mounted = true;
    images.forEach(async (img) => {
      const { data } = await supabase.storage
        .from("task-thread-files")
        .createSignedUrl(img.file_path, 3600);
      if (data?.signedUrl && mounted) {
        setUrls((prev) => ({ ...prev, [img.id]: data.signedUrl }));
      }
    });
    return () => { mounted = false; };
  }, [images.map(i => i.id).join(",")]);

  const lightboxImages = images
    .filter(img => urls[img.id])
    .map(img => ({ url: urls[img.id], name: img.file_name, filePath: img.file_path }));

  return (
    <>
      <div className={cn(
        "grid gap-1.5 mt-1",
        images.length === 1 ? "grid-cols-1 max-w-xs" : images.length === 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"
      )}>
        {images.map((img, idx) => (
          <button
            key={img.id}
            onClick={() => {
              const lbIdx = lightboxImages.findIndex(li => li.filePath === img.file_path);
              setLightboxIndex(lbIdx >= 0 ? lbIdx : 0);
              setLightboxOpen(true);
            }}
            className="relative group/img rounded-lg overflow-hidden border border-border/40 bg-muted/30 hover:border-primary/40 transition-colors"
          >
            {urls[img.id] ? (
              <img
                src={urls[img.id]}
                alt={img.file_name}
                className="w-full h-auto max-h-48 object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-24 flex items-center justify-center">
                <ImageIcon className="h-5 w-5 text-muted-foreground animate-pulse" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/10 transition-colors" />
          </button>
        ))}
      </div>

      <ImageLightbox
        images={lightboxImages}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        onDownload={onDownload}
      />
    </>
  );
}

/* ── Attachment Group ── */

function AttachmentGroup({ files, onDownload }: {
  files: Array<{ id: string; file_path: string; file_name: string; file_size: number | null; mime_type: string | null }>;
  onDownload: (path: string, name: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (files.length === 0) return null;

  if (files.length === 1) {
    const f = files[0];
    return (
      <button
        onClick={() => onDownload(f.file_path, f.file_name)}
        className="flex items-center gap-2 rounded-lg border border-border/50 bg-card px-3 py-2 text-xs hover:bg-muted/50 transition-colors w-full text-left"
      >
        <Paperclip className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="truncate flex-1">{f.file_name}</span>
        {f.file_size != null && (
          <span className="text-muted-foreground shrink-0">{formatSize(f.file_size)}</span>
        )}
        <Download className="h-3 w-3 text-muted-foreground shrink-0" />
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-border/50 bg-card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-muted/30 transition-colors text-left"
      >
        <Paperclip className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="flex-1 font-medium">{files.length} vedlegg</span>
        {expanded ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="border-t border-border/30 divide-y divide-border/20">
          {files.map((f) => (
            <button
              key={f.id}
              onClick={() => onDownload(f.file_path, f.file_name)}
              className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-muted/30 transition-colors text-left"
            >
              <Download className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="truncate flex-1">{f.file_name}</span>
              {f.file_size != null && (
                <span className="text-muted-foreground shrink-0">{formatSize(f.file_size)}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
