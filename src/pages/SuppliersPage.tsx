import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useSuppliers } from "@/hooks/useSuppliers";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import {
  Search, Loader2, Package, Wifi, WifiOff, AlertTriangle,
  CheckCircle2, Clock, ChevronRight,
} from "lucide-react";
import type { Supplier } from "@/types/product-module";

type FilterMode = "all" | "integrated" | "not_integrated" | "error" | "sync_active";

const filterLabels: Record<FilterMode, string> = {
  all: "Alle",
  integrated: "Integrert",
  not_integrated: "Ikke integrert",
  error: "Feil",
  sync_active: "Synk aktiv",
};

function ConnectionStatusBadge({ type }: { type: Supplier["integration_type"] }) {
  if (type === "manual") {
    return <Badge variant="outline" className="text-muted-foreground border-muted-foreground/30 text-[10px]">Manuell</Badge>;
  }
  return (
    <Badge variant="secondary" className="bg-primary/10 text-primary text-[10px]">
      {type.toUpperCase()}
    </Badge>
  );
}

export default function SuppliersPage() {
  const navigate = useNavigate();
  const { suppliers, loading } = useSuppliers();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");

  const filtered = useMemo(() => {
    let result = suppliers;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q));
    }

    switch (filter) {
      case "integrated":
        result = result.filter((s) => s.integration_type !== "manual");
        break;
      case "not_integrated":
        result = result.filter((s) => s.integration_type === "manual");
        break;
      case "error":
        // Will be enhanced when integration status is joined
        result = result.filter((s) => s.integration_type !== "manual");
        break;
      case "sync_active":
        result = result.filter((s) => s.integration_type !== "manual");
        break;
    }

    return result;
  }, [suppliers, search, filter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Leverandører</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Grossistregister og integrasjonskonfigurasjon
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Søk leverandør..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as FilterMode)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(filterLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Supplier grid */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">Ingen leverandører funnet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((supplier) => (
            <Card
              key={supplier.id}
              className="group cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 border-border/60"
              onClick={() => navigate(`/admin/suppliers/${supplier.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-sm text-foreground truncate">{supplier.name}</h3>
                      {supplier.is_active ? (
                        <div className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
                      ) : (
                        <div className="h-2 w-2 rounded-full bg-muted-foreground/30 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">{supplier.code}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0 mt-1" />
                </div>

                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/40">
                  <ConnectionStatusBadge type={supplier.integration_type} />
                  {supplier.integration_type !== "manual" && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Wifi className="h-3 w-3" />
                      Tilkoblet
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
