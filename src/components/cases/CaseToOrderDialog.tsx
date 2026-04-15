import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ClipboardList, ArrowRight } from "lucide-react";

interface CaseToOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  caseTitle: string;
  companyId: string;
  items: { from_email?: string | null; from_name?: string | null; body_text?: string | null; body_preview?: string | null; subject?: string | null }[];
  onCreated: (orderId: string) => void;
}

export function CaseToOrderDialog({
  open, onOpenChange, caseId, caseTitle, companyId, items, onCreated,
}: CaseToOrderDialogProps) {
  const { user } = useAuth();

  // Fetch templates for this company
  const { data: templates } = useQuery({
    queryKey: ["order-form-templates", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("order_form_templates")
        .select("id, name")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
    enabled: open,
  });

  const [templateId, setTemplateId] = useState("");
  const [title, setTitle] = useState(caseTitle || "");
  const [description, setDescription] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");

  // Pre-fill from case items (first email)
  useEffect(() => {
    if (!open) return;
    setTitle(caseTitle || "");
    const firstEmail = items.find(i => i.from_email);
    if (firstEmail) {
      setCustomerName(firstEmail.from_name || "");
      setCustomerEmail(firstEmail.from_email || "");
    }
    const bodyText = items[0]?.body_preview || items[0]?.body_text || "";
    setDescription(bodyText.slice(0, 500));
  }, [open, caseTitle, items]);

  // Auto-select first template
  useEffect(() => {
    if (templates?.length && !templateId) {
      setTemplateId(templates[0].id);
    }
  }, [templates, templateId]);

  const createOrder = useMutation({
    mutationFn: async () => {
      if (!templateId) throw new Error("Velg en mal");

      // Create the order submission
      const { data: order, error } = await supabase
        .from("order_form_submissions")
        .insert({
          company_id: companyId,
          template_id: templateId,
          source: "internal",
          requester_type: "internal",
          submitted_by: user?.id,
          submitter_name: customerName || null,
          submitter_email: customerEmail || null,
          channel: "postkontoret",
          linked_case_id: caseId,
          summary: {
            oppdragstittel: title,
            kundenavn: customerName,
            bestiller_epost: customerEmail,
          },
          priority: "normal",
        })
        .select("id, submission_no")
        .single();

      if (error) throw error;

      // Link the case back to the order
      const { error: caseErr } = await supabase
        .from("cases")
        .update({
          linked_order_submission_id: order.id,
          status: "converted" as any,
          resolution_type: "converted_to_order",
        })
        .eq("id", caseId);

      if (caseErr) throw caseErr;

      // Add a note to the order with context from the case
      if (description) {
        await supabase.from("order_form_messages").insert({
          submission_id: order.id,
          sender_user_id: user?.id,
          sender_name: "System",
          body: `Opprettet fra Postkontoret-sak.\n\nOriginal henvendelse:\n${description}`,
          visibility: "internal",
        });
      }

      // Log activity on the order
      await supabase.from("order_form_activity_log").insert({
        submission_id: order.id,
        event_type: "created_from_case",
        payload: { case_id: caseId, case_title: caseTitle },
        created_by: user?.id,
      });

      return order;
    },
    onSuccess: (order) => {
      toast.success(`Bestilling ${order.submission_no} opprettet`, {
        action: {
          label: "Åpne",
          onClick: () => { window.location.href = `/orders/${order.id}`; },
        },
      });
      onCreated(order.id);
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error("Kunne ikke opprette bestilling: " + (err.message || "Ukjent feil"));
    },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Opprett bestilling fra sak
          </SheetTitle>
          <SheetDescription>
            Opprett en ny bestilling basert på denne henvendelsen. Saken kobles automatisk og status synkroniseres.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          {/* Template selection */}
          <div>
            <Label className="text-xs">Bestillingsmal</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Velg mal..." />
              </SelectTrigger>
              <SelectContent>
                {templates?.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="space-y-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Data fra henvendelsen</p>
            <div>
              <Label className="text-xs">Tittel / Oppdragstittel</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Kundenavn</Label>
              <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Kunde e-post</Label>
              <Input value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} className="mt-1" type="email" />
            </div>
            <div>
              <Label className="text-xs">Beskrivelse</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 min-h-[80px]"
                placeholder="Automatisk hentet fra henvendelsen..."
              />
            </div>
          </div>

          <Separator />

          <div className="bg-muted/30 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Hva skjer?</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>En bestilling opprettes og kobles til denne saken</li>
              <li>Saken markeres som «Konvertert til bestilling»</li>
              <li>Statusendringer på bestillingen synkroniseres tilbake hit</li>
            </ul>
          </div>

          <Button
            className="w-full"
            onClick={() => createOrder.mutate()}
            disabled={createOrder.isPending || !templateId}
          >
            {createOrder.isPending ? "Oppretter..." : (
              <>
                <ArrowRight className="h-4 w-4 mr-1.5" />
                Opprett bestilling
              </>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
