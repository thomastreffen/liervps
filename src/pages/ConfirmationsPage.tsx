import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { Check, Search, X, CalendarDays, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface ConfirmationBlock {
  id: string;
  technician_id: string;
  project_id: string | null;
  start_at: string;
  end_at: string;
  title: string;
  location: string | null;
  match_confidence: number;
  match_reason: string | null;
  match_state: string;
  technician_name: string;
  technician_color: string | null;
  suggested_project_title: string | null;
  suggested_project_id: string | null;
}

interface ProjectOption {
  id: string;
  title: string;
}

export default function ConfirmationsPage() {
  const navigate = useNavigate();
  const [blocks, setBlocks] = useState<ConfirmationBlock[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectingProjectFor, setSelectingProjectFor] = useState<string | null>(null);

  const fetchBlocks = useCallback(async () => {
    const { data, error } = await supabase
      .from("schedule_blocks")
      .select(`
        id, technician_id, project_id, start_at, end_at, title, location,
        match_confidence, match_reason, match_state,
        technicians!inner(name, color),
        events(title)
      `)
      .eq("match_state", "needs_confirmation")
      .order("start_at", { ascending: true });

    if (!error && data) {
      setBlocks(data.map((row: any) => ({
        ...row,
        technician_name: row.technicians?.name ?? "Ukjent",
        technician_color: row.technicians?.color ?? null,
        suggested_project_title: row.events?.title ?? null,
        suggested_project_id: row.project_id,
      })));
    }
    setLoading(false);
  }, []);

  const fetchProjects = useCallback(async () => {
    const { data } = await supabase
      .from("events")
      .select("id, title")
      .order("title", { ascending: true })
      .limit(200);
    if (data) setProjects(data);
  }, []);

  useEffect(() => {
    fetchBlocks();
    fetchProjects();
  }, [fetchBlocks, fetchProjects]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("confirmations-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "schedule_blocks" }, () => {
        fetchBlocks();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchBlocks]);

  const handleConfirm = async (blockId: string) => {
    const block = blocks.find(b => b.id === blockId);
    if (!block?.suggested_project_id) return;

    const { error } = await supabase
      .from("schedule_blocks")
      .update({ match_state: "confirmed", project_id: block.suggested_project_id })
      .eq("id", blockId);

    if (error) {
      toast.error("Kunne ikke bekrefte");
    } else {
      toast.success("Bekreftet ✓");
      setBlocks(prev => prev.filter(b => b.id !== blockId));
    }
  };

  const handleAssignProject = async (blockId: string, projectId: string) => {
    const { error } = await supabase
      .from("schedule_blocks")
      .update({ match_state: "confirmed", project_id: projectId })
      .eq("id", blockId);

    if (error) {
      toast.error("Kunne ikke koble til prosjekt");
    } else {
      toast.success("Koblet til prosjekt ✓");
      setBlocks(prev => prev.filter(b => b.id !== blockId));
      setSelectingProjectFor(null);
    }
  };

  const handleMarkExternal = async (blockId: string) => {
    const { error } = await supabase
      .from("schedule_blocks")
      .update({ match_state: "external", project_id: null })
      .eq("id", blockId);

    if (error) {
      toast.error("Kunne ikke markere som ekstern");
    } else {
      toast.success("Markert som ekstern");
      setBlocks(prev => prev.filter(b => b.id !== blockId));
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/projects/plan")} className="rounded-lg">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2.5">
            <CalendarDays className="h-6 w-6 text-primary" />
            Bekreftelser
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Koble Outlook-hendelser til riktig prosjekt
          </p>
        </div>
        <Badge variant="secondary" className="ml-auto text-sm">
          {blocks.length} venter
        </Badge>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Laster...</div>
      ) : blocks.length === 0 ? (
        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <Check className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-lg font-semibold">Alt er bekreftet!</h2>
          <p className="text-sm text-muted-foreground mt-1">Ingen ventende bekreftelser</p>
        </div>
      ) : (
        <div className="space-y-2">
          {blocks.map((block) => (
            <div
              key={block.id}
              className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border border-border/40 bg-card hover:bg-accent/5 transition-colors"
            >
              {/* Technician + time */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div
                  className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                  style={{ backgroundColor: block.technician_color || "#6366f1" }}
                >
                  {block.technician_name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{block.title || "Uten tittel"}</p>
                  <p className="text-xs text-muted-foreground">
                    {block.technician_name} · {format(new Date(block.start_at), "EEE d. MMM HH:mm", { locale: nb })}–{format(new Date(block.end_at), "HH:mm")}
                  </p>
                </div>
              </div>

              {/* Suggested project + confidence */}
              <div className="flex items-center gap-2 min-w-0">
                {block.suggested_project_title ? (
                  <Badge variant="outline" className="text-xs truncate max-w-[200px]">
                    {block.suggested_project_title}
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground italic">Ingen forslag</span>
                )}
                {block.match_confidence > 0 && (
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {block.match_confidence}%
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                {selectingProjectFor === block.id ? (
                  <Select onValueChange={(v) => handleAssignProject(block.id, v)}>
                    <SelectTrigger className="w-[200px] h-8 text-xs">
                      <SelectValue placeholder="Velg prosjekt..." />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map(p => (
                        <SelectItem key={p.id} value={p.id} className="text-xs">{p.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <>
                    {block.suggested_project_id && (
                      <Button
                        size="sm"
                        className="h-7 text-xs gap-1 rounded-lg"
                        onClick={() => handleConfirm(block.id)}
                      >
                        <Check className="h-3 w-3" />
                        Godta
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1 rounded-lg"
                      onClick={() => setSelectingProjectFor(block.id)}
                    >
                      <Search className="h-3 w-3" />
                      Velg
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1 rounded-lg text-muted-foreground"
                      onClick={() => handleMarkExternal(block.id)}
                    >
                      <X className="h-3 w-3" />
                      Ekstern
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
