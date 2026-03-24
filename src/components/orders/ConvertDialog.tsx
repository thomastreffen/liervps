import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface ConvertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissionId: string;
  summary: Record<string, any> | null;
}

export function ConvertDialog({ open, onOpenChange, submissionId, summary }: ConvertDialogProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [target, setTarget] = useState<"case" | "order">("case");

  const mutation = useMutation({
    mutationFn: async () => {
      const convertedType = target === "case" ? "case" : "work_order";

      // Update submission
      await supabase
        .from("order_form_submissions")
        .update({
          status: "converted",
          converted_to_type: convertedType,
        })
        .eq("id", submissionId);

      // Log activity
      await supabase.from("order_form_activity_log").insert({
        submission_id: submissionId,
        event_type: target === "case" ? "converted_to_case" : "converted_to_order",
        payload: {
          target_type: convertedType,
          customer: summary?.kundenavn,
          title: summary?.oppdragstittel,
        },
        created_by: user?.id,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order-form-submission", submissionId] });
      qc.invalidateQueries({ queryKey: ["order-form-activity", submissionId] });
      toast.success(`Bestilling markert som konvertert til ${target === "case" ? "sak" : "oppdrag"}`);
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Konverter bestilling</DialogTitle>
          <DialogDescription>
            Marker bestillingen som konvertert og koble den videre.
          </DialogDescription>
        </DialogHeader>
        <RadioGroup value={target} onValueChange={(v) => setTarget(v as "case" | "order")} className="space-y-3">
          <div className="flex items-center gap-2 p-3 rounded-lg border border-border hover:bg-muted/30 cursor-pointer">
            <RadioGroupItem value="case" id="conv-case" />
            <Label htmlFor="conv-case" className="cursor-pointer flex-1">
              <span className="font-medium text-sm">Konverter til sak</span>
              <p className="text-xs text-muted-foreground">Opprett en sak for videre oppfølging</p>
            </Label>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-lg border border-border hover:bg-muted/30 cursor-pointer">
            <RadioGroupItem value="order" id="conv-order" />
            <Label htmlFor="conv-order" className="cursor-pointer flex-1">
              <span className="font-medium text-sm">Konverter til oppdrag</span>
              <p className="text-xs text-muted-foreground">Opprett et oppdrag for planlegging</p>
            </Label>
          </div>
        </RadioGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Avbryt</Button>
          <Button onClick={() => mutation.mutate()}>Konverter</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
