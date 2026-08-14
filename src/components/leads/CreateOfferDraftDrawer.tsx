import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import { calcSummaryBlock } from "@/lib/calc-summary";
import { useLeadConversionContext, segmentLabel, type ConversionLead } from "./useLeadConversionContext";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lead: ConversionLead;
  onCreated?: () => void;
}

export function CreateOfferDraftDrawer({ open, onOpenChange, lead, onCreated }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { activeCompanyId } = useCompanyContext();
  const { loading, publicLead, befaring, customerMatches } = useLeadConversionContext(lead, open);

  const [title, setTitle] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [solution, setSolution] = useState("");
  const [product, setProduct] = useState("");
  const [scope, setScope] = useState("");
  const [priceEstimate, setPriceEstimate] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [customerId, setCustomerId] = useState<string>("__none__");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || loading) return;
    const pl = publicLead;
    const brandModel = [pl?.selected_brand, pl?.selected_product_name].filter(Boolean).join(" ").trim();
    setTitle(brandModel ? `Tilbud – ${brandModel}` : "Tilbud – varmepumpe");
    setCustomerName(lead.company_name || pl?.name || "");
    setContactName(lead.contact_name || pl?.name || "");
    setEmail(lead.email || pl?.email || "");
    setPhone(lead.phone || pl?.phone || "");
    setAddress(pl?.address || befaring?.address || "");
    setProduct(brandModel);
    setSolution(pl?.selected_solution_name || (brandModel ? brandModel : "Luft-luft varmepumpe"));
    setPriceEstimate("");
    setCustomerId(customerMatches.length === 1 ? customerMatches[0].id : "__none__");

    const scopeLines = [
      `Segment: ${segmentLabel(pl?.segment)}`,
      brandModel ? `Valgt produkt: ${brandModel}` : null,
      pl?.selected_solution_name ? `Løsning: ${pl.selected_solution_name}` : null,
      pl?.address ? `Adresse: ${pl.address}` : null,
      pl?.calculator_summary ? `\nFra kalkulator:\n${calcSummaryBlock(pl.calculator_summary)}` : null,
      befaring ? `\nBefaring: ${format(new Date(befaring.start_time), "d. MMM yyyy 'kl.' HH:mm", { locale: nb })}` : null,
      pl?.message ? `\nKundens melding:\n${pl.message}` : null,
      lead.notes ? `\nNotater fra henvendelsen:\n${lead.notes}` : null,
      befaring?.description ? `\nFra befaringen:\n${befaring.description}` : null,
    ].filter(Boolean).join("\n");
    setScope(scopeLines);
    setInternalNotes("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loading, publicLead?.id, befaring?.id, customerMatches.length]);

  const canSave = useMemo(
    () => Boolean(title.trim() && customerName.trim() && !saving && !loading),
    [title, customerName, saving, loading],
  );

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const companyId = lead.company_id || activeCompanyId || null;
      const price = priceEstimate.trim() ? Number(priceEstimate.replace(/\s/g, "").replace(",", ".")) : null;

      // Guard against accidental duplicates: same lead + same title, still a draft
      const { data: dupe } = await supabase
        .from("calculations")
        .select("id")
        .eq("lead_id", lead.id)
        .eq("project_title", title.trim())
        .eq("status", "draft" as any)
        .is("deleted_at", null)
        .maybeSingle();

      if (dupe) {
        toast.info("Tilbudsutkast finnes allerede", { description: "Åpner eksisterende utkast." });
        onOpenChange(false);
        onCreated?.();
        navigate(`/sales/offers/${(dupe as any).id}`);
        return;
      }

      const snapshot = {
        source: "lead_befaring_v1",
        lead_id: lead.id,
        public_lead_id: lead.public_lead_id || null,
        befaring_event_id: befaring?.id || null,
        befaring_start: befaring?.start_time || null,
        segment: segmentLabel(publicLead?.segment),
        address: address.trim() || null,
        contact_name: contactName.trim() || null,
        contact_phone: phone.trim() || null,
        recommended_solution: solution.trim() || null,
        selected_product: product.trim() || null,
        brand: publicLead?.selected_brand || null,
        model: publicLead?.selected_product_name || null,
        calculator_summary: publicLead?.calculator_summary || null,
        internal_notes: internalNotes.trim() || null,
        price_estimate: price,
      };

      const { data: created, error } = await supabase
        .from("calculations")
        .insert({
          project_title: title.trim(),
          customer_name: customerName.trim(),
          customer_email: email.trim() || null,
          customer_id: customerId !== "__none__" ? customerId : null,
          description: scope.trim() || null,
          status: "draft" as any,
          lead_id: lead.id,
          company_id: companyId,
          created_by: user?.id || null,
          total_price: price,
          input_snapshot: snapshot as any,
        } as any)
        .select("id")
        .single();

      if (error || !created) {
        toast.error("Kunne ikke opprette tilbudsutkast", { description: error?.message });
        setSaving(false);
        return;
      }

      const stamp = format(new Date(), "dd.MM.yyyy HH:mm");
      await supabase.from("lead_history").insert({
        lead_id: lead.id,
        action: "offer_draft_created",
        description: `Tilbudsutkast opprettet: ${stamp}`,
        performed_by: user?.id,
        metadata: { calculation_id: created.id, befaring_event_id: befaring?.id || null },
      } as any);
      await supabase.from("activity_log").insert({
        entity_type: "lead",
        entity_id: lead.id,
        action: "offer_draft_created",
        type: "note",
        title: title.trim(),
        description: `Tilbudsutkast opprettet: ${stamp}`,
        performed_by: user?.id || null,
        metadata: { calculation_id: created.id, befaring_event_id: befaring?.id || null },
      } as any);

      // NB: lead-status settes ikke til «tilbud sendt» før tilbudet faktisk sendes.
      toast.success("Tilbudsutkast opprettet", { description: "Status: utkast" });
      onOpenChange(false);
      onCreated?.();
      navigate(`/sales/offers/${created.id}`);
    } catch (e: any) {
      console.error("[CreateOfferDraft]", e);
      toast.error("Kunne ikke opprette tilbudsutkast", { description: e?.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2"><FileText className="h-4 w-4" /> Lag tilbud</SheetTitle>
          <SheetDescription>Forhåndsutfylt fra henvendelsen{befaring ? " og befaringen" : ""}. Lagres som utkast.</SheetDescription>
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
                <Label>Kunde *</Label>
                <Input value={customerName} onChange={e => setCustomerName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Kontaktperson</Label>
                <Input value={contactName} onChange={e => setContactName(e.target.value)} />
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
              <Label>Adresse</Label>
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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Anbefalt løsning</Label>
                <Input value={solution} onChange={e => setSolution(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Produkt / modell</Label>
                <Input value={product} onChange={e => setProduct(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Omfang / beskrivelse</Label>
              <Textarea value={scope} onChange={e => setScope(e.target.value)} rows={10} />
            </div>

            <div className="space-y-1.5">
              <Label>Prisestimat (kr, valgfritt)</Label>
              <Input value={priceEstimate} onChange={e => setPriceEstimate(e.target.value)} inputMode="decimal" placeholder="f.eks. 34900" />
            </div>

            <div className="space-y-1.5">
              <Label>Interne notater</Label>
              <Textarea value={internalNotes} onChange={e => setInternalNotes(e.target.value)} rows={3} />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button className="flex-1 rounded-xl gap-1.5" onClick={handleSave} disabled={!canSave}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                Lagre tilbudsutkast
              </Button>
              <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>Avbryt</Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
