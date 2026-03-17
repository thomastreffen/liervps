import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CustomerSelect, type CustomerOption } from "@/components/offer/CustomerSelect";
import { ContactPersonSelect } from "@/components/offer/ContactPersonSelect";
import { OrderLineEditor, calcTotals, type OrderLine } from "@/components/offer/OrderLineEditor";
import { AiSuggestionsPreview } from "@/components/offer/AiSuggestionsPreview";
import { PdfPreviewDialog } from "@/components/offer/PdfPreviewDialog";
import {
  ArrowLeft, Save, Loader2, FileDown, ReceiptText, Eye,
} from "lucide-react";
import { toast } from "sonner";

export default function OfferEditorPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeCompanyId } = useCompanyContext();
  const [searchParams] = useSearchParams();

  const [calcId, setCalcId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Header fields
  const [projectTitle, setProjectTitle] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [reference, setReference] = useState("");
  const [comment, setComment] = useState("");

  // Order lines
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<OrderLine[]>([]);

  // PDF preview
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Pre-fill from query params
  useEffect(() => {
    const cName = searchParams.get("customerName");
    const cId = searchParams.get("customer");
    if (cName) setCustomerName(decodeURIComponent(cName));
    if (cId) setSelectedCustomerId(cId);
  }, [searchParams]);

  const totals = useMemo(() => calcTotals(lines), [lines]);

  const hasDescriptionOrAttachment = Boolean(comment.trim() || projectTitle.trim());

  const saveOffer = useCallback(async (silent = false): Promise<string | null> => {
    if (!user) return null;
    if (!projectTitle.trim()) {
      if (!silent) toast.error("Tilbudstittel er påkrevd");
      return null;
    }
    if (!customerName.trim()) {
      if (!silent) toast.error("Kundenavn er påkrevd");
      return null;
    }

    setSaving(true);
    try {
      let cId = calcId;

      const calcPayload: any = {
        project_title: projectTitle.trim(),
        customer_name: customerName.trim(),
        customer_email: customerEmail.trim() || null,
        customer_id: selectedCustomerId || null,
        contact_person_id: selectedContactId || null,
        description: comment.trim() || null,
        total_price: totals.totalExVat,
        total_material: 0,
        total_labor: 0,
        company_id: activeCompanyId || null,
      };

      if (cId) {
        const { error } = await supabase.from("calculations").update(calcPayload).eq("id", cId);
        if (error) throw error;
      } else {
        calcPayload.created_by = user.id;
        calcPayload.status = "draft";
        const { data, error } = await supabase
          .from("calculations")
          .insert(calcPayload)
          .select("id")
          .single();
        if (error) throw error;
        cId = data.id;
        setCalcId(cId);
      }

      // Save order lines
      await supabase.from("order_lines").delete().eq("calculation_id", cId);
      if (lines.length > 0) {
        const linePayloads = lines.map((l, idx) => ({
          calculation_id: cId,
          sort_order: idx,
          line_type: l.line_type,
          description: l.description,
          quantity: l.quantity,
          unit: l.unit || "stk",
          unit_price: l.unit_price,
          discount_percent: l.discount_percent,
          vat_rate: l.vat_rate,
          suggested_by_ai: l.suggested_by_ai,
        }));
        const { error: linesErr } = await supabase.from("order_lines").insert(linePayloads as any);
        if (linesErr) throw linesErr;
      }

      if (!silent) toast.success("Tilbud lagret");
      return cId;
    } catch (err: any) {
      toast.error("Feil ved lagring: " + (err.message || "Ukjent feil"));
      return null;
    } finally {
      setSaving(false);
    }
  }, [calcId, projectTitle, customerName, customerEmail, selectedCustomerId, selectedContactId, comment, lines, totals, user, activeCompanyId]);

  const generatePdf = async () => {
    const savedId = await saveOffer(true);
    if (!savedId) {
      toast.error("Tilbudet må lagres først. Fyll ut påkrevde felter.");
      return;
    }

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-offer-pdf", {
        body: { calculation_id: savedId, created_by: user?.id },
      });
      // 409 = no changes since last offer – not a fatal error
      if (error) {
        // Try to parse the context body for a known 409-style message
        const msg = typeof error === 'object' && 'context' in error
          ? (error as any).context?.body
          : null;
        let parsed: any = null;
        if (msg) {
          try { parsed = typeof msg === 'string' ? JSON.parse(msg) : msg; } catch {}
        }
        if (parsed?.error) {
          toast.info(parsed.error);
          // Redirect to the offer anyway so user doesn't land on blank page
          navigate(`/sales/offers/${savedId}`, { replace: true });
          return;
        }
        throw error;
      }
      if (data?.error) {
        toast.info(data.error);
        navigate(`/sales/offers/${savedId}`, { replace: true });
      } else {
        toast.success("Tilbud generert!");
        navigate(`/sales/offers/${savedId}`, { replace: true });
      }
    } catch (err: any) {
      toast.error("Feil ved generering: " + (err.message || "Ukjent feil"));
      // Still navigate so user doesn't get a blank page
      navigate(`/sales/offers/${savedId}`, { replace: true });
    } finally {
      setGenerating(false);
    }
  };

  const handlePreviewPdf = async () => {
    const savedId = await saveOffer(true);
    if (!savedId) {
      toast.error("Lagre tilbudet først for å forhåndsvise.");
      return;
    }
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewUrl(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-offer-pdf", {
        body: { calculation_id: savedId, created_by: user?.id, preview_only: true },
      });
      if (error) throw error;
      if (data?.pdf_url) {
        setPreviewUrl(data.pdf_url);
      } else if (data?.generated_pdf_url) {
        setPreviewUrl(data.generated_pdf_url);
      } else {
        toast.info("Forhåndsvisning ikke tilgjengelig");
      }
    } catch (err: any) {
      toast.error("Kunne ikke generere forhåndsvisning");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSaveAndStay = async () => {
    const savedId = await saveOffer();
    if (savedId && !calcId) {
      window.history.replaceState(null, "", `/sales/offers/new?saved=${savedId}`);
    }
  };

  const requestAiSuggestions = async () => {
    if (!comment.trim() && !projectTitle.trim()) {
      toast.info("Skriv en beskrivelse eller tilbudstittel for å få AI-forslag");
      return;
    }
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("suggest-order-lines", {
        body: {
          project_title: projectTitle,
          description: comment,
          existing_lines: lines.filter(l => l.line_type === "product").map(l => l.description),
        },
      });
      if (error) throw error;
      if (data?.suggestions && Array.isArray(data.suggestions) && data.suggestions.length > 0) {
        const maxSort = lines.length > 0 ? Math.max(...lines.map(l => l.sort_order)) : 0;
        const newLines: OrderLine[] = data.suggestions.map((s: any, i: number) => ({
          id: crypto.randomUUID(),
          sort_order: maxSort + i + 1,
          line_type: "product" as const,
          description: s.description || "Ny linje",
          quantity: s.quantity || 1,
          unit: s.unit || "stk",
          unit_price: s.unit_price || 0,
          discount_percent: 0,
          vat_rate: 25,
          suggested_by_ai: true,
        }));
        // Show as preview instead of auto-inserting
        setAiSuggestions(newLines);
        toast.success(`${newLines.length} AI-forslag klare for gjennomgang`);
      } else {
        toast.info("Ingen forslag fra AI");
      }
    } catch (err: any) {
      toast.error("AI-forslag feilet: " + (err.message || "Ukjent feil"));
    } finally {
      setAiLoading(false);
    }
  };

  const handleAcceptAiAll = () => {
    setLines(prev => [...prev, ...aiSuggestions]);
    setAiSuggestions([]);
    toast.success("Alle AI-forslag lagt til");
  };

  const handleAcceptAiSelected = (selected: OrderLine[]) => {
    setLines(prev => [...prev, ...selected]);
    setAiSuggestions(prev => prev.filter(s => !selected.some(sel => sel.id === s.id)));
    toast.success(`${selected.length} forslag lagt til`);
  };

  const handleDismissAi = () => {
    setAiSuggestions([]);
    toast.info("AI-forslag forkastet");
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/sales/offers")} className="rounded-lg">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <ReceiptText className="h-5 w-5 text-primary" />
            Nytt tilbud
          </h1>
          <p className="text-sm text-muted-foreground">Opprett tilbud med ordrelinjer</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleSaveAndStay}
            disabled={saving}
            className="gap-1.5 rounded-lg"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Lagre utkast
          </Button>
          <Button
            variant="outline"
            onClick={handlePreviewPdf}
            disabled={lines.length === 0}
            className="gap-1.5 rounded-lg"
          >
            <Eye className="h-4 w-4" />
            Forhåndsvis
          </Button>
          <Button
            onClick={generatePdf}
            disabled={generating || lines.length === 0}
            className="gap-1.5 rounded-lg"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            Generer tilbud
          </Button>
        </div>
      </div>

      {/* Customer & Project fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl border bg-card">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Tilbudstittel *</Label>
            <Input
              value={projectTitle}
              onChange={e => setProjectTitle(e.target.value)}
              placeholder="F.eks. Tavleombygning Sentrum 12"
            />
          </div>
          <CustomerSelect
            value={selectedCustomerId}
            onChange={(id, customer) => {
              setSelectedCustomerId(id);
              if (customer) {
                setCustomerName(customer.name);
                setCustomerEmail(customer.main_email || "");
              }
            }}
            companyId={activeCompanyId}
          />
          {!selectedCustomerId && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Kundenavn *</Label>
                <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Kundenavn" />
              </div>
              <div className="space-y-1.5">
                <Label>E-post</Label>
                <Input value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="kunde@firma.no" />
              </div>
            </div>
          )}
        </div>
        <div className="space-y-3">
          <ContactPersonSelect
            customerId={selectedCustomerId}
            value={selectedContactId}
            onChange={(id) => setSelectedContactId(id)}
          />
          <div className="space-y-1.5">
            <Label>Referanse</Label>
            <Input value={reference} onChange={e => setReference(e.target.value)} placeholder="Deres ref. / bestillingsnr." />
          </div>
          <div className="space-y-1.5">
            <Label>Kommentar / beskrivelse</Label>
            <Textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Fritekst som vises i tilbudet..."
              rows={2}
            />
          </div>
        </div>
      </div>

      {/* AI Suggestions Preview */}
      {aiSuggestions.length > 0 && (
        <AiSuggestionsPreview
          suggestions={aiSuggestions}
          onAcceptAll={handleAcceptAiAll}
          onAcceptSelected={handleAcceptAiSelected}
          onDismiss={handleDismissAi}
        />
      )}

      {/* Order Lines */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Ordrelinjer</h2>
        <OrderLineEditor
          lines={lines}
          onChange={setLines}
          onRequestAiSuggestions={requestAiSuggestions}
          aiLoading={aiLoading}
          companyId={activeCompanyId}
          hasDescriptionOrAttachment={hasDescriptionOrAttachment}
        />
      </div>

      {/* PDF Preview Dialog */}
      <PdfPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        pdfUrl={previewUrl}
        loading={previewLoading}
      />
    </div>
  );
}
