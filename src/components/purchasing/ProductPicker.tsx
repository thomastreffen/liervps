/**
 * Smart product picker with supplier price intelligence.
 * Shows product search results with all supplier alternatives.
 */
import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Search, Loader2, Trophy, ArrowRight, Package } from "lucide-react";
import { useProductSearch, type ProductSearchResult, type SupplierAlternative } from "@/hooks/useProductSearch";
import { useDebounce } from "@/hooks/useDebounce";

function formatPrice(val: number | null) {
  if (val == null) return "—";
  return new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK", maximumFractionDigits: 2 }).format(val);
}

interface ProductPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (product: ProductSearchResult, alternative: SupplierAlternative) => void;
  currentSupplierId?: string | null;
}

export function ProductPicker({ open, onClose, onSelect, currentSupplierId }: ProductPickerProps) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const { data: results = [], isLoading } = useProductSearch(debouncedSearch, open);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleSelect = useCallback((product: ProductSearchResult, alt: SupplierAlternative) => {
    onSelect(product, alt);
    onClose();
    setSearch("");
    setExpandedId(null);
  }, [onSelect, onClose]);

  return (
    <Dialog open={open} onOpenChange={() => { onClose(); setSearch(""); setExpandedId(null); }}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Velg produkt</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Søk på elnummer, EAN, varenummer, navn..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-auto min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : debouncedSearch.length < 2 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              Skriv minst 2 tegn for å søke
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Ingen produkter funnet</p>
            </div>
          ) : (
            <div className="divide-y">
              {results.map((product) => (
                <div key={product.catalog_product_id}>
                  {/* Product row */}
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
                    onClick={() => {
                      if (product.alternatives.length <= 1) {
                        // Direct select cheapest
                        const alt = product.alternatives[0];
                        if (alt) handleSelect(product, alt);
                      } else {
                        setExpandedId(expandedId === product.catalog_product_id ? null : product.catalog_product_id);
                      }
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{product.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {[product.el_number && `Elnr: ${product.el_number}`, product.brand, product.category].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {product.alternatives.length > 1 && (
                        <Badge variant="secondary" className="text-[10px]">
                          {product.alternatives.length} leverandører
                        </Badge>
                      )}
                      {product.best_net_price != null && (
                        <span className="font-mono text-sm font-semibold text-primary">
                          {formatPrice(product.best_net_price)}
                        </span>
                      )}
                      {product.best_supplier_name && (
                        <Badge variant="outline" className="text-[10px]">
                          {product.best_supplier_name}
                        </Badge>
                      )}
                    </div>
                  </button>

                  {/* Expanded supplier alternatives */}
                  {expandedId === product.catalog_product_id && product.alternatives.length > 0 && (
                    <div className="bg-muted/20 border-t border-b px-4 py-2">
                      <p className="text-[11px] text-muted-foreground font-medium mb-2 uppercase tracking-wider">
                        Velg leverandør
                      </p>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-[10px]">Leverandør</TableHead>
                            <TableHead className="text-[10px]">SKU</TableHead>
                            <TableHead className="text-[10px] text-right">Nettopris</TableHead>
                            <TableHead className="text-[10px] text-right">Forskjell</TableHead>
                            <TableHead className="w-10"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {product.alternatives.map((alt) => {
                            const isCurrentSupplier = currentSupplierId && alt.supplier_id === currentSupplierId;
                            return (
                              <TableRow
                                key={alt.supplier_product_id}
                                className={`cursor-pointer hover:bg-muted/60 ${alt.is_cheapest ? "bg-emerald-50/60 dark:bg-emerald-950/20" : ""}`}
                                onClick={() => handleSelect(product, alt)}
                              >
                                <TableCell className="py-1.5">
                                  <span className="flex items-center gap-1.5 text-sm">
                                    {alt.supplier_name}
                                    {alt.is_cheapest && <Trophy className="h-3 w-3 text-emerald-600" />}
                                    {isCurrentSupplier && (
                                      <Badge variant="secondary" className="text-[9px] px-1">Nåværende</Badge>
                                    )}
                                  </span>
                                </TableCell>
                                <TableCell className="py-1.5 font-mono text-xs text-muted-foreground">
                                  {alt.supplier_sku}
                                </TableCell>
                                <TableCell className="py-1.5 text-right font-mono text-sm font-medium">
                                  {formatPrice(alt.net_price)}
                                </TableCell>
                                <TableCell className="py-1.5 text-right">
                                  {alt.is_cheapest ? (
                                    <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[10px]">Billigst</Badge>
                                  ) : alt.diff_from_cheapest > 0 ? (
                                    <span className="text-xs text-amber-600 font-mono">
                                      +{formatPrice(alt.diff_from_cheapest)} ({alt.diff_percent.toFixed(1)}%)
                                    </span>
                                  ) : null}
                                </TableCell>
                                <TableCell className="py-1.5">
                                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
