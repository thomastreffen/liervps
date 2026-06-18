import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Inbox, Check, X, Edit3, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useMaterialSuggestions, type MaterialSuggestionRow } from "@/hooks/useMaterialSuggestions";
import { MATERIAL_PROVIDED_BY_LABELS, type MaterialProvidedBy } from "@/lib/material-status";
import type { MaterialItemRow } from "@/hooks/useMaterialList";

interface Props {
  materialListId: string;
  onApprove: (row: Partial<MaterialItemRow> & { description: string }) => Promise<void>;
  onLog?: (event: string, message: string, metadata?: Record<string, unknown>) => void;
}

export function MaterialSuggestionsPanel({ materialListId, onApprove, onLog }: Props) {
  const { rows, loading, pendingCount, updateStatus } = useMaterialSuggestions(materialListId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (rows.length === 0 && !loading) return null;

  return (
    <Card className="rounded-xl">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Inbox className="h-4 w-4 text-primary" />
          <div className="flex-1">
            <h4 className="text-sm font-semibold">Forslag fra bestiller</h4>
            <p className="text-xs text-muted-foreground">
              {pendingCount > 0
                ? `${pendingCount} ventende forslag — godkjenn eller avvis.`
                : "Ingen ventende forslag."}
            </p>
          </div>
          {pendingCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-300">
              {pendingCount} ventende
            </span>
          )}
        </div>

        <div className="space-y-2">
          {rows.map((r) => (
            <SuggestionRow
              key={r.id}
              row={r}
              editing={editingId === r.id}
              busy={busyId === r.id}
              onToggleEdit={() => setEditingId(editingId === r.id ? null : r.id)}
              onApprove={async (override) => {
                if (busyId) return;
                setBusyId(r.id);
                try {
                  await onApprove({
                    description: (override?.description ?? r.description ?? r.elnr ?? "").trim() || "—",
                    elnr: (override?.elnr ?? r.elnr) || null,
                    quantity_ordered: override?.quantity_ordered ?? r.quantity,
                    unit: override?.unit ?? r.unit ?? "stk",
                    provided_by: ((override?.provided_by ?? r.provided_by) || null) as MaterialProvidedBy | null,
                    comment: override?.comment ?? r.comment ?? null,
                    source: "external_suggestion",
                  });
                  await updateStatus(r.id, "approved");
                  toast.success("Forslag godkjent");
                  onLog?.(
                    "suggestion_approved",
                    `Godkjente forslag fra ${r.suggested_by_name ?? "bestiller"}: ${r.description ?? r.elnr ?? "—"}`,
                  );
                  setEditingId(null);
                } catch (e) {
                  console.error(e);
                  toast.error("Kunne ikke godkjenne forslaget");
                } finally {
                  setBusyId(null);
                }
              }}
              onReject={async () => {
                if (busyId) return;
                setBusyId(r.id);
                try {
                  await updateStatus(r.id, "rejected");
                  toast.success("Forslag avvist");
                  onLog?.(
                    "suggestion_rejected",
                    `Avviste forslag fra ${r.suggested_by_name ?? "bestiller"}: ${r.description ?? r.elnr ?? "—"}`,
                  );
                } catch (e) {
                  console.error(e);
                  toast.error("Kunne ikke avvise");
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

function SuggestionRow({
  row,
  editing,
  busy,
  onToggleEdit,
  onApprove,
  onReject,
}: {
  row: MaterialSuggestionRow;
  editing: boolean;
  busy: boolean;
  onToggleEdit: () => void;
  onApprove: (override?: Partial<MaterialItemRow>) => Promise<void>;
  onReject: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<Partial<MaterialItemRow>>({
    description: row.description ?? "",
    elnr: row.elnr ?? "",
    quantity_ordered: row.quantity,
    unit: row.unit,
    provided_by: row.provided_by as MaterialProvidedBy | null,
    comment: row.comment ?? "",
  });

  const statusClass =
    row.status === "approved"
      ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-300"
      : row.status === "rejected"
        ? "bg-rose-100 text-rose-900 dark:bg-rose-500/20 dark:text-rose-300"
        : "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-300";
  const statusLabel = row.status === "approved" ? "Godkjent" : row.status === "rejected" ? "Avvist" : "Ventende";

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center gap-2 px-3 py-2 flex-wrap">
        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusClass}`}>{statusLabel}</span>
        <span className="text-sm font-medium">{row.description || row.elnr || "—"}</span>
        {row.elnr && row.description && (
          <span className="text-xs text-muted-foreground">{row.elnr}</span>
        )}
        <span className="text-xs text-muted-foreground">
          • {row.quantity} {row.unit}
        </span>
        {row.provided_by && (
          <span className="text-xs text-muted-foreground">
            • Leveres av {MATERIAL_PROVIDED_BY_LABELS[row.provided_by as MaterialProvidedBy] ?? row.provided_by}
          </span>
        )}
        <span className="text-xs text-muted-foreground ml-auto">
          {row.suggested_by_name ?? "Bestiller"}
          {row.suggested_by_email ? ` · ${row.suggested_by_email}` : ""}
        </span>
      </div>

      {row.comment && <div className="px-3 pb-2 text-xs text-muted-foreground italic">"{row.comment}"</div>}

      {row.status === "pending" && (
        <div className="border-t px-3 py-2 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => onApprove()} disabled={busy}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Godkjenn
          </Button>
          <Button size="sm" variant="outline" onClick={onToggleEdit} disabled={busy}>
            <Edit3 className="h-3.5 w-3.5" /> {editing ? "Lukk" : "Rediger og godkjenn"}
          </Button>
          <Button size="sm" variant="ghost" onClick={onReject} disabled={busy} className="text-destructive ml-auto">
            <X className="h-3.5 w-3.5" /> Avvis
          </Button>
        </div>
      )}

      {editing && (
        <div className="border-t p-3 grid grid-cols-1 md:grid-cols-2 gap-2">
          <Input
            placeholder="Elnr"
            value={String(draft.elnr ?? "")}
            onChange={(e) => setDraft({ ...draft, elnr: e.target.value })}
          />
          <Input
            placeholder="Beskrivelse"
            value={String(draft.description ?? "")}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />
          <Input
            inputMode="decimal"
            placeholder="Antall"
            value={String(draft.quantity_ordered ?? "")}
            onChange={(e) =>
              setDraft({ ...draft, quantity_ordered: parseFloat(e.target.value.replace(",", ".")) || 0 })
            }
          />
          <Input
            placeholder="Enhet"
            value={String(draft.unit ?? "stk")}
            onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
          />
          <Textarea
            rows={2}
            className="md:col-span-2"
            placeholder="Kommentar"
            value={String(draft.comment ?? "")}
            onChange={(e) => setDraft({ ...draft, comment: e.target.value })}
          />
          <div className="md:col-span-2 flex justify-end">
            <Button size="sm" onClick={() => onApprove(draft)} disabled={busy}>
              <Check className="h-3.5 w-3.5" /> Lagre og godkjenn
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
