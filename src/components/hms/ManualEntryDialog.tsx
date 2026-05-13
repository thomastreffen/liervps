import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { logHmsAudit } from "@/lib/hms/audit";

interface Props {
  userId: string;
  trigger?: React.ReactNode;
  initial?: any | null; // existing entry to edit
  onClose?: () => void;
}

export function ManualEntryDialog({ userId, trigger, initial, onClose }: Props) {
  const { activeCompanyId } = useCompanyContext();
  const qc = useQueryClient();
  const [open, setOpen] = useState(!!initial);

  const isEdit = !!initial;
  const [workDate, setWorkDate] = useState(initial?.work_date ?? new Date().toISOString().slice(0, 10));
  const [ordinary, setOrdinary] = useState<number>(initial?.ordinary_hours ?? 7.5);
  const [overtime, setOvertime] = useState<number>(initial?.hours_overtime ?? 0);
  const [breakMin, setBreakMin] = useState<number>(initial?.break_minutes ?? 30);
  const [reason, setReason] = useState(initial?.adjustment_reason ?? "");
  const [activity, setActivity] = useState(initial?.activity ?? "");

  function close(o: boolean) {
    setOpen(o);
    if (!o) onClose?.();
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!reason.trim()) throw new Error("Begrunnelse er påkrevd");
      const { data: u } = await supabase.auth.getUser();
      const total = Number(ordinary) + Number(overtime);
      const hash = `manual-${userId}-${workDate}-${Date.now()}`;
      const payload = {
        company_id: activeCompanyId,
        user_id: userId,
        work_date: workDate,
        ordinary_hours: ordinary,
        hours_overtime: overtime,
        total_hours: total,
        hours: total,
        break_minutes: breakMin,
        activity: activity || null,
        adjustment_reason: reason,
        manually_adjusted: true,
        created_manually: !isEdit,
        source_system: "manual",
        source_hash: isEdit ? initial.source_hash : hash,
        status: "imported",
      };
      if (isEdit) {
        await (supabase as any).from("worktime_entries").update(payload).eq("id", initial.id);
      } else {
        await (supabase as any).from("worktime_entries").insert(payload);
      }
      await logHmsAudit({
        company_id: activeCompanyId,
        entity_type: "worktime_entry",
        entity_id: initial?.id,
        action: isEdit ? "manual_edit" : "manual_create",
        payload: { work_date: workDate, ordinary, overtime, reason, user_id: userId },
      });
      try {
        await (supabase as any).functions.invoke("worktime-aml-evaluate", {
          body: { company_id: activeCompanyId, user_id: userId },
        });
      } catch {}
    },
    onSuccess: () => {
      toast({ title: isEdit ? "Linje oppdatert" : "Linje lagt til" });
      qc.invalidateQueries({ queryKey: ["hms-aml-employee"] });
      close(false);
    },
    onError: (e: any) => toast({ title: "Feil", description: String(e.message || e), variant: "destructive" }),
  });

  const cancelMut = useMutation({
    mutationFn: async () => {
      if (!isEdit) return;
      if (!reason.trim()) throw new Error("Begrunnelse er påkrevd");
      const { data: u } = await supabase.auth.getUser();
      await (supabase as any).from("worktime_entries").update({
        status: "cancelled",
        adjustment_reason: reason,
        manually_adjusted: true,
      }).eq("id", initial.id);
      await logHmsAudit({
        company_id: activeCompanyId,
        entity_type: "worktime_entry",
        entity_id: initial.id,
        action: "manual_cancel",
        payload: { reason, user_id: userId },
      });
      try {
        await (supabase as any).functions.invoke("worktime-aml-evaluate", {
          body: { company_id: activeCompanyId, user_id: userId },
        });
      } catch {}
    },
    onSuccess: () => {
      toast({ title: "Linje annullert" });
      qc.invalidateQueries({ queryKey: ["hms-aml-employee"] });
      close(false);
    },
    onError: (e: any) => toast({ title: "Feil", description: String(e.message || e), variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={close}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Rediger arbeidstidslinje" : "Ny manuell timelinje"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Dato</Label><Input type="date" value={workDate} onChange={(e) => setWorkDate(e.target.value)} /></div>
            <div><Label>Aktivitet</Label><Input value={activity} onChange={(e) => setActivity(e.target.value)} placeholder="f.eks. Service" /></div>
            <div><Label>Ordinært (t)</Label><Input type="number" step="0.25" value={ordinary} onChange={(e) => setOrdinary(parseFloat(e.target.value || "0"))} /></div>
            <div><Label>Overtid (t)</Label><Input type="number" step="0.25" value={overtime} onChange={(e) => setOvertime(parseFloat(e.target.value || "0"))} /></div>
            <div><Label>Pause (min)</Label><Input type="number" value={breakMin} onChange={(e) => setBreakMin(parseInt(e.target.value || "0"))} /></div>
          </div>
          <div>
            <Label>Begrunnelse *</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Påkrevd ved manuell endring" />
          </div>
        </div>
        <DialogFooter className="gap-2">
          {isEdit && (
            <Button variant="destructive" onClick={() => cancelMut.mutate()} disabled={cancelMut.isPending} className="mr-auto">
              Annullér
            </Button>
          )}
          <Button variant="ghost" onClick={() => close(false)}>Avbryt</Button>
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !reason.trim()}>
            <Plus className="h-4 w-4 mr-1" />{isEdit ? "Lagre endring" : "Legg til"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
