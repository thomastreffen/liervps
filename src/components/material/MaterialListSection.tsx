import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Loader2,
  Plus,
  Package,
  Printer,
  Download,
  Sparkles,
  FileText,
  Copy,
  ClipboardCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useMaterialList, type MaterialItemRow } from "@/hooks/useMaterialList";
import {
  MATERIAL_STATUS_LABELS,
  MATERIAL_STATUS_CLASS,
  MATERIAL_STATUS_ORDER,
  type MaterialListStatus,
} from "@/lib/material-status";
import { InlineMaterialEditor } from "./InlineMaterialEditor";
import { InlineAiSuggestPanel } from "./InlineAiSuggestPanel";
import { AddTemplateDialog } from "./AddTemplateDialog";
import { CopyFromJobDialog } from "./CopyFromJobDialog";
import { MaterialConsumptionSheet } from "./MaterialConsumptionSheet";
import { MaterialProcurementsPanel } from "./MaterialProcurementsPanel";
import { MaterialPickPanel } from "./MaterialPickPanel";
import { MaterialActivityPanel } from "./MaterialActivityPanel";
import { useMaterialActivityLog } from "@/hooks/useMaterialProcurements";
import { buildMaterialCsv, downloadCsv } from "@/lib/material-csv";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  jobId?: string | null;
  orderId?: string | null;
  companyId: string | null;
  meta: {
    jobNumber: string | null;
    customer: string;
    address: string;
    description?: string | null;
  };
  showStatusSelector?: boolean;
  showCopyFromJob?: boolean;
  variant?: "card" | "bare";
}

/**
 * Felles materiallistekomponent for både /orders/:id og /jobs/:id.
 * Inline-redigering, AI-panel og standardpakke uten tunge modaler for hovedflyt.
 */
export function MaterialListSection({
  jobId,
  orderId,
  companyId,
  meta,
  showStatusSelector = true,
  showCopyFromJob = true,
  variant = "card",
}: Props) {
  const { list, items, loading, create, addItem, addItemsBulk, updateItem, deleteItem, updateList, updateStatus, refresh } =
    useMaterialList({ jobId: jobId ?? null, orderId: orderId ?? null, companyId });
  const { log } = useMaterialActivityLog(list?.id ?? null);

  const [creating, setCreating] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [tplOpen, setTplOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [consumptionOpen, setConsumptionOpen] = useState(false);

  const printUrl = jobId ? `/jobs/${jobId}/pickliste` : `/orders/${orderId}/pickliste`;
  const hasItems = items.length > 0;

  const handleCreate = async () => {
    if (!companyId) return;
    setCreating(true);
    try {
      await create();
      toast.success("Materialliste opprettet");
    } catch (e) {
      console.error(e);
      toast.error("Kunne ikke opprette materialliste");
    } finally {
      setCreating(false);
    }
  };

  const body = (
    <CardContent className="p-0 sm:p-0">
      <div className="p-4 sm:p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start gap-3 flex-wrap">
          <div className="flex items-center gap-2 shrink-0">
            <div className="h-9 w-9 rounded-lg bg-primary/15 flex items-center justify-center">
              <Package className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Materiell</h3>
              <p className="text-xs text-muted-foreground">
                Materialliste / plukkliste {jobId ? "knyttet til jobb" : "knyttet til bestillingen"}
              </p>
            </div>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : list ? (
              <>
                {showStatusSelector ? (
                  <Select
                    value={list.status}
                    onValueChange={(v) =>
                      updateStatus(v as MaterialListStatus).then(() => toast.success("Status oppdatert"))
                    }
                  >
                    <SelectTrigger className="w-[180px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MATERIAL_STATUS_ORDER.map((s) => (
                        <SelectItem key={s} value={s}>
                          {MATERIAL_STATUS_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${MATERIAL_STATUS_CLASS[list.status]}`}
                  >
                    {MATERIAL_STATUS_LABELS[list.status]}
                  </span>
                )}
                <Button size="sm" variant="outline" onClick={() => setAiOpen((o) => !o)}>
                  <Sparkles className="h-3.5 w-3.5" /> Foreslå med AI
                </Button>
                <Button size="sm" variant="outline" onClick={() => setTplOpen(true)}>
                  <FileText className="h-3.5 w-3.5" /> Standardpakke
                </Button>
                {showCopyFromJob && jobId && (
                  <Button size="sm" variant="outline" onClick={() => setCopyOpen(true)}>
                    <Copy className="h-3.5 w-3.5" /> Kopier fra jobb
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(printUrl, "_blank")}
                  disabled={!hasItems}
                  title={!hasItems ? "Legg til minst én vare først." : undefined}
                >
                  <Printer className="h-3.5 w-3.5" /> Plukkliste
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const csv = buildMaterialCsv(
                      { jobNumber: meta.jobNumber ?? "", customer: meta.customer, address: meta.address },
                      items,
                    );
                    downloadCsv(`materialliste-${meta.jobNumber ?? jobId ?? orderId}.csv`, csv);
                    toast.success("CSV eksportert");
                  }}
                  disabled={!hasItems}
                >
                  <Download className="h-3.5 w-3.5" /> CSV
                </Button>
                {jobId && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => setConsumptionOpen(true)}
                    disabled={!hasItems}
                  >
                    <ClipboardCheck className="h-3.5 w-3.5" /> Registrer forbruk
                  </Button>
                )}
              </>
            ) : (
              <Button size="sm" onClick={handleCreate} disabled={creating || !companyId}>
                {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Opprett materialliste
              </Button>
            )}
          </div>
        </div>

        {!loading && !list && (
          <p className="text-xs text-muted-foreground">
            Ingen materialliste opprettet ennå. Klikk "Opprett materialliste" for å starte registrering.
          </p>
        )}

        {/* AI inline panel */}
        {list && aiOpen && (
          <InlineAiSuggestPanel
            jobId={jobId ?? null}
            orderId={orderId ?? null}
            customer={meta.customer}
            address={meta.address}
            description={meta.description ?? ""}
            onApply={async (rows) => {
              await addItemsBulk(rows);
            }}
            onClose={() => setAiOpen(false)}
          />
        )}

        {/* Inline editor */}
        {list && (
          <div className="rounded-xl border bg-card overflow-hidden">
            <InlineMaterialEditor
              items={items}
              companyId={companyId}
              onUpdate={async (id, patch) => {
                try {
                  await updateItem(id, patch);
                } catch (e) {
                  console.error(e);
                  toast.error("Kunne ikke lagre");
                  throw e;
                }
              }}
              onDelete={async (id) => {
                try {
                  await deleteItem(id);
                  toast.success("Linje slettet");
                  await refresh();
                  log("item_deleted", "Slettet linje fra materialliste");
                } catch (e) {
                  console.error(e);
                  toast.error("Kunne ikke slette");
                }
              }}
              onAdd={async (row) => {
                await addItem(row as Partial<MaterialItemRow> & { description: string });
                log("item_added", `La til linje: ${row.description ?? row.elnr ?? ""}`.trim());
              }}
            />
          </div>
        )}

        {/* Bestilling og mottak */}
        {list && (
          <MaterialProcurementsPanel
            materialListId={list.id}
            currentListStatus={list.status}
            onListStatusChange={async (next) => {
              if (list.status !== next) {
                try {
                  await updateStatus(next);
                } catch (e) {
                  console.error(e);
                }
              }
            }}
            onLog={(e, m, md) => log(e, m, md)}
          />
        )}

        {/* Plukk og levering */}
        {list && (
          <MaterialPickPanel
            list={list}
            onUpdateList={updateList}
            onLog={(e, m, md) => log(e, m, md)}
          />
        )}

        {/* Aktivitetslogg */}
        {list && <MaterialActivityPanel materialListId={list.id} />}
      </div>

      {/* Dialogs som beholdes (drawer/sekundære flyter) */}
      {list && (
        <>
          <AddTemplateDialog
            open={tplOpen}
            onOpenChange={setTplOpen}
            companyId={companyId}
            onApply={async (rows) => {
              await addItemsBulk(rows);
              toast.success(`${rows.length} linjer lagt til`);
            }}
          />
          {jobId && showCopyFromJob && (
            <CopyFromJobDialog
              open={copyOpen}
              onOpenChange={setCopyOpen}
              currentJobId={jobId}
              customer={meta.customer}
              address={meta.address}
              companyId={companyId}
              onApply={async (rows) => {
                await addItemsBulk(rows);
                toast.success(`${rows.length} linjer kopiert`);
              }}
            />
          )}
          {jobId && (
            <MaterialConsumptionSheet
              open={consumptionOpen}
              onOpenChange={setConsumptionOpen}
              items={items}
              onUpdate={updateItem}
              onAddExtra={async (row) => {
                await addItem({ ...row, source: "added_after" });
              }}
              onComplete={async () => {
                await updateStatus("forbruk_registrert");
                toast.success("Forbruk registrert");
                setConsumptionOpen(false);
              }}
            />
          )}
        </>
      )}
    </CardContent>
  );

  if (variant === "bare") return <div>{body}</div>;

  return (
    <Card
      id="order-material-section"
      className="rounded-2xl border-2 border-primary/30 bg-primary/5 scroll-mt-24"
    >
      {body}
    </Card>
  );
}
