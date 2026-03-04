import { memo } from "react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { X, ExternalLink, Check, ArrowRight, MapPin, Info, Calendar as CalendarIcon, User, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ScheduleBlock } from "@/hooks/useScheduleBlocks";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface Props {
  block: ScheduleBlock;
  onClose: () => void;
  onConfirmed?: () => void;
}

const stateLabels: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  auto: { label: "Auto-koblet", variant: "default" },
  confirmed: { label: "Bekreftet", variant: "default" },
  needs_confirmation: { label: "Trenger bekreftelse", variant: "secondary" },
  external: { label: "Ekstern", variant: "outline" },
  manual: { label: "Manuell", variant: "default" },
};

export const ScheduleBlockDetailPanel = memo(function ScheduleBlockDetailPanel({ block, onClose, onConfirmed }: Props) {
  const navigate = useNavigate();
  const stateInfo = stateLabels[block.match_state] || stateLabels.external;
  const isOutlook = block.source === "outlook";

  const handleConfirm = async () => {
    if (!block.project_id) return;
    const { error } = await supabase
      .from("schedule_blocks")
      .update({ match_state: "confirmed" })
      .eq("id", block.id);
    if (error) toast.error("Kunne ikke bekrefte");
    else {
      toast.success("Bekreftet ✓");
      onConfirmed?.();
      onClose();
    }
  };

  // Prefer outlook_weblink (direct from Graph), fallback to constructed URL
  const outlookUrl = block.outlook_weblink
    || (block.calendar_id && block.outlook_event_id
      ? `https://outlook.office.com/calendar/item/${encodeURIComponent(block.outlook_event_id)}`
      : null);

  return (
    <div className="fixed right-4 top-24 z-50 w-80 bg-card border border-border/60 rounded-2xl shadow-xl p-4 space-y-3 animate-in slide-in-from-right-4 duration-200">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {isOutlook && (
            <div className="flex items-center gap-1.5 mb-1">
              <CalendarIcon className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">Outlook</span>
            </div>
          )}
          <p className="text-sm font-semibold truncate">{block.outlook_subject || block.title || "Uten tittel"}</p>
          <p className="text-xs text-muted-foreground">
            {block.technician_name} · {format(block.start_at, "EEE d. MMM HH:mm", { locale: nb })}–{format(block.end_at, "HH:mm")}
          </p>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Location */}
      {(block.outlook_location || block.location) && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">{block.outlook_location || block.location}</span>
        </div>
      )}

      {/* Organizer */}
      {block.outlook_organizer && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <User className="h-3 w-3 shrink-0" />
          <span className="truncate">{block.outlook_organizer}</span>
        </div>
      )}

      {/* Preview / description */}
      {block.outlook_preview && (
        <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <FileText className="h-3 w-3 shrink-0 mt-0.5" />
          <p className="line-clamp-3">{block.outlook_preview}</p>
        </div>
      )}

      {/* State badge */}
      <Badge variant={stateInfo.variant} className="text-xs">
        {stateInfo.label}
      </Badge>

      {/* Project link */}
      {block.project_title && block.project_id && (
        <button
          onClick={() => navigate(`/projects/${block.project_id}`)}
          className="flex items-center gap-2 w-full text-left p-2 rounded-lg bg-primary/5 hover:bg-primary/10 transition-colors"
        >
          <span className="text-xs font-medium text-primary truncate">{block.project_title}</span>
          <ArrowRight className="h-3 w-3 text-primary shrink-0" />
        </button>
      )}

      {/* Confidence info for needs_confirmation */}
      {block.match_state === "needs_confirmation" && (
        <div className="p-2 rounded-lg bg-amber-500/5 border border-amber-500/20 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
            <Info className="h-3 w-3" />
            Match {block.match_confidence}%
          </div>
          {block.match_reason && (
            <p className="text-[10px] text-muted-foreground">{block.match_reason}</p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        {block.match_state === "needs_confirmation" && block.project_id && (
          <Button size="sm" className="h-7 text-xs gap-1 rounded-lg flex-1" onClick={handleConfirm}>
            <Check className="h-3 w-3" />
            Godta
          </Button>
        )}

        {block.match_state === "needs_confirmation" && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs rounded-lg"
            onClick={() => { navigate("/calendar/confirmations"); onClose(); }}
          >
            Åpne bekreftelser
          </Button>
        )}

        {outlookUrl && (
          <a href={outlookUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 rounded-lg">
              <ExternalLink className="h-3 w-3" />
              Åpne i Outlook
            </Button>
          </a>
        )}
      </div>
    </div>
  );
});
