import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { PageContainer } from "@/components/PageContainer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Loader2, Plus, Trash2, Trophy, ShoppingCart, Save,
} from "lucide-react";
import { usePurchaseOrderDetail } from "@/hooks/usePurchaseOrderDetail";
import { useSuppliers } from "@/hooks/useSuppliers";
import { ProductPicker } from "@/components/purchasing/ProductPicker";
import { OrderAnalysisPanel } from "@/components/purchasing/OrderAnalysisPanel";
import type { ProductSearchResult, SupplierAlternative } from "@/hooks/useProductSearch";

function formatPrice(val: number | null) {
  if (val == null) return "—";
  return new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK", maximumFractionDigits: 2 }).format(val);
}

const statusLabels: Record<string, string> = {
  draft: "Utkast",
  confirmed: "Bekreftet",
  sent: "Sendt",
  partially_received: "Delvis mottatt",
  received: "Mottatt",
  cancelled: "Kansellert",
};

export default function PurchaseOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { order, loading, analyzeOrder, addLine, removeLine, updateOrder, recalcTotals } = usePurchaseOrderDetail(id);
  const { suppliers } = useSuppliers();
  const [showPicker, setShowPicker] = useState(false);

  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </PageContainer>
    );
  }

  if (!order) {
    return (
      <PageContainer>
        <div className="text-center py-32 text-muted-foreground">
          <ShoppingCart className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>Ordre ikke funnet</p>
          <Button variant="ghost" className="mt-4" onClick={() => navigate("/purchasing")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Tilbake
          </Button>
        </div>
      </PageContainer>
    );
  }

  const analysis = analyzeOrder(order);
  const isDraft = order.status === "draft";

  const handleProductSelect = async (product: ProductSearchResult, alt: SupplierAlternative) => {
    await addLine.mutateAsync({
      description: product.name,
      el_number: product.el_number || undefined,
      quantity: 1,
      unit: product.unit || "stk",
      unit_price: alt.list_price,
      net_price: alt.net_price ?? alt.list_price,
      catalog_product_id: product.catalog_product_id,
      supplier_product_id: alt.supplier_product_id,
      best_available_price: product.best_net_price ?? undefined,
      best_available_supplier_id: product.best_supplier_id ?? undefined,
      chosen_supplier_id: alt.supplier_id,
    });
    recalcTotals.mutate();
  };

  const handleRemoveLine = async (lineId: string) => {
    await removeLine.mutateAsync(lineId);
    recalcTotals.mutate();
  };

  return (
    <PageContainer variant="fluid">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/purchasing")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm text-muted-foreground">{order.order_number}</span>
              <Badge className="text-[10px]">{statusLabels[order.status] || order.status}</Badge>
            </div>
            {isDraft ? (
              <Input
                value={order.title}
                onChange={(e) => updateOrder.mutate({ title: e.target.value })}
                className="text-xl font-bold border-0 p-0 h-auto shadow-none focus-visible:ring-0 mt-1"
                placeholder="Tittel på innkjøpsordre..."
              />
            ) : (
              <h1 className="text-xl font-bold mt-1">{order.title}</h1>
            )}
            <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
              {order.supplier_name && <span>Leverandør: <strong className="text-foreground">{order.supplier_name}</strong></span>}
              {order.project_title && <span>Prosjekt: <strong className="text-foreground">{order.project_title}</strong></span>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Lines – 2/3 width */}
          <div className="xl:col-span-2 space-y-4">
            <Card>
              <CardHeader className="pb-3 flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold">Ordrelinjer</CardTitle>
                {isDraft && (
                  <Button size="sm" className="gap-1.5" onClick={() => setShowPicker(true)}>
                    <Plus className="h-3.5 w-3.5" />
                    Legg til produkt
                  </Button>
                )}
              </CardHeader>
              <CardContent className="p-0">
                {order.lines.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Ingen linjer ennå</p>
                    {isDraft && (
                      <Button variant="ghost" className="mt-2 text-xs" onClick={() => setShowPicker(true)}>
                        <Plus className="h-3 w-3 mr-1" />
                        Legg til første produkt
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produkt</TableHead>
                          <TableHead>Elnr.</TableHead>
                          <TableHead className="text-right">Ant.</TableHead>
                          <TableHead className="text-right">Enhetspris</TableHead>
                          <TableHead className="text-right">Nettopris</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead>Leverandør</TableHead>
                          <TableHead className="text-right">Besparelse</TableHead>
                          {isDraft && <TableHead className="w-10"></TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {order.lines.map((line) => (
                          <TableRow key={line.id}>
                            <TableCell className="font-medium max-w-[200px] truncate">
                              {line.description}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {line.el_number || "—"}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {line.quantity}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs text-muted-foreground">
                              {formatPrice(line.unit_price)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm font-medium">
                              {formatPrice(line.net_price)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm font-semibold">
                              {formatPrice(line.total_ex_vat)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <span className="text-sm">{line.chosen_supplier_name || "—"}</span>
                                {line.best_available_supplier_name &&
                                  line.chosen_supplier_id !== line.best_available_supplier_id &&
                                  line.price_saving > 0 && (
                                    <Badge variant="outline" className="text-[9px] text-amber-600 border-amber-300">
                                      Billigere hos {line.best_available_supplier_name}
                                    </Badge>
                                  )}
                                {line.chosen_supplier_id === line.best_available_supplier_id && (
                                  <Trophy className="h-3 w-3 text-emerald-600" />
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {line.price_saving > 0 ? (
                                <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[10px]">
                                  -{formatPrice(line.price_saving)}
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            {isDraft && (
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  onClick={() => handleRemoveLine(line.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="border-t px-4 py-2 flex items-center justify-between text-sm bg-muted/30">
                      <span className="text-muted-foreground">{order.lines.length} linjer</span>
                      <span className="font-mono font-bold">{formatPrice(order.total_ex_vat)} eks. mva</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Notes */}
            {isDraft && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Notater</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={order.notes || ""}
                    onChange={(e) => updateOrder.mutate({ notes: e.target.value })}
                    placeholder="Interne notater til denne ordren..."
                    rows={3}
                  />
                </CardContent>
              </Card>
            )}
          </div>

          {/* Analysis sidebar – 1/3 width */}
          <div className="space-y-4">
            <OrderAnalysisPanel analysis={analysis} lineCount={order.lines.length} />

            {/* Order settings */}
            {isDraft && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">Innstillinger</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <label className="text-[11px] text-muted-foreground uppercase tracking-wider">Primærleverandør</label>
                    <Select
                      value={order.supplier_id || ""}
                      onValueChange={(v) => updateOrder.mutate({ supplier_id: v || null })}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Velg leverandør" />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground uppercase tracking-wider">
                      Terskel for leverandørbytteforslag (%)
                    </label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={order.preferred_supplier_threshold}
                      onChange={(e) => updateOrder.mutate({ preferred_supplier_threshold: Number(e.target.value) })}
                      className="mt-1"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Under denne prosenten anbefaler systemet å beholde samlet ordre
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Product picker */}
      <ProductPicker
        open={showPicker}
        onClose={() => setShowPicker(false)}
        onSelect={handleProductSelect}
        currentSupplierId={order.supplier_id}
      />
    </PageContainer>
  );
}
