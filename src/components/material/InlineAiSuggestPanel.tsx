import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Loader2, Sparkles, X, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { MaterialItemRow } from "@/hooks/useMaterialList";
import { cn } from "@/lib/utils";

interface Props {
  jobId?: string | null;
  orderId?: string | null;
  customer: string;
  address: string;
  description: string;
  onApply: (rows: Array<Partial<MaterialItemRow> & { description: string }>) => Promise<void>;
  onClose: () => void;
}

interface Suggestion {
  elnr: string | null;
  description: string;
  quantity: number;
  unit: string;
  unit_price?: number | null;
  reason: string;
  confidence: "høy" | "middels" | "lav";
  approved: boolean;
}

const BASIS_OPTIONS: { id: string; label: string }[] = [
  { id: "job_description", label: "Jobbeskrivelse" },
  { id: "attachments", label: "Vedlegg / bilder" },
  { id: "history_customer", label: "Tidligere jobber – samme kunde" },
  { id: "history_address", label: "Samme adresse / anlegg" },
  { id: "templates", label: "Standardpakker" },
  { id: "fill_elnr", label: "Finn elnr på linjer uten" },
  { id: "small_parts", label: "Småmateriell" },
  { id: "spare", label: "Sjekk-/reservemateriell" },
];

const CONF_CLASS: Record<Suggestion["confidence"], string> = {
  høy: "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-300",
  middels: "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-300",
  lav: "bg-muted text-muted-foreground",
};

export function InlineAiSuggestPanel({
  jobId,
  orderId,
  customer,
  address,
  description,
  onApply,
  onClose,
}: Props) {
  const [basis, setBasis] = useState<Set<string>>(new Set(["job_description"]));
  const [extraContext, setExtraContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [applying, setApplying] = useState(false);

  const toggleBasis = (id: string) => {
    setBasis((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const fetchSuggestions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("material-ai-suggest", {
        body: {
          jobId: jobId ?? null,
          orderId: orderId ?? null,
          customer,
          address,
          description,
          extraContext,
          basis: Array.from(basis),
        },
      });
      if (error) throw error;
      const list = ((data?.suggestions ?? []) as Suggestion[]).map((s) => ({ ...s, approved: true }));
      setSuggestions(list);
      if (list.length === 0) toast.info("AI fant ingen forslag");
    } catch (e) {
      console.error(e);
      toast.error("Kunne ikke hente AI-forslag");
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
          source: "ai" as const,
          ai_confidence: s.confidence,
          ai_reason: s.reason,
        })),
      );
      toast.success(`${approved.length} AI-forslag lagt til`);
      setSuggestions([]);
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
                  <span>{o.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Ekstra kontekst (valgfritt)</label>
            <Input
              value={extraContext}
              onChange={(e) => setExtraContext(e.target.value)}
              placeholder="F.eks. 'service varmepumpe i kjeller'"
              className="mt-1"
            />
          </div>
          <Button onClick={fetchSuggestions} disabled={loading || basis.size === 0} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Hent forslag
          </Button>
        </>
      ) : (
        <>
          <div className="text-xs text-muted-foreground">
            AI-forslag må kontrolleres før de legges til. Rediger antall eller avvis linjer du ikke vil ha med.
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
                  <th className="p-2 text-left">Begrunnelse</th>
                  <th className="p-2 w-20">Sikkerhet</th>
                </tr>
              </thead>
              <tbody>
                {suggestions.map((s, i) => (
                  <tr
                    key={i}
                    className={cn("border-t border-border/30", !s.approved && "opacity-50")}
                  >
                    <td className="p-1.5 text-center">
                      <Checkbox checked={s.approved} onCheckedChange={(v) => updateSug(i, { approved: !!v })} />
                    </td>
                    <td className="p-1.5">
                      <Input
                        value={s.elnr ?? ""}
                        onChange={(e) => updateSug(i, { elnr: e.target.value || null })}
                        className="h-7 text-sm"
                      />
                    </td>
                    <td className="p-1.5">
                      <Input
                        value={s.description}
                        onChange={(e) => updateSug(i, { description: e.target.value })}
                        className="h-7 text-sm"
                      />
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
                    <td className="p-1.5 text-xs text-muted-foreground">{s.reason}</td>
                    <td className="p-1.5 text-center">
                      <span className={cn("px-2 py-0.5 rounded text-[10px] font-semibold", CONF_CLASS[s.confidence])}>
                        {s.confidence}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSuggestions([])}>
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
