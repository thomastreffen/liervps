import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Sparkles, CheckCheck, X, Plus } from "lucide-react";
import type { OrderLine } from "./OrderLineEditor";

interface AiSuggestionsPreviewProps {
  suggestions: OrderLine[];
  onAcceptSelected: (lines: OrderLine[]) => void;
  onAcceptAll: () => void;
  onDismiss: () => void;
}

const formatPrice = (n: number) =>
  n.toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function AiSuggestionsPreview({
  suggestions,
  onAcceptSelected,
  onAcceptAll,
  onDismiss,
}: AiSuggestionsPreviewProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(suggestions.map(s => s.id)));

  const toggleOne = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === suggestions.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(suggestions.map(s => s.id)));
    }
  };

  const handleAcceptSelected = () => {
    const lines = suggestions.filter(s => selected.has(s.id));
    if (lines.length > 0) onAcceptSelected(lines);
  };

  return (
    <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">AI-forslag ({suggestions.length} linjer)</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 rounded-lg h-8 text-xs"
            onClick={onAcceptAll}
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Legg til alle
          </Button>
          <Button
            type="button"
            size="sm"
            className="gap-1.5 rounded-lg h-8 text-xs"
            onClick={handleAcceptSelected}
            disabled={selected.size === 0}
          >
            <Plus className="h-3.5 w-3.5" />
            Legg til valgte ({selected.size})
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5 rounded-lg h-8 text-xs text-muted-foreground"
            onClick={onDismiss}
          >
            <X className="h-3.5 w-3.5" />
            Forkast
          </Button>
        </div>
      </div>

      <div className="rounded-lg border overflow-x-auto bg-background">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-10">
                <Checkbox
                  checked={selected.size === suggestions.length}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
              <TableHead className="min-w-[220px]">Beskrivelse</TableHead>
              <TableHead className="w-20 text-right">Antall</TableHead>
              <TableHead className="w-20">Enhet</TableHead>
              <TableHead className="w-28 text-right">Enhetspris</TableHead>
              <TableHead className="w-28 text-right">Sum eks. mva</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suggestions.map(line => {
              const lineTotal = Math.round(line.quantity * line.unit_price * (1 - line.discount_percent / 100) * 100) / 100;
              return (
                <TableRow
                  key={line.id}
                  className={selected.has(line.id) ? "bg-primary/5" : "opacity-50"}
                >
                  <TableCell className="py-2.5">
                    <Checkbox
                      checked={selected.has(line.id)}
                      onCheckedChange={() => toggleOne(line.id)}
                    />
                  </TableCell>
                  <TableCell className="py-2.5">
                    <span className="text-sm">{line.description}</span>
                  </TableCell>
                  <TableCell className="text-right text-sm py-2.5">{line.quantity}</TableCell>
                  <TableCell className="text-sm py-2.5">{line.unit}</TableCell>
                  <TableCell className="text-right text-sm py-2.5">{formatPrice(line.unit_price)}</TableCell>
                  <TableCell className="text-right text-sm font-medium py-2.5">{formatPrice(lineTotal)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        Forslagene er generert av AI og bør kontrolleres før bruk. Velg linjene du vil legge til.
      </p>
    </div>
  );
}
