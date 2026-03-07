import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import {
  CalendarPlus, Clock, User, Trash2, CalendarDays, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ScheduleBlockRow {
  id: string;
  start_at: string;
  end_at: string;
  title: string;
  match_state: string;
  technician_name?: string;
  technician_color?: string;
}

interface ProjectScheduleBlocksProps {
  projectId: string;
  onPlanNew: () => void;
}

const STATE_LABELS: Record<string, string> = {
  manual: "Manuell",
  confirmed: "Bekreftet",
  auto: "Auto",
  needs_confirmation: "Trenger bekreftelse",
  external: "Ekstern",
};

export function ProjectScheduleBlocks({ projectId, onPlanNew }: ProjectScheduleBlocksProps) {
  const [blocks, setBlocks] = useState<ScheduleBlockRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBlocks = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("schedule_blocks")
      .select(`
        id, start_at, end_at, title, match_state,
        technicians!inner(name, color)
      `)
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("start_at", { ascending: true })
      .limit(20);

    const mapped: ScheduleBlockRow[] = (data || []).map((row: any) => ({
      id: row.id,
      start_at: row.start_at,
      end_at: row.end_at,
      title: row.title,
      match_state: row.match_state,
      technician_name: row.technicians?.name,
      technician_color: row.technicians?.color,
    }));

    setBlocks(mapped);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchBlocks(); }, [fetchBlocks]);

  const handleRemove = useCallback(async (blockId: string) => {
    const { error } = await supabase
      .from("schedule_blocks")
      .update({ deleted_at: new Date().toISOString() } as any)
      .eq("id", blockId);
    if (error) {
      toast.error("Kunne ikke fjerne fra plan");
    } else {
      toast.success("Fjernet fra plan");
      fetchBlocks();
    }
  }, [fetchBlocks]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Empty state
  if (blocks.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 p-6 sm:p-8 text-center space-y-3">
        <div className="flex justify-center">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <CalendarDays className="h-6 w-6 text-primary" />
          </div>
        </div>
        <p className="text-sm font-semibold text-foreground">Ingen plan ennå</p>
        <p className="text-xs text-muted-foreground">
          Planlegg første arbeidsøkt for dette prosjektet
        </p>
        <Button onClick={onPlanNew} className="gap-1.5 rounded-xl">
          <CalendarPlus className="h-4 w-4" />
          Planlegg første arbeidsøkt
        </Button>
      </div>
    );
  }

  const now = new Date();
  const upcoming = blocks.filter((b) => new Date(b.end_at) >= now);
  const past = blocks.filter((b) => new Date(b.end_at) < now);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          Planlagte arbeidsøkter
          <Badge variant="secondary" className="text-[10px] h-5">{blocks.length}</Badge>
        </h3>
        <Button variant="outline" size="sm" onClick={onPlanNew} className="gap-1.5 rounded-xl text-xs h-8">
          <CalendarPlus className="h-3.5 w-3.5" />
          Ny økt
        </Button>
      </div>

      {/* Upcoming blocks */}
      {upcoming.length > 0 && (
        <div className="space-y-2">
          {upcoming.map((block) => (
            <BlockCard key={block.id} block={block} onRemove={handleRemove} />
          ))}
        </div>
      )}

      {/* Past blocks */}
      {past.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Tidligere</p>
          {past.map((block) => (
            <BlockCard key={block.id} block={block} onRemove={handleRemove} isPast />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Block Card ── */

function BlockCard({
  block,
  onRemove,
  isPast,
}: {
  block: ScheduleBlockRow;
  onRemove: (id: string) => void;
  isPast?: boolean;
}) {
  const start = new Date(block.start_at);
  const end = new Date(block.end_at);
  const durationMin = Math.round((end.getTime() - start.getTime()) / 60000);
  const durationLabel = durationMin >= 60
    ? `${Math.floor(durationMin / 60)}t ${durationMin % 60 > 0 ? `${durationMin % 60}m` : ""}`
    : `${durationMin}m`;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border p-3 transition-colors",
        isPast
          ? "border-border/30 bg-muted/20 opacity-60"
          : "border-border/40 bg-card hover:bg-secondary/30"
      )}
    >
      {/* Color dot */}
      <span
        className="h-3 w-3 rounded-full shrink-0"
        style={{ backgroundColor: block.technician_color || "hsl(var(--primary))" }}
      />

      {/* Info */}
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold truncate">
            {format(start, "EEE d. MMM", { locale: nb })}
          </p>
          <span className="text-xs text-muted-foreground">
            {format(start, "HH:mm")} – {format(end, "HH:mm")}
          </span>
          <span className="text-[10px] text-muted-foreground/70">({durationLabel})</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <User className="h-3 w-3" />
          <span className="truncate">{block.technician_name || "Ukjent"}</span>
          <span className="text-[10px]">· {STATE_LABELS[block.match_state] || block.match_state}</span>
        </div>
      </div>

      {/* Remove button */}
      {!isPast && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={() => onRemove(block.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
