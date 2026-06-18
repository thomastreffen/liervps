import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { MaterialItemRow } from "@/hooks/useMaterialList";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  currentJobId: string;
  customer: string;
  address: string;
  companyId: string | null;
  onApply: (rows: Array<Partial<MaterialItemRow> & { description: string }>) => Promise<void>;
}

interface CandidateJob {
  id: string;
  job_number: string | null;
  title: string;
  customer: string | null;
  address: string | null;
  start_time: string;
  material_list_id: string;
}

export function CopyFromJobDialog({ open, onOpenChange, currentJobId, customer, address, companyId, onApply }: Props) {
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<CandidateJob[]>([]);
  const [pickedListId, setPickedListId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !companyId) return;
    setLoading(true);
    setPickedListId(null);
    (async () => {
      // find material_lists for events matching customer or address (same company)
      const { data: lists } = await supabase
        .from("material_lists")
        .select("id, job_id, events:job_id(id, job_number, title, customer, address, start_time)")
        .eq("company_id", companyId)
        .not("job_id", "is", null)
        .neq("job_id", currentJobId)
        .order("created_at", { ascending: false })
        .limit(50);

      const c: CandidateJob[] = [];
      for (const l of (lists ?? []) as Array<{ id: string; job_id: string | null; events: { id: string; job_number: string | null; title: string; customer: string | null; address: string | null; start_time: string } | null }>) {
        const ev = l.events;
        if (!ev) continue;
        const cust = (ev.customer ?? "").toString().toLowerCase();
        const addr = (ev.address ?? "").toString().toLowerCase();
        if (
          (customer && cust.includes(customer.toLowerCase())) ||
          (address && addr.includes(address.toLowerCase()))
        ) {
          c.push({
            id: ev.id,
            job_number: ev.job_number,
            title: ev.title,
            customer: ev.customer,
            address: ev.address,
            start_time: ev.start_time,
            material_list_id: l.id,
          });
        }
      }
      setCandidates(c);
      setLoading(false);
    })();
  }, [open, companyId, currentJobId, customer, address]);

  const apply = async () => {
    if (!pickedListId) return;
    setSaving(true);
    try {
      const { data: items } = await supabase
        .from("material_list_items")
        .select("elnr, description, quantity_ordered, unit, supplier, comment")
        .eq("material_list_id", pickedListId);
      const rows = (items ?? []).map((it) => ({
        elnr: it.elnr,
        description: it.description,
        quantity_ordered: it.quantity_ordered,
        unit: it.unit,
        supplier: it.supplier,
        comment: it.comment,
        source: "copied" as const,
      }));
      await onApply(rows);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Kopier materialliste fra tidligere jobb</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center p-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            Fant ingen tidligere materiallister for samme kunde eller adresse.
          </p>
        ) : (
          <div className="border rounded-md max-h-64 overflow-auto">
            {candidates.map((c) => (
              <button
                key={c.material_list_id}
                type="button"
                onClick={() => setPickedListId(c.material_list_id)}
                className={`block w-full text-left px-3 py-2 text-sm border-b last:border-0 hover:bg-accent ${pickedListId === c.material_list_id ? "bg-accent" : ""}`}
              >
                <div className="font-medium">{c.job_number ?? "—"} · {c.title}</div>
                <div className="text-xs text-muted-foreground">
                  {c.customer ?? "—"} · {c.address ?? "—"} · {new Date(c.start_time).toLocaleDateString("nb-NO")}
                </div>
              </button>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Avbryt</Button>
          <Button onClick={apply} disabled={!pickedListId || saving}>Kopier liste</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
