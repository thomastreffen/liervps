import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { useTechnicians } from "@/hooks/useTechnicians";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Wrench } from "lucide-react";
import { toast } from "sonner";
import { calcSummaryBlock } from "@/lib/calc-summary";
import { useLeadConversionContext, segmentLabel, type ConversionLead } from "./useLeadConversionContext";

export interface JobOfferContext {
  id: string;
  project_title: string;
  total_price?: number | null;
  input_snapshot?: any;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lead: ConversionLead;
  /** Tilbudet oppdraget bekreftes fra – gir kobling og hindrer dobbeltoppdrag. */
  offer?: JobOfferContext | null;
  onCreated?: () => void;
}

export function CreateJobFromLeadDrawer({ open, onOpenChange, lead, offer, onCreated }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { activeCompanyId, allowedCompanyIds } = useCompanyContext();
  const companyId = lead.company_id || activeCompanyId || null;
  const { technicians } = useTechnicians(companyId, allowedCompanyIds);
  const { loading, publicLead, befaring, customerMatches } = useLeadConversionContext(lead, open);

  const [title, setTitle] = useState("");
  const [customer, setCustomer] = useState("");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("16:00");
  const [techId, setTechId] = useState("__none__");
  const [description, setDescription] = useState("");
  const [customerId, setCustomerId] = useState("__none__");
  const [confirmed, setConfirmed] = useState(false);
  const [sendConfirmation, setSendConfirmation] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clientRequestId, setClientRequestId] = useState(() => crypto.randomUUID());

  useEffect(() => {
    if (!open) return;
    setClientRequestId(crypto.randomUUID());
  }, [open]);

  // Hindrer dobbelt oppdrag: finnes det allerede et oppdrag på tilbudet, åpnes det i stedet.
  useEffect(() => {
    if (!open || !offer?.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("events").select("id").eq("source_calculation_id", offer.id)
        .is("deleted_at", null).limit(1).maybeSingle();
      if (cancelled || !data) return;
      toast.info("Oppdraget finnes allerede", { description: "Åpner det eksisterende oppdraget." });
      onOpenChange(false);
      navigate(`/projects/${(data as any).id}`);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, offer?.id]);

  useEffect(() => {
    if (!open || loading) return;
    const pl = publicLead;
    const brandModel = [pl?.selected_brand, pl?.selected_product_name].filter(Boolean).join(" ").trim();
    setTitle(offer?.project_title?.trim() || (brandModel ? `Montering – ${brandModel}` : "Montering – varmepumpe"));
    setCustomer(lead.company_name || pl?.name || "");
    setContact(lead.contact_name || pl?.name || "");
    setEmail(lead.email || pl?.email || "");
    setPhone(lead.phone || pl?.phone || "");
    setAddress(pl?.address || befaring?.address || "");
    setCustomerId(customerMatches.length === 1 ? customerMatches[0].id : "__none__");
    setConfirmed(Boolean(offer));
    setSendConfirmation(false);
    setTechId("__none__");

    setDescription([
      `Segment: ${segmentLabel(pl?.segment)}`,
      brandModel ? `Produkt: ${brandModel}` : null,
      pl?.selected_solution_name ? `Løsning: ${pl.selected_solution_name}` : null,
      pl?.calculator_summary ? `\nFra kalkulator:\n${calcSummaryBlock(pl.calculator_summary)}` : null,
      befaring ? `\nBefaring: ${format(new Date(befaring.start_time), "d. MMM yyyy 'kl.' HH:mm", { locale: nb })}` : null,
      lead.notes ? `\nNotater fra henvendelsen:\n${lead.notes}` : null,
      befaring?.description ? `\nFra befaringen:\n${befaring.description}` : null,
      `\nÅpne henvendelsen: ${window.location.origin}/sales/leads/${lead.id}`,
    ].filter(Boolean).join("\n"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loading, publicLead?.id, befaring?.id, customerMatches.length, offer?.id]);

  const canSave = useMemo(
    () => Boolean(title.trim() && date && startTime && endTime && !saving && !loading),
    [title, date, startTime, endTime, saving, loading],
  );

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      let resolvedCompanyId = companyId;
      if (!resolvedCompanyId) {
        const { data: ic } = await supabase.from("internal_companies").select("id").order("name").limit(1).maybeSingle();
        resolvedCompanyId = (ic as any)?.id ?? null;
      }
      if (!resolvedCompanyId) {
        toast.error("Fant ikke selskap for oppdraget");
        setSaving(false);
        return;
      }

      const startISO = new Date(`${date}T${startTime}:00`).toISOString();
      const endISO = new Date(`${date}T${endTime}:00`).toISOString();
      if (new Date(endISO) <= new Date(startISO)) {
        toast.error("Slutt-tid må være etter start-tid");
        setSaving(false);
        return;
      }

      // Idempotency — reuse if this drawer already created an event
      const { data: existing } = await supabase
        .from("events").select("id").eq("client_request_id", clientRequestId).maybeSingle();

      let jobId: string;
      if (existing) {
        jobId = (existing as any).id;
      } else {
        const selectedTech = techId !== "__none__" ? techId : null;
        let ownerTechId = selectedTech;
        if (!ownerTechId) {
          const { data: myTech } = await supabase
            .from("technicians").select("id").eq("user_id", user?.id || "").limit(1).maybeSingle();
          ownerTechId = (myTech as any)?.id ?? technicians[0]?.id ?? null;
        }
        if (!ownerTechId) {
          toast.error("Ingen ressurs tilgjengelig", { description: "Velg en montør for oppdraget." });
          setSaving(false);
          return;
        }

        const fullDescription = [
          description.trim() || null,
          [contact, email, phone].filter(Boolean).length ? `Kontakt: ${[contact, email, phone].filter(Boolean).join(" · ")}` : null,
        ].filter(Boolean).join("\n\n");

        const { data: created, error } = await supabase.from("events").insert({
          title: title.trim(),
          customer: customer.trim() || lead.company_name,
          customer_id: customerId !== "__none__" ? customerId : null,
          address: address.trim() || null,
          description: fullDescription || null,
          start_time: startISO,
          end_time: endISO,
          technician_id: ownerTechId,
          status: (confirmed ? "scheduled" : "requested") as any,
          created_by: user?.id || null,
          client_request_id: clientRequestId,
          project_type: "project",
          company_id: resolvedCompanyId,
          source_lead_id: lead.id,
          source_calculation_id: offer?.id || null,
        } as any).select("id").single();

        if (error || !created) {
          toast.error("Kunne ikke opprette oppdrag", { description: error?.message });
          setSaving(false);
          return;
        }
        jobId = created.id;

        await supabase.from("event_logs").insert({
          event_id: jobId,
          action_type: "created",
          performed_by: user?.id,
          change_summary: confirmed ? "opprettet bekreftet oppdrag fra henvendelse" : "opprettet oppdragsutkast fra henvendelse",
        } as any);

        if (selectedTech) {
          await (supabase as any).from("event_technicians").upsert(
            [{ event_id: jobId, technician_id: selectedTech, start_at: startISO, end_at: endISO }],
            { onConflict: "event_id,technician_id", ignoreDuplicates: false },
          );
        }
      }

      const stamp = format(new Date(), "dd.MM.yyyy HH:mm");
      const label = confirmed ? "Oppdrag bekreftet" : "Oppdragsutkast opprettet";
      await supabase.from("lead_history").insert({
        lead_id: lead.id,
        action: "job_created",
        description: `${label}: ${stamp}`,
        performed_by: user?.id,
        metadata: { job_id: jobId, befaring_event_id: befaring?.id || null, confirmed },
      } as any);
      await supabase.from("activity_log").insert({
        entity_type: "lead",
        entity_id: lead.id,
        action: "job_created",
        type: "note",
        title: title.trim(),
        description: `${label}: ${stamp}`,
        performed_by: user?.id || null,
        metadata: { job_id: jobId, confirmed },
      } as any);

      // Lead-status endres kun når oppdraget faktisk er bekreftet
      if (confirmed) {
        await supabase.from("leads").update({ status: "won" as any }).eq("id", lead.id);
        if (lead.public_lead_id) {
          await supabase.from("public_leads")
            .update({ status: "won", handled_at: new Date().toISOString(), handled_by: user?.id || null } as any)
            .eq("id", lead.public_lead_id);
        }
      }

      toast.success(label);

      // Ordrebekreftelse er valgfri og skal aldri blokkere lagringen.
      if (confirmed && sendConfirmation && email.trim()) {
        try {
          const brandModel = [publicLead?.selected_brand, publicLead?.selected_product_name].filter(Boolean).join(" ").trim();
          const solution = publicLead?.selected_solution_name || brandModel || title.trim();
          const bodyLines = [
            `Hei ${contact || customer || ""}`.trim(),
            "",
            "Takk for tilliten – vi har registrert oppdraget ditt.",
            "",
            `Bekreftet løsning: ${solution}`,
            address.trim() ? `Adresse: ${address.trim()}` : null,
            `Planlagt dato: ${format(new Date(startISO), "d. MMMM yyyy 'kl.' HH:mm", { locale: nb })}`,
            "",
            "Neste steg: vi tar kontakt for endelig avtale om montering og forbereder utstyret.",
            "",
            "Lier Varmepumpeservice AS",
            "post@liervps.no · liervps.no",
          ].filter(Boolean).join("\n");

          const { error: mailError } = await supabase.functions.invoke("gmail-send", {
            body: {
              to: email.trim(),
              subject: "Ordrebekreftelse fra Lier Varmepumpeservice",
              text: bodyLines,
              html: `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1f2937;white-space:pre-wrap">${bodyLines
                .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`,
            },
          });
          if (mailError) throw mailError;
          toast.success("Ordrebekreftelse sendt til kunden");
          await supabase.from("lead_history").insert({
            lead_id: lead.id, action: "order_confirmation_sent",
            description: `Ordrebekreftelse sendt til ${email.trim()}: ${stamp}`,
            performed_by: user?.id, metadata: { job_id: jobId },
          } as any);
        } catch (mailErr: any) {
          console.warn("[CreateJobFromLead] ordrebekreftelse feilet", mailErr);
          toast.error("Oppdraget er lagret, men e-posten ble ikke sendt", {
            description: mailErr?.message || "Sjekk Google-tilkoblingen.",
          });
        }
      }
      onOpenChange(false);
      onCreated?.();
      navigate(`/projects/${jobId}`);
    } catch (e: any) {
      console.error("[CreateJobFromLead]", e);
      toast.error("Kunne ikke opprette oppdrag", { description: e?.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2"><Wrench className="h-4 w-4" /> Opprett oppdrag</SheetTitle>
          <SheetDescription>Forhåndsutfylt fra henvendelsen{befaring ? " og befaringen" : ""}.</SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-4 py-4">
            {befaring && (
              <Badge variant="secondary" className="text-[11px]">
                Befaring {format(new Date(befaring.start_time), "d. MMM yyyy 'kl.' HH:mm", { locale: nb })}
              </Badge>
            )}

            <div className="space-y-1.5">
              <Label>Tittel *</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Kunde</Label>
                <Input value={customer} onChange={e => setCustomer(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Kontaktperson</Label>
                <Input value={contact} onChange={e => setContact(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>E-post</Label>
                <Input value={email} onChange={e => setEmail(e.target.value)} type="email" />
              </div>
              <div className="space-y-1.5">
                <Label>Telefon</Label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Adresse / oppdragssted</Label>
              <Input value={address} onChange={e => setAddress(e.target.value)} />
            </div>

            {customerMatches.length > 0 && (
              <div className="space-y-1.5">
                <Label>Eksisterende kunde funnet</Label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger><SelectValue placeholder="Velg kunde" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Ikke koble til kundekort</SelectItem>
                    {customerMatches.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}{c.main_email ? ` · ${c.main_email}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">Ingen nye kunder opprettes automatisk.</p>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Dato</Label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Fra</Label>
                <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Til</Label>
                <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Montør</Label>
              <Select value={techId} onValueChange={setTechId}>
                <SelectTrigger><SelectValue placeholder="Velg montør" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Ikke tildelt ennå</SelectItem>
                  {technicians.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Beskrivelse / kontekst</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={9} />
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer rounded-xl border border-border/60 p-3">
              <Checkbox checked={confirmed} onCheckedChange={v => setConfirmed(!!v)} />
              <span className="text-sm">
                Oppdraget er bekreftet av kunden
                <span className="block text-xs text-muted-foreground">Setter henvendelsen til «vunnet». Uten dette lagres oppdraget som utkast og status beholdes.</span>
              </span>
            </label>

            {confirmed && (
              <label className="flex items-start gap-2.5 cursor-pointer rounded-xl border border-border/60 p-3">
                <Checkbox checked={sendConfirmation} onCheckedChange={v => setSendConfirmation(!!v)} disabled={!email.trim()} />
                <span className="text-sm">
                  Send ordrebekreftelse til kunde
                  <span className="block text-xs text-muted-foreground">
                    {email.trim() ? `Sendes til ${email.trim()} via Gmail. Feiler e-posten, lagres oppdraget likevel.` : "Krever e-postadresse på kunden."}
                  </span>
                </span>
              </label>
            )}

            <div className="flex items-center gap-2 pt-1">
              <Button className="flex-1 rounded-xl gap-1.5" onClick={handleSave} disabled={!canSave}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
                Opprett oppdrag
              </Button>
              <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>Avbryt</Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
