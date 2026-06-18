import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Package, Plus, Printer, ExternalLink, Info } from "lucide-react";
import { toast } from "sonner";
import { useMaterialList } from "@/hooks/useMaterialList";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { MATERIAL_STATUS_LABELS, MATERIAL_STATUS_CLASS } from "@/lib/material-status";

interface Props {
  orderId: string;
  linkedEventId?: string | null;
}

/**
 * Materialliste-inngang fra bestillingsside.
 * - Hvis bestillingen er koblet til jobb (linkedEventId): viser listen knyttet til jobben.
 * - Ellers: oppretter/viser liste knyttet direkte til order_id.
 */
export function OrderMaterialSection({ orderId, linkedEventId }: Props) {
  const navigate = useNavigate();
  const { activeCompany, allowedCompanyIds } = useCompanyContext();
  const companyId = activeCompany?.id ?? allowedCompanyIds[0] ?? null;
  const hasJob = !!linkedEventId;

  const { list, items, loading, create } = useMaterialList({
    jobId: hasJob ? linkedEventId : null,
    orderId: hasJob ? null : orderId,
    companyId,
  });

  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    try {
      setCreating(true);
      await create();
      toast.success("Materialliste opprettet");
    } catch (e) {
      console.error(e);
      toast.error("Kunne ikke opprette materialliste");
    } finally {
      setCreating(false);
    }
  };

  const openList = () => {
    if (hasJob && linkedEventId) {
      navigate(`/jobs/${linkedEventId}?tab=materiell`);
    } else {
      // Stay on order page; scroll to anchor (this section is the materialliste view)
      document.getElementById("order-material-section")?.scrollIntoView({ behavior: "smooth" });
    }
  };

  const printUrl = hasJob && linkedEventId
    ? `/jobs/${linkedEventId}/pickliste`
    : `/orders/${orderId}/pickliste`;

  const totalQty = items.reduce((sum, it) => sum + (it.quantity_ordered ?? 0), 0);

  return (
    <Card id="order-material-section" className="rounded-2xl border-2 border-primary/30 bg-primary/5 scroll-mt-24 transition-shadow">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start gap-3 flex-wrap">
          <div className="flex items-center gap-2 shrink-0">
            <div className="h-9 w-9 rounded-lg bg-primary/15 flex items-center justify-center">
              <Package className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Materiell</h3>
              <p className="text-xs text-muted-foreground">
                {hasJob ? "Materialliste / plukkliste · knyttet til jobb" : "Materialliste / plukkliste · knyttet til denne bestillingen"}
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
                <Button size="sm" variant="outline" onClick={openList}>
                  <ExternalLink className="h-3.5 w-3.5" /> Åpne materialliste
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(printUrl, "_blank")}
                  disabled={items.length === 0}
                >
                  <Printer className="h-3.5 w-3.5" /> Skriv ut plukkliste
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

        {!loading && !list && (
          <p className="text-xs text-muted-foreground mt-3">
            Ingen materialliste er opprettet for denne bestillingen ennå.
            {!hasJob && (
              <>
                {" "}
                <span className="inline-flex items-center gap-1 text-muted-foreground/80">
                  <Info className="h-3 w-3" />
                  Listen kan kobles videre til jobb når oppgave/prosjekt opprettes.
                </span>
              </>
            )}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
