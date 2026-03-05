import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, ChevronRight, AlertCircle, Circle, Plus, Loader2 } from "lucide-react";
import { format, isPast } from "date-fns";
import { nb } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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

export function MyTasks({ tasks, onTaskCreated }: MyTasksProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeCompanyId } = useCompanyContext();
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!newTitle.trim() || !user || saving) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("tasks").insert({
        title: newTitle.trim(),
        company_id: activeCompanyId,
        created_by: user.id,
        owner_user_id: user.id,
        status: "open",
        priority: "normal",
      } as any);
      if (error) throw error;
      toast.success("Oppgave opprettet");
      setNewTitle("");
      setShowCreate(false);
      onTaskCreated?.();
    } catch (e: any) {
      toast.error("Kunne ikke opprette oppgave");
    } finally {
      setSaving(false);
    }
  };

  const inlineCreate = (
    <div className="flex items-center gap-2 px-4 py-2">
      <Input
        autoFocus
        value={newTitle}
        onChange={(e) => setNewTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleCreate();
          if (e.key === "Escape") { setShowCreate(false); setNewTitle(""); }
        }}
        placeholder="Skriv oppgavetittel..."
        className="h-8 text-sm"
        disabled={saving}
      />
      <Button size="sm" className="h-8 px-3 shrink-0" onClick={handleCreate} disabled={!newTitle.trim() || saving}>
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Legg til"}
      </Button>
      <Button size="sm" variant="ghost" className="h-8 px-2 shrink-0" onClick={() => { setShowCreate(false); setNewTitle(""); }}>
        ✕
      </Button>
    </div>
  );

  if (tasks.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-3 border-2 border-success/20">
          <CheckCircle2 className="h-7 w-7 text-success/50" />
        </div>
        <p className="text-sm text-muted-foreground/50 font-medium mb-4">Ingen åpne oppgaver – alt i rute!</p>
        {showCreate ? (
          inlineCreate
        ) : (
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Opprett ny oppgave
          </button>
        )}
      </div>
    );
  }

  return (
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
              <span className={`text-[11px] shrink-0 flex items-center gap-1 font-medium ${
                overdue ? "text-destructive" : "text-muted-foreground/50"
              }`}>
                {overdue && <AlertCircle className="h-3 w-3" />}
                {format(new Date(t.due_at), "d. MMM", { locale: nb })}
              </span>
            )}
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/15 group-hover:text-primary/40 shrink-0" />
          </button>
        );
      })}

      {/* Add task row */}
      {showCreate ? (
        inlineCreate
      ) : (
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-3 w-full rounded-xl px-4 py-2.5 text-left hover:bg-primary/5 transition-colors text-muted-foreground/40 hover:text-primary"
        >
          <Plus className="h-[18px] w-[18px] shrink-0 stroke-[2]" />
          <span className="text-sm font-medium">Legg til oppgave</span>
        </button>
      )}
    </div>
  );
}
