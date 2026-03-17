import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Plus, Trash2, Type, Package, Sparkles, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CreateProductDialog } from "@/components/offer/CreateProductDialog";

export interface OrderLine {
  id: string;
  sort_order: number;
  line_type: "product" | "text";
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  discount_percent: number;
  vat_rate: number;
  suggested_by_ai: boolean;
}

interface OrderLineEditorProps {
  lines: OrderLine[];
  onChange: (lines: OrderLine[]) => void;
  onRequestAiSuggestions?: () => void;
  aiLoading?: boolean;
  readOnly?: boolean;
  companyId?: string | null;
  hasDescriptionOrAttachment?: boolean;
}

const UNITS = ["stk", "timer", "m", "m²", "m³", "kg", "liter", "pakke", "sett"];

const INTEGER_UNITS = new Set(["stk", "pakke", "sett"]);

function formatQuantity(value: number, unit: string): string {
  if (INTEGER_UNITS.has(unit) && Number.isInteger(value)) {
    return value.toString();
  }
  return value.toLocaleString("nb-NO", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function calcLineExVat(line: OrderLine): number {
  if (line.line_type === "text") return 0;
  return Math.round(line.quantity * line.unit_price * (1 - line.discount_percent / 100) * 100) / 100;
}

export function calcTotals(lines: OrderLine[]) {
  const totalExVat = lines.reduce((sum, l) => sum + calcLineExVat(l), 0);
  const totalVat = lines.reduce((sum, l) => {
    const exVat = calcLineExVat(l);
    return sum + (exVat * l.vat_rate / 100);
  }, 0);
  const totalIncVat = totalExVat + totalVat;
  return { totalExVat, totalVat, totalIncVat };
}

const formatPrice = (n: number) =>
  n.toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function OrderLineEditor({
  lines,
  onChange,
  onRequestAiSuggestions,
  aiLoading = false,
  readOnly = false,
  companyId,
  hasDescriptionOrAttachment = false,
}: OrderLineEditorProps) {
  const [showCreateProduct, setShowCreateProduct] = useState(false);
  const [pendingLineId, setPendingLineId] = useState<string | null>(null);

  const addLine = (type: "product" | "text") => {
    const maxSort = lines.length > 0 ? Math.max(...lines.map(l => l.sort_order)) : 0;
    onChange([
      ...lines,
      {
        id: crypto.randomUUID(),
        sort_order: maxSort + 1,
        line_type: type,
        description: type === "text" ? "" : "",
        quantity: 1,
        unit: type === "product" ? "stk" : "",
        unit_price: 0,
        discount_percent: 0,
        vat_rate: 25,
        suggested_by_ai: false,
      },
    ]);
  };

  const updateLine = (id: string, field: string, value: any) => {
    onChange(
      lines.map(l => (l.id === id ? { ...l, [field]: value } : l))
    );
  };

  const removeLine = (id: string) => {
    onChange(lines.filter(l => l.id !== id));
  };

  const handleProductCreated = (product: { name: string; default_unit: string; default_unit_price: number }) => {
    if (pendingLineId) {
      onChange(
        lines.map(l =>
          l.id === pendingLineId
            ? { ...l, description: product.name, unit: product.default_unit, unit_price: product.default_unit_price }
            : l
        )
      );
      setPendingLineId(null);
    }
  };

  const openCreateProductForLine = (lineId: string, initialName: string) => {
    setPendingLineId(lineId);
    setShowCreateProduct(true);
  };

  const aiDisabled = !hasDescriptionOrAttachment || aiLoading;
  const aiTooltipText = !hasDescriptionOrAttachment
    ? "Legg til beskrivelse eller dokument for å bruke AI-forslag"
    : aiLoading
    ? "AI jobber med forslag..."
    : "Foreslå ordrelinjer basert på beskrivelsen";

  const totals = useMemo(() => calcTotals(lines), [lines]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      {!readOnly && (
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 rounded-lg h-9"
            onClick={() => addLine("product")}
          >
            <Plus className="h-4 w-4" />
            <Package className="h-4 w-4" />
            Produktlinje
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 rounded-lg h-9"
            onClick={() => addLine("text")}
          >
            <Plus className="h-4 w-4" />
            <Type className="h-4 w-4" />
            Fritekstlinje
          </Button>
          {onRequestAiSuggestions && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="ml-auto">
                  <Button
                    type="button"
                    variant={hasDescriptionOrAttachment ? "secondary" : "ghost"}
                    size="sm"
                    className={cn(
                      "gap-1.5 rounded-lg h-9",
                      hasDescriptionOrAttachment && !aiLoading && "text-primary"
                    )}
                    onClick={onRequestAiSuggestions}
                    disabled={aiDisabled}
                  >
                    {aiLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {aiLoading ? "AI analyserer..." : "Foreslå linjer med AI"}
                  </Button>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <p className="text-xs">{aiTooltipText}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-10 text-center">#</TableHead>
              <TableHead className="min-w-[260px]">Beskrivelse</TableHead>
              <TableHead className="w-24 text-right">Antall</TableHead>
              <TableHead className="w-24">Enhet</TableHead>
              <TableHead className="w-32 text-right">Enhetspris</TableHead>
              <TableHead className="w-24 text-right">Rabatt %</TableHead>
              <TableHead className="w-32 text-right">Sum eks. mva</TableHead>
              {!readOnly && <TableHead className="w-12" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.length === 0 ? (
              <TableRow>
                <TableCell colSpan={readOnly ? 7 : 8} className="text-center text-muted-foreground py-12">
                  <div className="space-y-2">
                    <Package className="h-8 w-8 mx-auto text-muted-foreground/40" />
                    <p>Ingen ordrelinjer ennå</p>
                    <p className="text-xs">Klikk «Produktlinje» for å legge til en vare eller tjeneste</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              lines
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((line, idx) => (
                  <TableRow
                    key={line.id}
                    className={cn(
                      "group",
                      line.line_type === "text" && "bg-muted/10",
                      line.suggested_by_ai && "bg-primary/5 border-l-2 border-l-primary/30"
                    )}
                  >
                    <TableCell className="text-center text-xs text-muted-foreground font-mono py-4">
                      {idx + 1}
                    </TableCell>
                    <TableCell className="py-4">
                      {line.line_type === "text" ? (
                        readOnly ? (
                          <p className="text-sm italic text-muted-foreground">{line.description}</p>
                        ) : (
                          <Textarea
                            value={line.description}
                            onChange={e => updateLine(line.id, "description", e.target.value)}
                            placeholder="Overskrift / kommentar..."
                            className="min-h-[40px] text-sm italic border-0 bg-transparent shadow-none resize-none p-1 focus-visible:ring-1 focus-visible:ring-primary/30 rounded"
                            rows={1}
                          />
                        )
                      ) : readOnly ? (
                        <p className="text-sm">{line.description}</p>
                      ) : (
                        <div className="space-y-1.5">
                          <Input
                            value={line.description}
                            onChange={e => updateLine(line.id, "description", e.target.value)}
                            placeholder="Skriv produktnavn..."
                            className="h-9 text-sm border-0 bg-transparent shadow-none px-1 focus-visible:ring-1 focus-visible:ring-primary/30 rounded"
                          />
                          {line.description.trim().length > 2 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 text-[11px] gap-1 rounded-md px-2 border-dashed"
                              onClick={() => openCreateProductForLine(line.id, line.description)}
                            >
                              <Plus className="h-3 w-3" />
                              Opprett produkt
                            </Button>
                          )}
                        </div>
                      )}
                      {line.suggested_by_ai && (
                        <span className="text-[10px] text-primary/60 flex items-center gap-1 mt-1">
                          <Sparkles className="h-2.5 w-2.5" /> AI-forslag
                        </span>
                      )}
                    </TableCell>
                    {line.line_type === "text" ? (
                      <>
                        <TableCell />
                        <TableCell />
                        <TableCell />
                        <TableCell />
                        <TableCell />
                      </>
                    ) : (
                      <>
                        <TableCell className="py-4">
                          {readOnly ? (
                            <span className="text-sm text-right block">{formatQuantity(line.quantity, line.unit)}</span>
                          ) : (
                            <Input
                              type="number"
                              value={line.quantity}
                              onChange={e => {
                                const val = Number(e.target.value);
                                updateLine(line.id, "quantity", INTEGER_UNITS.has(line.unit) ? Math.round(val) : val);
                              }}
                              className="h-9 text-sm text-right border border-input bg-background shadow-sm px-2 focus-visible:ring-1 focus-visible:ring-primary/30 rounded w-20"
                              min={0}
                              step={INTEGER_UNITS.has(line.unit) ? "1" : "0.01"}
                            />
                          )}
                        </TableCell>
                        <TableCell className="py-4">
                          {readOnly ? (
                            <span className="text-sm">{line.unit}</span>
                          ) : (
                            <Select
                              value={line.unit}
                              onValueChange={v => updateLine(line.id, "unit", v)}
                            >
                              <SelectTrigger className="h-9 text-sm border border-input bg-background shadow-sm px-2 rounded w-20">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {UNITS.map(u => (
                                  <SelectItem key={u} value={u}>{u}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell className="py-3">
                          {readOnly ? (
                            <span className="text-sm text-right block">{formatPrice(line.unit_price)}</span>
                          ) : (
                            <Input
                              type="number"
                              value={line.unit_price}
                              onChange={e => updateLine(line.id, "unit_price", Number(e.target.value))}
                              className="h-9 text-sm text-right border border-input bg-background shadow-sm px-2 focus-visible:ring-1 focus-visible:ring-primary/30 rounded w-28"
                              min={0}
                              step="0.01"
                            />
                          )}
                        </TableCell>
                        <TableCell className="py-3">
                          {readOnly ? (
                            <span className="text-sm text-right block">{line.discount_percent}%</span>
                          ) : (
                            <Input
                              type="number"
                              value={line.discount_percent}
                              onChange={e => updateLine(line.id, "discount_percent", Number(e.target.value))}
                              className="h-9 text-sm text-right border border-input bg-background shadow-sm px-2 focus-visible:ring-1 focus-visible:ring-primary/30 rounded w-20"
                              min={0}
                              max={100}
                              step="0.5"
                            />
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium text-sm py-3">
                          {formatPrice(calcLineExVat(line))}
                        </TableCell>
                      </>
                    )}
                    {!readOnly && (
                      <TableCell className="py-3">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeLine(line.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-80 space-y-1.5 text-sm">
          <div className="flex justify-between px-3 py-1.5">
            <span className="text-muted-foreground">Sum eks. mva</span>
            <span className="font-medium">{formatPrice(totals.totalExVat)} kr</span>
          </div>
          <div className="flex justify-between px-3 py-1.5">
            <span className="text-muted-foreground">MVA (25%)</span>
            <span>{formatPrice(totals.totalVat)} kr</span>
          </div>
          <div className="flex justify-between px-3 py-2 bg-muted/50 rounded-lg font-semibold text-base">
            <span>Sum inkl. mva</span>
            <span>{formatPrice(totals.totalIncVat)} kr</span>
          </div>
        </div>
      </div>

      {/* Create Product Dialog */}
      <CreateProductDialog
        open={showCreateProduct}
        onOpenChange={setShowCreateProduct}
        companyId={companyId}
        initialName={pendingLineId ? lines.find(l => l.id === pendingLineId)?.description || "" : ""}
        onCreated={handleProductCreated}
      />
    </div>
  );
}
