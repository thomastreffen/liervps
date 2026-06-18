import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Package, Plus, Printer, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useMaterialList } from "@/hooks/useMaterialList";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { MATERIAL_STATUS_LABELS, MATERIAL_STATUS_CLASS } from "@/lib/material-status";
import { MaterialItemsTable } from "@/components/material/MaterialItemsTable";
import { AddMaterialItemDialog } from "@/components/material/AddMaterialItemDialog";

interface Props {
  orderId: string;
  linkedEventId?: string | null;
}

/**
 * Materialliste-inngang fra bestillingsside.
 * - Knyttet til jobb hvis linkedEventId, ellers direkte til order_id.
 * - Inline editor: tabell + "Legg til vare" rett under kortet.
 */
export function OrderMaterialSection({ orderId, linkedEventId }: Props) {
  const navigate = useNavigate();
  const { activeCompany, allowedCompanyIds } = useCompanyContext();
  const companyId = activeCompany?.id ?? allowedCompanyIds[0] ?? null;
  const hasJob = !!linkedEventId;

  const { list, items, loading, create, addItem, updateItem, deleteItem, refresh } =
    useMaterialList({
      jobId: hasJob ? linkedEventId : null,
      orderId: hasJob ? null : orderId,
      companyId,
    });

  const [creating, setCreating] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const handleCreate = async () => {
    try {
      setCreating(true);
      const newList = await create();
      toast.success("Materialliste opprettet");
      setExpanded(true);
      // Åpne "Legg til vare" umiddelbart for å la bruker legge inn første linje
      setTimeout(() => setAddOpen(true), 150);
      void newList;
    } catch (e) {
      console.error(e);
      toast.error("Kunne ikke opprette materialliste");
    } finally {
      setCreating(false);
    }
  };

  const printUrl =
    hasJob && linkedEventId ? `/jobs/${linkedEventId}/pickliste` : `/orders/${orderId}/pickliste`;

  const totalQty = items.reduce((sum, it) => sum + (it.quantity_ordered ?? 0), 0);
  const hasItems = items.length > 0;

  return (
    <Card
      id="order-material-section"
      className="rounded-2xl border-2 border-primary/30 bg-primary/5 scroll-mt-24 transition-shadow"
    >
      <CardContent className="p-4 sm:p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start gap-3 flex-wrap">
          <div className="flex items-center gap-2 shrink-0">
            <div className="h-9 w-9 rounded-lg bg-primary/15 flex items-center justify-center">
              <Package className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Materiell</h3>
              <p className="text-xs text-muted-foreground">
                {hasJob
                  ? "Materialliste / plukkliste · knyttet til jobb"
                  : "Materialliste / plukkliste · knyttet til denne bestillingen"}
              </p>
            </div>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : list ? (
              <>
                <span
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${MATERIAL_STATUS_CLASS[list.status]}`}
                >
                  {MATERIAL_STATUS_LABELS[list.status]}
                </span>
                <span className="text-xs text-muted-foreground">
                  {items.length} linjer · {totalQty} stk planlagt
                </span>
                {hasJob && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/jobs/${linkedEventId}?tab=materiell`)}
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Åpne i jobb
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(printUrl, "_blank")}
                  disabled={!hasItems}
                  title={
                    !hasItems ? "Legg til minst én vare før plukkliste kan skrives ut." : undefined
                  }
                >
                  <Printer className="h-3.5 w-3.5" /> Skriv ut plukkliste
                </Button>
                <Button size="sm" onClick={() => setAddOpen(true)}>
                  <Plus className="h-3.5 w-3.5" /> Legg til vare
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={handleCreate} disabled={creating || !companyId}>
                {creating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                Opprett materialliste
              </Button>
            )}
          </div>
        </div>

        {/* Tomtilstand uten liste */}
        {!loading && !list && (
          <p className="text-xs text-muted-foreground">
            Ingen materialliste opprettet ennå. Klikk "Opprett materialliste" for å starte
            plukklisten for denne bestillingen.
          </p>
        )}

        {/* Inline editor */}
        {!loading && list && expanded && (
          <div className="rounded-xl border bg-card overflow-hidden">
            {hasItems ? (
              <MaterialItemsTable
                items={items}
                onUpdate={async (id, patch) => {
                  try {
                    await updateItem(id, patch);
                  } catch (e) {
                    console.error(e);
                    toast.error("Kunne ikke lagre");
                  }
                }}
                onDelete={async (id) => {
                  if (!confirm("Slette linje?")) return;
                  try {
                    await deleteItem(id);
                    toast.success("Linje slettet");
                    await refresh();
                  } catch (e) {
                    console.error(e);
                    toast.error("Kunne ikke slette");
                  }
                }}
              />
            ) : (
              <div className="p-8 text-center space-y-3">
                <Package className="h-8 w-8 mx-auto text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">Ingen varer lagt til ennå.</p>
                <Button size="sm" onClick={() => setAddOpen(true)}>
                  <Plus className="h-3.5 w-3.5" /> Legg til vare
                </Button>
              </div>
            )}
          </div>
        )}

        {list && (
          <AddMaterialItemDialog
            open={addOpen}
            onOpenChange={setAddOpen}
            companyId={companyId}
            onAdd={async (row) => {
              await addItem(row);
              toast.success("Vare lagt til");
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}
