import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { useTechnicians } from "@/hooks/useTechnicians";
import { useCalendarSync } from "@/hooks/useCalendarSync";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CalendarPlus } from "lucide-react";
import { toast } from "sonner";

interface PublicLeadRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  segment: string | null;
  request_type: string | null;
  message: string | null;
  lead_source: string | null;
  selected_brand: string | null;
  selected_product_name: string | null;
  selected_solution_name: string | null;
  calculator_summary: any;
}

export interface BefaringLead {
  id: string;
  company_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  company_id: string | null;
  public_lead_id?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lead: BefaringLead;
  onCreated?: () => void;
}

function fmtCalc(summary: any): string {
  if (!summary || typeof summary !== "object") return "";
  return Object.entries(summary)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `  ${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join("\n");
}

export function CreateBefaringDrawer({ open, onOpenChange, lead, onCreated }: Props) {
  const { user } = useAuth();
  const { activeCompanyId, allowedCompanyIds } = useCompanyContext();
  const { syncCreate } = useCalendarSync();
  const companyId = lead.company_id || activeCompanyId || null;
  const { technicians } = useTechnicians(companyId, allowedCompanyIds);

  const [publicLead, setPublicLead] = useState<PublicLeadRow | null>(null);
  const [loadingContext, setLoadingContext] = useState(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [customer, setCustomer] = useState("");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [techId, setTechId] = useState<string>("__none__");
  const [notes, setNotes] = useState("");
  const [context, setContext] = useState("");
  const [sendEmail, setSendEmail] = useState(false);
  const [syncGoogle, setSyncGoogle] = useState(true);
  const [clientRequestId, setClientRequestId] = useState<string>(() => crypto.randomUUID());

  // ── Prefill when opened ──
  useEffect(() => {
    if (!open) return;
    setClientRequestId(crypto.randomUUID());
    let cancelled = false;

    const applyPrefill = (pl: PublicLeadRow | null) => {
      if (cancelled) return;
      setPublicLead(pl);

      const brandModel = [pl?.selected_brand, pl?.selected_product_name].filter(Boolean).join(" ");
      const segmentLabel = (pl?.segment || "").toLowerCase() === "naering" || (pl?.segment || "").toLowerCase() === "næring"
        ? "næring"
        : "bolig";
      let defaultTitle = "Befaring – varmepumpe";
      if (brandModel) defaultTitle = `Befaring – ${brandModel}`;
      else if (pl?.selected_solution_name) defaultTitle = `Befaring – ${pl.selected_solution_name}`;
      else if (pl?.calculator_summary) defaultTitle = `Befaring – varmepumpevurdering ${segmentLabel}`;
      setTitle(defaultTitle);

      setCustomer(pl?.name || lead.company_name || "");
      setContact(lead.contact_name || pl?.name || "");
      setEmail(lead.email || pl?.email || "");
      setPhone(lead.phone || pl?.phone || "");
      setAddress(pl?.address || "");

      const ctx = [
        `Lead-ID: ${lead.id}`,
        pl ? `Nettside-henvendelse: ${pl.id}` : null,
        pl?.lead_source ? `Kilde: ${pl.lead_source}` : null,
        pl?.segment ? `Segment: ${pl.segment}` : null,
        pl?.request_type ? `Type: ${pl.request_type}` : null,
        pl?.address ? `Adresse: ${pl.address}` : null,
        pl?.selected_brand ? `Merke: ${pl.selected_brand}` : null,
        pl?.selected_product_name ? `Modell: ${pl.selected_product_name}` : null,
        pl?.selected_solution_name ? `Løsning: ${pl.selected_solution_name}` : null,
        pl?.calculator_summary ? `Kalkulator:\n${fmtCalc(pl.calculator_summary)}` : null,
        pl?.message ? `\nKundens melding:\n${pl.message}` : null,
        !pl && lead.notes ? `\nNotater fra lead:\n${lead.notes}` : null,
      ].filter(Boolean).join("\n");
      setContext(ctx);
      setNotes("");
      setSendEmail(false);
      setSyncGoogle(true);
      setTechId("__none__");
    };

    if (lead.public_lead_id) {
      setLoadingContext(true);
      supabase.from("public_leads").select("*").eq("id", lead.public_lead_id).maybeSingle()
        .then(({ data }) => { applyPrefill((data as any) || null); setLoadingContext(false); });
    } else {
      applyPrefill(null);
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lead.id, lead.public_lead_id]);

  const canSave = useMemo(
    () => Boolean(title.trim() && date && startTime && endTime && !saving),
    [title, date, startTime, endTime, saving],
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
        toast.error("Fant ikke selskap for befaringen");
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

      const description = [
        notes.trim() ? notes.trim() : null,
        context.trim() ? `— Kontekst fra henvendelse —\n${context.trim()}` : null,
        [email, phone].filter(Boolean).length ? `Kontakt: ${[contact, email, phone].filter(Boolean).join(" · ")}` : null,
      ].filter(Boolean).join("\n\n");

      // Idempotency: reuse if the same client_request_id already produced an event
      const { data: existing } = await supabase
        .from("events").select("id").eq("client_request_id", clientRequestId).maybeSingle();

      let eventId: string;
      if (existing) {
        eventId = existing.id;
      } else {
        const selectedTech = techId !== "__none__" ? techId : null;
        const { data: created, error } = await supabase.from("events").insert({
          title: title.trim(),
          customer: customer.trim() || lead.company_name,
          address: address.trim() || null,
          description: description || null,
          start_time: startISO,
          end_time: endISO,
          technician_id: selectedTech || user?.id || "00000000-0000-0000-0000-000000000000",
          status: "scheduled" as any,
          created_by: user?.id || null,
          client_request_id: clientRequestId,
          project_type: "task",
          company_id: resolvedCompanyId,
          source_lead_id: lead.id,
        } as any).select("id").single();

        if (error || !created) {
          toast.error("Kunne ikke opprette befaring", { description: error?.message });
          setSaving(false);
          return;
        }
        eventId = created.id;

        await supabase.from("event_logs").insert({
          event_id: eventId,
          action_type: "created",
          performed_by: user?.id,
          change_summary: "opprettet befaring fra henvendelse",
        } as any);

        if (selectedTech) {
          await (supabase as any).from("event_technicians").upsert(
            [{ event_id: eventId, technician_id: selectedTech, start_at: startISO, end_at: endISO }],
            { onConflict: "event_id,technician_id", ignoreDuplicates: false },
          );
          await (supabase as any).from("schedule_blocks").insert({
            company_id: resolvedCompanyId,
            technician_id: selectedTech,
            project_id: eventId,
            source: "manual",
            start_at: startISO,
            end_at: endISO,
            title: title.trim(),
            match_state: "manual",
            match_confidence: 100,
            match_reason: "Befaring opprettet fra henvendelse",
          });
        }
      }

      // Link befaring back to the lead (shown in "Møter" on the lead)
      await supabase.from("lead_calendar_links").insert({
        lead_id: lead.id,
        outlook_event_id: eventId,
        event_subject: title.trim(),
        event_start: startISO,
        event_end: endISO,
        event_location: address.trim() || null,
        attendee_emails: [email].filter(Boolean),
        created_by: user?.id || null,
      } as any);

      // Lead status → befaring (trigger mirrors public_leads → befaring_booked)
      await supabase.from("leads").update({ status: "befaring" as any }).eq("id", lead.id);

      const when = format(new Date(startISO), "dd.MM.yyyy HH:mm");
      await supabase.from("lead_history").insert({
        lead_id: lead.id,
        action: "befaring_created",
        description: `Befaring opprettet: ${when}`,
        performed_by: user?.id,
        metadata: { event_id: eventId, title: title.trim() },
      } as any);
      await supabase.from("activity_log").insert({
        entity_type: "lead",
        entity_id: lead.id,
        action: "befaring_created",
        type: "meeting",
        title: title.trim(),
        description: `Befaring opprettet: ${when}`,
        performed_by: user?.id || null,
        metadata: { event_id: eventId },
      } as any);

      toast.success("Befaring opprettet", { description: when });

      if (syncGoogle) syncCreate(eventId);

      if (sendEmail && email.trim()) {
        const text = [
          `Hei ${contact || customer},`,
          "",
          `Vi har satt opp befaring: ${title.trim()}`,
          `Tidspunkt: ${when}`,
          address.trim() ? `Sted: ${address.trim()}` : null,
          "",
          "Ta kontakt hvis tidspunktet ikke passer.",
          "",
          "Vennlig hilsen",
          "Lier VPS",
        ].filter(Boolean).join("\n");
        const { data: mail, error: mailErr } = await supabase.functions.invoke("gmail-send", {
          body: { to: email.trim(), subject: `Befaring – ${format(new Date(startISO), "dd.MM.yyyy HH:mm")}`, text },
        });
        if (mailErr || mail?.status === "error") {
          toast.warning("Befaring lagret, men e-post ble ikke sendt");
        } else if (mail?.status === "no_token") {
          toast.info("Befaring lagret. Gmail er ikke koblet til – e-post ble ikke sendt.");
        } else {
          toast.success("Bekreftelse sendt til kunden");
        }
      }

      onOpenChange(false);
      onCreated?.();
    } catch (err: any) {
      console.error("[CreateBefaring] error:", err);
      toast.error("Kunne ikke opprette befaring", { description: err?.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <CalendarPlus className="h-4 w-4 text-primary" /> Lag befaring
          </SheetTitle>
          <SheetDescription>Forhåndsutfylt fra henvendelsen. Ingen data må skrives inn på nytt.</SheetDescription>
        </SheetHeader>

        {loadingContext ? (
          <div className="py-12 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-4 py-4">
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
            </div>

            <div className="grid grid-cols-2 gap-3">
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
              <Label>Adresse / poststed</Label>
              <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Adresse for befaringen" />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Dato *</Label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Fra *</Label>
                <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Til *</Label>
                <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Ressurs (valgfritt)</Label>
              <Select value={techId} onValueChange={setTechId}>
                <SelectTrigger><SelectValue placeholder="Ingen ressurs" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Ingen ressurs</SelectItem>
                  {technicians.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Notat</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Interne notater om befaringen..." />
            </div>

            <div className="space-y-1.5">
              <Label>Intern kontekst fra henvendelsen</Label>
              <Textarea value={context} onChange={e => setContext(e.target.value)} rows={8} className="font-mono text-xs" />
            </div>

            <div className="space-y-2 rounded-xl border border-border/60 p-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={sendEmail} onCheckedChange={v => setSendEmail(Boolean(v))} disabled={!email.trim()} />
                Send e-postbekreftelse til kunden
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={syncGoogle} onCheckedChange={v => setSyncGoogle(Boolean(v))} />
                Synk til Google Kalender (hvis koblet til)
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Avbryt</Button>
              <Button onClick={handleSave} disabled={!canSave} className="gap-1.5">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
                Opprett befaring
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
