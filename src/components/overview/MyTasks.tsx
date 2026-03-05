import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2, ChevronRight, AlertCircle, Circle, Plus, Loader2,
  CalendarIcon, Clock, Flag, Paperclip, X,
} from "lucide-react";
import { format, isPast } from "date-fns";
import { nb } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { toast } from "sonner";

export interface OverviewTask {
  id: string;
  title: string;
  due_at: string | null;
  linked_project_id: string | null;
  priority: string;
}

interface MyTasksProps {
  tasks: OverviewTask[];
  onTaskCreated?: () => void;
}

function InlineCreateForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const { user } = useAuth();
  const { activeCompanyId } = useCompanyContext();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("normal");
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [plannedStart, setPlannedStart] = useState("");
  const [plannedEnd, setPlannedEnd] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    if (!title.trim() || !user || saving) return;
    setSaving(true);
    try {
      const hasPlannedTime = !!plannedStart || !!plannedEnd;

      const { data, error } = await supabase.from("tasks").insert({
        title: title.trim(),
        description: description.trim() || null,
        company_id: activeCompanyId,
        created_by: user.id,
        owner_user_id: user.id,
        status: "open",
        priority,
        due_at: dueDate ? dueDate.toISOString() : null,
        planned_start_at: plannedStart ? new Date(plannedStart).toISOString() : null,
        planned_end_at: plannedEnd ? new Date(plannedEnd).toISOString() : null,
      } as any).select("id").single();
      if (error) throw error;
      const taskId = (data as any).id;

      // Upload attachments
      if (files.length > 0) {
        for (const file of files) {
          const path = `tasks/${taskId}/${Date.now()}-${file.name}`;
          await supabase.storage.from("user-documents").upload(path, file);
          await (supabase as any).from("task_attachments").insert({
            task_id: taskId,
            file_name: file.name,
            file_path: path,
            mime_type: file.type,
            file_size: file.size,
          });
        }
      }

      // Auto-sync to Outlook calendar if planned time is set
      if (hasPlannedTime) {
        try {
          await supabase.functions.invoke("sync-task-to-calendar", {
            body: { task_id: taskId },
          });
        } catch (e) {
          console.warn("Calendar sync failed:", e);
        }
      }

      toast.success("Oppgave opprettet");
      onCreated();
    } catch {
      toast.error("Kunne ikke opprette oppgave");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-t border-border bg-muted/20 p-4 space-y-3 animate-in slide-in-from-bottom-2 duration-200">
      {/* Title */}
      <div className="space-y-1">
        <Label className="text-xs font-medium text-muted-foreground">Tittel</Label>
        <Input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Hva skal gjøres?"
          className="h-9"
          onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
        />
      </div>

      {/* Description */}
      <div className="space-y-1">
        <Label className="text-xs font-medium text-muted-foreground">Beskrivelse</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Valgfri beskrivelse..."
          className="min-h-[56px] text-sm resize-none"
        />
      </div>

      {/* Priority + Due date row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Flag className="h-3 w-3" /> Prioritet
          </Label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Lav</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="high">Høy</SelectItem>
              <SelectItem value="critical">Kritisk</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <CalendarIcon className="h-3 w-3" /> Frist
          </Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full h-9 justify-start text-left text-sm font-normal",
                  !dueDate && "text-muted-foreground"
                )}
              >
                {dueDate ? format(dueDate, "d. MMM yyyy", { locale: nb }) : "Velg dato"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dueDate}
                onSelect={setDueDate}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Planned start/end */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" /> Planlagt start
          </Label>
          <Input
            type="datetime-local"
            value={plannedStart}
            onChange={(e) => setPlannedStart(e.target.value)}
            className="h-9 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" /> Planlagt slutt
          </Label>
          <Input
            type="datetime-local"
            value={plannedEnd}
            onChange={(e) => setPlannedEnd(e.target.value)}
            className="h-9 text-sm"
          />
        </div>
      </div>

      {/* Attachments */}
      <div className="space-y-1">
        <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
          <Paperclip className="h-3 w-3" /> Vedlegg
        </Label>
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
          }}
        />
        <div className="flex items-center gap-2 flex-wrap">
          <Button type="button" variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => fileRef.current?.click()}>
            <Plus className="h-3 w-3" /> Legg til fil
          </Button>
          {files.map((f, i) => (
            <span key={i} className="inline-flex items-center gap-1 text-xs bg-muted rounded-md px-2 py-1">
              {f.name}
              <button onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <Button size="sm" onClick={handleSubmit} disabled={!title.trim() || saving} className="gap-1.5">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Opprett oppgave
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Avbryt</Button>
      </div>
    </div>
  );
}

export function MyTasks({ tasks, onTaskCreated }: MyTasksProps) {
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);

  const handleCreated = () => {
    setShowCreate(false);
    onTaskCreated?.();
  };

  if (tasks.length === 0 && !showCreate) {
    return (
      <div className="text-center py-12">
        <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-3 border-2 border-success/20">
          <CheckCircle2 className="h-7 w-7 text-success/50" />
        </div>
        <p className="text-sm text-muted-foreground/50 font-medium mb-4">Ingen åpne oppgaver – alt i rute!</p>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Opprett ny oppgave
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Task list */}
      {tasks.length > 0 && (
        <div className="p-2">
          {tasks.map((t) => {
            const overdue = t.due_at && isPast(new Date(t.due_at));
            return (
              <button
                key={t.id}
                onClick={() => navigate(t.linked_project_id ? `/projects/${t.linked_project_id}` : "/tasks")}
                className="flex items-center gap-3 w-full rounded-xl px-4 py-3 text-left hover:bg-primary/5 transition-colors group"
              >
                <Circle className={`h-[18px] w-[18px] shrink-0 stroke-[2.5] ${overdue ? "text-destructive" : "text-border"}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground truncate group-hover:text-primary transition-colors">{t.title}</p>
                </div>
                {t.due_at && (
                  <span className={`text-[11px] shrink-0 flex items-center gap-1 font-medium ${overdue ? "text-destructive" : "text-muted-foreground/50"}`}>
                    {overdue && <AlertCircle className="h-3 w-3" />}
                    {format(new Date(t.due_at), "d. MMM", { locale: nb })}
                  </span>
                )}
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/15 group-hover:text-primary/40 shrink-0" />
              </button>
            );
          })}

          {/* Add button in list */}
          {!showCreate && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-3 w-full rounded-xl px-4 py-2.5 text-left hover:bg-primary/5 transition-colors text-muted-foreground/40 hover:text-primary"
            >
              <Plus className="h-[18px] w-[18px] shrink-0 stroke-[2]" />
              <span className="text-sm font-medium">Legg til oppgave</span>
            </button>
          )}
        </div>
      )}

      {/* Empty + create form */}
      {tasks.length === 0 && showCreate && (
        <InlineCreateForm onCreated={handleCreated} onCancel={() => setShowCreate(false)} />
      )}

      {/* Create form below list */}
      {tasks.length > 0 && showCreate && (
        <InlineCreateForm onCreated={handleCreated} onCancel={() => setShowCreate(false)} />
      )}
    </div>
  );
}
