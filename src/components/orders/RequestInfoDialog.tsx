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
  submissionNo?: string;
  bestillerEpost?: string;
}

export function RequestInfoDialog({ open, onOpenChange, submissionId, submissionNo, bestillerEpost }: RequestInfoDialogProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);
  const [freeText, setFreeText] = useState("");
  const [setMissingStatus, setSetMissingStatus] = useState(true);
  const [sendEmail, setSendEmail] = useState(!!bestillerEpost);

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

      // Send email notification to bestiller if toggled and email available
      if (sendEmail && bestillerEpost) {
        try {
          await supabase.functions.invoke("order-form-notify", {
            body: {
              submission_id: submissionId,
              notification_type: "missing_info",
              missing_items: selected,
              free_text: freeText,
            },
          });
        } catch (err) {
          console.error("Failed to send missing info email:", err);
          // Don't fail the whole operation if email fails
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order-form-submission", submissionId] });
      qc.invalidateQueries({ queryKey: ["order-form-comments", submissionId] });
      qc.invalidateQueries({ queryKey: ["order-form-activity", submissionId] });
      toast.success(sendEmail && bestillerEpost 
        ? "Forespørsel sendt til bestiller" 
        : "Forespørsel registrert internt"
      );
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
          {bestillerEpost && (
            <div className="flex items-center gap-2">
              <Switch checked={sendEmail} onCheckedChange={setSendEmail} />
              <Label className="text-sm font-normal">
                Send e-post til bestiller ({bestillerEpost})
              </Label>
            </div>
          )}
          {!bestillerEpost && (
            <p className="text-xs text-muted-foreground">
              Ingen e-postadresse funnet for bestiller – forespørselen lagres kun internt.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Avbryt</Button>
          <Button
            disabled={selected.length === 0 && !freeText.trim()}
            onClick={() => mutation.mutate()}
          >
            {sendEmail && bestillerEpost ? "Send forespørsel" : "Registrer internt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
