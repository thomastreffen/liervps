import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Package, Plus, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  MATERIAL_STATUS_CLASS,
  MATERIAL_STATUS_LABELS,
  MATERIAL_PROVIDED_BY_LABELS,
  type MaterialListStatus,
  type MaterialProvidedBy,
} from "@/lib/material-status";

interface SharedData {
  list: {
    status: MaterialListStatus;
    crate_location: string | null;
    ordered_at: string | null;
    received_at: string | null;
    picked_at: string | null;
    dispatched_at: string | null;
    delivered_to_job_at: string | null;
    completed_at: string | null;
  };
  job: {
    title: string | null;
    job_number: string | null;
    customer: string | null;
    address: string | null;
  };
  items: Array<{
    id: string;
    elnr: string | null;
    description: string;
    quantity_ordered: number;
    quantity_picked: number;
    quantity_received: number;
    unit: string;
    provided_by: string | null;
    comment: string | null;
  }>;
  procurements: Array<{
    supplier: string | null;
    supplier_order_number: string | null;
    expected_delivery_at: string | null;
    received_at: string | null;
    status: string;
  }>;
}

export default function SharedMaterialListPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<SharedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // suggestion form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [elnr, setElnr] = useState("");
  const [desc, setDesc] = useState("");
  const [qty, setQty] = useState("1");
  const [unit, setUnit] = useState("stk");
  const [providedBy, setProvidedBy] = useState<string>("");
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [sentList, setSentList] = useState<string[]>([]);

  const refresh = async () => {
    if (!token) return;
    const { data: res, error } = await supabase.rpc("get_shared_material_list" as never, { p_token: token } as never);
    if (error || !res) {
      setNotFound(true);
    } else {
      setData(res as unknown as SharedData);
    }
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const submit = async () => {
    if (!token || sending) return;
    const q = parseFloat(qty.replace(",", ".")) || 0;
    if (q <= 0) {
      toast.error("Antall må være større enn 0");
      return;
    }
    if (!elnr.trim() && !desc.trim()) {
      toast.error("Fyll inn enten elnr eller beskrivelse");
      return;
    }
    setSending(true);
    try {
      const { error } = await supabase.rpc("create_material_suggestion" as never, {
        p_token: token,
        p_name: name.trim(),
        p_email: email.trim(),
        p_elnr: elnr.trim(),
        p_description: desc.trim(),
        p_quantity: q,
        p_unit: unit.trim() || "stk",
        p_provided_by: providedBy,
        p_comment: comment.trim(),
      } as never);
      if (error) throw error;
      const label = desc.trim() || elnr.trim();
      setSentList((s) => [label, ...s]);
      setElnr("");
      setDesc("");
      setQty("1");
      setUnit("stk");
      setProvidedBy("");
      setComment("");
      toast.success("Forslag sendt");
    } catch (e) {
      console.error(e);
      toast.error("Kunne ikke sende forslaget. Prøv igjen.");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-2">
          <h1 className="text-xl font-semibold">Lenken er ikke gyldig</h1>
          <p className="text-sm text-muted-foreground">
            Delingen kan ha blitt deaktivert. Ta kontakt med Lier VPS for ny lenke.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-card border-b">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center">
            <Package className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold truncate">{data.job.title || "Materialliste"}</h1>
            <p className="text-xs text-muted-foreground truncate">
              {data.job.job_number ? `${data.job.job_number} · ` : ""}
              {data.job.customer ?? ""}
              {data.job.address ? ` · ${data.job.address}` : ""}
            </p>
          </div>
          <span
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap ${MATERIAL_STATUS_CLASS[data.list.status]}`}
          >
            {MATERIAL_STATUS_LABELS[data.list.status]}
          </span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 space-y-4">
        {/* Statusoversikt */}
        <Card className="rounded-xl">
          <CardContent className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <Stat label="Bestilt" value={fmtDate(data.list.ordered_at)} />
            <Stat label="Mottatt" value={fmtDate(data.list.received_at)} />
            <Stat label="Plukket" value={fmtDate(data.list.picked_at)} />
            <Stat label="Levert" value={fmtDate(data.list.delivered_to_job_at)} />
          </CardContent>
        </Card>

        {/* Materialliste */}
        <Card className="rounded-xl">
          <CardContent className="p-4 space-y-3">
            <h2 className="text-sm font-semibold">Materiell ({data.items.length})</h2>
            {data.items.length === 0 ? (
              <p className="text-xs text-muted-foreground">Ingen materiell registrert ennå.</p>
            ) : (
              <div className="divide-y divide-border/40">
                {data.items.map((it) => (
                  <div key={it.id} className="py-2 flex items-start gap-3 text-sm">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{it.description}</div>
                      <div className="text-xs text-muted-foreground">
                        {it.elnr ? `${it.elnr} · ` : ""}
                        {it.provided_by
                          ? `Leveres av ${MATERIAL_PROVIDED_BY_LABELS[it.provided_by as MaterialProvidedBy] ?? it.provided_by}`
                          : ""}
                        {it.comment ? ` · ${it.comment}` : ""}
                      </div>
                    </div>
                    <div className="text-right shrink-0 text-xs">
                      <div className="font-semibold tabular-nums">
                        {it.quantity_ordered} {it.unit}
                      </div>
                      {it.quantity_received > 0 && (
                        <div className="text-emerald-700 dark:text-emerald-400">
                          Mottatt {it.quantity_received}
                        </div>
                      )}
                      {it.quantity_picked > 0 && (
                        <div className="text-muted-foreground">Plukket {it.quantity_picked}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bestillinger */}
        {data.procurements.length > 0 && (
          <Card className="rounded-xl">
            <CardContent className="p-4 space-y-2">
              <h2 className="text-sm font-semibold">Bestillinger</h2>
              {data.procurements.map((p, i) => (
                <div key={i} className="text-xs flex flex-wrap gap-x-3 gap-y-1">
                  <span className="font-medium">{p.supplier ?? "Leverandør"}</span>
                  {p.supplier_order_number && (
                    <span className="text-muted-foreground">#{p.supplier_order_number}</span>
                  )}
                  {p.expected_delivery_at && (
                    <span className="text-muted-foreground">
                      Forventet {fmtDate(p.expected_delivery_at)}
                    </span>
                  )}
                  {p.received_at && (
                    <span className="text-emerald-700 dark:text-emerald-400">
                      Mottatt {fmtDate(p.received_at)}
                    </span>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Foreslå materiell */}
        <Card className="rounded-xl border-primary/40">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Foreslå materiell</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Forslagene dine sendes til Lier VPS for godkjenning før de legges inn på materiallisten.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Field label="Ditt navn">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Valgfritt" />
              </Field>
              <Field label="E-post">
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Valgfritt" />
              </Field>
              <Field label="Elnr">
                <Input value={elnr} onChange={(e) => setElnr(e.target.value)} />
              </Field>
              <Field label="Beskrivelse">
                <Input value={desc} onChange={(e) => setDesc(e.target.value)} />
              </Field>
              <Field label="Antall">
                <Input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
              </Field>
              <Field label="Enhet">
                <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
              </Field>
              <Field label="Leveres av">
                <Select value={providedBy || "_none"} onValueChange={(v) => setProvidedBy(v === "_none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Velg" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">—</SelectItem>
                    {(Object.keys(MATERIAL_PROVIDED_BY_LABELS) as MaterialProvidedBy[]).map((k) => (
                      <SelectItem key={k} value={k}>{MATERIAL_PROVIDED_BY_LABELS[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <div className="sm:col-span-2">
                <Field label="Kommentar">
                  <Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
                </Field>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" /> Forslag krever intern godkjenning
              </span>
              <Button size="sm" onClick={submit} disabled={sending}>
                {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Send forslag
              </Button>
            </div>

            {sentList.length > 0 && (
              <div className="text-xs text-emerald-700 dark:text-emerald-400 space-y-1">
                <div className="font-medium">Sendt:</div>
                <ul className="list-disc list-inside">
                  {sentList.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("nb-NO", { day: "2-digit", month: "short" });
}
