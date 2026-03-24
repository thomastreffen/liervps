import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ArrowRight, Check, ExternalLink } from "lucide-react";

interface ConvertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissionId: string;
  summary: Record<string, any> | null;
  values?: Record<string, any>;
  submissionNo?: string;
}

export function ConvertDialog({ open, onOpenChange, submissionId, summary, values = {}, submissionNo }: ConvertDialogProps) {
  const { user } = useAuth();
  const { activeCompanyId } = useCompanyContext();
  const qc = useQueryClient();
  const [target, setTarget] = useState<"case" | "order">("case");

  // Editable fields for conversion
  const [title, setTitle] = useState(
    values.oppdragstittel || summary?.oppdragstittel || ""
  );
  const [description, setDescription] = useState(
    values.detaljert_arbeidsbeskrivelse || ""
  );
  const [address, setAddress] = useState(values.anleggsadresse || "");
  const [customer, setCustomer] = useState(
    values.kundenavn || summary?.kundenavn || ""
  );

  const priorityMap: Record<string, string> = {
    "Kritisk stopp": "critical",
    "Høy": "high",
    "Normal": "medium",
    "Lav": "low",
  };
  const hastegrad = values.hastegrad || summary?.hastegrad || "Normal";

  const mutation = useMutation({
    mutationFn: async () => {
      if (!activeCompanyId) throw new Error("Mangler selskap");

      let createdId: string | null = null;

      if (target === "case") {
        // Create actual case
        const casePriority = priorityMap[hastegrad] || "medium";
        const { data: newCase, error: caseErr } = await supabase
          .from("cases")
          .insert({
            company_id: activeCompanyId,
            title: title || "Bestilling uten tittel",
            priority: casePriority as any,
            status: "open" as any,
            scope: "internal" as any,
            next_action: "waiting_for_assignment" as any,
            owner_user_id: user?.id,
            source_order_form_id: submissionId,
          })
          .select("id, case_number")
          .single();

        if (caseErr) throw caseErr;
        createdId = newCase.id;

        // Add case item with description
        if (description) {
          await supabase.from("case_items").insert({
            case_id: newCase.id,
            company_id: activeCompanyId,
            type: "note",
            subject: `Bestilling ${submissionNo || ""}`,
            body_text: `Konvertert fra bestilling.\n\nKunde: ${customer}\nAdresse: ${address}\n\nBeskrivelse:\n${description}`,
            from_name: "System",
          });
        }

      } else {
        // Create actual event/oppdrag
        const now = new Date();
        const startTime = values.onsket_utfort_dato
          ? new Date(values.onsket_utfort_dato + "T08:00:00")
          : now;
        const endTime = new Date(startTime.getTime() + 8 * 60 * 60 * 1000);

        const { data: newEvent, error: eventErr } = await supabase
          .from("events")
          .insert({
            company_id: activeCompanyId,
            title: title || "Bestilling uten tittel",
            description: `Kunde: ${customer}\nAdresse: ${address}\n\n${description}`,
            address: address || null,
            customer: customer || null,
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
            status: "pending" as any,
            project_type: "service",
            created_by: user?.id,
            source_order_form_id: submissionId,
          })
          .select("id, internal_number")
          .single();

        if (eventErr) throw eventErr;
        createdId = newEvent.id;
      }

      // Update submission
      await supabase
        .from("order_form_submissions")
        .update({
          status: "converted",
          converted_to_type: target === "case" ? "case" : "work_order",
          converted_to_id: createdId,
        })
        .eq("id", submissionId);

      // Log activity
      await supabase.from("order_form_activity_log").insert({
        submission_id: submissionId,
        event_type: target === "case" ? "converted_to_case" : "converted_to_order",
        payload: {
          target_type: target,
          created_id: createdId,
          customer,
          title,
        },
        created_by: user?.id,
      });

      return createdId;
    },
    onSuccess: (createdId) => {
      qc.invalidateQueries({ queryKey: ["order-form-submission", submissionId] });
      qc.invalidateQueries({ queryKey: ["order-form-activity", submissionId] });
      toast.success(
        `Bestilling konvertert til ${target === "case" ? "sak" : "oppdrag"}`,
        {
          action: {
            label: "Åpne",
            onClick: () => {
              window.location.href = target === "case"
                ? `/cases/${createdId}`
                : `/projects/plan?openTask=${createdId}`;
            },
          },
        }
      );
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error("Konvertering feilet: " + (err.message || "Ukjent feil"));
    },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Konverter bestilling</SheetTitle>
          <SheetDescription>
            Opprett en sak eller et oppdrag basert på denne bestillingen. Data overføres automatisk.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Target type */}
          <RadioGroup value={target} onValueChange={(v) => setTarget(v as "case" | "order")} className="space-y-3">
            <div className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${target === "case" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30"}`}>
              <RadioGroupItem value="case" id="conv-case" />
              <Label htmlFor="conv-case" className="cursor-pointer flex-1">
                <span className="font-medium text-sm">Konverter til sak</span>
                <p className="text-xs text-muted-foreground">Opprett en sak i Henvendelser for videre oppfølging</p>
              </Label>
            </div>
            <div className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${target === "order" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30"}`}>
              <RadioGroupItem value="order" id="conv-order" />
              <Label htmlFor="conv-order" className="cursor-pointer flex-1">
                <span className="font-medium text-sm">Konverter til oppdrag</span>
                <p className="text-xs text-muted-foreground">Opprett et oppdrag for planlegging og gjennomføring</p>
              </Label>
            </div>
          </RadioGroup>

          <Separator />

          {/* Editable fields */}
          <div className="space-y-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Data som overføres</p>
            
            <div>
              <Label className="text-xs">Tittel</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Kunde</Label>
              <Input value={customer} onChange={(e) => setCustomer(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Adresse</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Beskrivelse</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 min-h-[80px]"
              />
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline">Hastegrad: {hastegrad}</Badge>
              <Badge variant="outline">
                Ref: {values.referanse_po || values.midlertidig_referanse || "Ikke angitt"}
              </Badge>
              {values.onsket_utfort_dato && (
                <Badge variant="outline">Ønsket: {values.onsket_utfort_dato}</Badge>
              )}
            </div>
          </div>

          <Separator />

          <Button
            className="w-full"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Konverterer..." : (
              <>
                <ArrowRight className="h-4 w-4 mr-1.5" />
                Opprett {target === "case" ? "sak" : "oppdrag"}
              </>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
