import React, { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2, Check, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import type { MaterialItemRow } from "@/hooks/useMaterialList";
import { MATERIAL_PROVIDED_BY_LABELS, type MaterialProvidedBy } from "@/lib/material-status";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface ProcurementOption {
  id: string;
  label: string;
}

/**
 * Parse number tolerant of Norwegian decimal comma.
 * "12,5" -> 12.5, "12.5" -> 12.5, "" -> 0
 */
export function parseNumNb(v: string): number {
  if (v === null || v === undefined) return 0;
  const s = String(v).trim().replace(/\s/g, "").replace(",", ".");
  if (!s) return 0;
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function formatNb(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "";
  return String(n).replace(".", ",");
}

interface ProductSuggestion {
  id: string;
  elnr: string | null;
  description: string;
  unit: string;
  supplier: string | null;
  unit_price: number | null;
}

interface NewRowDraft {
  elnr: string;
  description: string;
  unit_price: string;
  quantity_ordered: string;
  unit: string;
  supplier: string;
  comment: string;
}

const EMPTY_DRAFT: NewRowDraft = {
  elnr: "",
  description: "",
  unit_price: "",
  quantity_ordered: "",
  unit: "stk",
  supplier: "",
  comment: "",
};

interface Props {
  items: MaterialItemRow[];
  companyId: string | null;
  procurements?: ProcurementOption[];
  onUpdate: (id: string, patch: Partial<MaterialItemRow>) => Promise<void>;
  onDelete: (id: string) => Promise<void> | void;
  onAdd: (row: Partial<MaterialItemRow> & { description: string }) => Promise<void>;
}

/**
 * Spreadsheet-aktig inline-redigering for materialliste.
 * - Eksisterende linjer redigeres i tabellen (autosave on blur / Enter).
 * - Nederst er det alltid en tom "ny linje" — Enter lagrer og fokuserer ny linje.
 * - Inline produktoppslag på elnr og beskrivelse.
 */
export function InlineMaterialEditor({ items, companyId, procurements = [], onUpdate, onDelete, onAdd }: Props) {
  const isMobile = useIsMobile();

  const totalQty = items.reduce((s, it) => s + (it.quantity_ordered || 0), 0);
  const totalSum = items.reduce(
    (s, it) => s + (it.unit_price != null ? it.unit_price * (it.quantity_ordered || 0) : 0),
    0,
  );
  const anyPrice = items.some((it) => it.unit_price != null);

  if (isMobile) {
    return (
      <MobileEditor
        items={items}
        companyId={companyId}
        procurements={procurements}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onAdd={onAdd}
        anyPrice={anyPrice}
        totalQty={totalQty}
        totalSum={totalSum}
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="p-2 text-left w-28">Elnr</th>
            <th className="p-2 text-left">Beskrivelse</th>
            <th className="p-2 text-right w-24">Pris</th>
            <th className="p-2 text-right w-20">Antall</th>
            <th className="p-2 text-left w-16">Enhet</th>
            <th className="p-2 text-right w-24">Sum</th>
            <th className="p-2 text-right w-20">Mottatt</th>
            <th className="p-2 text-right w-20">Plukket</th>
            <th className="p-2 text-right w-20">Brukt</th>
            <th className="p-2 text-left w-36">Leveres av</th>
            <th className="p-2 text-left w-40">Bestilling</th>
            <th className="p-2 text-left w-40">Kommentar</th>
            <th className="p-2 w-8" />
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <ExistingRow
              key={it.id}
              item={it}
              procurements={procurements}
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
          ))}
          <NewRow companyId={companyId} procurements={procurements} onAdd={onAdd} />
        </tbody>
        {anyPrice && (
          <tfoot className="bg-muted/30 text-sm font-medium">
            <tr>
              <td colSpan={2} className="p-2 text-right text-muted-foreground">
                Sum materiell
              </td>
              <td />
              <td className="p-2 text-right tabular-nums">{totalQty}</td>
              <td />
              <td className="p-2 text-right tabular-nums">
                {totalSum.toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td colSpan={7} />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

/* ============== Existing row ============== */
type SaveState = "idle" | "saving" | "saved" | "error";

function ExistingRow({
  item,
  procurements,
  onUpdate,
  onDelete,
}: {
  item: MaterialItemRow;
  procurements: ProcurementOption[];
  onUpdate: (id: string, patch: Partial<MaterialItemRow>) => Promise<void>;
  onDelete: (id: string) => Promise<void> | void;
}) {
  const [state, setState] = useState<SaveState>("idle");
  const stateTimer = useRef<ReturnType<typeof setTimeout>>();

  const flash = (s: SaveState) => {
    setState(s);
    clearTimeout(stateTimer.current);
    stateTimer.current = setTimeout(() => setState("idle"), 1500);
  };

  const save = async (patch: Partial<MaterialItemRow>) => {
    setState("saving");
    try {
      await onUpdate(item.id, patch);
      flash("saved");
    } catch (e) {
      console.error("update row failed", e);
      flash("error");
    }
  };

  const sum =
    item.unit_price != null ? item.unit_price * (item.quantity_ordered || 0) : null;

  return (
    <tr className={cn("border-t border-border/30 hover:bg-muted/20", state === "error" && "bg-destructive/10")}>
      <td className="p-1">
        <CellText value={item.elnr ?? ""} onSave={(v) => save({ elnr: v || null })} />
      </td>
      <td className="p-1">
        <CellText value={item.description} onSave={(v) => save({ description: v })} />
      </td>
      <td className="p-1">
        <CellNumber value={item.unit_price} allowNull onSave={(v) => save({ unit_price: v })} />
      </td>
      <td className="p-1">
        <CellNumber value={item.quantity_ordered} onSave={(v) => save({ quantity_ordered: v ?? 0 })} />
      </td>
      <td className="p-1">
        <CellText value={item.unit} onSave={(v) => save({ unit: v || "stk" })} />
      </td>
      <td className="p-1 text-right tabular-nums text-muted-foreground">
        {sum != null ? sum.toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
      </td>
      <td className="p-1">
        <CellNumber value={item.quantity_received} onSave={(v) => save({ quantity_received: v ?? 0 })} />
      </td>
      <td className="p-1">
        <CellNumber value={item.quantity_picked} onSave={(v) => save({ quantity_picked: v ?? 0 })} />
      </td>
      <td className="p-1">
        <CellNumber value={item.quantity_used} onSave={(v) => save({ quantity_used: v ?? 0 })} />
      </td>
      <td className="p-1">
        <ProvidedBySelect
          value={item.provided_by}
          onChange={(v) => save({ provided_by: v })}
        />
      </td>
      <td className="p-1">
        <ProcurementSelect
          value={item.procurement_id}
          options={procurements}
          onChange={(v) => save({ procurement_id: v })}
        />
      </td>
      <td className="p-1">
        <CellText value={item.comment ?? ""} onSave={(v) => save({ comment: v || null })} />
      </td>
      <td className="p-1">
        <div className="flex items-center gap-1">
          <SaveIndicator state={state} />
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={async () => {
              if (!confirm("Slette linje?")) return;
              await onDelete(item.id);
            }}
            title="Slett linje"
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

function ProvidedBySelect({
  value,
  onChange,
}: {
  value: MaterialProvidedBy | null;
  onChange: (v: MaterialProvidedBy | null) => void;
}) {
  return (
    <Select
      value={value ?? "_none"}
      onValueChange={(v) => onChange(v === "_none" ? null : (v as MaterialProvidedBy))}
    >
      <SelectTrigger className="h-8 text-xs border-transparent hover:border-input bg-transparent">
        <SelectValue placeholder="—" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="_none">—</SelectItem>
        {(Object.keys(MATERIAL_PROVIDED_BY_LABELS) as MaterialProvidedBy[]).map((k) => (
          <SelectItem key={k} value={k}>{MATERIAL_PROVIDED_BY_LABELS[k]}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ProcurementSelect({
  value,
  options,
  onChange,
}: {
  value: string | null;
  options: ProcurementOption[];
  onChange: (v: string | null) => void;
}) {
  if (options.length === 0) {
    return <span className="text-[11px] text-muted-foreground italic px-2">Ingen bestillinger</span>;
  }
  return (
    <Select value={value ?? "_none"} onValueChange={(v) => onChange(v === "_none" ? null : v)}>
      <SelectTrigger className="h-8 text-xs border-transparent hover:border-input bg-transparent">
        <SelectValue placeholder="—" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="_none">—</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "saving") return <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />;
  if (state === "saved") return <Check className="h-3 w-3 text-emerald-500" />;
  if (state === "error") return <span className="text-[10px] text-destructive">Feil</span>;
  return <span className="w-3" />;
}

function CellText({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <Input
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== value && onSave(v)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
      }}
      className="h-8 text-sm border-transparent hover:border-input focus:border-input bg-transparent"
    />
  );
}

function CellNumber({
  value,
  onSave,
  allowNull = false,
}: {
  value: number | null;
  onSave: (v: number | null) => void;
  allowNull?: boolean;
}) {
  const [v, setV] = useState(value == null ? "" : formatNb(value));
  useEffect(() => setV(value == null ? "" : formatNb(value)), [value]);
  return (
    <Input
      value={v}
      inputMode="decimal"
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        if (v.trim() === "") {
          if (allowNull && value != null) onSave(null);
          else if (!allowNull && value !== 0) onSave(0);
          return;
        }
        const n = parseNumNb(v);
        if (n !== value) onSave(n);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
      }}
      className="h-8 text-sm text-right tabular-nums border-transparent hover:border-input focus:border-input bg-transparent"
    />
  );
}

/* ============== New (bottom) row with autocomplete ============== */
function NewRow({
  companyId,
  procurements,
  onAdd,
}: {
  companyId: string | null;
  procurements: ProcurementOption[];
  onAdd: (row: Partial<MaterialItemRow> & { description: string }) => Promise<void>;
}) {
  const [draft, setDraft] = useState<NewRowDraft>(EMPTY_DRAFT);
  const [providedBy, setProvidedBy] = useState<MaterialProvidedBy | null>(null);
  const [procurementId, setProcurementId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const elnrRef = useRef<HTMLInputElement>(null);

  const isValid = useMemo(() => {
    const hasName = draft.elnr.trim() !== "" || draft.description.trim() !== "";
    const qty = parseNumNb(draft.quantity_ordered);
    return hasName && qty > 0;
  }, [draft]);

  const commit = async () => {
    if (!isValid || saving) return;
    setSaving(true);
    try {
      const price = draft.unit_price.trim() === "" ? null : parseNumNb(draft.unit_price);
      await onAdd({
        elnr: draft.elnr.trim() || null,
        description: draft.description.trim() || draft.elnr.trim(),
        quantity_ordered: parseNumNb(draft.quantity_ordered),
        unit: draft.unit.trim() || "stk",
        supplier: draft.supplier.trim() || null,
        comment: draft.comment.trim() || null,
        unit_price: price,
        provided_by: providedBy,
        procurement_id: procurementId,
        source: "manual",
      });
      setDraft(EMPTY_DRAFT);
      setProvidedBy(null);
      setProcurementId(null);
      setTimeout(() => elnrRef.current?.focus(), 30);
    } catch (e) {
      console.error("add row failed", e);
    } finally {
      setSaving(false);
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void commit();
    }
  };

  const applyProduct = (p: ProductSuggestion) => {
    setDraft((d) => ({
      ...d,
      elnr: p.elnr ?? d.elnr,
      description: p.description,
      unit: p.unit || d.unit || "stk",
      supplier: p.supplier ?? d.supplier,
      unit_price: p.unit_price != null ? formatNb(p.unit_price) : d.unit_price,
    }));
  };

  return (
    <tr className="border-t-2 border-primary/30 bg-primary/5">
      <td className="p-1 align-top">
        <ProductAutocomplete
          ref={elnrRef}
          companyId={companyId}
          value={draft.elnr}
          field="elnr"
          placeholder="Elnr"
          onChange={(v) => setDraft({ ...draft, elnr: v })}
          onSelect={applyProduct}
          onEnter={commit}
        />
      </td>
      <td className="p-1 align-top">
        <ProductAutocomplete
          companyId={companyId}
          value={draft.description}
          field="description"
          placeholder="Beskrivelse"
          onChange={(v) => setDraft({ ...draft, description: v })}
          onSelect={applyProduct}
          onEnter={commit}
        />
      </td>
      <td className="p-1 align-top">
        <Input
          value={draft.unit_price}
          inputMode="decimal"
          placeholder="0"
          onChange={(e) => setDraft({ ...draft, unit_price: e.target.value })}
          onKeyDown={onKey}
          className="h-8 text-sm text-right tabular-nums"
        />
      </td>
      <td className="p-1 align-top">
        <Input
          value={draft.quantity_ordered}
          inputMode="decimal"
          placeholder="0"
          onChange={(e) => setDraft({ ...draft, quantity_ordered: e.target.value })}
          onKeyDown={onKey}
          className="h-8 text-sm text-right tabular-nums"
        />
      </td>
      <td className="p-1 align-top">
        <Input
          value={draft.unit}
          onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
          onKeyDown={onKey}
          className="h-8 text-sm"
        />
      </td>
      <td className="p-1" />
      <td className="p-1" />
      <td className="p-1" />
      <td className="p-1" />
      <td className="p-1 align-top">
        <ProvidedBySelect value={providedBy} onChange={(v) => setProvidedBy(v)} />
      </td>
      <td className="p-1 align-top">
        <ProcurementSelect value={procurementId} options={procurements} onChange={(v) => setProcurementId(v)} />
      </td>
      <td className="p-1 align-top">
        <Input
          value={draft.comment}
          onChange={(e) => setDraft({ ...draft, comment: e.target.value })}
          onKeyDown={onKey}
          placeholder="Notat"
          className="h-8 text-sm"
        />
      </td>
      <td className="p-1 align-top">
        <Button
          size="icon"
          variant={isValid ? "default" : "ghost"}
          className="h-7 w-7"
          onClick={commit}
          disabled={!isValid || saving}
          title="Legg til (Enter)"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        </Button>
      </td>
    </tr>
  );
}

/* ============== Product autocomplete ============== */
interface AutocompleteProps {
  companyId: string | null;
  value: string;
  field: "elnr" | "description";
  placeholder?: string;
  onChange: (v: string) => void;
  onSelect: (p: ProductSuggestion) => void;
  onEnter?: () => void;
}

const ProductAutocomplete = React.forwardRef<HTMLInputElement, AutocompleteProps>(
  function ProductAutocomplete(props, ref) {
    const { companyId, value, field, placeholder, onChange, onSelect, onEnter } = props;
    const [open, setOpen] = useState(false);
    const [results, setResults] = useState<ProductSuggestion[]>([]);
    const [highlight, setHighlight] = useState(0);

    useEffect(() => {
      if (!companyId || value.trim().length < 2) {
        setResults([]);
        return;
      }
      let cancelled = false;
      const t = setTimeout(async () => {
        const q = value.trim();
        const builder = supabase
          .from("material_products")
          .select("id, elnr, description, unit, supplier, unit_price")
          .eq("company_id", companyId)
          .eq("active", true)
          .limit(8);
        if (field === "elnr") builder.ilike("elnr", `${q}%`);
        else builder.ilike("description", `%${q}%`);
        const { data, error } = await builder;
        if (cancelled || error) return;
        setResults((data ?? []) as ProductSuggestion[]);
        setHighlight(0);
      }, 200);
      return () => {
        cancelled = true;
        clearTimeout(t);
      };
    }, [companyId, value, field]);

    return (
      <div className="relative">
        <Input
          ref={ref}
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (open && results.length > 0) {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlight((h) => Math.min(h + 1, results.length - 1));
                return;
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlight((h) => Math.max(h - 1, 0));
                return;
              }
              if (e.key === "Tab" || e.key === "Enter") {
                const pick = results[highlight];
                if (pick) {
                  e.preventDefault();
                  onSelect(pick);
                  setOpen(false);
                  if (e.key === "Enter") onEnter?.();
                  return;
                }
              }
              if (e.key === "Escape") {
                setOpen(false);
                return;
              }
            }
            if (e.key === "Enter") {
              e.preventDefault();
              onEnter?.();
            }
          }}
          className="h-8 text-sm"
        />
        {open && results.length > 0 && (
          <div className="absolute z-50 mt-1 left-0 right-0 min-w-[280px] rounded-md border bg-popover shadow-lg max-h-64 overflow-y-auto">
            {results.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(p);
                  setOpen(false);
                }}
                className={cn(
                  "w-full text-left px-3 py-1.5 text-sm hover:bg-accent flex items-center justify-between gap-2",
                  i === highlight && "bg-accent",
                )}
              >
                <span className="flex flex-col">
                  <span className="font-medium">{p.description}</span>
                  <span className="text-xs text-muted-foreground">
                    {p.elnr ?? "—"} · {p.unit} {p.supplier ? `· ${p.supplier}` : ""}
                  </span>
                </span>
                {p.unit_price != null && (
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {formatNb(p.unit_price)} kr
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  },
);

/* ============== Mobile editor (cards) ============== */
function MobileEditor({
  items,
  companyId,
  onUpdate,
  onDelete,
  onAdd,
  anyPrice,
  totalSum,
}: Props & { anyPrice: boolean; totalQty: number; totalSum: number }) {
  return (
    <div className="divide-y divide-border/40">
      {items.map((it) => (
        <MobileCard key={it.id} item={it} onUpdate={onUpdate} onDelete={onDelete} />
      ))}
      <MobileNewRow companyId={companyId} onAdd={onAdd} />
      {anyPrice && (
        <div className="p-3 flex items-center justify-between text-sm font-medium bg-muted/20">
          <span className="text-muted-foreground">Sum materiell</span>
          <span className="tabular-nums">
            {totalSum.toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr
          </span>
        </div>
      )}
    </div>
  );
}

function MobileCard({
  item,
  onUpdate,
  onDelete,
}: {
  item: MaterialItemRow;
  onUpdate: (id: string, patch: Partial<MaterialItemRow>) => Promise<void>;
  onDelete: (id: string) => Promise<void> | void;
}) {
  return (
    <div className="p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 space-y-1">
          <CellText value={item.description} onSave={(v) => onUpdate(item.id, { description: v })} />
          <div className="text-xs text-muted-foreground">
            <CellText value={item.elnr ?? ""} onSave={(v) => onUpdate(item.id, { elnr: v || null })} />
          </div>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={async () => {
            if (!confirm("Slette linje?")) return;
            await onDelete(item.id);
          }}
        >
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <NumBox label="Pris" value={item.unit_price} allowNull onSave={(v) => onUpdate(item.id, { unit_price: v })} />
        <NumBox label="Antall" value={item.quantity_ordered} onSave={(v) => onUpdate(item.id, { quantity_ordered: v ?? 0 })} />
        <div>
          <div className="text-[10px] uppercase text-muted-foreground">Enhet</div>
          <CellText value={item.unit} onSave={(v) => onUpdate(item.id, { unit: v || "stk" })} />
        </div>
        <NumBox label="Plukket" value={item.quantity_picked} onSave={(v) => onUpdate(item.id, { quantity_picked: v ?? 0 })} />
        <NumBox label="Brukt" value={item.quantity_used} onSave={(v) => onUpdate(item.id, { quantity_used: v ?? 0 })} />
        <div>
          <div className="text-[10px] uppercase text-muted-foreground">Retur</div>
          <div className="h-8 flex items-center px-2 tabular-nums">{item.quantity_returned}</div>
        </div>
      </div>
    </div>
  );
}

function NumBox({
  label,
  value,
  onSave,
  allowNull = false,
}: {
  label: string;
  value: number | null;
  onSave: (v: number | null) => void;
  allowNull?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <CellNumber value={value} onSave={onSave} allowNull={allowNull} />
    </div>
  );
}

function MobileNewRow({
  companyId,
  onAdd,
}: {
  companyId: string | null;
  onAdd: (row: Partial<MaterialItemRow> & { description: string }) => Promise<void>;
}) {
  const [draft, setDraft] = useState<NewRowDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);

  const isValid =
    (draft.elnr.trim() !== "" || draft.description.trim() !== "") &&
    parseNumNb(draft.quantity_ordered) > 0;

  const commit = async () => {
    if (!isValid || saving) return;
    setSaving(true);
    try {
      const price = draft.unit_price.trim() === "" ? null : parseNumNb(draft.unit_price);
      await onAdd({
        elnr: draft.elnr.trim() || null,
        description: draft.description.trim() || draft.elnr.trim(),
        quantity_ordered: parseNumNb(draft.quantity_ordered),
        unit: draft.unit.trim() || "stk",
        supplier: draft.supplier.trim() || null,
        comment: draft.comment.trim() || null,
        unit_price: price,
        source: "manual",
      });
      setDraft(EMPTY_DRAFT);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-3 bg-primary/5 space-y-2">
      <div className="text-[10px] uppercase font-semibold text-primary">Ny varelinje</div>
      <ProductAutocomplete
        companyId={companyId}
        value={draft.elnr}
        field="elnr"
        placeholder="Elnr"
        onChange={(v) => setDraft({ ...draft, elnr: v })}
        onSelect={(p) =>
          setDraft({
            ...draft,
            elnr: p.elnr ?? draft.elnr,
            description: p.description,
            unit: p.unit || "stk",
            supplier: p.supplier ?? "",
            unit_price: p.unit_price != null ? formatNb(p.unit_price) : draft.unit_price,
          })
        }
      />
      <ProductAutocomplete
        companyId={companyId}
        value={draft.description}
        field="description"
        placeholder="Beskrivelse"
        onChange={(v) => setDraft({ ...draft, description: v })}
        onSelect={(p) =>
          setDraft({
            ...draft,
            elnr: p.elnr ?? draft.elnr,
            description: p.description,
            unit: p.unit || "stk",
            supplier: p.supplier ?? "",
            unit_price: p.unit_price != null ? formatNb(p.unit_price) : draft.unit_price,
          })
        }
      />
      <div className="grid grid-cols-3 gap-2">
        <Input
          inputMode="decimal"
          placeholder="Pris"
          value={draft.unit_price}
          onChange={(e) => setDraft({ ...draft, unit_price: e.target.value })}
        />
        <Input
          inputMode="decimal"
          placeholder="Antall"
          value={draft.quantity_ordered}
          onChange={(e) => setDraft({ ...draft, quantity_ordered: e.target.value })}
        />
        <Input
          placeholder="Enhet"
          value={draft.unit}
          onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
        />
      </div>
      <Button onClick={commit} disabled={!isValid || saving} className="w-full">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        Legg til vare
      </Button>
    </div>
  );
}
