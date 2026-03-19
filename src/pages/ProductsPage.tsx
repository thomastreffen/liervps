import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { PageContainer } from "@/components/PageContainer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Search, Loader2, Package, ArrowUpDown, AlertTriangle, Link2Off,
} from "lucide-react";
import { useProductList } from "@/hooks/useProductList";
import { useUnlinkedProducts } from "@/hooks/useUnlinkedProducts";
import { useSuppliers } from "@/hooks/useSuppliers";
import { UnlinkedProductsTable } from "@/components/products/UnlinkedProductsTable";
import { formatDistanceToNow } from "date-fns";
import { nb } from "date-fns/locale";

function formatPrice(val: number | null) {
  if (val == null) return "—";
  return new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK", maximumFractionDigits: 2 }).format(val);
}

export default function ProductsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [filterOnlyWithPrice, setFilterOnlyWithPrice] = useState(false);
  const [filterOnlyMultiSupplier, setFilterOnlyMultiSupplier] = useState(false);
  const [activeTab, setActiveTab] = useState("catalog");

  const { products, loading } = useProductList({
    search,
    sortBy,
    sortAsc,
    filterOnlyWithPrice,
    filterOnlyMultiSupplier,
  });
  const { unlinked, loading: unlinkedLoading } = useUnlinkedProducts();
  const { suppliers } = useSuppliers();

  const toggleSort = (col: string) => {
    if (sortBy === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(col);
      setSortAsc(true);
    }
  };

  const SortHeader = ({ col, children }: { col: string; children: React.ReactNode }) => (
    <TableHead
      className="cursor-pointer select-none hover:text-foreground"
      onClick={() => toggleSort(col)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {sortBy === col && (
          <ArrowUpDown className="h-3 w-3 text-primary" />
        )}
      </span>
    </TableHead>
  );

  return (
    <PageContainer variant="fluid">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Produkter</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Produktkatalog med prissammenligning og datakvalitet
            </p>
          </div>
          <div className="flex items-center gap-2">
            {unlinked.length > 0 && (
              <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                <Link2Off className="h-3 w-3 mr-1" />
                {unlinked.length} ukoblede
              </Badge>
            )}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="catalog" className="gap-1.5">
              <Package className="h-3.5 w-3.5" />
              Katalog
            </TabsTrigger>
            <TabsTrigger value="unlinked" className="gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              Ukoblede
              {unlinked.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                  {unlinked.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="catalog" className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[240px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Søk på navn, elnummer, EAN, merke..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="price-filter"
                  checked={filterOnlyWithPrice}
                  onCheckedChange={setFilterOnlyWithPrice}
                />
                <Label htmlFor="price-filter" className="text-xs">Kun med pris</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="multi-filter"
                  checked={filterOnlyMultiSupplier}
                  onCheckedChange={setFilterOnlyMultiSupplier}
                />
                <Label htmlFor="multi-filter" className="text-xs">Flere leverandører</Label>
              </div>
            </div>

            {/* Table */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Ingen produkter i katalogen</p>
                {search ? (
                  <p className="text-sm mt-1">Prøv et annet søk</p>
                ) : unlinked.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    <p className="text-sm">
                      Det finnes <strong className="text-foreground">{unlinked.length} importerte leverandørprodukter</strong> som ikke er koblet til katalogen ennå.
                    </p>
                    <Button variant="outline" size="sm" onClick={() => setActiveTab("unlinked")} className="gap-1.5">
                      <Link2Off className="h-3.5 w-3.5" />
                      Vis ukoblede produkter
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm mt-1">Importer produkter via leverandørintegrering for å fylle katalogen</p>
                )}
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <div className="max-h-[calc(100vh-320px)] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <SortHeader col="name">Produkt</SortHeader>
                        <TableHead>Elnr.</TableHead>
                        <TableHead>EAN</TableHead>
                        <TableHead>Merke</TableHead>
                        <TableHead>Kategori</TableHead>
                        <SortHeader col="suppliers">Leverandører</SortHeader>
                        <SortHeader col="price">Beste pris</SortHeader>
                        <TableHead>Billigste</TableHead>
                        <SortHeader col="updated_at">Oppdatert</SortHeader>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products.map((p) => (
                        <TableRow
                          key={p.id}
                          className="cursor-pointer"
                          onClick={() => navigate(`/products/${p.id}`)}
                        >
                          <TableCell className="font-medium max-w-[260px] truncate">
                            {p.name}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {p.el_number || "—"}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {p.ean || "—"}
                          </TableCell>
                          <TableCell className="text-sm">{p.brand || "—"}</TableCell>
                          <TableCell className="text-sm">{p.category || "—"}</TableCell>
                          <TableCell>
                            {p.supplier_count > 0 ? (
                              <Badge variant={p.supplier_count > 1 ? "default" : "secondary"} className="text-[10px]">
                                {p.supplier_count}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">0</span>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-sm font-medium">
                            {formatPrice(p.best_net_price)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {p.best_supplier_name || "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(p.updated_at), { addSuffix: true, locale: nb })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="border-t px-4 py-2 text-xs text-muted-foreground bg-muted/30">
                  {products.length} produkter
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="unlinked">
            <UnlinkedProductsTable />
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  );
}
