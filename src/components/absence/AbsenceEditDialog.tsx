import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ABSENCE_TYPE_LABELS, type AbsenceType } from "@/hooks/useAbsenceRequests";

export interface AbsenceEditData {
  id: string;
  absence_type: string;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  is_full_day: boolean;
  comment: string | null;
  status: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  absence: AbsenceEditData | null;
  onSaved: () => void;
}

export function AbsenceEditDialog({ open, onOpenChange, absence, onSaved }: Props) {
  const [absenceType, setAbsenceType] = useState<AbsenceType>("ferie");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("16:00");
  const [isFullDay, setIsFullDay] = useState(true);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (absence) {
      setAbsenceType(absence.absence_type as AbsenceType);
      setStartDate(absence.start_date);
      setEndDate(absence.end_date);
      setStartTime(absence.start_time || "08:00");
      setEndTime(absence.end_time || "16:00");
      setIsFullDay(absence.is_full_day);
      setComment(absence.comment || "");
    }
  }, [absence]);

  const handleSave = async () => {
    if (!absence || !startDate || !endDate) return;
    setSaving(true);
    const { error } = await supabase
      .from("absence_requests")
      .update({
        absence_type: absenceType,
        start_date: startDate,
        end_date: endDate,
        start_time: isFullDay ? null : startTime,
        end_time: isFullDay ? null : endTime,
        is_full_day: isFullDay,
        comment: comment || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", absence.id);
    setSaving(false);

    if (error) {
      toast.error("Feil ved lagring", { description: error.message });
    } else {
      toast.success("Fraværet er oppdatert");
      // If approved, sync updated times to Outlook
      if (absence.status === "approved") {
        supabase.functions.invoke("absence-calendar-sync", {
          body: { action: "update", absence_id: absence.id },
        }).then(({ data, error: syncErr }) => {
          if (syncErr) console.error("[AbsenceSync] update error:", syncErr);
          else if (data?.status === "updated") toast.success("Outlook-kalender oppdatert");
        });
      }
      onSaved();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rediger fravær</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs">Type fravær</Label>
            <Select value={absenceType} onValueChange={(v) => setAbsenceType(v as AbsenceType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(ABSENCE_TYPE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Fra dato</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Til dato</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Heldag</Label>
              <p className="text-[11px] text-muted-foreground">Slå av for å angi klokkeslett</p>
            </div>
            <Switch checked={isFullDay} onCheckedChange={setIsFullDay} />
          </div>

          {!isFullDay && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Fra kl.</Label>
                <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} step="900" />
              </div>
              <div>
                <Label className="text-xs">Til kl.</Label>
                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} step="900" />
              </div>
            </div>
          )}

          <div>
            <Label className="text-xs">Kommentar</Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              placeholder="F.eks. Familieferie, syk barn, etc."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Avbryt</Button>
          <Button onClick={handleSave} disabled={saving || !startDate || !endDate}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            Lagre
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
