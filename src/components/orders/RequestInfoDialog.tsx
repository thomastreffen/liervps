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

  // Fetch user name for sender_name
  const getUserName = async () => {
    if (!user?.id) return "Saksbehandler";
    const { data } = await supabase
      .from("user_accounts")
      .select("person:people(full_name)")
      .eq("auth_user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();
    return (data as any)?.person?.full_name || "Saksbehandler";
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const senderName = await getUserName();

      const bodyParts = [
        ...selected.map(s => `• ${s}`),
        freeText ? freeText : "",
      ].filter(Boolean);
      const body = bodyParts.join("\n");

      // Create message in order_form_messages (primary)
      const { data: msg } = await supabase.from("order_form_messages").insert({
        submission_id: submissionId,
        sender_type: "admin",
        sender_user_id: user?.id,
        sender_name: senderName,
        message_type: "request_info",
        body,
        is_visible_to_customer: true,
        requires_reply: true,
      } as any).select("id").single();

      // Also create legacy comment for backward compat
      await supabase.from("order_form_comments").insert({
        submission_id: submissionId,
        body: "Forespørsel om mer informasjon:\n\n" + body,
        comment_type: "missing_info_request",
        visibility: "shared",
        created_by: user?.id,
      } as any);

      // Log activity
      await supabase.from("order_form_activity_log").insert({
        submission_id: submissionId,
        event_type: "missing_info_requested",
        payload: { items: selected, free_text: freeText, message_id: msg?.id },
        created_by: user?.id,
      });

      // Update status + awaiting flag
      const updatePayload: any = {
        awaiting_customer_reply: true,
        last_admin_message_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
      };
      if (msg?.id) updatePayload.open_request_message_id = msg.id;
      if (setMissingStatus) {
        updatePayload.status = "missing_info";
        updatePayload.quality_issues = selected.map(s => ({ severity: "error" as const, message: s }));
      }

      await supabase
        .from("order_form_submissions")
        .update(updatePayload)
        .eq("id", submissionId);

      // Send email notification to bestiller if toggled
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
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order-form-submission", submissionId] });
      qc.invalidateQueries({ queryKey: ["order-form-comments", submissionId] });
      qc.invalidateQueries({ queryKey: ["order-form-activity", submissionId] });
      qc.invalidateQueries({ queryKey: ["order-form-messages", submissionId] });
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
