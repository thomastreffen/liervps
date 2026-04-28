import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, Trash2, Plus, ArrowRight } from "lucide-react";
import { toast } from "sonner";

/**
 * Bro mellom kalkylesak/enkeltkalkyle og tilbud.
 * - Velg struktur (én post per delkalkyle / én samlet)
 * - Velg hva som skal med i beskrivelsen
 * - Juster pris (avrunding / kommersielt påslag / manuell)
 * - Opprett tilbudsutkast (skriver til calculations + order_lines)
 *
 * Eksponerer ALDRI kost, DG, normtid eller AI-confidence til tilbudet.
 */

export interface OfferSourceCalc {
  id: string;
  project_title: string;
  case_system_key: string | null;
  totals_snapshot: any;
  total_price: number;
  description?: string | null;
}

export interface OfferSourceContext {
  kind: "case" | "calculation";
  caseId?: string;
  caseTitle?: string;
  caseDescription?: string | null;
  customerName?: string | null;
  calcs: OfferSourceCalc[]; // For "calculation": single entry. For "case": all subs.
}

interface DraftLine {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  source_calc_id: string | null;
  system_key: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  source: OfferSourceContext | null;
}

type Structure = "per_subcalc" | "single";

const ROUNDING_OPTIONS = [
  { value: "0", label: "Ingen avrunding" },
  { value: "100", label: "Nærmeste 100" },
  { value: "500", label: "Nærmeste 500" },
  { value: "1000", label: "Nærmeste 1000" },
];

function roundPrice(value: number, step: number): number {
  if (step <= 0) return value;
  return Math.round(value / step) * step;
}

function formatNok(n: number): string {
  return new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 }).format(n ?? 0);
}

export function CreateOfferFromCalcDialog({ open, onClose, source }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeCompanyId } = useCompanyContext();

  const isMulti = (source?.calcs.length ?? 0) > 1;

  const [structure, setStructure] = useState<Structure>("per_subcalc");
  const [includeSummary, setIncludeSummary] = useState(true);
  const [includeScope, setIncludeScope] = useState(true);
  const [includeSubtotals, setIncludeSubtotals] = useState(true);
  const [includeAssumptions, setIncludeAssumptions] = useState(true);
  const [includeExclusions, setIncludeExclusions] = useState(true);
  const [markupPct, setMarkupPct] = useState<number>(0);
  const [roundingStep, setRoundingStep] = useState<string>("0");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reset / regenerate when source or structure changes
  useEffect(() => {
    if (!open || !source) return;

    // Default structure: single calc -> single, multi -> per_subcalc
    setStructure(isMulti ? "per_subcalc" : "single");
  }, [open, source, isMulti]);

  // Generate lines whenever structure / pricing changes
  useEffect(() => {
    if (!source) return;

    const calcs = source.calcs;
    let generated: DraftLine[] = [];

    if (structure === "per_subcalc") {
      generated = calcs.map((c) => {
        const base = Number(c.totals_snapshot?.total_sales ?? c.total_price ?? 0);
        const withMarkup = base * (1 + (markupPct || 0) / 100);
        const final = roundPrice(withMarkup, Number(roundingStep));
        const sysLabel = c.case_system_key ? `${c.case_system_key} ` : "";
        return {
          id: crypto.randomUUID(),
          description: `${sysLabel}${c.project_title}`.trim(),
          quantity: 1,
          unit: "stk",
          unit_price: final,
          source_calc_id: c.id,
          system_key: c.case_system_key,
        };
      });
    } else {
      // single line
      const total = calcs.reduce(
        (sum, c) => sum + Number(c.totals_snapshot?.total_sales ?? c.total_price ?? 0),
        0,
      );
      const withMarkup = total * (1 + (markupPct || 0) / 100);
      const final = roundPrice(withMarkup, Number(roundingStep));
      const title = source.caseTitle ?? calcs[0]?.project_title ?? "Tilbud";
      generated = [{
        id: crypto.randomUUID(),
        description: title,
        quantity: 1,
        unit: "stk",
        unit_price: final,
        source_calc_id: null,
        system_key: null,
      }];
    }

    setLines(generated);
  }, [source, structure, markupPct, roundingStep]);

  // Build description draft
  useEffect(() => {
    if (!source) return;
    const parts: string[] = [];
    const calcs = source.calcs;

    if (includeSummary) {
      if (isMulti && source.caseTitle) {
        const systems = calcs
          .map((c) => `${c.case_system_key ?? ""} ${c.project_title}`.trim())
          .filter(Boolean)
          .join(" og ");
        parts.push(`Tilbud gjelder ${systems}.`);
      } else if (calcs[0]) {
        parts.push(`Tilbud gjelder ${calcs[0].project_title}.`);
      }
    }

    if (includeScope) {
      parts.push("\nOmfang / leveranse:");
      calcs.forEach((c) => {
        const sys = c.case_system_key ? `${c.case_system_key} – ` : "";
        parts.push(`• Montasje av ${sys}${c.project_title} iht. kalkylegrunnlag og tilhørende underlag.`);
      });
    }

    if (includeSubtotals && isMulti) {
      parts.push("\nDelsummer per system:");
      calcs.forEach((c) => {
        const base = Number(c.totals_snapshot?.total_sales ?? c.total_price ?? 0);
        parts.push(`• ${c.case_system_key ?? "—"} ${c.project_title}: kr ${formatNok(base)}`);
      });
    }

    if (includeAssumptions) {
      parts.push(
        "\nForutsetninger:",
        "• Arbeid utføres på normal arbeidstid.",
        "• Fri tilkomst og egnede arbeidsforhold på montasjested.",
        "• Strøm, lys og oppvarming på arbeidsstedet stilles av kunde.",
      );
    }

    if (includeExclusions) {
      parts.push(
        "\nIkke inkludert:",
        "• Bygningsmessige arbeider og hulltaking i bærende konstruksjon.",
        "• Stillas, lift eller annen spesialrigg utover standard.",
        "• Ventetid eller endringer som ikke er beskrevet i underlaget.",
      );
    }

    setDescriptionDraft(parts.join("\n"));
  }, [source, isMulti, includeSummary, includeScope, includeSubtotals, includeAssumptions, includeExclusions]);

  const totalsPreview = useMemo(() => {
    const ex = lines.reduce((s, l) => s + l.quantity * l.unit_price, 0);
    return { ex, inc: ex * 1.25 };
  }, [lines]);

  const updateLine = (id: string, patch: Partial<DraftLine>) => {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const removeLine = (id: string) => {
    setLines((prev) => prev.filter((l) => l.id !== id));
  };

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        description: "Ny linje",
        quantity: 1,
        unit: "stk",
        unit_price: 0,
        source_calc_id: null,
        system_key: null,
      },
    ]);
  };

  const handleCreate = async () => {
    if (!user || !source) return;
    if (lines.length === 0) {
      toast.error("Tilbudet må ha minst én linje");
      return;
    }

    setSubmitting(true);
    try {
      const sourceRefIds = source.calcs.map((c) => c.id);
      const sourceTag = source.kind === "case"
        ? `[Kilde: kalkylesak ${source.caseId}]`
        : `[Kilde: kalkyle ${sourceRefIds[0]}]`;

      const offerTitle = source.caseTitle
        ?? source.calcs[0]?.project_title
        ?? "Tilbud fra kalkyle";

      const calcPayload: any = {
        project_title: offerTitle,
        customer_name: source.customerName ?? "Ukjent kunde",
        description: `${descriptionDraft}\n\n${sourceTag}`,
        total_price: totalsPreview.ex,
        total_material: 0,
        total_labor: 0,
        company_id: activeCompanyId || null,
        created_by: user.id,
        status: "draft",
      };

      const { data: created, error: insertErr } = await supabase
        .from("calculations")
        .insert(calcPayload)
        .select("id")
        .single();

      if (insertErr || !created) throw insertErr ?? new Error("Kunne ikke opprette tilbud");

      const linePayloads = lines.map((l, idx) => ({
        calculation_id: created.id,
        sort_order: idx,
        line_type: "product" as const,
        description: l.description,
        quantity: l.quantity,
        unit: l.unit || "stk",
        unit_price: l.unit_price,
        discount_percent: 0,
        vat_rate: 25,
        suggested_by_ai: false,
      }));

      const { error: linesErr } = await supabase.from("order_lines").insert(linePayloads);
      if (linesErr) throw linesErr;

      toast.success("Tilbudsutkast opprettet");
      onClose();
      navigate(`/sales/offers/${created.id}`);
    } catch (err: any) {
      toast.error("Feil ved opprettelse: " + (err.message || "Ukjent"));
    } finally {
      setSubmitting(false);
    }
  };

  if (!source) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Opprett tilbud fra kalkyle
          </DialogTitle>
          <DialogDescription>
            Lag et kundevendt tilbud basert på kalkylegrunnlaget. Interne tall som kost, normtid og DG tas ikke med.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Structure */}
          {isMulti && (
            <section className="space-y-3">
              <Label className="text-sm font-semibold">Struktur</Label>
              <RadioGroup value={structure} onValueChange={(v) => setStructure(v as Structure)}>
                <div className="flex items-start gap-2 p-3 rounded-lg border hover:bg-muted/40 cursor-pointer">
                  <RadioGroupItem value="per_subcalc" id="per_subcalc" className="mt-0.5" />
                  <label htmlFor="per_subcalc" className="flex-1 cursor-pointer">
                    <div className="text-sm font-medium">Én post per delkalkyle</div>
                    <div className="text-xs text-muted-foreground">Anbefalt for samlesaker. Hvert system blir en egen tilbudslinje.</div>
                  </label>
                </div>
                <div className="flex items-start gap-2 p-3 rounded-lg border hover:bg-muted/40 cursor-pointer">
                  <RadioGroupItem value="single" id="single" className="mt-0.5" />
                  <label htmlFor="single" className="flex-1 cursor-pointer">
                    <div className="text-sm font-medium">Én samlet post</div>
                    <div className="text-xs text-muted-foreground">All leveranse vises som én sumlinje.</div>
                  </label>
                </div>
              </RadioGroup>
            </section>
          )}

          {/* Description toggles */}
          <section className="space-y-3">
            <Label className="text-sm font-semibold">Innhold i tilbudsbeskrivelsen</Label>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={includeSummary} onCheckedChange={(v) => setIncludeSummary(!!v)} />
                <span>Oppsummering</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={includeScope} onCheckedChange={(v) => setIncludeScope(!!v)} />
                <span>Omfang / leveranse</span>
              </label>
              {isMulti && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={includeSubtotals} onCheckedChange={(v) => setIncludeSubtotals(!!v)} />
                  <span>Delsummer per system</span>
                </label>
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={includeAssumptions} onCheckedChange={(v) => setIncludeAssumptions(!!v)} />
                <span>Forutsetninger</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={includeExclusions} onCheckedChange={(v) => setIncludeExclusions(!!v)} />
                <span>Ikke inkludert</span>
              </label>
            </div>
          </section>

          {/* Pricing */}
          <section className="space-y-3">
            <Label className="text-sm font-semibold">Prisgrunnlag</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Kommersielt påslag (%)</Label>
                <Input
                  type="number"
                  value={markupPct}
                  onChange={(e) => setMarkupPct(Number(e.target.value) || 0)}
                  step="0.5"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Avrunding</Label>
                <select
                  value={roundingStep}
                  onChange={(e) => setRoundingStep(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {ROUNDING_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Du kan også overstyre pris pr. linje i forhåndsvisningen under.
            </p>
          </section>

          <Separator />

          {/* Preview & edit lines */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Forhåndsvisning av tilbudslinjer</Label>
              <Button size="sm" variant="outline" onClick={addLine} className="rounded-lg gap-1.5 h-8">
                <Plus className="h-3.5 w-3.5" /> Legg til linje
              </Button>
            </div>

            <div className="space-y-2">
              {lines.map((l) => (
                <div key={l.id} className="grid grid-cols-[1fr_80px_60px_120px_36px] gap-2 items-start p-2 rounded-lg border bg-card">
                  <div className="space-y-1">
                    <Input
                      value={l.description}
                      onChange={(e) => updateLine(l.id, { description: e.target.value })}
                      className="text-sm h-9"
                    />
                    {l.system_key && (
                      <Badge variant="outline" className="text-[10px] font-mono rounded-md">{l.system_key}</Badge>
                    )}
                  </div>
                  <Input
                    type="number"
                    value={l.quantity}
                    onChange={(e) => updateLine(l.id, { quantity: Number(e.target.value) || 0 })}
                    className="text-sm h-9 text-right"
                  />
                  <Input
                    value={l.unit}
                    onChange={(e) => updateLine(l.id, { unit: e.target.value })}
                    className="text-sm h-9"
                  />
                  <Input
                    type="number"
                    value={l.unit_price}
                    onChange={(e) => updateLine(l.id, { unit_price: Number(e.target.value) || 0 })}
                    className="text-sm h-9 text-right font-mono"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeLine(l.id)}
                    className="h-9 w-9 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-6 text-sm pr-12 pt-2">
              <div className="text-muted-foreground">Sum eks. mva:</div>
              <div className="font-mono font-semibold">kr {formatNok(totalsPreview.ex)}</div>
            </div>
          </section>

          <Separator />

          {/* Description preview */}
          <section className="space-y-2">
            <Label className="text-sm font-semibold">Tilbudsbeskrivelse (redigerbar)</Label>
            <Textarea
              value={descriptionDraft}
              onChange={(e) => setDescriptionDraft(e.target.value)}
              rows={10}
              className="text-sm font-mono"
            />
          </section>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Avbryt</Button>
          <Button onClick={handleCreate} disabled={submitting} className="rounded-xl gap-1.5">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            Opprett tilbudsutkast
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
