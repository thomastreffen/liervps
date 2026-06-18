import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Sparkles, Check, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { MaterialItemRow } from "@/hooks/useMaterialList";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  jobId: string;
  customer: string;
  address: string;
  description: string;
  onApply: (rows: Array<Partial<MaterialItemRow> & { description: string }>) => Promise<void>;
}

interface Suggestion {
  elnr: string | null;
  description: string;
  quantity: number;
  unit: string;
  reason: string;
  confidence: "høy" | "middels" | "lav";
  approved: boolean;
}

export function AiSuggestMaterialsDialog({ open, onOpenChange, jobId, customer, address, description, onApply }: Props) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [extraContext, setExtraContext] = useState("");

  const fetchSuggestions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("material-ai-suggest", {
        body: { jobId, customer, address, description, extraContext },
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

  const apply = async () => {
    const rows = suggestions
      .filter((s) => s.approved)
      .map((s) => ({
        elnr: s.elnr,
        description: s.description,
        quantity_ordered: s.quantity,
        unit: s.unit,
        source: "ai" as const,
        ai_confidence: s.confidence,
        ai_reason: s.reason,
      }));
    if (rows.length === 0) return;
    await onApply(rows);
    setSuggestions([]);
    onOpenChange(false);
  };

  const updateSug = (i: number, patch: Partial<Suggestion>) => {
    setSuggestions((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" /> AI-forslag til materiell
          </DialogTitle>
        </DialogHeader>

        <div className="rounded-md bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 p-3 text-sm">
          AI-forslag må kontrolleres før bestilling. Godkjenn, rediger eller avvis linje for linje.
        </div>

        {suggestions.length === 0 ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs uppercase text-muted-foreground">Ekstra kontekst (valgfritt)</label>
              <Input value={extraContext} onChange={(e) => setExtraContext(e.target.value)} placeholder="F.eks. 'service varmepumpe i kjeller'" />
            </div>
            <Button onClick={fetchSuggestions} disabled={loading} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Hent forslag fra AI
            </Button>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-auto">
            {suggestions.map((s, i) => (
              <div key={i} className={`border rounded-md p-3 ${s.approved ? "" : "opacity-50"}`}>
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-1.5">
                    <Input
                      value={s.description}
                      onChange={(e) => updateSug(i, { description: e.target.value })}
                      className="h-8 text-sm font-medium"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <Input value={s.elnr ?? ""} onChange={(e) => updateSug(i, { elnr: e.target.value || null })} placeholder="Elnr" className="h-8 text-xs" />
                      <Input type="number" value={s.quantity} onChange={(e) => updateSug(i, { quantity: parseFloat(e.target.value) || 0 })} className="h-8 text-xs" />
                      <Input value={s.unit} onChange={(e) => updateSug(i, { unit: e.target.value })} className="h-8 text-xs" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium uppercase">{s.confidence}</span> · {s.reason}
                    </p>
                  </div>
                  <Button size="icon" variant={s.approved ? "default" : "outline"} className="h-8 w-8" onClick={() => updateSug(i, { approved: !s.approved })}>
                    {s.approved ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Lukk</Button>
          {suggestions.length > 0 && (
            <Button onClick={apply}>Legg til godkjente</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
