import { useState } from "react";
import { useUnlinkedProducts, type UnlinkedProduct } from "@/hooks/useUnlinkedProducts";
import { useCatalogProducts } from "@/hooks/useCatalogProducts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Loader2, Link2, PlusCircle, Search } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { nb } from "date-fns/locale";

export function UnlinkedProductsTable() {
  const { unlinked, loading, linkToProduct, createAndLink } = useUnlinkedProducts();
  const [linkDialogItem, setLinkDialogItem] = useState<UnlinkedProduct | null>(null);
  const [catalogSearch, setCatalogSearch] = useState("");
  const { products: catalogResults, loading: catalogLoading } = useCatalogProducts({
    search: catalogSearch,
    limit: 20,
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (unlinked.length === 0) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p className="font-medium">Ingen ukoblede produkter</p>
        <p className="text-sm mt-1">Alle leverandørprodukter er koblet til katalogen</p>
      </div>
    );
  }

  return (
    <>
      <div className="border rounded-lg overflow-hidden">
        <div className="max-h-[calc(100vh-380px)] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Leverandør</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Produktnavn</TableHead>
                <TableHead>Merke</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Sist sett</TableHead>
                <TableHead className="text-right">Handling</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {unlinked.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">{item.supplier_name}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{item.supplier_sku}</TableCell>
                  <TableCell className="text-sm max-w-[250px] truncate">
                    {item.supplier_product_name || "—"}
                  </TableCell>
                  <TableCell className="text-sm">{item.raw_brand || "—"}</TableCell>
                  <TableCell className="text-sm">{item.raw_category || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {item.last_seen_at
                      ? formatDistanceToNow(new Date(item.last_seen_at), { addSuffix: true, locale: nb })
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1"
                        onClick={() => {
                          setLinkDialogItem(item);
                          setCatalogSearch("");
                        }}
                      >
                        <Link2 className="h-3 w-3" />
                        Koble
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs gap-1"
                        onClick={() => createAndLink.mutate(item)}
                        disabled={createAndLink.isPending}
                      >
                        <PlusCircle className="h-3 w-3" />
                        Nytt
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="border-t px-4 py-2 text-xs text-muted-foreground bg-muted/30">
          {unlinked.length} ukoblede produkter
        </div>
      </div>

      {/* Link dialog */}
      <Dialog open={!!linkDialogItem} onOpenChange={() => setLinkDialogItem(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Koble til masterprodukt</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Kobler <strong>{linkDialogItem?.supplier_product_name || linkDialogItem?.supplier_sku}</strong> til et eksisterende produkt.
          </p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Søk i produktkatalog..."
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="max-h-[240px] overflow-auto border rounded-md">
            {catalogLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : catalogResults.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                {catalogSearch.length < 2 ? "Skriv minst 2 tegn for å søke" : "Ingen resultater"}
              </div>
            ) : (
              <div className="divide-y">
                {catalogResults.map((cp) => (
                  <button
                    key={cp.id}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted/40 transition-colors"
                    onClick={() => {
                      if (linkDialogItem) {
                        linkToProduct.mutate({
                          supplierProductId: linkDialogItem.id,
                          productId: cp.id,
                        });
                        setLinkDialogItem(null);
                      }
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{cp.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {[cp.el_number, cp.brand, cp.category].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
