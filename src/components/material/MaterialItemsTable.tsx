import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import type { MaterialItemRow } from "@/hooks/useMaterialList";
import { MATERIAL_SOURCE_LABELS } from "@/lib/material-status";

interface Props {
  items: MaterialItemRow[];
  onUpdate: (id: string, patch: Partial<MaterialItemRow>) => Promise<void>;
  onDelete: (id: string) => void;
}

export function MaterialItemsTable({ items, onUpdate, onDelete }: Props) {
  const isMobile = useIsMobile();

  if (items.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground text-sm">
        Ingen materiallinjer ennå. Legg til vare, standardpakke eller AI-forslag.
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="divide-y divide-border/40">
        {items.map((it) => (
          <MobileCard key={it.id} item={it} onUpdate={onUpdate} onDelete={onDelete} />
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="p-2 text-left">Elnr</th>
            <th className="p-2 text-left">Beskrivelse</th>
            <th className="p-2 text-right w-20">Antall</th>
            <th className="p-2 text-left w-16">Enhet</th>
            <th className="p-2 text-right w-20">Plukket</th>
            <th className="p-2 text-right w-20">Brukt</th>
            <th className="p-2 text-right w-20">Retur</th>
            <th className="p-2 text-left w-32">Leverandør</th>
            <th className="p-2 text-left">Kilde</th>
            <th className="p-2 w-8" />
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id} className="border-t border-border/30 hover:bg-muted/20">
              <td className="p-1.5">
                <Cell value={it.elnr ?? ""} onSave={(v) => onUpdate(it.id, { elnr: v || null })} />
              </td>
              <td className="p-1.5">
                <Cell value={it.description} onSave={(v) => onUpdate(it.id, { description: v })} />
              </td>
              <td className="p-1.5">
                <NumCell value={it.quantity_ordered} onSave={(v) => onUpdate(it.id, { quantity_ordered: v })} />
              </td>
              <td className="p-1.5">
                <Cell value={it.unit} onSave={(v) => onUpdate(it.id, { unit: v || "stk" })} />
              </td>
              <td className="p-1.5">
                <NumCell value={it.quantity_picked} onSave={(v) => onUpdate(it.id, { quantity_picked: v })} />
              </td>
              <td className="p-1.5">
                <NumCell value={it.quantity_used} onSave={(v) => onUpdate(it.id, { quantity_used: v })} />
              </td>
              <td className="p-1.5 text-right tabular-nums text-muted-foreground">{it.quantity_returned}</td>
              <td className="p-1.5">
                <Cell value={it.supplier ?? ""} onSave={(v) => onUpdate(it.id, { supplier: v || null })} />
              </td>
              <td className="p-1.5 text-xs text-muted-foreground">
                {MATERIAL_SOURCE_LABELS[it.source] ?? it.source}
              </td>
              <td className="p-1.5">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onDelete(it.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Cell({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  return (
    <Input
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== value && onSave(v)}
      className="h-8 text-sm border-transparent hover:border-input focus:border-input bg-transparent"
    />
  );
}

function NumCell({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  const [v, setV] = useState(String(value));
  return (
    <Input
      type="number"
      step="any"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        const n = parseFloat(v);
        if (!isNaN(n) && n !== value) onSave(n);
      }}
      className="h-8 text-sm text-right tabular-nums border-transparent hover:border-input focus:border-input bg-transparent"
    />
  );
}

function MobileCard({
  item,
  onUpdate,
  onDelete,
}: {
  item: MaterialItemRow;
  onUpdate: (id: string, patch: Partial<MaterialItemRow>) => Promise<void>;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="font-medium text-sm">{item.description}</div>
          <div className="text-xs text-muted-foreground">
            {item.elnr ?? "—"} · {item.supplier ?? "—"} · {MATERIAL_SOURCE_LABELS[item.source]}
          </div>
        </div>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onDelete(item.id)}>
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>
      <div className="grid grid-cols-4 gap-2 text-xs">
        <NumBox label="Antall" value={item.quantity_ordered} onSave={(v) => onUpdate(item.id, { quantity_ordered: v })} />
        <NumBox label="Plukket" value={item.quantity_picked} onSave={(v) => onUpdate(item.id, { quantity_picked: v })} />
        <NumBox label="Brukt" value={item.quantity_used} onSave={(v) => onUpdate(item.id, { quantity_used: v })} />
        <div>
          <div className="text-[10px] uppercase text-muted-foreground">Retur</div>
          <div className="h-8 flex items-center px-2 tabular-nums">{item.quantity_returned}</div>
        </div>
      </div>
    </div>
  );
}

function NumBox({ label, value, onSave }: { label: string; value: number; onSave: (v: number) => void }) {
  const [v, setV] = useState(String(value));
  return (
    <div>
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <Input
        type="number"
        step="any"
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          const n = parseFloat(v);
          if (!isNaN(n) && n !== value) onSave(n);
        }}
        className="h-8 text-sm text-right tabular-nums"
      />
    </div>
  );
}
