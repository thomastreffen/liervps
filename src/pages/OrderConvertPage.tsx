import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, FileText, User, MapPin, Phone, Mail,
  Calendar, Clock, Paperclip, Tag, Loader2, CheckCircle2, Building2,
} from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";

export default function OrderConvertPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { activeCompanyId } = useCompanyContext();

  const [target, setTarget] = useState<"case" | "order">("case");

  // Fetch submission
  const { data: submission, isLoading } = useQuery({
    queryKey: ["order-form-submission", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_form_submissions")
        .select("*, order_form_templates(name, slug)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: values = [] } = useQuery({
    queryKey: ["order-form-values", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase
        .from("order_form_submission_values")
        .select("*")
        .eq("submission_id", id!);
      return data || [];
    },
  });

  const { data: attachments = [] } = useQuery({
    queryKey: ["order-form-attachments", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase
        .from("order_form_submission_attachments")
        .select("*")
        .eq("submission_id", id!);
      return data || [];
    },
  });

  const valuesMap = useMemo(() => {
    const m: Record<string, any> = {};
    for (const v of values) m[(v as any).field_key] = (v as any).value;
    return m;
  }, [values]);

  const summary = submission?.summary as Record<string, any> | null;

  // Editable target fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [customer, setCustomer] = useState("");

  // Populate when data loads
  const [initialized, setInitialized] = useState(false);
  
  useEffect(() => {
    if (!initialized && submission) {
      const vm: Record<string, any> = {};
      for (const v of values) vm[(v as any).field_key] = (v as any).value;
      const s = (submission.summary as Record<string, any>) || {};
      const formValues = (submission as any).form_values as Record<string, any> | null;
      
      // Try multiple sources: values rows → summary → form_values
      setTitle(
        vm.oppdragstittel || s.oppdragstittel || s.tittel || 
        formValues?.oppdragstittel || submission.submission_no || ""
      );
      setDescription(
        vm.detaljert_arbeidsbeskrivelse || s.detaljert_arbeidsbeskrivelse || 
        vm.beskrivelse || s.beskrivelse || formValues?.detaljert_arbeidsbeskrivelse || ""
      );
      setAddress(
        vm.anleggsadresse || s.anleggsadresse || vm.oppdragssted || s.oppdragssted ||
        vm.adresse || s.adresse || formValues?.anleggsadresse || ""
      );
      setCustomer(
        vm.kundenavn || s.kundenavn || vm.kunde || s.kunde ||
        formValues?.kundenavn || submission.submitter_name || ""
      );
      setInitialized(true);
    }
  }, [submission, values, initialized]);

  const priorityMap: Record<string, string> = {
    "Kritisk stopp": "critical",
    "Høy": "high",
    "Normal": "medium",
    "Lav": "low",
  };
  const hastegrad = valuesMap.hastegrad || summary?.hastegrad || "Normal";

  // Source info for display
  const bestillerNavn = submission?.submitter_name || summary?.bestiller_navn || valuesMap.bestiller_navn || "–";
  const bestillerEpost = submission?.submitter_email || summary?.bestiller_epost || valuesMap.bestiller_epost || "–";
  const bestillerTelefon = valuesMap.bestiller_telefon || summary?.bestiller_telefon || "–";
  const kontaktperson = valuesMap.kontaktperson_navn || summary?.kontaktperson || "–";
  const kontaktTelefon = valuesMap.kontaktperson_telefon || "–";
  const referanse = valuesMap.referanse_po || valuesMap.midlertidig_referanse || "–";
  const onsketDato = valuesMap.onsket_utfort_dato || "–";
  const onsketTid = valuesMap.onsket_klokkeslett || "–";
  const oppdragssted = valuesMap.oppdragssted || valuesMap.anleggsadresse || "–";

  const mutation = useMutation({
    mutationFn: async () => {
      if (!activeCompanyId) throw new Error("Mangler selskap");
      let createdId: string | null = null;

      if (target === "case") {
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
            source_order_form_id: id,
          })
          .select("id, case_number")
          .single();
        if (caseErr) throw caseErr;
        createdId = newCase.id;

        if (description) {
          await supabase.from("case_items").insert({
            case_id: newCase.id,
            company_id: activeCompanyId,
            type: "note",
            subject: `Bestilling ${submission?.submission_no || ""}`,
            body_text: `Konvertert fra bestilling.\n\nKunde: ${customer}\nAdresse: ${address}\n\nBeskrivelse:\n${description}`,
            from_name: "System",
          });
        }
      } else {
        const now = new Date();
        const startTime = valuesMap.onsket_utfort_dato
          ? new Date(valuesMap.onsket_utfort_dato + "T08:00:00")
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
            source_order_form_id: id,
          })
          .select("id, internal_number")
          .single();
        if (eventErr) throw eventErr;
        createdId = newEvent.id;
      }

      await supabase
        .from("order_form_submissions")
        .update({
          status: "converted",
          converted_to_type: target === "case" ? "case" : "work_order",
          converted_to_id: createdId,
        })
        .eq("id", id!);

      await supabase.from("order_form_activity_log").insert({
        submission_id: id!,
        event_type: target === "case" ? "converted_to_case" : "converted_to_order",
        payload: { target_type: target, created_id: createdId, customer, title },
        created_by: user?.id,
      });

      return createdId;
    },
    onSuccess: (createdId) => {
      qc.invalidateQueries({ queryKey: ["order-form-submission", id] });
      qc.invalidateQueries({ queryKey: ["order-form-activity", id] });
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
      navigate(`/orders/${id}`);
    },
    onError: (err: any) => {
      toast.error("Konvertering feilet: " + (err.message || "Ukjent feil"));
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Fant ikke bestillingen.
      </div>
    );
  }

  if (submission.converted_to_id) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center space-y-4">
        <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
        <h2 className="text-lg font-semibold">Allerede konvertert</h2>
        <p className="text-muted-foreground text-sm">Denne bestillingen er allerede konvertert.</p>
        <Button variant="outline" onClick={() => navigate(`/orders/${id}`)}>
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Tilbake
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/orders/${id}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold">Konverter bestilling</h1>
          <p className="text-sm text-muted-foreground">
            {submission.submission_no} · {(submission as any).order_form_templates?.name || "Bestilling"}
          </p>
        </div>
        <Badge variant="outline" className="text-xs">{hastegrad}</Badge>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT: Source data */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <FileText className="h-4 w-4" /> Fra bestilling
          </h2>

          <Card className="border-border/50">
            <CardContent className="py-4 space-y-4">
              {/* Bestiller */}
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 font-medium">Bestiller</p>
                <div className="space-y-1">
                  <InfoRow icon={<User className="h-3.5 w-3.5" />} label={bestillerNavn} />
                  <InfoRow icon={<Mail className="h-3.5 w-3.5" />} label={bestillerEpost} />
                  {bestillerTelefon !== "–" && <InfoRow icon={<Phone className="h-3.5 w-3.5" />} label={bestillerTelefon} />}
                </div>
              </div>

              <Separator />

              {/* Kunde & kontakt */}
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 font-medium">Kunde & kontakt</p>
                <div className="space-y-1">
                  <InfoRow icon={<Building2 className="h-3.5 w-3.5" />} label={valuesMap.kundenavn || summary?.kundenavn || "–"} />
                  {kontaktperson !== "–" && <InfoRow icon={<User className="h-3.5 w-3.5" />} label={kontaktperson} sub="Kontaktperson" />}
                  {kontaktTelefon !== "–" && <InfoRow icon={<Phone className="h-3.5 w-3.5" />} label={kontaktTelefon} />}
                </div>
              </div>

              <Separator />

              {/* Oppdragssted */}
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 font-medium">Oppdragssted</p>
                <InfoRow icon={<MapPin className="h-3.5 w-3.5" />} label={oppdragssted} />
              </div>

              <Separator />

              {/* Dato / tid */}
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 font-medium">Ønsket tidspunkt</p>
                <div className="flex gap-4">
                  <InfoRow icon={<Calendar className="h-3.5 w-3.5" />} label={onsketDato} />
                  {onsketTid !== "–" && <InfoRow icon={<Clock className="h-3.5 w-3.5" />} label={onsketTid} />}
                </div>
              </div>

              {/* Referanse */}
              {referanse !== "–" && (
                <>
                  <Separator />
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 font-medium">Referanse / PO</p>
                    <InfoRow icon={<Tag className="h-3.5 w-3.5" />} label={referanse} />
                  </div>
                </>
              )}

              {/* Beskrivelse */}
              {valuesMap.detaljert_arbeidsbeskrivelse && (
                <>
                  <Separator />
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 font-medium">Beskrivelse fra bestiller</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                      {valuesMap.detaljert_arbeidsbeskrivelse}
                    </p>
                  </div>
                </>
              )}

              {/* Vedlegg */}
              {attachments.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 font-medium">
                      Vedlegg ({attachments.length})
                    </p>
                    <div className="space-y-1.5">
                      {attachments.map((att: any) => (
                        <div key={att.id} className="flex items-center gap-2 text-sm p-2 rounded-lg bg-muted/30">
                          <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate flex-1">{att.file_name}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {att.file_size ? (att.file_size < 1024 * 1024 ? `${Math.round(att.file_size / 1024)} KB` : `${(att.file_size / 1024 / 1024).toFixed(1)} MB`) : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: Target form */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <ArrowRight className="h-4 w-4" /> Opprett ny
          </h2>

          <Card className="border-primary/20">
            <CardContent className="py-4 space-y-5">
              {/* Target type */}
              <RadioGroup value={target} onValueChange={(v) => setTarget(v as "case" | "order")} className="grid grid-cols-2 gap-3">
                <label className={`flex flex-col items-center gap-1.5 p-4 rounded-xl border-2 cursor-pointer transition-all text-center ${target === "case" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30"}`}>
                  <RadioGroupItem value="case" id="conv-case" className="sr-only" />
                  <span className="text-sm font-medium">Sak</span>
                  <span className="text-[11px] text-muted-foreground">Henvendelser</span>
                </label>
                <label className={`flex flex-col items-center gap-1.5 p-4 rounded-xl border-2 cursor-pointer transition-all text-center ${target === "order" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30"}`}>
                  <RadioGroupItem value="order" id="conv-order" className="sr-only" />
                  <span className="text-sm font-medium">Oppdrag</span>
                  <span className="text-[11px] text-muted-foreground">Ressursplan</span>
                </label>
              </RadioGroup>

              <Separator />

              {/* Editable fields */}
              <div className="space-y-4">
                <div>
                  <Label className="text-xs font-medium">Tittel *</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" placeholder="Tittel på sak/oppdrag" />
                </div>
                <div>
                  <Label className="text-xs font-medium">Kunde</Label>
                  <Input value={customer} onChange={(e) => setCustomer(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs font-medium">Adresse</Label>
                  <Input value={address} onChange={(e) => setAddress(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs font-medium">Beskrivelse</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="mt-1 min-h-[100px]"
                  />
                </div>
              </div>

              {/* Meta badges */}
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="text-xs">Hastegrad: {hastegrad}</Badge>
                {referanse !== "–" && <Badge variant="outline" className="text-xs">Ref: {referanse}</Badge>}
                {onsketDato !== "–" && <Badge variant="outline" className="text-xs">Ønsket: {onsketDato}</Badge>}
                {attachments.length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    <Paperclip className="h-3 w-3 mr-1" />{attachments.length} vedlegg
                  </Badge>
                )}
              </div>

              <Separator />

              {/* Actions */}
              <div className="flex items-center gap-3">
                <Button
                  className="flex-1 gap-1.5"
                  onClick={() => mutation.mutate()}
                  disabled={mutation.isPending || !title.trim()}
                >
                  {mutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                  Opprett {target === "case" ? "sak" : "oppdrag"}
                </Button>
                <Button variant="outline" onClick={() => navigate(`/orders/${id}`)}>
                  Avbryt
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, sub }: { icon: React.ReactNode; label: string; sub?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground shrink-0">{icon}</span>
      <span className="text-foreground">{label}</span>
      {sub && <span className="text-[10px] text-muted-foreground">({sub})</span>}
    </div>
  );
}
