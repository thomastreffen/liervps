import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  MessagesSquare,
  CheckCircle2,
  FolderOpen,
  CalendarDays,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { Button } from "@/components/ui/button";

/* ── Types ── */

interface RoomCardProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick?: () => void;
  extra?: React.ReactNode;
}

interface ProjectRoomsProps {
  jobId: string;
  onOpenPlan: () => void;
  onOpenRoom: (room: string) => void;
}

/* ── Room Card ── */

function RoomCard({ icon, title, subtitle, onClick, extra }: RoomCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-2xl",
        "border border-border/40 bg-card text-card-foreground",
        "min-h-[320px] w-full p-10",
        "shadow-sm transition-all duration-200",
        "hover:shadow-md hover:shadow-foreground/[0.04] hover:border-border/70 hover:scale-[1.01]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/8 text-primary">
        {icon}
      </div>
      <div className="text-center space-y-1.5">
        <h3 className="text-lg font-bold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {extra}
    </button>
  );
}

/* ── Main Component ── */

export function ProjectRooms({ jobId, onOpenPlan, onOpenRoom }: ProjectRoomsProps) {
  const navigate = useNavigate();
  const [counts, setCounts] = useState({ conversations: 0, tasks: 0, docs: 0, schedule: 0 });
  const [nextBlock, setNextBlock] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCounts = useCallback(async () => {
    setLoading(true);
    const today = new Date().toISOString().split("T")[0];

    const [threadRes, taskRes, docRes, scheduleRes, nextRes] = await Promise.all([
      supabase.from("conversation_threads")
        .select("id", { count: "exact", head: true })
        .eq("project_id", jobId)
        .eq("is_archived", false),
      supabase.from("job_tasks")
        .select("id", { count: "exact", head: true })
        .eq("job_id", jobId)
        .neq("status", "completed"),
      supabase.from("docs_files")
        .select("id", { count: "exact", head: true })
        .eq("project_id", jobId),
      supabase.from("job_tasks")
        .select("id", { count: "exact", head: true })
        .eq("job_id", jobId)
        .not("scheduled_date", "is", null)
        .gte("scheduled_date", today),
      // Neste planlagte blokk
      supabase.from("job_tasks")
        .select("scheduled_date")
        .eq("job_id", jobId)
        .not("scheduled_date", "is", null)
        .gte("scheduled_date", today)
        .order("scheduled_date", { ascending: true })
        .limit(1),
    ]);

    setCounts({
      conversations: threadRes.count ?? 0,
      tasks: taskRes.count ?? 0,
      docs: docRes.count ?? 0,
      schedule: scheduleRes.count ?? 0,
    });

    if (nextRes.data && nextRes.data.length > 0 && nextRes.data[0].scheduled_date) {
      setNextBlock(format(new Date(nextRes.data[0].scheduled_date), "EEEE d. MMM", { locale: nb }));
    }
    setLoading(false);
  }, [jobId]);

  useEffect(() => { fetchCounts(); }, [fetchCounts]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const scheduleSubtitle = counts.schedule === 0
    ? "Ingen planlagte hendelser"
    : `${counts.schedule} planlagte ${counts.schedule === 1 ? "hendelse" : "hendelser"}${nextBlock ? ` · Neste: ${nextBlock}` : ""}`;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-4xl mx-auto">
      <RoomCard
        icon={<MessagesSquare className="h-7 w-7" />}
        title="Samtaler"
        subtitle={counts.conversations === 0 ? "Ingen samtaler ennå" : `${counts.conversations} ${counts.conversations === 1 ? "oppdatering" : "oppdateringer"}`}
        onClick={() => onOpenRoom("samtaler")}
      />
      <RoomCard
        icon={<CheckCircle2 className="h-7 w-7" />}
        title="Oppgaver"
        subtitle={counts.tasks === 0 ? "Ingen åpne oppgaver" : `${counts.tasks} åpne ${counts.tasks === 1 ? "oppgave" : "oppgaver"}`}
        onClick={() => onOpenRoom("oppgaver")}
      />
      <RoomCard
        icon={<FolderOpen className="h-7 w-7" />}
        title="Dokumenter"
        subtitle={counts.docs === 0 ? "Ingen filer ennå" : `${counts.docs} ${counts.docs === 1 ? "fil" : "filer"}`}
        onClick={() => onOpenRoom("dokumenter")}
      />
      <RoomCard
        icon={<CalendarDays className="h-7 w-7" />}
        title="Tidsplan"
        subtitle={scheduleSubtitle}
        onClick={onOpenPlan}
        extra={
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground mt-1"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/projects/plan?project=${jobId}`);
            }}
          >
            <ExternalLink className="h-3 w-3" />
            Åpne ressursplan
          </Button>
        }
      />
    </div>
  );
}
