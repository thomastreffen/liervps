import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Check, X, AlertTriangle } from "lucide-react";
import type { MaterialItemRow } from "@/hooks/useMaterialList";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  items: MaterialItemRow[];
  onUpdate: (id: string, patch: Partial<MaterialItemRow>) => Promise<void>;
  onAddExtra: (row: Partial<MaterialItemRow> & { description: string }) => Promise<void>;
  onComplete: () => Promise<void>;
}

export function MaterialConsumptionSheet({ open, onOpenChange, items, onUpdate, onAddExtra, onComplete }: Props) {
  const [extraDesc, setExtraDesc] = useState("");
  const [extraQty, setExtraQty] = useState("1");
  const [extraElnr, setExtraElnr] = useState("");

  const quickSet = (item: MaterialItemRow, mode: "all" | "none" | "missing") => {
    if (mode === "all") onUpdate(item.id, { quantity_used: item.quantity_picked || item.quantity_ordered });
    if (mode === "none") onUpdate(item.id, { quantity_used: 0 });
    if (mode === "missing") onUpdate(item.id, { comment: (item.comment ? item.comment + " · " : "") + "Mangler / måtte hente mer" });
  };

  const addExtra = async () => {
    if (!extraDesc.trim()) return;
    await onAddExtra({
      description: extraDesc.trim(),
      elnr: extraElnr || null,
      quantity_ordered: 0,
      quantity_used: parseFloat(extraQty) || 1,
      quantity_picked: 0,
    });
    setExtraDesc(""); setExtraQty("1"); setExtraElnr("");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Registrer forbruk</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          {items.map((it) => (
            <div key={it.id} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium text-sm">{it.description}</div>
                  <div className="text-xs text-muted-foreground">
                    {it.elnr ?? "—"} · plukket {it.quantity_picked} {it.unit}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Brukt</Label>
                  <Input
                    type="number"
                    step="any"
                    defaultValue={it.quantity_used}
                    onBlur={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!isNaN(v) && v !== it.quantity_used) onUpdate(it.id, { quantity_used: v });
                    }}
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs">Retur (auto)</Label>
                  <div className="h-9 flex items-center px-3 border rounded-md bg-muted/30 text-sm tabular-nums">
                    {it.quantity_returned}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" variant="outline" onClick={() => quickSet(it, "all")}>
                  <Check className="h-3 w-3" /> Brukt alt
                </Button>
                <Button size="sm" variant="outline" onClick={() => quickSet(it, "none")}>
                  <X className="h-3 w-3" /> Ikke brukt
                </Button>
                <Button size="sm" variant="outline" onClick={() => quickSet(it, "missing")}>
                  <AlertTriangle className="h-3 w-3" /> Mangler
                </Button>
              </div>
            </div>
          ))}

          {/* Add extra */}
          <div className="border-2 border-dashed rounded-lg p-3 space-y-2">
            <div className="font-medium text-sm">Legg til ekstra vare brukt</div>
            <Input placeholder="Beskrivelse" value={extraDesc} onChange={(e) => setExtraDesc(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Elnr" value={extraElnr} onChange={(e) => setExtraElnr(e.target.value)} />
              <Input type="number" placeholder="Antall" value={extraQty} onChange={(e) => setExtraQty(e.target.value)} />
            </div>
            <Button size="sm" onClick={addExtra} disabled={!extraDesc.trim()}>
              <Plus className="h-3.5 w-3.5" /> Legg til
            </Button>
          </div>

          <Button className="w-full" onClick={onComplete}>
            Lagre og marker som forbruk registrert
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
