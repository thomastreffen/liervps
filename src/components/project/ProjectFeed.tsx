import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, formatDistanceToNow } from "date-fns";
import { nb } from "date-fns/locale";
import {
  Send, CheckCircle2, Mail, FileText, AlertTriangle,
  MessageSquare, Plus, Loader2, MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface FeedItem {
  id: string;
  type: "message" | "task" | "email" | "status_change" | "document" | "system";
  title: string;
  body?: string;
  created_at: string;
  author?: string;
  metadata?: Record<string, any>;
}

interface ProjectFeedProps {
  jobId: string;
  jobTitle: string;
  customer: string;
  internalNumber: string | null;
}

export function ProjectFeed({ jobId, jobTitle, customer, internalNumber }: ProjectFeedProps) {
  const { user } = useAuth();
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [composerMode, setComposerMode] = useState<"idle" | "message" | "task">("idle");
  const [composerText, setComposerText] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    const items: FeedItem[] = [];

    // Fetch activity logs, communication logs, tasks in parallel
    const [activityRes, commRes, tasksRes, docsRes] = await Promise.all([
      supabase.from("activity_log")
        .select("id, action, title, description, created_at, performed_by, type")
        .eq("entity_id", jobId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("communication_logs")
        .select("id, subject, body_preview, created_at, direction, mode, to_recipients, created_by")
        .eq("entity_id", jobId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase.from("job_tasks")
        .select("id, title, status, created_at, scheduled_date")
        .eq("job_id", jobId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase.from("documents")
        .select("id, file_name, created_at, uploaded_by, category")
        .eq("entity_id", jobId)
        .eq("entity_type", "job")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    // Activity logs → feed items
    for (const a of (activityRes.data || [])) {
      if (a.type === "note" || a.type === "comment" || a.action === "note_added") {
        items.push({
          id: `act-${a.id}`,
          type: "message",
          title: a.title || "Melding",
          body: a.description || undefined,
          created_at: a.created_at,
          author: a.performed_by || undefined,
        });
      } else if (a.action === "status_changed") {
        items.push({
          id: `act-${a.id}`,
          type: "status_change",
          title: a.title || "Statusendring",
          body: a.description || undefined,
          created_at: a.created_at,
          author: a.performed_by || undefined,
        });
      }
    }

    // Emails → feed items
    for (const c of (commRes.data || [])) {
      items.push({
        id: `comm-${c.id}`,
        type: "email",
        title: c.subject || "(Uten emne)",
        body: c.body_preview || undefined,
        created_at: c.created_at,
        metadata: { direction: c.direction, mode: c.mode },
      });
    }

    // Tasks → feed items
    for (const t of (tasksRes.data || [])) {
      items.push({
        id: `task-${t.id}`,
        type: "task",
        title: t.title,
        created_at: t.created_at,
        metadata: { status: t.status, scheduled_date: t.scheduled_date },
      });
    }

    // Documents → feed items
    for (const d of (docsRes.data || [])) {
      items.push({
        id: `doc-${d.id}`,
        type: "document",
        title: d.file_name,
        created_at: d.created_at,
        metadata: { category: d.category },
      });
    }

    // Sort chronologically (newest first)
    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setFeedItems(items);
    setLoading(false);
  }, [jobId]);

  useEffect(() => { fetchFeed(); }, [fetchFeed]);

  const handleSendMessage = async () => {
    if (!composerText.trim() || !user) return;
    setSending(true);
    const { error } = await supabase.from("activity_log").insert({
      entity_id: jobId,
      entity_type: "job",
      action: "note_added",
      type: "note",
      title: "Melding",
      description: composerText.trim(),
      performed_by: user.id,
    });
    if (error) {
      toast.error("Kunne ikke sende melding");
    } else {
      toast.success("Melding lagt til");
      setComposerText("");
      setComposerMode("idle");
      fetchFeed();
    }
    setSending(false);
  };

  const handleCreateTask = async () => {
    if (!taskTitle.trim() || !user) return;
    setSending(true);
    const { error } = await (supabase as any).from("job_tasks").insert({
      job_id: jobId,
      title: taskTitle.trim(),
      status: "pending",
      created_by: user.id,
    });
    if (error) {
      toast.error("Kunne ikke opprette oppgave");
    } else {
      toast.success("Oppgave opprettet");
      setTaskTitle("");
      setComposerMode("idle");
      fetchFeed();
    }
    setSending(false);
  };

  const typeIcon = (type: FeedItem["type"]) => {
    switch (type) {
      case "message": return <MessageSquare className="h-4 w-4 text-primary" />;
      case "task": return <CheckCircle2 className="h-4 w-4 text-success" />;
      case "email": return <Mail className="h-4 w-4 text-accent" />;
      case "document": return <FileText className="h-4 w-4 text-muted-foreground" />;
      case "status_change": return <AlertTriangle className="h-4 w-4 text-muted-foreground" />;
      default: return <MoreHorizontal className="h-4 w-4 text-muted-foreground" />;
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

  return (
    <div className="space-y-6">
      {/* Composer */}
      <div className="rounded-xl border border-border/50 bg-card p-4">
        {composerMode === "idle" ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setComposerMode("message"); setTimeout(() => inputRef.current?.focus(), 50); }}
              className="flex-1 text-left text-sm text-muted-foreground/60 rounded-lg border border-border/40 px-4 py-2.5 hover:border-primary/30 hover:text-muted-foreground transition-colors"
            >
              Skriv melding eller opprett oppgave…
            </button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs rounded-lg"
              onClick={() => setComposerMode("task")}
            >
              <Plus className="h-3.5 w-3.5" />
              Oppgave
            </Button>
          </div>
        ) : composerMode === "message" ? (
          <div className="space-y-3">
            <Textarea
              ref={inputRef}
              value={composerText}
              onChange={(e) => setComposerText(e.target.value)}
              placeholder="Skriv en melding til teamet…"
              className="min-h-[80px] border-0 bg-transparent p-0 focus-visible:ring-0 resize-none text-sm"
            />
            <div className="flex items-center justify-between">
              <button
                onClick={() => { setComposerMode("idle"); setComposerText(""); }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Avbryt
              </button>
              <Button
                size="sm"
                onClick={handleSendMessage}
                disabled={!composerText.trim() || sending}
                className="gap-1.5 text-xs rounded-lg"
              >
                {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Send melding
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Input
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="Hva skal gjøres?"
              className="border-0 bg-transparent p-0 h-auto focus-visible:ring-0 text-sm font-medium"
              onKeyDown={(e) => e.key === "Enter" && handleCreateTask()}
            />
            <div className="flex items-center justify-between">
              <button
                onClick={() => { setComposerMode("idle"); setTaskTitle(""); }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Avbryt
              </button>
              <Button
                size="sm"
                onClick={handleCreateTask}
                disabled={!taskTitle.trim() || sending}
                className="gap-1.5 text-xs rounded-lg"
              >
                {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                Opprett oppgave
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Feed */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : feedItems.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground/60 text-sm">Ingen aktivitet ennå. Skriv en melding for å komme i gang.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {feedItems.map(item => (
            <div
              key={item.id}
              className={cn(
                "flex gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-muted/30",
                item.type === "email" && "bg-accent/[0.03]"
              )}
            >
              <div className="mt-0.5 shrink-0">
                {typeIcon(item.type)}
              </div>
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