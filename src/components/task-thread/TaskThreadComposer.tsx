import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Paperclip, Send, X, Loader2, FileText, Reply, Mail, MailX, ChevronDown, ChevronUp, AlertTriangle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import type { TaskMessage, MessagePriority } from "@/hooks/useTaskThread";

export interface Recipient {
  name: string;
  email: string;
  technicianId: string;
  isResponsible?: boolean;
}

interface Props {
  onSend: (body: string, options: {
    files?: File[];
    replyToMessageId?: string;
    sendEmail: boolean;
    emailRecipients?: Recipient[];
    priority?: MessagePriority;
  }) => Promise<void>;
  sending: boolean;
  canUpload: boolean;
  canEmail: boolean;
  taskId?: string;
  replyTo: TaskMessage | null;
  onClearReply: () => void;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024;

const PRIORITY_OPTIONS: { value: MessagePriority; label: string; icon?: React.ReactNode; className: string; activeClassName: string }[] = [
  { value: "normal", label: "Normal", className: "text-muted-foreground hover:text-foreground hover:bg-muted", activeClassName: "bg-muted text-foreground" },
  { value: "important", label: "Viktig", icon: <AlertTriangle className="h-3 w-3" />, className: "text-muted-foreground hover:text-amber-700 hover:bg-amber-50 dark:hover:text-amber-400 dark:hover:bg-amber-950/30", activeClassName: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  { value: "urgent", label: "Haster", icon: <AlertCircle className="h-3 w-3" />, className: "text-muted-foreground hover:text-destructive hover:bg-destructive/10", activeClassName: "bg-destructive/15 text-destructive" },
];

export function TaskThreadComposer({ onSend, sending, canUpload, canEmail, taskId, replyTo, onClearReply }: Props) {
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [priority, setPriority] = useState<MessagePriority>("normal");
  const [skipEmail, setSkipEmail] = useState(false);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [showRecipients, setShowRecipients] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canSend = (body.trim().length > 0 || files.length > 0) && !sending;

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  useEffect(() => { autoResize(); }, [body, autoResize]);
  useEffect(() => { if (replyTo) textareaRef.current?.focus(); }, [replyTo]);

  useEffect(() => {
    if (!taskId || !canEmail) { setRecipients([]); return; }
    let cancelled = false;
    setLoadingRecipients(true);
    (async () => {
      // Fetch technicians and responsible user in parallel
      const [techRes, eventRes] = await Promise.all([
        supabase.from("event_technicians").select("technician_id, technicians(name, email)").eq("event_id", taskId),
        supabase.from("events").select("responsible_id").eq("id", taskId).maybeSingle(),
      ]);
      if (cancelled) return;
      const responsibleId = (eventRes.data as any)?.responsible_id;
      const techs: Recipient[] = [];
      for (const link of ((techRes.data || []) as any[])) {
        if (link.technicians?.email) {
          techs.push({
            name: link.technicians.name,
            email: link.technicians.email,
            technicianId: link.technician_id,
            isResponsible: link.technician_id === responsibleId,
          });
        }
      }
      // Sort: responsible first
      techs.sort((a, b) => (b.isResponsible ? 1 : 0) - (a.isResponsible ? 1 : 0));
      setRecipients(techs);
      setSelectedEmails(new Set(techs.map(t => t.email)));
      setLoadingRecipients(false);
    })();
    return () => { cancelled = true; };
  }, [taskId, canEmail]);

  const toggleRecipient = (email: string) => {
    setSelectedEmails(prev => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email); else next.add(email);
      return next;
    });
  };

  const handleSend = async () => {
    if (!canSend) return;
    const willEmail = canEmail && !skipEmail && selectedEmails.size > 0 && recipients.length > 0;
    const emailRecipients = willEmail ? recipients.filter(r => selectedEmails.has(r.email)) : undefined;

    await onSend(body, {
      files: files.length > 0 ? files : undefined,
      replyToMessageId: replyTo?.id,
      sendEmail: willEmail,
      emailRecipients,
      priority,
    });
    setBody("");
    setFiles([]);
    setPriority("normal");
    onClearReply();
    setTimeout(() => textareaRef.current?.focus(), 50);
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

  const willSendEmail = canEmail && !skipEmail && selectedEmails.size > 0 && recipients.length > 0;
  const selectedCount = recipients.filter(r => selectedEmails.has(r.email)).length;

  return (
    <div className="border-t border-border bg-card p-3 space-y-2">
      {/* Reply quote */}
      {replyTo && (
        <div className="flex items-start gap-2 rounded-lg border-l-2 border-primary/40 bg-muted/50 px-3 py-2">
          <Reply className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary/60" />
          <div className="flex-1 min-w-0">
            <span className="text-[11px] font-medium text-foreground/80">{replyTo.author_name || "Ukjent"}</span>
            <p className="text-xs text-muted-foreground truncate mt-0.5">{replyTo.body?.slice(0, 120) || "…"}</p>
          </div>
          <button type="button" onClick={onClearReply} className="text-muted-foreground hover:text-foreground shrink-0">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* File preview */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {files.map((f, i) => (
            <div key={`${f.name}-${i}`} className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-muted/40 px-2.5 py-1 text-xs">
              <FileText className="h-3 w-3 text-muted-foreground" />
              <span className="truncate max-w-[120px]">{f.name}</span>
              <button type="button" onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={replyTo ? `Svar til ${replyTo.author_name || "melding"}…` : "Skriv en melding…"}
          className={cn(
            "flex-1 min-h-[42px] max-h-[160px] resize-none text-sm rounded-lg border bg-background px-3 py-2.5 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            priority === "urgent" && "border-destructive/50 focus-visible:ring-destructive/50",
            priority === "important" && "border-amber-400/50 dark:border-amber-600/50 focus-visible:ring-amber-500/50"
          )}
          rows={1}
          disabled={sending}
        />
        <div className="flex items-end gap-1 shrink-0">
          {canUpload && (
            <>
              <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={() => inputRef.current?.click()} disabled={sending}>
                <Paperclip className="h-4 w-4" />
              </Button>
              <input ref={inputRef} type="file" multiple onChange={handleAddFiles} className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp" />
            </>
          )}
          <Button type="button" size="icon" className="h-9 w-9" onClick={handleSend} disabled={!canSend}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Priority + Recipients row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Priority chips */}
        <div className="flex items-center gap-1">
          {PRIORITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPriority(opt.value)}
              className={cn(
                "inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors",
                priority === opt.value ? opt.activeClassName : opt.className
              )}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>

        {/* Email recipients */}
        {canEmail && recipients.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 cursor-pointer select-none">
              <Checkbox checked={!skipEmail} onCheckedChange={(checked) => setSkipEmail(!checked)} className="h-3.5 w-3.5" />
              <span className="text-[11px] text-muted-foreground">Varsle via e-post</span>
            </label>
            {!skipEmail && (
              <RecipientSummary
                recipients={recipients}
                selectedEmails={selectedEmails}
                expanded={showRecipients}
                onToggleExpand={() => setShowRecipients(!showRecipients)}
                onToggleRecipient={toggleRecipient}
              />
            )}
          </div>
        )}
      </div>

      {/* Expanded recipient list — only when some are deselected or user clicked Endre */}
      {canEmail && recipients.length > 0 && showRecipients && !skipEmail && (
        <div className="rounded-md bg-muted/20 px-2 py-1.5 space-y-0.5">
          {recipients.map((r) => (
            <label key={r.email} className="flex items-center gap-2 px-1 py-0.5 rounded hover:bg-muted/40 cursor-pointer">
              <Checkbox checked={selectedEmails.has(r.email)} onCheckedChange={() => toggleRecipient(r.email)} className="h-3 w-3" />
              <span className="text-[11px] text-foreground">{r.name}</span>
              {r.isResponsible && <span className="text-[10px] font-medium text-primary/70">(ansvarlig)</span>}
              <span className="text-[10px] text-muted-foreground">{r.email}</span>
            </label>
          ))}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground select-none hidden sm:block">
        Enter for ny linje · {navigator.platform?.includes("Mac") ? "⌘" : "Ctrl"}+Enter for å sende
      </p>
    </div>
  );
}
