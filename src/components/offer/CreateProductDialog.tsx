import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Package } from "lucide-react";
import { toast } from "sonner";

const UNITS = ["stk", "timer", "m", "m²", "m³", "kg", "liter", "pakke", "sett"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId?: string | null;
  initialName?: string;
  onCreated?: (product: { name: string; default_unit: string; default_unit_price: number }) => void;
}

export function CreateProductDialog({ open, onOpenChange, companyId, initialName = "", onCreated }: Props) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("stk");
  const [unitPrice, setUnitPrice] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setUnit("stk");
      setUnitPrice(0);
    }
  }, [open, initialName]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Produktnavn er påkrevd");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("products").insert({
        name: name.trim(),
        default_unit: unit,
        default_unit_price: unitPrice,
        default_vat_rate: 25,
        company_id: companyId || null,
      } as any);
      if (error) throw error;
      toast.success(`Produkt "${name.trim()}" opprettet`);
      onCreated?.({ name: name.trim(), default_unit: unit, default_unit_price: unitPrice });
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Kunne ikke opprette produkt: " + (err.message || "Ukjent feil"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Nytt produkt
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Produktnavn *</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="F.eks. Koblingsboks IP65"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Standard enhet</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map(u => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Standard pris (kr)</Label>
              <Input
                type="number"
                value={unitPrice}
                onChange={e => setUnitPrice(Number(e.target.value))}
                min={0}
                step="0.01"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            MVA settes til 25% som standard. Produktet kan gjenbrukes i fremtidige tilbud.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Avbryt</Button>
          <Button onClick={handleSave} disabled={!name.trim() || saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            Opprett produkt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
