import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Users, Loader2, AlertTriangle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { TechNowStatus } from "@/hooks/useTechnicianNowStatus";
import { toast } from "sonner";

interface DBTechnician {
  id: string;
  name: string;
  email: string;
  user_id?: string | null;
  color?: string | null;
}

interface TechnicianListProps {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  allowDeselect?: boolean;
  filterIds?: Set<string> | null;
  nowStatusMap?: Map<string, TechNowStatus>;
  onColorChange?: (techId: string, color: string) => void;
  techDayPercents?: Map<string, number>;
  technicians?: DBTechnician[];
  isGlobalScope?: boolean;
}

const COLOR_PRESETS = [
  "#D50000", "#F4511E", "#E67C73", "#F09300",
  "#F6BF26", "#33B679", "#0B8043", "#7CB342",
  "#039BE5", "#3F51B5", "#7986CB", "#8E24AA",
  "#616161", "#795548", "#009688", "#C0CA33",
];

function NowBadge({ status }: { status: TechNowStatus }) {
  const base = "text-[9px] font-semibold px-1.5 py-0.5 rounded-full leading-none whitespace-nowrap";
  if (status.state === "busy") {
    return (
      <span className={cn(base, "bg-destructive/10 text-destructive")}>
        {status.durationLabel || status.label}
      </span>
    );
  }
  return (
    <span className={cn(base, "bg-success/10 text-success")}>
      {status.durationLabel || status.label}
    </span>
  );
}

function ColorPicker({ currentColor, onPick }: { currentColor: string | null; onPick: (c: string) => void }) {
  return (
    <div className="grid grid-cols-4 gap-1.5 p-2">
      {COLOR_PRESETS.map((c) => (
        <button
          key={c}
          onClick={(e) => { e.stopPropagation(); onPick(c); }}
          className={cn(
            "h-6 w-6 rounded-full border-2 transition-transform hover:scale-110",
            currentColor === c ? "border-foreground scale-110 ring-2 ring-foreground/20" : "border-transparent"
          )}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );
}

function CapacityBar({ percent }: { percent: number }) {
  const clampedPercent = Math.min(percent, 100);
  const color = percent > 100
    ? "hsl(var(--destructive))"
    : percent >= 90
    ? "hsl(var(--destructive))"
    : percent >= 50
    ? "hsl(var(--warning))"
    : "hsl(var(--success))";

  const label = percent > 100
    ? `${Math.round(percent)}%`
    : percent >= 50
    ? `${Math.round(percent)}%`
    : null;

  return (
    <div className="flex items-center gap-1.5 mt-1">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${clampedPercent}%`,
            backgroundColor: color,
          }}
        />
      </div>
      {label && (
        <span className="text-[9px] font-bold tabular-nums shrink-0" style={{ color }}>
          {label}
        </span>
      )}
    </div>
  );
}

export function TechnicianList({
  selectedId,
  onSelect,
  allowDeselect,
  filterIds,
  nowStatusMap,
  onColorChange,
  techDayPercents,
  technicians: scopedTechnicians,
  isGlobalScope = false,
}: TechnicianListProps) {
  const [technicians, setTechnicians] = useState<DBTechnician[]>([]);
  const [loading, setLoading] = useState(true);
  const [colorPickerOpen, setColorPickerOpen] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTechnicians() {
      if (scopedTechnicians) {
        setTechnicians(scopedTechnicians);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("technicians")
        .select("id, name, email, user_id, color")
        .not("user_id", "is", null)
        .eq("is_plannable_resource", true)
        .is("archived_at", null)
        .order("name");

      if (error) {
        console.error("Failed to fetch technicians:", error.message);
      } else {
        setTechnicians(data || []);
      }
      setLoading(false);
    }

    fetchTechnicians();
  }, [scopedTechnicians]);

  const handleColorPick = useCallback(async (techId: string, color: string) => {
    setTechnicians((prev) => prev.map((t) => t.id === techId ? { ...t, color } : t));
    setColorPickerOpen(null);
    onColorChange?.(techId, color);

    const { error } = await supabase
      .from("technicians")
      .update({ color })
      .eq("id", techId);

    if (error) {
      toast.error("Kunne ikke lagre farge");
    }
  }, [onColorChange]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (technicians.length === 0) {
    return (
      <div className="px-3 py-4 text-sm text-muted-foreground">
        Ingen montører i valgt selskap.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      <h2 className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Montører
      </h2>

      {/* All technicians view */}
      <button
        onClick={() => onSelect(null)}
        className={cn(
          "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
          selectedId === null
            ? "bg-accent/10 text-accent-foreground ring-1 ring-accent/20"
            : "hover:bg-secondary"
        )}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Users className="h-3.5 w-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium">Alle montører</p>
          <p className="text-[10px] text-muted-foreground">{isGlobalScope ? "Global" : "Selskap"}</p>
        </div>
      </button>

      {technicians
        .filter((tech) => !filterIds || filterIds.has(tech.id))
        .map((tech) => {
        const isSelected = selectedId === tech.id;
        const initial = tech.name.trim().charAt(0).toUpperCase();
        const nowStatus = nowStatusMap?.get(tech.id);
        const techColor = tech.color || "#039BE5";
        const dayPercent = techDayPercents?.get(tech.id) ?? 0;
        const isOverbooked = dayPercent > 100;

        return (
          <div key={tech.id} className="flex items-center gap-0">
            <button
              onClick={() => onSelect(tech.id)}
              className={cn(
                "flex-1 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors min-w-0",
                isSelected
                  ? "ring-1 ring-accent/20"
                  : "hover:bg-secondary"
              )}
              style={isSelected ? { backgroundColor: `${techColor}15` } : undefined}
            >
              <Popover
                open={colorPickerOpen === tech.id}
                onOpenChange={(open) => setColorPickerOpen(open ? tech.id : null)}
              >
                <PopoverTrigger asChild>
                  <div
                    className="relative cursor-pointer group"
                    onClick={(e) => { e.stopPropagation(); setColorPickerOpen(tech.id); }}
                  >
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold shrink-0 text-white transition-shadow group-hover:ring-2 group-hover:ring-offset-1"
                      style={{ backgroundColor: techColor }}
                    >
                      {initial}
                    </div>
                    {nowStatus && (
                      <span
                        className={cn(
                          "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card",
                          nowStatus.state === "busy" ? "bg-destructive" : "bg-success"
                        )}
                      />
                    )}
                  </div>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" side="right" align="start" onClick={(e) => e.stopPropagation()}>
                  <div className="p-2">
                    <p className="text-xs font-medium text-muted-foreground mb-1.5 px-1">Velg farge for {tech.name.split(" ")[0]}</p>
                    <ColorPicker currentColor={tech.color} onPick={(c) => handleColorPick(tech.id, c)} />
                  </div>
                </PopoverContent>
              </Popover>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <p className="text-xs font-bold truncate">{tech.name}</p>
                  {isOverbooked && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />
                      </TooltipTrigger>
                      <TooltipContent side="right" className="text-xs">
                        Overbooket ({Math.round(dayPercent)}%)
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
                {nowStatus && (
                  <div className="mt-0.5">
                    <NowBadge status={nowStatus} />
                  </div>
                )}
                <CapacityBar percent={dayPercent} />
              </div>
            </button>
          </div>
        );
      })}
    </div>
  );
}
