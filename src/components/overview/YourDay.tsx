import { useNavigate } from "react-router-dom";
import { Clock, MapPin, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";

export interface DayBlock {
  id: string;
  start_at: string;
  end_at: string;
  title: string;
  project_id: string | null;
  project_title: string | null;
  location: string | null;
  technician_name: string | null;
}

export function YourDay({ blocks }: { blocks: DayBlock[] }) {
  const navigate = useNavigate();

  if (blocks.length === 0) {
    return (
      <div className="text-center py-10">
        <Clock className="h-7 w-7 text-muted-foreground/30 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground/60">Du har ingen planlagte jobber i dag</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {blocks.map((b) => (
        <button
          key={b.id}
          onClick={() => b.project_id && navigate(`/projects/${b.project_id}`)}
          disabled={!b.project_id}
          className="flex items-center gap-3 w-full rounded-xl px-3.5 py-3 text-left hover:bg-muted/50 transition-colors group disabled:opacity-60 disabled:cursor-default"
        >
          <div className="text-xs font-mono text-muted-foreground w-[72px] shrink-0 text-right">
            {format(new Date(b.start_at), "HH:mm")} – {format(new Date(b.end_at), "HH:mm")}
          </div>
          <div className="h-8 w-0.5 rounded-full bg-primary/30 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
              {b.project_title || b.title}
            </p>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              {b.location && (
                <span className="flex items-center gap-0.5 truncate">
                  <MapPin className="h-2.5 w-2.5" /> {b.location}
                </span>
              )}
              {b.technician_name && <span>{b.technician_name}</span>}
            </div>
          </div>
          {b.project_id && (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/20 group-hover:text-primary/40 shrink-0" />
          )}
        </button>
      ))}
    </div>
  );
}
