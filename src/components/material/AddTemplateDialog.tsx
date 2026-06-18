import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMaterialTemplates, type MaterialTemplateItem } from "@/hooks/useMaterialTemplates";
import type { MaterialItemRow } from "@/hooks/useMaterialList";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  companyId: string | null;
  onApply: (rows: Array<Partial<MaterialItemRow> & { description: string }>) => Promise<void>;
}

export function AddTemplateDialog({ open, onOpenChange, companyId, onApply }: Props) {
  const { templates, fetchItems } = useMaterialTemplates(companyId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [multiplier, setMultiplier] = useState("1");
  const [items, setItems] = useState<MaterialTemplateItem[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) { setSelectedId(null); setItems([]); setMultiplier("1"); }
  }, [open]);

  useEffect(() => {
    if (selectedId) fetchItems(selectedId).then(setItems);
  }, [selectedId, fetchItems]);

  const apply = async () => {
    const m = parseFloat(multiplier) || 1;
    const rows = items.map((it) => ({
      description: it.description,
      elnr: it.elnr,
      quantity_ordered: it.quantity * m,
      unit: it.unit,
      supplier: it.supplier,
      comment: it.comment,
      source: "template" as const,
    }));
    setSaving(true);
    try {
      await onApply(rows);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Legg til standardpakke</DialogTitle>
        </DialogHeader>

        {templates.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            Ingen standardpakker ennå. Opprett pakker under innstillinger for materialpakker.
          </p>
        ) : (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Velg pakke</Label>
              <div className="border rounded-md max-h-48 overflow-auto">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedId(t.id)}
                    className={`block w-full text-left px-3 py-2 text-sm border-b last:border-0 hover:bg-accent ${selectedId === t.id ? "bg-accent" : ""}`}
                  >
                    <div className="font-medium">{t.name}</div>
                    {t.category && <div className="text-xs text-muted-foreground">{t.category}</div>}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs">Antall ganger</Label>
              <Input type="number" min="1" step="any" value={multiplier} onChange={(e) => setMultiplier(e.target.value)} />
            </div>

            {items.length > 0 && (
              <div className="text-xs text-muted-foreground">
                Legger til <strong>{items.length}</strong> linjer × {multiplier}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Avbryt</Button>
          <Button onClick={apply} disabled={!selectedId || saving}>Legg til</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
