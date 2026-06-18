import { useState } from "react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Truck, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  COMMON_SUPPLIERS,
  DELIVERY_METHODS,
  PROCUREMENT_STATUS_CLASS,
  PROCUREMENT_STATUS_LABELS,
  type ProcurementStatus,
} from "@/lib/material-status";
import { useMaterialProcurements } from "@/hooks/useMaterialProcurements";
import type { MaterialProcurementRow } from "@/hooks/useMaterialList";

interface Props {
  materialListId: string;
  currentListStatus?: string | null;
  onListStatusChange?: (status: "bestilt" | "delvis_mottatt" | "mottatt") => Promise<void> | void;
  onLog?: (event: string, message: string, metadata?: Record<string, unknown>) => void;
}

export function MaterialProcurementsPanel({ materialListId, currentListStatus, onListStatusChange, onLog }: Props) {
  const { rows, loading, create, update, remove } = useMaterialProcurements(materialListId);
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  // Auto-sync overordnet status basert på bestillinger
  const syncListStatus = async (next: MaterialProcurementRow[]) => {
    if (!onListStatusChange || next.length === 0) return;
    const allReceived = next.every((p) => p.status === "received" || p.status === "cancelled");
    const anyReceived = next.some((p) => p.status === "received" || p.status === "partially_received");
    const anyOrdered = next.some(
      (p) => p.status === "ordered" || p.status === "partially_received" || p.status === "received",
    );
    const blockedStatuses = ["plukket", "med_montor", "levert_jobb", "forbruk_registrert", "ferdig"];
    if (currentListStatus && blockedStatuses.includes(currentListStatus)) return;

    if (allReceived && anyReceived) await onListStatusChange("mottatt");
    else if (anyReceived) await onListStatusChange("delvis_mottatt");
    else if (anyOrdered) await onListStatusChange("bestilt");
  };

  const handleAdd = async () => {
    if (adding) return;
    setAdding(true);
    try {
      const r = await create({ supplier: "Onninen", status: "planned" });
      setEditing(r.id);
      onLog?.("procurement_created", `La til bestilling hos ${r.supplier ?? "leverandør"}`);
    } catch (e) {
      console.error(e);
      toast.error("Kunne ikke legge til bestilling");
    } finally {
      setAdding(false);
    }
  };

  return (
    <Card className="rounded-xl">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Truck className="h-4 w-4 text-primary" /> Bestilling og mottak
            </h4>
            <p className="text-xs text-muted-foreground">
              Registrer hver bestilling/leveranse. Du kan legge inn flere — for eksempel én hos Onninen og én hos MCS
              Elektrotavler.
            </p>
          </div>
          <Button size="sm" onClick={handleAdd} disabled={adding}>
            <Plus className="h-3.5 w-3.5" /> Ny bestilling
          </Button>
        </div>

        {loading && rows.length === 0 && <p className="text-xs text-muted-foreground">Laster…</p>}
        {!loading && rows.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Ingen bestillinger registrert ennå.
          </p>
        )}

        <div className="space-y-2">
          {rows.map((p) => (
            <ProcurementRow
              key={p.id}
              row={p}
              busy={busyId === p.id}
              editing={editing === p.id}
              onEdit={() => setEditing(editing === p.id ? null : p.id)}
              onUpdate={async (patch) => {
                if (busyId) return;
                setBusyId(p.id);
                try {
                  await update(p.id, patch);
                  onLog?.(
                    "procurement_updated",
                    `Oppdaterte bestilling (${patch.supplier ?? p.supplier ?? "leverandør"})`,
                    patch,
                  );
                  const next = rows.map((r) => (r.id === p.id ? { ...r, ...patch } : r));
                  await syncListStatus(next);
                } catch (e) {
                  console.error(e);
                  toast.error("Kunne ikke lagre");
                  throw e;
                } finally {
                  setBusyId(null);
                }
              }}
              onReceive={async () => {
                if (busyId) return;
                setBusyId(p.id);
                try {
                  const { data: userRes } = await supabase.auth.getUser();
                  const patch: Partial<MaterialProcurementRow> = {
                    status: "received",
                    received_at: new Date().toISOString(),
                    received_by: userRes.user?.id ?? null,
                  };
                  await update(p.id, patch);
                  toast.success("Mottak registrert");
                  onLog?.("procurement_received", `Mottak registrert (${p.supplier ?? "leverandør"})`);
                  const next = rows.map((r) => (r.id === p.id ? { ...r, ...patch } : r));
                  await syncListStatus(next);
                } catch (e) {
                  console.error(e);
                  toast.error("Kunne ikke registrere mottak");
                } finally {
                  setBusyId(null);
                }
              }}
              onRemove={async () => {
                if (busyId) return;
                if (!confirm("Slette denne bestillingen?")) return;
                setBusyId(p.id);
                try {
                  await remove(p.id);
                  onLog?.("procurement_deleted", `Slettet bestilling (${p.supplier ?? "leverandør"})`);
                } catch (e) {
                  console.error(e);
                  toast.error("Kunne ikke slette");
                } finally {
                  setBusyId(null);
                }
              }}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ProcurementRow({
  row,
  busy,
  editing,
  onEdit,
  onUpdate,
  onReceive,
  onRemove,
}: {
  row: MaterialProcurementRow;
  busy: boolean;
  editing: boolean;
  onEdit: () => void;
  onUpdate: (patch: Partial<MaterialProcurementRow>) => Promise<void>;
  onReceive: () => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const [local, setLocal] = useState<Partial<MaterialProcurementRow>>({});
  const value = { ...row, ...local };

  const save = async () => {
    try {
      await onUpdate(local);
      setLocal({});
      onEdit();
    } catch {
      /* feil håndtert i onUpdate */
    }
  };

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center gap-2 px-3 py-2 flex-wrap">
        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${PROCUREMENT_STATUS_CLASS[row.status]}`}>
          {PROCUREMENT_STATUS_LABELS[row.status]}
        </span>
        <span className="text-sm font-medium">{row.supplier ?? "Ukjent leverandør"}</span>
        {row.supplier_order_number && (
          <span className="text-xs text-muted-foreground">#{row.supplier_order_number}</span>
        )}
        {row.expected_delivery_at && (
          <span className="text-xs text-muted-foreground">
            • Forventet {new Date(row.expected_delivery_at).toLocaleDateString("nb-NO")}
          </span>
        )}
        {row.received_at && (
          <span className="text-xs text-emerald-700 dark:text-emerald-400">
            • Mottatt {new Date(row.received_at).toLocaleDateString("nb-NO")}
          </span>
        )}
        <div className="ml-auto flex gap-1">
          {row.status !== "received" && row.status !== "cancelled" && (
            <Button size="sm" variant="outline" onClick={onReceive} disabled={busy}>
              <CheckCircle2 className="h-3.5 w-3.5" /> {busy ? "Lagrer…" : "Registrer mottak"}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onEdit} disabled={busy}>
            {editing ? "Lukk" : "Rediger"}
          </Button>
          <Button size="sm" variant="ghost" onClick={onRemove} disabled={busy}>
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      </div>

      {editing && (
        <div className="p-3 pt-1 grid grid-cols-1 md:grid-cols-2 gap-3 border-t">
          <Field label="Bestilt hos">
            <Select
              value={value.supplier ?? ""}
              onValueChange={(v) => setLocal((s) => ({ ...s, supplier: v }))}
            >
              <SelectTrigger><SelectValue placeholder="Velg leverandør" /></SelectTrigger>
              <SelectContent>
                {COMMON_SUPPLIERS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Ordrenummer / referanse">
            <Input
              value={value.supplier_order_number ?? ""}
              onChange={(e) => setLocal((s) => ({ ...s, supplier_order_number: e.target.value }))}
            />
          </Field>
          <Field label="Bestilt dato">
            <Input
              type="date"
              value={toDateInput(value.ordered_at)}
              onChange={(e) =>
                setLocal((s) => ({ ...s, ordered_at: e.target.value ? new Date(e.target.value).toISOString() : null }))
              }
            />
          </Field>
          <Field label="Forventet levering">
            <Input
              type="date"
              value={toDateInput(value.expected_delivery_at)}
              onChange={(e) =>
                setLocal((s) => ({
                  ...s,
                  expected_delivery_at: e.target.value ? new Date(e.target.value).toISOString() : null,
                }))
              }
            />
          </Field>
          <Field label="Leveringsmåte">
            <Select
              value={value.delivery_method ?? ""}
              onValueChange={(v) => setLocal((s) => ({ ...s, delivery_method: v }))}
            >
              <SelectTrigger><SelectValue placeholder="Velg" /></SelectTrigger>
              <SelectContent>
                {DELIVERY_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Leveringssted">
            <Input
              value={value.delivery_location ?? ""}
              placeholder="MCS lager, jobbadresse, montør…"
              onChange={(e) => setLocal((s) => ({ ...s, delivery_location: e.target.value }))}
            />
          </Field>
          <Field label="Status">
            <Select
              value={value.status}
              onValueChange={(v) => setLocal((s) => ({ ...s, status: v as ProcurementStatus }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(PROCUREMENT_STATUS_LABELS) as ProcurementStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{PROCUREMENT_STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Mottatt dato">
            <Input
              type="date"
              value={toDateInput(value.received_at)}
              onChange={(e) =>
                setLocal((s) => ({ ...s, received_at: e.target.value ? new Date(e.target.value).toISOString() : null }))
              }
            />
          </Field>
          <div className="md:col-span-2">
            <Field label="Kommentar">
              <Textarea
                rows={2}
                value={value.comment ?? ""}
                onChange={(e) => setLocal((s) => ({ ...s, comment: e.target.value }))}
              />
            </Field>
          </div>
          <div className="md:col-span-2 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setLocal({}); onEdit(); }}>Avbryt</Button>
            <Button size="sm" onClick={save} disabled={Object.keys(local).length === 0}>Lagre</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function toDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}
