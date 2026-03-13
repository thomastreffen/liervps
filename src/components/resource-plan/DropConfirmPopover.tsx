import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetDescription } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addMinutes } from "date-fns";
import { nb } from "date-fns/locale";
import { Clock, User, Loader2, Check, FolderKanban, ListTodo } from "lucide-react";

export interface DropPayload {
  taskId?: string;
  taskTitle: string;
  projectId?: string;
  estimatedMinutes?: number;
  priority?: string;
  type: "task" | "project";
  technicianId: string;
  technicianName?: string;
  dropTime: Date;
}

interface DropConfirmPopoverProps {
  payload: DropPayload | null;
  onClose: () => void;
  onCreated: () => void;
}

const DURATION_OPTIONS = [
  { value: "30", label: "30 min" },
  { value: "60", label: "1 time" },
  { value: "90", label: "1t 30m" },
  { value: "120", label: "2 timer" },
  { value: "180", label: "3 timer" },
  { value: "240", label: "4 timer" },
  { value: "480", label: "Hel dag" },
];

export function DropConfirmPopover({ payload, onClose, onCreated }: DropConfirmPopoverProps) {
  const [duration, setDuration] = useState<string>(
    payload?.estimatedMinutes?.toString() || "60"
  );
  const [saving, setSaving] = useState(false);

  const handleConfirm = useCallback(async () => {
    if (!payload) return;
    setSaving(true);

    try {
      const durationMin = parseInt(duration, 10);
      const endTime = addMinutes(payload.dropTime, durationMin);

      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;

      // Look up company_id from technician
      const { data: techData } = await supabase
        .from("technicians")
        .select("company_id, user_id")
        .eq("id", payload.technicianId)
        .single();

      const companyId = (techData as any)?.company_id;

      if (payload.type === "project" && payload.taskId) {
        // ── Project drop: assign technician + create schedule block ──

        // Update project times
        await supabase
          .from("events")
          .update({
            start_time: payload.dropTime.toISOString(),
            end_time: endTime.toISOString(),
            status: "scheduled" as any,
          })
          .eq("id", payload.taskId);

        // Add technician assignment (idempotent via upsert-like check)
        const { data: existingAssignment } = await supabase
          .from("event_technicians")
          .select("id")
          .eq("event_id", payload.taskId)
          .eq("technician_id", payload.technicianId)
          .maybeSingle();

        if (!existingAssignment) {
          await supabase.from("event_technicians").insert({
            event_id: payload.taskId,
            technician_id: payload.technicianId,
          });
        }

        // Create schedule block
        const { error } = await (supabase as any).from("schedule_blocks").insert({
          company_id: companyId,
          technician_id: payload.technicianId,
          project_id: payload.taskId,
          source: "manual",
          start_at: payload.dropTime.toISOString(),
          end_at: endTime.toISOString(),
          title: payload.taskTitle,
          match_state: "manual",
          match_confidence: 100,
          match_reason: "Prosjekt dratt til kalender",
        });

        if (error) throw error;

        // Log activity
        await supabase.from("event_logs").insert({
          event_id: payload.taskId,
          action_type: "technician_assigned",
          performed_by: userId || null,
          change_summary: `${payload.technicianName || "Montør"} tildelt via drag-planlegging kl. ${format(payload.dropTime, "HH:mm")}–${format(endTime, "HH:mm")}`,
        });

      } else {
        // ── Task drop: create schedule block directly ──
        const { error } = await (supabase as any).from("schedule_blocks").insert({
          company_id: companyId,
          technician_id: payload.technicianId,
          project_id: payload.projectId || null,
          source: "manual",
          start_at: payload.dropTime.toISOString(),
          end_at: endTime.toISOString(),
          title: payload.taskTitle,
          match_state: "manual",
          match_confidence: 100,
          match_reason: payload.type === "task" ? "Oppgave dratt til kalender" : "Prosjekt dratt til kalender",
        });

        if (error) throw error;

        // If it's a task, update planned_start_at / planned_end_at
        if (payload.taskId) {
          await (supabase as any).from("tasks").update({
            planned_start_at: payload.dropTime.toISOString(),
            planned_end_at: endTime.toISOString(),
            assigned_user_id: payload.technicianId,
          }).eq("id", payload.taskId);
        }
      }

      toast.success("Planlagt!", {
        description: `${payload.taskTitle} → ${payload.technicianName || "montør"} kl. ${format(payload.dropTime, "HH:mm")}–${format(endTime, "HH:mm")}`,
      });
      onCreated();
      onClose();
    } catch (err: any) {
      console.error("Drop confirm error:", err);
      toast.error("Kunne ikke opprette planblokk");
    } finally {
      setSaving(false);
    }
  }, [payload, duration, onClose, onCreated]);

  if (!payload) return null;

  const endTime = addMinutes(payload.dropTime, parseInt(duration, 10));
  const isProject = payload.type === "project";
  const TypeIcon = isProject ? FolderKanban : ListTodo;

  return (
    <Sheet open={!!payload} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="max-h-[360px] rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="text-base">Bekreft planlegging</SheetTitle>
          <SheetDescription className="sr-only">Bekreft planlegging av {isProject ? "jobb" : "oppgave"}</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          {/* Title with type indicator */}
          <div className="flex items-center gap-2">
            <TypeIcon className={`h-4 w-4 shrink-0 ${isProject ? "text-primary" : "text-accent"}`} />
            <span className="font-semibold text-sm truncate">{payload.taskTitle}</span>
            {isProject && (
              <span className="text-[9px] font-mono font-bold bg-primary/15 text-primary rounded px-1.5 py-0.5 shrink-0">
                Jobb
              </span>
            )}
          </div>

          {/* Time + Tech */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> Tidspunkt
              </Label>
              <p className="text-sm font-medium">
                {format(payload.dropTime, "EEE d. MMM", { locale: nb })}
              </p>
              <p className="text-sm">
                {format(payload.dropTime, "HH:mm")} – {format(endTime, "HH:mm")}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <User className="h-3 w-3" /> Montør
              </Label>
              <p className="text-sm font-medium">{payload.technicianName || "Valgt montør"}</p>
            </div>
          </div>

          {/* Duration selector */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Varighet</Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <SheetFooter className="flex-row gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1" disabled={saving}>
            Avbryt
          </Button>
          <Button onClick={handleConfirm} className="flex-1 gap-1.5" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Planlegg
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
