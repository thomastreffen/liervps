import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageContainer } from "@/components/PageContainer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Search, Loader2, Plus, ShoppingCart, TrendingDown, ChevronRight,
} from "lucide-react";
import { usePurchaseOrders } from "@/hooks/usePurchaseOrders";
import { useSuppliers } from "@/hooks/useSuppliers";
import { formatDistanceToNow } from "date-fns";
import { nb } from "date-fns/locale";

function formatKr(val: number) {
  if (!val) return "—";
  return new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK", maximumFractionDigits: 0 }).format(val);
}

const statusLabels: Record<string, string> = {
  draft: "Utkast",
  confirmed: "Bekreftet",
  sent: "Sendt",
  partially_received: "Delvis mottatt",
  received: "Mottatt",
  cancelled: "Kansellert",
};

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  confirmed: "bg-blue-100 text-blue-700",
  sent: "bg-primary/10 text-primary",
  partially_received: "bg-amber-100 text-amber-700",
  received: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-destructive/10 text-destructive",
};

export default function PurchaseOrdersPage() {
  const navigate = useNavigate();
  const { orders, loading, createOrder } = usePurchaseOrders();
  const { suppliers } = useSuppliers();
  const [search, setSearch] = useState("");
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSupplierId, setNewSupplierId] = useState<string>("");

  const filtered = orders.filter((o) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      o.title.toLowerCase().includes(q) ||
      o.order_number.toLowerCase().includes(q) ||
      o.supplier_name?.toLowerCase().includes(q) ||
      o.project_title?.toLowerCase().includes(q)
    );
  });

  const handleCreate = async () => {
    const id = await createOrder.mutateAsync({
      title: newTitle || "Ny innkjøpsordre",
      supplier_id: newSupplierId || undefined,
    });
    setShowNewDialog(false);
    setNewTitle("");
    setNewSupplierId("");
    navigate(`/purchasing/${id}`);
  };

  return (
    <PageContainer variant="fluid">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Innkjøp</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Innkjøpsordrer med prissammenligning og leverandørintelligens
            </p>
          </div>
          <Button onClick={() => setShowNewDialog(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Ny ordre
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Søk på tittel, ordrenr, leverandør, prosjekt..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <ShoppingCart className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Ingen innkjøpsordrer</p>
            <p className="text-sm mt-1">Opprett din første innkjøpsordre for å komme i gang</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ordrenr.</TableHead>
                  <TableHead>Tittel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Leverandør</TableHead>
                  <TableHead>Prosjekt</TableHead>
                  <TableHead className="text-right">Linjer</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Sparepotensial</TableHead>
                  <TableHead>Opprettet</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((o) => (
                  <TableRow
                    key={o.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/purchasing/${o.id}`)}
                  >
                    <TableCell className="font-mono text-xs font-medium">{o.order_number}</TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate">{o.title || "Uten tittel"}</TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] border-0 ${statusColors[o.status] || ""}`}>
                        {statusLabels[o.status] || o.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{o.supplier_name || "—"}</TableCell>
                    <TableCell className="text-sm max-w-[150px] truncate">{o.project_title || "—"}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{o.line_count}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatKr(o.total_ex_vat)}</TableCell>
                    <TableCell className="text-right">
                      {o.total_saving > 0 ? (
                        <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[10px] gap-0.5">
                          <TrendingDown className="h-3 w-3" />
                          {formatKr(o.total_saving)}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(o.created_at), { addSuffix: true, locale: nb })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="border-t px-4 py-2 text-xs text-muted-foreground bg-muted/30">
              {filtered.length} ordrer
            </div>
          </div>
        )}
      </div>

      {/* New order dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ny innkjøpsordre</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="po-title">Tittel</Label>
              <Input
                id="po-title"
                placeholder="F.eks. Materiell til prosjekt X"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
            </div>
            <div>
              <Label>Primærleverandør (valgfritt)</Label>
              <Select value={newSupplierId} onValueChange={setNewSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Velg leverandør" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>Avbryt</Button>
            <Button onClick={handleCreate} disabled={createOrder.isPending}>
              {createOrder.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Opprett
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
