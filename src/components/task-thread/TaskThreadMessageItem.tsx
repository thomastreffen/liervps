import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { User, Paperclip, Download, Mail, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { TaskMessage } from "@/hooks/useTaskThread";
import { cn } from "@/lib/utils";

interface Props {
  message: TaskMessage;
  isOwnMessage: boolean;
}

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"];

export function TaskThreadMessageItem({ message, isOwnMessage }: Props) {
  const time = format(new Date(message.created_at), "d. MMM HH:mm", { locale: nb });
  const isExternalEmail = message.message_type === "external_email";
  const isOutbound = message.direction === "outbound";
  const isInbound = message.direction === "inbound";

  const handleDownload = async (filePath: string, fileName: string) => {
    const { data } = await supabase.storage
      .from("task-thread-files")
      .createSignedUrl(filePath, 3600);
    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    }
  };

  // Determine alignment: own internal messages right, inbound left, outbound right
  const alignRight = isExternalEmail ? isOutbound : isOwnMessage;

  // Recipients display for outbound emails
  const recipients = (message as any).recipients as Array<{ name: string; email: string }> | null;

  return (
    <div className={cn("flex gap-2.5", alignRight && "flex-row-reverse")}>
      {/* Avatar */}
      <div className={cn(
        "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center",
        isExternalEmail
          ? "bg-blue-100 dark:bg-blue-900/50"
          : "bg-muted"
      )}>
        {isExternalEmail ? (
          <Mail className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
        ) : (
          <User className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </div>

      {/* Content */}
      <div className={cn("max-w-[80%] space-y-1", alignRight && "items-end")}>
        {/* Header */}
        <div className={cn("flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap", alignRight && "flex-row-reverse")}>
          <span className="font-medium text-foreground">
            {message.author_name || message.author_email || "Ukjent"}
          </span>
          <span>{time}</span>

          {/* Type badges */}
          {message.message_type === "internal_message" && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary">
              Intern
            </span>
          )}
          {isExternalEmail && isOutbound && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
              <ArrowUpRight className="h-2.5 w-2.5" />
              E-post sendt
            </span>
          )}
          {isExternalEmail && isInbound && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300">
              <ArrowDownLeft className="h-2.5 w-2.5" />
              E-post mottatt
            </span>
          )}
        </div>

        {/* Recipients line for outbound email */}
        {isExternalEmail && isOutbound && recipients && recipients.length > 0 && (
          <div className={cn("text-[11px] text-muted-foreground", alignRight && "text-right")}>
            <span>Til: </span>
            {recipients.map((r, i) => (
              <span key={i}>
                {i > 0 && ", "}
                {r.name} <span className="text-muted-foreground/70">({r.email})</span>
              </span>
            ))}
          </div>
        )}

        {/* Sender line for inbound email */}
        {isExternalEmail && isInbound && message.author_email && (
          <div className="text-[11px] text-muted-foreground">
            Fra: {message.author_name || message.author_email}
            {message.author_name && (
              <span className="text-muted-foreground/70"> ({message.author_email})</span>
            )}
          </div>
        )}

        {/* Body */}
        {message.body && (
          <div className={cn(
            "rounded-lg px-3 py-2 text-sm leading-relaxed",
            isExternalEmail && isOutbound
              ? "bg-blue-50 dark:bg-blue-950/40 text-foreground border border-blue-100 dark:border-blue-900/50"
              : isExternalEmail && isInbound
              ? "bg-green-50 dark:bg-green-950/40 text-foreground border border-green-100 dark:border-green-900/50"
              : isOwnMessage
              ? "bg-primary/10 text-foreground"
              : "bg-muted text-foreground"
          )}>
            <p className="whitespace-pre-wrap break-words">{message.body}</p>
          </div>
        )}

        {/* Attachments */}
        {message.attachments.length > 0 && (
          <div className="space-y-1">
            {message.attachments.map((att) => {
              const isImage = att.mime_type && IMAGE_TYPES.includes(att.mime_type);
              return (
                <button
                  key={att.id}
                  onClick={() => handleDownload(att.file_path, att.file_name)}
                  className="flex items-center gap-2 rounded-md border border-border/60 bg-card px-2.5 py-1.5 text-xs hover:bg-muted transition-colors w-full text-left"
                >
                  {isImage ? (
                    <Paperclip className="h-3.5 w-3.5 text-primary shrink-0" />
                  ) : (
                    <Download className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  )}
                  <span className="truncate flex-1">{att.file_name}</span>
                  {att.file_size && (
                    <span className="text-muted-foreground shrink-0">
                      {att.file_size < 1024 * 1024
                        ? `${(att.file_size / 1024).toFixed(0)} KB`
                        : `${(att.file_size / 1024 / 1024).toFixed(1)} MB`}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
