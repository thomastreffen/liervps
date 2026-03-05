import { useNavigate } from "react-router-dom";
import { Clock, MapPin, ChevronRight } from "lucide-react";
import { format } from "date-fns";

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
      <div className="text-center py-16">
        <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3 border-2 border-border/40">
          <Clock className="h-7 w-7 text-muted-foreground/30" />
        </div>
        <p className="text-sm text-muted-foreground/50 font-medium">Du har ingen planlagte jobber i dag</p>
      </div>
    );
  }

  return (
    <div className="p-2">
      {blocks.map((b) => (
        <button
          key={b.id}
          onClick={() => b.project_id && navigate(`/projects/${b.project_id}`)}
          disabled={!b.project_id}
          className="flex items-center gap-4 w-full rounded-xl px-4 py-3.5 text-left hover:bg-primary/5 transition-colors group disabled:opacity-60 disabled:cursor-default"
        >
          {/* Time */}
          <div className="flex flex-col items-center w-16 shrink-0">
            <span className="text-sm font-bold text-foreground">{format(new Date(b.start_at), "HH:mm")}</span>
            <span className="text-[10px] text-muted-foreground/50 leading-tight">{format(new Date(b.end_at), "HH:mm")}</span>
          </div>

          {/* Accent bar */}
          <div className="w-1 self-stretch rounded-full bg-primary/40 shrink-0 min-h-[32px]" />

          {/* Content */}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
              {b.project_title || b.title}
            </p>
            <div className="flex items-center gap-3 mt-0.5">
              {b.location && (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground truncate">
                  <MapPin className="h-2.5 w-2.5 shrink-0" /> {b.location}
                </span>
              )}
              {b.technician_name && (
                <span className="text-[11px] text-muted-foreground">{b.technician_name}</span>
              )}
            </div>
          </div>

          {b.project_id && (
            <ChevronRight className="h-4 w-4 text-muted-foreground/20 group-hover:text-primary/50 shrink-0" />
          )}
        </button>
      ))}
    </div>
  );
}
