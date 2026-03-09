import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Send, CheckCircle2, Loader2, Calendar, ToggleLeft, ToggleRight,
  StickyNote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type ComposerMode = "note" | "task";

interface ActivityComposerProps {
  entityType: string;        // "lead" | "job" | "customer"
  entityId: string;
  /** Force a specific mode (hides toggle) */
  forcedMode?: ComposerMode;
  placeholder?: string;
  onSubmitted?: () => void;
  className?: string;
}

export function ActivityComposer({
  entityType,
  entityId,
  forcedMode,
  placeholder,
  onSubmitted,
  className,
}: ActivityComposerProps) {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [mode, setMode] = useState<ComposerMode>(forcedMode || "note");
  const [taskDate, setTaskDate] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isTask = forcedMode === "task" || mode === "task";

  const handleSubmit = async () => {
    if (!text.trim() || !user) return;
    setSending(true);

    try {
      if (isTask) {
        // For leads, log as activity. For jobs, insert into job_tasks.
        if (entityType === "job") {
          await (supabase as any).from("job_tasks").insert({
            job_id: entityId,
            title: text.trim(),
            status: "pending",
            created_by: user.id,
            scheduled_date: taskDate || null,
          });
        }
        // Always log to activity_log
        await supabase.from("activity_log").insert({
          entity_id: entityId,
          entity_type: entityType,
          action: "task_created",
          type: "task",
          title: text.trim(),
          description: text.trim(),
          performed_by: user.id,
          metadata: taskDate ? { scheduled_date: taskDate } : {},
        });
        toast.success("Oppgave opprettet");
      } else {
        await supabase.from("activity_log").insert({
          entity_id: entityId,
          entity_type: entityType,
          action: "note_added",
          type: "note",
          title: "Notat",
          description: text.trim(),
          performed_by: user.id,
        });
        toast.success("Notat lagt til");
      }

      setText("");
      setTaskDate("");
      if (!forcedMode) setMode("note");
      onSubmitted?.();
    } catch (err) {
      console.error("[ActivityComposer] Error:", err);
      toast.error("Kunne ikke lagre");
    } finally {
      setSending(false);
    }
  };

  const defaultPlaceholder = isTask
    ? "Hva skal gjøres?"
    : "Skriv et notat til teamet…";

  return (
    <div className={cn("rounded-xl border border-border/50 bg-card p-4 space-y-3", className)}>
      <Textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder || defaultPlaceholder}
        className="min-h-[72px] border-0 bg-transparent p-0 focus-visible:ring-0 resize-none text-sm"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit();
        }}
      />

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

      <div className="flex items-center justify-between pt-1 border-t border-border/30">
        <div className="flex items-center gap-2">
          {!forcedMode && (
            <button
              onClick={() => setMode(mode === "task" ? "note" : "task")}
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
          {forcedMode === "note" && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <StickyNote className="h-3.5 w-3.5" /> Notat
            </span>
          )}
        </div>

        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!text.trim() || sending}
          className="gap-1.5 text-xs rounded-lg h-7"
        >
          {sending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : isTask ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
          {isTask ? "Opprett" : "Lagre"}
        </Button>
      </div>
    </div>
  );
}
