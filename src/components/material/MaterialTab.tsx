import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Plus, Package, FileText, Printer, Download, Sparkles, Copy, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
import { useMaterialList } from "@/hooks/useMaterialList";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import {
  MATERIAL_STATUS_LABELS,
  MATERIAL_STATUS_CLASS,
  MATERIAL_STATUS_ORDER,
  type MaterialListStatus,
} from "@/lib/material-status";
import { MaterialItemsTable } from "./MaterialItemsTable";
import { AddMaterialItemDialog } from "./AddMaterialItemDialog";
import { AddTemplateDialog } from "./AddTemplateDialog";
import { CopyFromJobDialog } from "./CopyFromJobDialog";
import { AiSuggestMaterialsDialog } from "./AiSuggestMaterialsDialog";
import { MaterialConsumptionSheet } from "./MaterialConsumptionSheet";
import { buildMaterialCsv, downloadCsv } from "@/lib/material-csv";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MaterialTabProps {
  jobId: string;
  jobNumber: string | null;
  customer: string;
  address: string;
  contactName?: string | null;
  contactPhone?: string | null;
  plannedAt?: Date | null;
  technicianNames?: string[];
  description?: string | null;
}

export function MaterialTab(props: MaterialTabProps) {
  const { jobId, jobNumber, customer, address, contactName, contactPhone, plannedAt, technicianNames, description } = props;
  const { activeCompany, allowedCompanyIds } = useCompanyContext();
  const companyId = activeCompany?.id ?? allowedCompanyIds[0] ?? null;
  const { list, items, loading, create, addItem, addItemsBulk, updateItem, deleteItem, updateStatus, refresh } = useMaterialList({
    jobId,
    companyId,
  });

  const [addOpen, setAddOpen] = useState(false);
  const [tplOpen, setTplOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [consumptionOpen, setConsumptionOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    try {
      setCreating(true);
      await create();
      toast.success("Materialliste opprettet");
    } catch (e) {
      toast.error("Kunne ikke opprette materialliste");
      console.error(e);
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Job info header */}
      <Card className="rounded-2xl">
        <CardContent className="p-4 sm:p-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Info label="Jobbnummer" value={jobNumber ?? "—"} />
            <Info label="Kunde" value={customer || "—"} />
            <Info label="Adresse" value={address || "—"} className="md:col-span-2" />
            <Info label="Kontakt" value={contactName ?? "—"} />
            <Info label="Telefon" value={contactPhone ?? "—"} />
            <Info label="Planlagt" value={plannedAt ? plannedAt.toLocaleString("nb-NO", { dateStyle: "short", timeStyle: "short" }) : "—"} />
            <Info label="Montør" value={(technicianNames ?? []).join(", ") || "—"} />
          </div>
          {description && (
            <p className="mt-3 text-sm text-muted-foreground line-clamp-2">{description}</p>
          )}
        </CardContent>
      </Card>

      {!list ? (
        <Card className="rounded-2xl border-dashed">
          <CardContent className="p-8 text-center space-y-4">
            <Package className="h-10 w-10 mx-auto text-muted-foreground/60" />
            <p className="text-muted-foreground">Ingen materialliste er opprettet for denne jobben ennå.</p>
            <Button onClick={handleCreate} disabled={creating || !companyId}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Opprett materialliste
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Status + actions */}
          <Card className="rounded-2xl">
            <CardContent className="p-4 flex flex-wrap items-center gap-3">
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold ${MATERIAL_STATUS_CLASS[list.status]}`}
              >
                {MATERIAL_STATUS_LABELS[list.status]}
              </span>
              <Select
                value={list.status}
                onValueChange={(v) => updateStatus(v as MaterialListStatus).then(() => toast.success("Status oppdatert"))}
              >
                <SelectTrigger className="w-[200px] h-9">
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
              <div className="ml-auto flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setCopyOpen(true)}>
                  <Copy className="h-4 w-4" /> Kopier fra jobb
                </Button>
                <Button size="sm" variant="outline" onClick={() => setTplOpen(true)}>
                  <FileText className="h-4 w-4" /> Standardpakke
                </Button>
                <Button size="sm" variant="outline" onClick={() => setAiOpen(true)}>
                  <Sparkles className="h-4 w-4" /> Foreslå med AI
                </Button>
                <Button size="sm" variant="outline" onClick={() => window.open(`/jobs/${jobId}/pickliste`, "_blank")}>
                  <Printer className="h-4 w-4" /> Skriv ut plukkliste
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const csv = buildMaterialCsv(
                      { jobNumber: jobNumber ?? "", customer, address },
                      items,
                    );
                    downloadCsv(`materialliste-${jobNumber ?? jobId}.csv`, csv);
                    toast.success("CSV eksportert");
                  }}
                  disabled={items.length === 0}
                >
                  <Download className="h-4 w-4" /> Eksport CSV
                </Button>
                <Button size="sm" variant="default" onClick={() => setConsumptionOpen(true)} disabled={items.length === 0}>
                  <ClipboardCheck className="h-4 w-4" /> Registrer forbruk
                </Button>
                <Button size="sm" onClick={() => setAddOpen(true)}>
                  <Plus className="h-4 w-4" /> Legg til vare
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Items */}
          <Card className="rounded-2xl">
            <CardContent className="p-0">
              <MaterialItemsTable
                items={items}
                onUpdate={async (id, patch) => {
                  try {
                    await updateItem(id, patch);
                  } catch (e) {
                    toast.error("Kunne ikke lagre");
                    console.error(e);
                  }
                }}
                onDelete={async (id) => {
                  if (!confirm("Slette linje?")) return;
                  try {
                    await deleteItem(id);
                    toast.success("Linje slettet");
                    await refresh();
                  } catch (e) {
                    toast.error("Kunne ikke slette");
                    console.error(e);
                  }
                }}
              />
            </CardContent>
          </Card>
        </>
      )}

      {/* Dialogs */}
      {list && (
        <>
          <AddMaterialItemDialog
            open={addOpen}
            onOpenChange={setAddOpen}
            companyId={companyId}
            onAdd={async (row) => {
              await addItem(row);
              toast.success("Vare lagt til");
            }}
          />
          <AddTemplateDialog
            open={tplOpen}
            onOpenChange={setTplOpen}
            companyId={companyId}
            onApply={async (rows) => {
              await addItemsBulk(rows);
              toast.success(`${rows.length} linjer lagt til`);
            }}
          />
          <CopyFromJobDialog
            open={copyOpen}
            onOpenChange={setCopyOpen}
            currentJobId={jobId}
            customer={customer}
            address={address}
            companyId={companyId}
            onApply={async (rows) => {
              await addItemsBulk(rows);
              toast.success(`${rows.length} linjer kopiert`);
            }}
          />
          <AiSuggestMaterialsDialog
            open={aiOpen}
            onOpenChange={setAiOpen}
            jobId={jobId}
            customer={customer}
            address={address}
            description={description ?? ""}
            onApply={async (rows) => {
              await addItemsBulk(rows);
              toast.success(`${rows.length} AI-forslag lagt til`);
            }}
          />
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
        </>
      )}
    </div>
  );
}

function Info({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
      <div className="text-sm font-medium truncate">{value}</div>
    </div>
  );
}
