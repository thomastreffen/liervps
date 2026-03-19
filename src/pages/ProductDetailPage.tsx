import { useParams, useNavigate } from "react-router-dom";
import { PageContainer } from "@/components/PageContainer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft, Loader2, Package, Trophy, FileText, Clock,
} from "lucide-react";
import { useProductDetail } from "@/hooks/useProductDetail";
import { formatDistanceToNow, format } from "date-fns";
import { nb } from "date-fns/locale";

function formatPrice(val: number | null) {
  if (val == null) return "—";
  return new Intl.NumberFormat("nb-NO", {
    style: "currency", currency: "NOK", maximumFractionDigits: 2,
  }).format(val);
}

function formatPercent(val: number | null) {
  if (val == null) return "—";
  return `${val.toFixed(1)}%`;
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { product, loading } = useProductDetail(id);

  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </PageContainer>
    );
  }

  if (!product) {
    return (
      <PageContainer>
        <div className="text-center py-32 text-muted-foreground">
          <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>Produkt ikke funnet</p>
          <Button variant="ghost" className="mt-4" onClick={() => navigate("/products")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Tilbake
          </Button>
        </div>
      </PageContainer>
    );
  }

  const infoFields = [
    { label: "Elnummer", value: product.el_number },
    { label: "EAN", value: product.ean },
    { label: "Merke", value: product.brand },
    { label: "Kategori", value: product.category },
    { label: "Underkategori", value: product.subcategory },
    { label: "Enhet", value: product.unit },
  ];

  return (
    <PageContainer variant="contained">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/products")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold tracking-tight truncate">{product.name}</h1>
            {product.description && (
              <p className="text-sm text-muted-foreground mt-1">{product.description}</p>
            )}
            <div className="flex items-center gap-2 mt-2">
              {product.best_net_price != null && (
                <Badge variant="default" className="text-xs">
                  Beste pris: {formatPrice(product.best_net_price)}
                </Badge>
              )}
              <Badge variant={product.is_active ? "secondary" : "outline"} className="text-[10px]">
                {product.is_active ? "Aktiv" : "Inaktiv"}
              </Badge>
            </div>
          </div>
        </div>

        {/* Product info grid */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Produktinformasjon</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {infoFields.map((f) => (
                <div key={f.label}>
                  <dt className="text-[11px] text-muted-foreground uppercase tracking-wider">{f.label}</dt>
                  <dd className="text-sm font-medium mt-0.5 font-mono">
                    {f.value || <span className="text-muted-foreground">—</span>}
                  </dd>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Supplier prices */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              Leverandørpriser
              <Badge variant="secondary" className="text-[10px] ml-auto">
                {product.prices.length} priser
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {product.prices.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">
                Ingen priser registrert for dette produktet
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Leverandør</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Produktnavn</TableHead>
                    <TableHead className="text-right">Listepris</TableHead>
                    <TableHead className="text-right">Rabatt</TableHead>
                    <TableHead className="text-right">Nettopris</TableHead>
                    <TableHead>Kildefil</TableHead>
                    <TableHead>Importert</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {product.prices.map((p) => (
                    <TableRow
                      key={p.id}
                      className={p.is_cheapest ? "bg-emerald-50/60 dark:bg-emerald-950/20" : ""}
                    >
                      <TableCell className="font-medium">
                        <span className="flex items-center gap-1.5">
                          {p.supplier_name}
                          {p.is_cheapest && (
                            <Trophy className="h-3.5 w-3.5 text-emerald-600" />
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{p.supplier_sku}</TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">
                        {p.supplier_product_name || "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatPrice(p.list_price)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatPercent(p.discount_percent)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold">
                        {formatPrice(p.net_price)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono max-w-[150px] truncate">
                        {p.source_file_name || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(p.imported_at), { addSuffix: true, locale: nb })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Import history */}
        {product.importJobs.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Importhistorikk
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Leverandør</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Rader</TableHead>
                    <TableHead>Tidspunkt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {product.importJobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="text-sm">{job.supplier_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">{job.job_type}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={job.status === "success" ? "default" : job.status === "failed" ? "destructive" : "secondary"}
                          className="text-[10px]"
                        >
                          {job.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{job.rows_processed}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {job.finished_at
                          ? format(new Date(job.finished_at), "d. MMM yyyy HH:mm", { locale: nb })
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </PageContainer>
  );
}
