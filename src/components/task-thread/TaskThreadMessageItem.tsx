import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { User, Paperclip, Download } from "lucide-react";
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

  const handleDownload = async (filePath: string, fileName: string) => {
    const { data } = await supabase.storage
      .from("task-thread-files")
      .createSignedUrl(filePath, 3600);
    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    }
  };

  return (
    <div className={cn("flex gap-2.5", isOwnMessage && "flex-row-reverse")}>
      {/* Avatar */}
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-muted flex items-center justify-center">
        <User className="h-3.5 w-3.5 text-muted-foreground" />
      </div>

      {/* Content */}
      <div className={cn("max-w-[80%] space-y-1", isOwnMessage && "items-end")}>
        {/* Header */}
        <div className={cn("flex items-center gap-2 text-[11px] text-muted-foreground", isOwnMessage && "flex-row-reverse")}>
          <span className="font-medium text-foreground">{message.author_name || "Ukjent"}</span>
          <span>{time}</span>
          {message.message_type === "internal_message" && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary">
              Intern
            </span>
          )}
          {/* Prepared for external email badge */}
          {message.message_type === "external_email" && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-info/10 text-info">
              E-post
            </span>
          )}
        </div>

        {/* Body */}
        {message.body && (
          <div className={cn(
            "rounded-lg px-3 py-2 text-sm leading-relaxed",
            isOwnMessage
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
