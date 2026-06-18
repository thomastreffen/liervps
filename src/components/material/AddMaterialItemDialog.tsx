import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useMaterialProductSearch } from "@/hooks/useMaterialTemplates";
import type { MaterialItemRow } from "@/hooks/useMaterialList";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  companyId: string | null;
  onAdd: (row: Partial<MaterialItemRow> & { description: string }) => Promise<void>;
}

interface ProductRow {
  id: string;
  elnr: string | null;
  description: string;
  unit: string;
  supplier: string | null;
  supplier_sku: string | null;
}

export function AddMaterialItemDialog({ open, onOpenChange, companyId, onAdd }: Props) {
  const { search } = useMaterialProductSearch(companyId);
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<ProductRow[]>([]);
  const [elnr, setElnr] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("stk");
  const [supplier, setSupplier] = useState("");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setTerm(""); setResults([]); setElnr(""); setDescription("");
      setQuantity("1"); setUnit("stk"); setSupplier(""); setComment("");
    }
  }, [open]);

  useEffect(() => {
    let active = true;
    const t = setTimeout(async () => {
      if (term.length < 2) { setResults([]); return; }
      const r = await search(term);
      if (active) setResults(r as ProductRow[]);
    }, 250);
    return () => { active = false; clearTimeout(t); };
  }, [term, search]);

  const pick = (p: ProductRow) => {
    setElnr(p.elnr ?? "");
    setDescription(p.description);
    setUnit(p.unit);
    setSupplier(p.supplier ?? "");
    setResults([]);
    setTerm("");
  };

  const save = async () => {
    if (!description.trim()) return;
    setSaving(true);
    try {
      await onAdd({
        elnr: elnr || null,
        description: description.trim(),
        quantity_ordered: parseFloat(quantity) || 0,
        unit: unit || "stk",
        supplier: supplier || null,
        comment: comment || null,
        source: "manual",
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Legg til vare</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Søk i produktdatabase (elnr / beskrivelse / leverandørvarenr)</Label>
            <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Skriv minst 2 tegn..." />
            {results.length > 0 && (
              <div className="mt-1 border rounded-md max-h-48 overflow-auto bg-popover">
                {results.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => pick(p)}
                    className="block w-full text-left px-3 py-2 text-sm hover:bg-accent border-b last:border-0"
                  >
                    <div className="font-medium">{p.description}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.elnr ?? "—"} · {p.supplier ?? "—"} · {p.unit}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Elnr</Label>
              <Input value={elnr} onChange={(e) => setElnr(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Leverandør</Label>
              <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Onninen, Ahlsell..." />
            </div>
          </div>
          <div>
            <Label className="text-xs">Beskrivelse *</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Antall</Label>
              <Input type="number" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Enhet</Label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Kommentar</Label>
            <Input value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Avbryt</Button>
          <Button onClick={save} disabled={saving || !description.trim()}>Legg til</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
