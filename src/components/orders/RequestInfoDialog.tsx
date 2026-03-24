import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { MISSING_INFO_OPTIONS } from "@/lib/order-quality";

interface RequestInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissionId: string;
}

export function RequestInfoDialog({ open, onOpenChange, submissionId }: RequestInfoDialogProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);
  const [freeText, setFreeText] = useState("");
  const [setMissingStatus, setSetMissingStatus] = useState(true);

  const mutation = useMutation({
    mutationFn: async () => {
      const body = [
        "Forespørsel om mer informasjon:",
        "",
        ...selected.map(s => `• ${s}`),
        freeText ? `\n${freeText}` : "",
      ].filter(Boolean).join("\n");

      // Create comment
      await supabase.from("order_form_comments").insert({
        submission_id: submissionId,
        body,
        comment_type: "missing_info_request",
        created_by: user?.id,
      });

      // Log activity
      await supabase.from("order_form_activity_log").insert({
        submission_id: submissionId,
        event_type: "missing_info_requested",
        payload: { items: selected, free_text: freeText },
        created_by: user?.id,
      });

      // Update status if toggled
      if (setMissingStatus) {
        await supabase
          .from("order_form_submissions")
          .update({
            status: "missing_info",
            quality_issues: selected.map(s => ({ severity: "error" as const, message: s })),
          })
          .eq("id", submissionId);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order-form-submission", submissionId] });
      qc.invalidateQueries({ queryKey: ["order-form-comments", submissionId] });
      qc.invalidateQueries({ queryKey: ["order-form-activity", submissionId] });
      toast.success("Forespørsel registrert");
      setSelected([]);
      setFreeText("");
      onOpenChange(false);
    },
  });

  const toggleItem = (item: string) => {
    setSelected(prev => prev.includes(item) ? prev.filter(s => s !== item) : [...prev, item]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Be om mer informasjon</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Velg hva som mangler</Label>
            {MISSING_INFO_OPTIONS.map(item => (
              <div key={item} className="flex items-center gap-2">
                <Checkbox
                  checked={selected.includes(item)}
                  onCheckedChange={() => toggleItem(item)}
                  id={`mi-${item}`}
                />
                <Label htmlFor={`mi-${item}`} className="text-sm font-normal cursor-pointer">
                  {item}
                </Label>
              </div>
            ))}
          </div>
          <div>
            <Label className="text-sm font-medium">Tilleggskommentar</Label>
            <Textarea
              value={freeText}
              onChange={e => setFreeText(e.target.value)}
              placeholder="Beskriv hva som trengs..."
              className="mt-1 min-h-[60px]"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={setMissingStatus} onCheckedChange={setSetMissingStatus} />
            <Label className="text-sm font-normal">Sett status til «Mangler info»</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Avbryt</Button>
          <Button
            disabled={selected.length === 0 && !freeText.trim()}
            onClick={() => mutation.mutate()}
          >
            Send forespørsel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
