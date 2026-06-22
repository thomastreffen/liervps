import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Loader2, Sparkles, X, Check, FileText, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { MaterialItemRow } from "@/hooks/useMaterialList";
import { cn } from "@/lib/utils";
import { useMaterialAiAttachments, type MaterialAiAttachment } from "@/hooks/useMaterialAiAttachments";

interface Props {
  jobId?: string | null;
  orderId?: string | null;
  customer: string;
  address: string;
  description: string;
  onApply: (rows: Array<Partial<MaterialItemRow> & { description: string }>) => Promise<void>;
  onClose: () => void;
}

type SourceType =
  | "attachment_material_list"
  | "attachment_revision_cloud"
  | "attachment_other"
  | "job_description"
  | "existing_lines"
  | "product_database"
  | "small_parts"
  | "none";

interface Suggestion {
  elnr: string | null;
  description: string;
  quantity: number;
  unit: string;
  unit_price?: number | null;
  manufacturer?: string | null;
  supplier?: string | null;
  provided_by?: string | null;
  confidence: "høy" | "middels" | "lav";
  ai_reason: string;
  source_type: SourceType;
  source_file?: string | null;
  source_page?: string | null;
  source_label?: string | null;
  component_reference?: string | null;
  approved: boolean;
}

const BASIS_OPTIONS: { id: string; label: string; hint?: string }[] = [
  { id: "job_description", label: "Jobbbeskrivelse" },
  { id: "attachments", label: "Vedlegg / PDF" },
  { id: "history_customer", label: "Tidligere jobber – samme kunde" },
  { id: "history_address", label: "Samme adresse / anlegg" },
  { id: "templates", label: "Standardpakker" },
  { id: "fill_elnr", label: "Finn elnr på linjer uten" },
  { id: "small_parts", label: "Småmateriell (eksplisitt valg)", hint: "Tillater generisk småmateriell" },
  { id: "spare", label: "Sjekk-/reservemateriell" },
];

const CONF_CLASS: Record<Suggestion["confidence"], string> = {
  høy: "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-300",
  middels: "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-300",
  lav: "bg-muted text-muted-foreground",
};

const SOURCE_LABELS: Record<SourceType, string> = {
  attachment_material_list: "Materialliste i vedlegg",
  attachment_revision_cloud: "Revisjonssky i vedlegg",
  attachment_other: "Vedlegg",
  job_description: "Jobbbeskrivelse",
  existing_lines: "Eksisterende linjer",
  product_database: "Produktdatabase",
  small_parts: "Småmateriell valgt av bruker",
  none: "Ingen kilde",
};

function shouldPreapprove(s: Suggestion): boolean {
  if (s.confidence !== "høy") return false;
  return (
    s.source_type === "attachment_material_list" ||
    s.source_type === "product_database"
  );
}

export function InlineAiSuggestPanel({
  jobId,
  orderId,
  customer,
  address,
  description,
  onApply,
  onClose,
}: Props) {
  const [basis, setBasis] = useState<Set<string>>(new Set(["job_description", "attachments"]));
  const [extraContext, setExtraContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [jobTypeLabel, setJobTypeLabel] = useState<string | null>(null);
  const [clarifications, setClarifications] = useState<string[]>([]);
  const [applying, setApplying] = useState(false);

  const { attachments, loading: loadingAttachments } = useMaterialAiAttachments({ jobId, orderId });
  const [selectedAttachments, setSelectedAttachments] = useState<Set<string>>(new Set());

  // Pre-select first PDF (or all PDFs if few) once attachments arrive
  useEffect(() => {
    if (attachments.length === 0) return;
    setSelectedAttachments((prev) => {
      if (prev.size > 0) return prev;
      const pdfs = attachments.filter((a) => /\.pdf$/i.test(a.name));
      const next = new Set<string>();
      if (pdfs.length === 1) next.add(pdfs[0].name);
      else if (pdfs.length > 1) pdfs.forEach((p) => next.add(p.name));
      else attachments.forEach((a) => next.add(a.name));
      return next;
    });
  }, [attachments]);

  const toggleBasis = (id: string) => {
    setBasis((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAttachment = (name: string) => {
    setSelectedAttachments((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const pickedAttachments: MaterialAiAttachment[] = useMemo(
    () => attachments.filter((a) => selectedAttachments.has(a.name)),
    [attachments, selectedAttachments],
  );

  const fetchSuggestions = async () => {
    setLoading(true);
    setNote(null);
    setJobTypeLabel(null);
    setClarifications([]);
    try {
      const resolvedDescription = (description ?? "").trim();
      const wantsJobDescription = basis.has("job_description");

      // Debug-logg før AI-kall
      console.log("[material-ai] request context", {
        selectedBasis: Array.from(basis),
        resolvedJobDescription: resolvedDescription,
        jobDescriptionLength: resolvedDescription.length,
        attachmentCount: pickedAttachments.length,
        extraContext,
        jobId,
        orderId,
      });

      if (wantsJobDescription && !resolvedDescription) {
        const msg =
          "Jobbeskrivelse finnes på bestillingen, men ble ikke sendt til AI-kallet. Sjekk at arbeidsbeskrivelsen er resolvert i forelderkomponenten.";
        console.error("[material-ai]", msg);
        setNote(msg);
        toast.error(msg);
        return;
      }

      const { data, error } = await supabase.functions.invoke("material-ai-suggest", {
        body: {
          jobId: jobId ?? null,
          orderId: orderId ?? null,
          customer,
          address,
          description: resolvedDescription,
          extraContext,
          basis: Array.from(basis),
          attachments: basis.has("attachments") ? pickedAttachments : [],
        },
      });
      if (error) throw error;
      const list = ((data?.suggestions ?? []) as Omit<Suggestion, "approved">[]).map((s) => ({
        ...s,
        approved: shouldPreapprove(s as Suggestion),
      }));
      setSuggestions(list);
      setNote(data?.note ?? null);
      setJobTypeLabel(data?.job_type_label ?? null);
      setClarifications(Array.isArray(data?.clarifications) ? data.clarifications : []);
      if (list.length === 0 && !data?.note) toast.info("AI fant ingen forslag");
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Kunne ikke hente AI-forslag: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const updateSug = (i: number, patch: Partial<Suggestion>) => {
    setSuggestions((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  };

  const apply = async () => {
    const approved = suggestions.filter((s) => s.approved);
    if (approved.length === 0) return;
    setApplying(true);
    try {
      await onApply(
        approved.map((s) => ({
          elnr: s.elnr,
          description: s.description,
          quantity_ordered: s.quantity,
          unit: s.unit || "stk",
          unit_price: s.unit_price ?? null,
          supplier: s.supplier ?? null,
          source: "ai" as const,
          ai_confidence: s.confidence,
          ai_reason: s.ai_reason,
          // Extended source tracing (cast to satisfy MaterialItemRow union)
          ...({
            ai_source_type: s.source_type,
            ai_source_file: s.source_file ?? null,
            ai_source_page: s.source_page ?? null,
            ai_source_label: s.source_label ?? null,
            ai_component_reference: s.component_reference ?? null,
            manufacturer: s.manufacturer ?? null,
            provided_by: s.provided_by ?? null,
          } as Partial<MaterialItemRow>),
        })),
      );
      toast.success(`${approved.length} AI-forslag lagt til`);
      setSuggestions([]);
      setNote(null);
    } catch (e) {
      console.error(e);
      toast.error("Kunne ikke legge til AI-forslag");
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="rounded-xl border-2 border-amber-300/60 dark:border-amber-500/40 bg-amber-50/60 dark:bg-amber-500/5 p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-500" />
          <h4 className="font-semibold text-sm">AI-forslag til materiell</h4>
        </div>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {suggestions.length === 0 ? (
        <>
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2">Velg grunnlag</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {BASIS_OPTIONS.map((o) => (
                <label
                  key={o.id}
                  className="flex items-center gap-2 text-sm px-2 py-1.5 rounded-md hover:bg-background cursor-pointer"
                >
                  <Checkbox checked={basis.has(o.id)} onCheckedChange={() => toggleBasis(o.id)} />
                  <span className="flex-1">
                    {o.label}
                    {o.hint && <span className="block text-[10px] text-muted-foreground">{o.hint}</span>}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {basis.has("attachments") && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-2">
                Vedlegg som skal analyseres
              </div>
              {loadingAttachments ? (
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" /> Henter vedlegg…
                </div>
              ) : attachments.length === 0 ? (
                <div className="text-xs text-muted-foreground italic">
                  Ingen vedlegg funnet på denne {jobId ? "jobben" : "bestillingen"}.
                </div>
              ) : (
                <div className="space-y-1 rounded-md border bg-background p-2 max-h-40 overflow-auto">
                  {attachments.map((a) => {
                    const isPdf = /\.pdf$/i.test(a.name);
                    return (
                      <label
                        key={a.name}
                        className="flex items-center gap-2 text-sm px-1.5 py-1 rounded hover:bg-muted/40 cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedAttachments.has(a.name)}
                          onCheckedChange={() => toggleAttachment(a.name)}
                        />
                        <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="flex-1 truncate">{a.name}</span>
                        <span className="text-[10px] uppercase text-muted-foreground">
                          {isPdf ? "PDF" : (a.mime?.split("/")[1] ?? "FIL")}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground">Ekstra kontekst (valgfritt)</label>
            <Input
              value={extraContext}
              onChange={(e) => setExtraContext(e.target.value)}
              placeholder="F.eks. 'alt i revisjonsskyer skal utføres'"
              className="mt-1"
            />
          </div>

          {note && (
            <div className="flex gap-2 rounded-md border border-amber-300/60 bg-amber-100/60 dark:bg-amber-500/10 p-2 text-xs">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-600" />
              <span>{note}</span>
            </div>
          )}

          <Button onClick={fetchSuggestions} disabled={loading || basis.size === 0} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Hent forslag
          </Button>
        </>
      ) : (
        <>
          {jobTypeLabel && (
            <div className="rounded-md border border-blue-300/60 bg-blue-50 dark:bg-blue-500/10 px-3 py-2 text-xs">
              <span className="font-semibold">Jobbtype tolket som:</span> {jobTypeLabel}
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Forslag uten verifisert elnr må kontrolleres før bestilling.
              </div>
            </div>
          )}
          {clarifications.length > 0 && (
            <div className="rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-xs">
              <div className="font-semibold mb-1">AI trenger avklaring:</div>
              <ul className="list-disc pl-4 space-y-0.5">
                {clarifications.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="text-xs text-muted-foreground">
            AI-forslag må kontrolleres før de legges til. Lav/middels sikkerhet er ikke forhåndsvalgt.
          </div>
          <div className="overflow-x-auto rounded-md border bg-background">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[11px] uppercase text-muted-foreground">
                <tr>
                  <th className="p-2 w-8" />
                  <th className="p-2 text-left w-24">Elnr</th>
                  <th className="p-2 text-left">Beskrivelse</th>
                  <th className="p-2 text-right w-20">Antall</th>
                  <th className="p-2 text-left w-16">Enhet</th>
                  <th className="p-2 text-left w-44">Kilde / side</th>
                  <th className="p-2 text-left">Begrunnelse</th>
                  <th className="p-2 w-20">Sikkerhet</th>
                </tr>
              </thead>
              <tbody>
                {suggestions.map((s, i) => (
                  <tr key={i} className={cn("border-t border-border/30", !s.approved && "opacity-60")}>
                    <td className="p-1.5 text-center">
                      <Checkbox
                        checked={s.approved}
                        onCheckedChange={(v) => updateSug(i, { approved: !!v })}
                      />
                    </td>
                    <td className="p-1.5">
                      <Input
                        value={s.elnr ?? ""}
                        onChange={(e) => updateSug(i, { elnr: e.target.value || null })}
                        className="h-7 text-sm"
                        placeholder={s.elnr === null ? "—" : ""}
                      />
                    </td>
                    <td className="p-1.5 min-w-[280px]">
                      <Input
                        value={s.description}
                        onChange={(e) => updateSug(i, { description: e.target.value })}
                        className="h-7 text-sm"
                        title={s.description}
                      />
                      <div
                        className="text-[11px] text-muted-foreground mt-0.5 whitespace-normal break-words"
                        title={s.description}
                      >
                        {s.description}
                      </div>
                      {s.manufacturer && (
                        <div className="text-[10px] text-muted-foreground mt-0.5">{s.manufacturer}</div>
                      )}
                    </td>
                    <td className="p-1.5">
                      <Input
                        value={String(s.quantity)}
                        inputMode="decimal"
                        onChange={(e) => {
                          const n = parseFloat(e.target.value.replace(",", "."));
                          updateSug(i, { quantity: isNaN(n) ? 0 : n });
                        }}
                        className="h-7 text-sm text-right tabular-nums"
                      />
                    </td>
                    <td className="p-1.5">
                      <Input
                        value={s.unit}
                        onChange={(e) => updateSug(i, { unit: e.target.value })}
                        className="h-7 text-sm"
                      />
                    </td>
                    <td className="p-1.5 text-[11px] text-muted-foreground">
                      <div className="font-medium text-foreground">
                        {SOURCE_LABELS[s.source_type] ?? s.source_type}
                      </div>
                      {s.source_file && <div className="truncate" title={s.source_file}>{s.source_file}</div>}
                      {s.source_page && <div>Side: {s.source_page}</div>}
                      {s.component_reference && <div>Ref: {s.component_reference}</div>}
                    </td>
                    <td className="p-1.5 text-xs text-muted-foreground min-w-[220px] max-w-[360px]">
                      <div className="whitespace-normal break-words" title={s.ai_reason}>
                        {s.ai_reason}
                      </div>
                    </td>
                    <td className="p-1.5 text-center">
                      <span
                        className={cn("px-2 py-0.5 rounded text-[10px] font-semibold", CONF_CLASS[s.confidence])}
                      >
                        {s.confidence}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setSuggestions([]); setNote(null); }}>
              Forkast forslag
            </Button>
            <Button onClick={apply} disabled={applying || suggestions.every((s) => !s.approved)}>
              {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Legg godkjente forslag til materiallisten
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
