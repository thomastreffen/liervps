import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Paperclip, Send, X, Loader2, FileText, Mail, MessageSquare, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type ComposerMode = "internal" | "email";

interface TechRecipient {
  name: string;
  email: string;
}

interface Props {
  onSend: (body: string, files?: File[]) => Promise<void>;
  onSendEmail?: (body: string, files?: File[]) => Promise<void>;
  sending: boolean;
  canUpload: boolean;
  canEmail: boolean;
  taskId?: string;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024;

export function TaskThreadComposer({ onSend, onSendEmail, sending, canUpload, canEmail, taskId }: Props) {
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [mode, setMode] = useState<ComposerMode>("internal");
  const [recipients, setRecipients] = useState<TechRecipient[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const canSend = (body.trim().length > 0 || files.length > 0) && !sending;

  // Fetch recipients when switching to email mode
  useEffect(() => {
    if (mode !== "email" || !taskId) {
      setRecipients([]);
      return;
    }
    let cancelled = false;
    setLoadingRecipients(true);
    (async () => {
      const { data } = await supabase
        .from("event_technicians")
        .select("technician_id, technicians(name, email)")
        .eq("event_id", taskId);
      if (cancelled) return;
      const techs: TechRecipient[] = [];
      for (const link of (data || []) as any[]) {
        if (link.technicians?.email) {
          techs.push({ name: link.technicians.name, email: link.technicians.email });
        }
      }
      setRecipients(techs);
      setLoadingRecipients(false);
    })();
    return () => { cancelled = true; };
  }, [mode, taskId]);

  const handleSend = async () => {
    if (!canSend) return;
    if (mode === "email" && onSendEmail) {
      await onSendEmail(body, files.length > 0 ? files : undefined);
    } else {
      await onSend(body, files.length > 0 ? files : undefined);
    }
    setBody("");
    setFiles([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleAddFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []).filter(f => f.size <= MAX_FILE_SIZE);
    setFiles(prev => [...prev, ...newFiles]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const isEmailMode = mode === "email";

  return (
    <div className="border-t border-border bg-card p-3 space-y-2">
      {/* Mode switch */}
      {canEmail && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMode("internal")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              !isEmailMode
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Intern
          </button>
          <button
            type="button"
            onClick={() => setMode("email")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              isEmailMode
                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <Mail className="h-3.5 w-3.5" />
            E-post til montør
          </button>
        </div>
      )}

      {/* Email recipients preview */}
      {isEmailMode && (
        <div className="rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30 px-3 py-2">
          <div className="flex items-center gap-1.5 text-xs text-blue-700 dark:text-blue-300 mb-1">
            <Mail className="h-3 w-3" />
            <span className="font-medium">Sendes som e-post til:</span>
          </div>
          {loadingRecipients ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Henter montører…
            </div>
          ) : recipients.length === 0 ? (
            <p className="text-xs text-destructive">
              Ingen tildelte montører med e-postadresse
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {recipients.map((r, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-xs text-blue-800 dark:text-blue-200"
                >
                  {r.name}
                  <span className="text-blue-500 dark:text-blue-400">({r.email})</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* File preview */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {files.map((f, i) => (
            <div
              key={`${f.name}-${i}`}
              className="flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/50 px-2 py-1 text-xs"
            >
              <FileText className="h-3 w-3 text-muted-foreground" />
              <span className="truncate max-w-[120px]">{f.name}</span>
              <button
                type="button"
                onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="flex items-end gap-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isEmailMode ? "Skriv e-post til montør…" : "Skriv en melding…"}
          className={cn(
            "min-h-[40px] max-h-[120px] resize-none text-sm flex-1",
            isEmailMode && "border-blue-200 dark:border-blue-800 focus-visible:ring-blue-500"
          )}
          rows={1}
          disabled={sending}
        />

        <div className="flex flex-col items-end gap-1 shrink-0">
          {canUpload && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => inputRef.current?.click()}
                disabled={sending}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <input
                ref={inputRef}
                type="file"
                multiple
                onChange={handleAddFiles}
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp"
              />
            </>
          )}
          <Button
            type="button"
            size="icon"
            className={cn(
              "h-9 w-9",
              isEmailMode && "bg-blue-600 hover:bg-blue-700 text-white"
            )}
            onClick={handleSend}
            disabled={!canSend || (isEmailMode && recipients.length === 0)}
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isEmailMode ? (
              <Mail className="h-4 w-4" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground select-none hidden sm:block">
        Enter for ny linje • {navigator.platform?.includes("Mac") ? "⌘" : "Ctrl"}+Enter for å sende
      </p>
    </div>
  );
}
