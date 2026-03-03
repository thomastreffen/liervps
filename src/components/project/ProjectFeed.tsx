import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { nb } from "date-fns/locale";
import {
  Send, CheckCircle2, Mail, FileText, AlertTriangle,
  MessageSquare, Loader2, Calendar, Paperclip, ToggleLeft, ToggleRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/* ── Types ── */

interface FeedItem {
  id: string;
  type: "message" | "task" | "email" | "status_change" | "document" | "system";
  title: string;
  body?: string;
  created_at: string;
  author?: string;
  metadata?: Record<string, any>;
}

export type FeedFilter = "all" | "conversations" | "tasks" | "documents";

interface ProjectFeedProps {
  jobId: string;
  jobTitle: string;
  customer: string;
  internalNumber: string | null;
  filter?: FeedFilter;
}

/* ── Feed Component ── */

export function ProjectFeed({ jobId, jobTitle, customer, internalNumber, filter = "all" }: ProjectFeedProps) {
  const { user } = useAuth();
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Composer state
  const [composerText, setComposerText] = useState("");
  const [isTask, setIsTask] = useState(filter === "tasks");
  const [taskDate, setTaskDate] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* ── Fetch feed ── */
  const fetchFeed = useCallback(async () => {
    setLoading(true);
    const items: FeedItem[] = [];

    const fetchMessages = filter === "all" || filter === "conversations";
    const fetchEmails = filter === "all" || filter === "conversations";
    const fetchTasks = filter === "all" || filter === "tasks";
    const fetchDocs = filter === "all" || filter === "documents";

    const emptyRes = { data: [] as any[] };

    const [activityRes, commRes, tasksRes, docsRes] = await Promise.all([
      fetchMessages
        ? supabase.from("activity_log")
            .select("id, action, title, description, created_at, performed_by, type")
            .eq("entity_id", jobId)
            .in("type", ["note", "comment"])
            .order("created_at", { ascending: false })
            .limit(50)
        : emptyRes,
      fetchEmails
        ? supabase.from("communication_logs")
            .select("id, subject, body_preview, created_at, direction, mode, to_recipients, created_by")
            .eq("entity_id", jobId)
            .order("created_at", { ascending: false })
            .limit(20)
        : emptyRes,
      fetchTasks
        ? supabase.from("job_tasks")
            .select("id, title, status, created_at, scheduled_date")
            .eq("job_id", jobId)
            .order("created_at", { ascending: false })
            .limit(50)
        : emptyRes,
      fetchDocs
        ? supabase.from("documents")
            .select("id, file_name, created_at, uploaded_by, category")
            .eq("entity_id", jobId)
            .eq("entity_type", "job")
            .is("deleted_at", null)
            .order("created_at", { ascending: false })
            .limit(50)
        : emptyRes,
    ]);

    for (const a of (activityRes.data || [])) {
      if (a.type === "note" || a.type === "comment" || a.action === "note_added") {
        items.push({ id: `act-${a.id}`, type: "message", title: a.title || "Melding", body: a.description || undefined, created_at: a.created_at, author: a.performed_by || undefined });
      } else if (a.action === "status_changed") {
        items.push({ id: `act-${a.id}`, type: "status_change", title: a.title || "Statusendring", body: a.description || undefined, created_at: a.created_at, author: a.performed_by || undefined });
      }
    }

    for (const c of (commRes.data || [])) {
      items.push({ id: `comm-${c.id}`, type: "email", title: c.subject || "(Uten emne)", body: c.body_preview || undefined, created_at: c.created_at, metadata: { direction: c.direction, mode: c.mode } });
    }

    for (const t of (tasksRes.data || [])) {
      items.push({ id: `task-${t.id}`, type: "task", title: t.title, created_at: t.created_at, metadata: { status: t.status, scheduled_date: t.scheduled_date } });
    }

    for (const d of (docsRes.data || [])) {
      items.push({ id: `doc-${d.id}`, type: "document", title: d.file_name, created_at: d.created_at, metadata: { category: d.category } });
    }

    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setFeedItems(items);
    setLoading(false);
  }, [jobId, filter]);

  useEffect(() => { fetchFeed(); }, [fetchFeed]);

  /* ── Send message or create task ── */
  const handleSubmit = async () => {
    if (!composerText.trim() || !user) return;
    setSending(true);

    if (isTask) {
      const { error } = await (supabase as any).from("job_tasks").insert({
        job_id: jobId,
        title: composerText.trim(),
        status: "pending",
        created_by: user.id,
        scheduled_date: taskDate || null,
      });
      if (error) { toast.error("Kunne ikke opprette oppgave"); }
      else { toast.success("Oppgave opprettet"); }
    } else {
      const { error } = await supabase.from("activity_log").insert({
        entity_id: jobId,
        entity_type: "job",
        action: "note_added",
        type: "note",
        title: "Melding",
        description: composerText.trim(),
        performed_by: user.id,
      });
      if (error) { toast.error("Kunne ikke sende melding"); }
      else { toast.success("Melding lagt til"); }
    }

    setComposerText("");
    if (filter !== "tasks") setIsTask(false);
    setTaskDate("");
    setSending(false);
    fetchFeed();
  };

  /* ── Icon helpers ── */
  const typeIcon = (type: FeedItem["type"]) => {
    switch (type) {
      case "message": return <MessageSquare className="h-4 w-4 text-primary" />;
      case "task": return <CheckCircle2 className="h-4 w-4 text-success" />;
      case "email": return <Mail className="h-4 w-4 text-accent" />;
      case "document": return <FileText className="h-4 w-4 text-muted-foreground" />;
      case "status_change": return <AlertTriangle className="h-4 w-4 text-muted-foreground" />;
      default: return null;
    }
  };

  const typeLabel = (type: FeedItem["type"]) => {
    switch (type) {
      case "message": return "Melding";
      case "task": return "Oppgave";
      case "email": return "E-post";
      case "document": return "Dokument";
      case "status_change": return "Status";
      default: return "";
    }
  };

  const showComposer = filter !== "documents";
  const composerPlaceholder = filter === "tasks"
    ? "Hva skal gjøres?"
    : filter === "conversations"
      ? "Skriv en melding til teamet…"
      : isTask ? "Hva skal gjøres?" : "Skriv en melding til teamet…";
  const emptyMessage = filter === "conversations"
    ? "Ingen samtaler ennå. Skriv en melding for å komme i gang."
    : filter === "tasks"
      ? "Ingen oppgaver ennå. Opprett en oppgave for å komme i gang."
      : filter === "documents"
        ? "Ingen dokumenter lastet opp ennå."
        : "Ingen aktivitet ennå. Skriv en melding for å komme i gang.";

  return (
    <div className="space-y-6">
      {/* ── Composer ── */}
      {showComposer && (
        <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
          <Textarea
            ref={textareaRef}
            value={composerText}
            onChange={(e) => setComposerText(e.target.value)}
            placeholder={composerPlaceholder}
            className="min-h-[72px] border-0 bg-transparent p-0 focus-visible:ring-0 resize-none text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit();
            }}
          />

          {/* Task fields */}
          {isTask && (
            <div className="flex items-center gap-3 pt-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                <Input
                  type="date"
                  value={taskDate}
                  onChange={(e) => setTaskDate(e.target.value)}
                  className="h-7 w-auto border-border/40 text-xs px-2"
                />
              </div>
            </div>
          )}

          {/* Actions bar */}
          <div className="flex items-center justify-between pt-1 border-t border-border/30">
            <div className="flex items-center gap-2">
              {filter !== "tasks" && (
                <button
                  onClick={() => setIsTask(!isTask)}
                  className={cn(
                    "flex items-center gap-1.5 text-xs rounded-md px-2 py-1 transition-colors",
                    isTask
                      ? "bg-success/10 text-success font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  {isTask ? <ToggleRight className="h-3.5 w-3.5" /> : <ToggleLeft className="h-3.5 w-3.5" />}
                  Oppgave
                </button>
              )}
            </div>

            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!composerText.trim() || sending}
              className="gap-1.5 text-xs rounded-lg h-7"
            >
              {sending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : isTask ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              {isTask ? "Opprett" : "Send"}
            </Button>
          </div>
        </div>
      )}

      {/* ── Feed ── */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : feedItems.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground/60 text-sm">{emptyMessage}</p>
        </div>
      ) : (
        <div className="space-y-1">
          {feedItems.map(item => (
            <div
              key={item.id}
              className={cn(
                "flex gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-muted/30",
                item.type === "task" && "bg-success/[0.03]",
                item.type === "email" && "bg-accent/[0.03]"
              )}
            >
              <div className="mt-0.5 shrink-0">{typeIcon(item.type)}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] text-muted-foreground/50 uppercase tracking-wider font-medium">
                    {typeLabel(item.type)}
                  </span>
                  {item.type === "email" && item.metadata?.direction === "inbound" && (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-accent/30 text-accent">Inn</Badge>
                  )}
                  {item.type === "task" && item.metadata?.status && (
                    <Badge variant="secondary" className={cn(
                      "text-[9px] px-1.5 py-0",
                      item.metadata.status === "completed" && "text-success"
                    )}>
                      {item.metadata.status === "completed" ? "Fullført" : item.metadata.status === "in_progress" ? "Pågår" : "Åpen"}
                    </Badge>
                  )}
                  {item.type === "task" && item.metadata?.scheduled_date && (
                    <span className="text-[10px] text-muted-foreground/40 font-mono">
                      {item.metadata.scheduled_date}
                    </span>
                  )}
                  <span className="text-[11px] text-muted-foreground/40 ml-auto shrink-0">
                    {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: nb })}
                  </span>
                </div>
                <p className="text-sm text-foreground mt-0.5">{item.title}</p>
                {item.body && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.body}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
