import { useState, useCallback, useMemo } from "react";
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
  Plus, Trash2, GripVertical, Type, Package, Sparkles, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
}

const UNITS = ["stk", "timer", "m", "m²", "m³", "kg", "liter", "pakke", "sett"];

function calcLineExVat(line: OrderLine): number {
  if (line.line_type === "text") return 0;
  return Math.round(line.quantity * line.unit_price * (1 - line.discount_percent / 100) * 100) / 100;
}

function calcLineIncVat(line: OrderLine): number {
  const exVat = calcLineExVat(line);
  return Math.round(exVat * (1 + line.vat_rate / 100) * 100) / 100;
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
}: OrderLineEditorProps) {
  const addLine = (type: "product" | "text") => {
    const maxSort = lines.length > 0 ? Math.max(...lines.map(l => l.sort_order)) : 0;
    onChange([
      ...lines,
      {
        id: crypto.randomUUID(),
        sort_order: maxSort + 1,
        line_type: type,
        description: type === "text" ? "" : "Ny linje",
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

  const totals = useMemo(() => calcTotals(lines), [lines]);

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      {!readOnly && (
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 rounded-lg"
            onClick={() => addLine("product")}
          >
            <Plus className="h-3.5 w-3.5" />
            <Package className="h-3.5 w-3.5" />
            Produktlinje
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 rounded-lg"
            onClick={() => addLine("text")}
          >
            <Plus className="h-3.5 w-3.5" />
            <Type className="h-3.5 w-3.5" />
            Fritekstlinje
          </Button>
          {onRequestAiSuggestions && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 rounded-lg text-muted-foreground ml-auto"
              onClick={onRequestAiSuggestions}
              disabled={aiLoading}
            >
              {aiLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Foreslå linjer med AI
            </Button>
          )}
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-8">#</TableHead>
              <TableHead className="min-w-[200px]">Beskrivelse</TableHead>
              <TableHead className="w-20 text-right">Antall</TableHead>
              <TableHead className="w-20">Enhet</TableHead>
              <TableHead className="w-28 text-right">Enhetspris</TableHead>
              <TableHead className="w-20 text-right">Rabatt %</TableHead>
              <TableHead className="w-28 text-right">Sum eks. mva</TableHead>
              {!readOnly && <TableHead className="w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.length === 0 ? (
              <TableRow>
                <TableCell colSpan={readOnly ? 7 : 8} className="text-center text-muted-foreground py-8">
                  Ingen ordrelinjer. Klikk "Produktlinje" for å legge til.
                </TableCell>
              </TableRow>
            ) : (
              lines
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((line, idx) => (
                  <TableRow
                    key={line.id}
                    className={cn(
                      line.line_type === "text" && "bg-muted/10",
                      line.suggested_by_ai && "bg-primary/5 border-l-2 border-l-primary/30"
                    )}
                  >
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {idx + 1}
                    </TableCell>
                    <TableCell>
                      {line.line_type === "text" ? (
                        readOnly ? (
                          <p className="text-sm italic text-muted-foreground">{line.description}</p>
                        ) : (
                          <Textarea
                            value={line.description}
                            onChange={e => updateLine(line.id, "description", e.target.value)}
                            placeholder="Overskrift / kommentar..."
                            className="min-h-[36px] text-sm italic border-0 bg-transparent shadow-none resize-none p-0 focus-visible:ring-0"
                            rows={1}
                          />
                        )
                      ) : readOnly ? (
                        <p className="text-sm">{line.description}</p>
                      ) : (
                        <Input
                          value={line.description}
                          onChange={e => updateLine(line.id, "description", e.target.value)}
                          placeholder="Beskrivelse..."
                          className="h-8 text-sm border-0 bg-transparent shadow-none p-0 focus-visible:ring-0"
                        />
                      )}
                      {line.suggested_by_ai && (
                        <span className="text-[10px] text-primary/60 flex items-center gap-1 mt-0.5">
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
                        <TableCell>
                          {readOnly ? (
                            <span className="text-sm text-right block">{line.quantity}</span>
                          ) : (
                            <Input
                              type="number"
                              value={line.quantity}
                              onChange={e => updateLine(line.id, "quantity", Number(e.target.value))}
                              className="h-8 text-sm text-right border-0 bg-transparent shadow-none p-0 focus-visible:ring-0 w-16"
                              min={0}
                              step="0.01"
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          {readOnly ? (
                            <span className="text-sm">{line.unit}</span>
                          ) : (
                            <Select
                              value={line.unit}
                              onValueChange={v => updateLine(line.id, "unit", v)}
                            >
                              <SelectTrigger className="h-8 text-sm border-0 bg-transparent shadow-none p-0 focus-visible:ring-0 w-16">
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
                        <TableCell>
                          {readOnly ? (
                            <span className="text-sm text-right block">{formatPrice(line.unit_price)}</span>
                          ) : (
                            <Input
                              type="number"
                              value={line.unit_price}
                              onChange={e => updateLine(line.id, "unit_price", Number(e.target.value))}
                              className="h-8 text-sm text-right border-0 bg-transparent shadow-none p-0 focus-visible:ring-0 w-24"
                              min={0}
                              step="0.01"
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          {readOnly ? (
                            <span className="text-sm text-right block">{line.discount_percent}%</span>
                          ) : (
                            <Input
                              type="number"
                              value={line.discount_percent}
                              onChange={e => updateLine(line.id, "discount_percent", Number(e.target.value))}
                              className="h-8 text-sm text-right border-0 bg-transparent shadow-none p-0 focus-visible:ring-0 w-14"
                              min={0}
                              max={100}
                              step="0.5"
                            />
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium text-sm">
                          {formatPrice(calcLineExVat(line))}
                        </TableCell>
                      </>
                    )}
                    {!readOnly && (
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => removeLine(line.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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
        <div className="w-72 space-y-1 text-sm">
          <div className="flex justify-between px-2 py-1">
            <span className="text-muted-foreground">Sum eks. mva</span>
            <span className="font-medium">{formatPrice(totals.totalExVat)} kr</span>
          </div>
          <div className="flex justify-between px-2 py-1">
            <span className="text-muted-foreground">MVA (25%)</span>
            <span>{formatPrice(totals.totalVat)} kr</span>
          </div>
          <div className="flex justify-between px-2 py-1.5 bg-muted/50 rounded-lg font-semibold">
            <span>Sum inkl. mva</span>
            <span>{formatPrice(totals.totalIncVat)} kr</span>
          </div>
        </div>
      </div>
    </div>
  );
}
