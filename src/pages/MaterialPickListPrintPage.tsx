import { useEffect, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Printer, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MATERIAL_STATUS_LABELS, type MaterialListStatus, MATERIAL_PROVIDED_BY_LABELS, type MaterialProvidedBy } from "@/lib/material-status";
import type { MaterialItemRow, MaterialListRow } from "@/hooks/useMaterialList";

interface JobInfo {
  job_number: string | null;
  title: string;
  customer: string | null;
  address: string | null;
  start_time: string | null;
  description: string | null;
}

export default function MaterialPickListPrintPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const isOrderRoute = location.pathname.startsWith("/orders/");
  const [list, setList] = useState<MaterialListRow | null>(null);
  const [items, setItems] = useState<MaterialItemRow[]>([]);
  const [job, setJob] = useState<JobInfo | null>(null);
  const [technicianNames, setTechnicianNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      if (isOrderRoute) {
        const [{ data: lists }, { data: sub }] = await Promise.all([
          supabase.from("material_lists").select("*").eq("order_id", id).limit(1),
          supabase
            .from("order_form_submissions")
            .select("submission_no, summary, submitter_name, created_at")
            .eq("id", id)
            .maybeSingle(),
        ]);
        const summary = (sub?.summary as Record<string, unknown> | null) ?? {};
        setJob({
          job_number: sub?.submission_no ?? null,
          title: (summary.oppdragstittel as string) || "Bestilling",
          customer: (summary.kundenavn as string) || (summary.firmanavn as string) || null,
          address: (summary.oppdragssted as string) || (summary.adresse as string) || null,
          start_time: sub?.created_at ?? null,
          description: (summary.beskrivelse as string) || null,
        });
        setTechnicianNames(sub?.submitter_name ? [sub.submitter_name as string] : []);
        const l = (lists ?? [])[0] as MaterialListRow | undefined;
        if (l) {
          setList(l);
          const { data: rows } = await supabase
            .from("material_list_items")
            .select("*")
            .eq("material_list_id", l.id)
            .order("sort_order");
          setItems((rows ?? []) as MaterialItemRow[]);
        }
      } else {
        const [{ data: ev }, { data: lists }, { data: techs }] = await Promise.all([
          supabase.from("events").select("job_number, title, customer, address, start_time, description").eq("id", id).maybeSingle(),
          supabase.from("material_lists").select("*").eq("job_id", id).limit(1),
          supabase.from("event_technicians").select("technicians(name)").eq("event_id", id),
        ]);
        setJob(ev as JobInfo | null);
        setTechnicianNames(((techs ?? []) as Array<{ technicians: { name: string } | null }>).map((t) => t.technicians?.name).filter(Boolean) as string[]);
        const l = (lists ?? [])[0] as MaterialListRow | undefined;
        if (l) {
          setList(l);
          const { data: rows } = await supabase
            .from("material_list_items")
            .select("*")
            .eq("material_list_id", l.id)
            .order("sort_order");
          setItems((rows ?? []) as MaterialItemRow[]);
        }
      }
      setLoading(false);
    })();
  }, [id, isOrderRoute]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!list || !job) {
    return <div className="p-8 text-center">Ingen materialliste funnet.</div>;
  }

  const planned = job.start_time ? new Date(job.start_time).toLocaleString("nb-NO", { dateStyle: "short", timeStyle: "short" }) : "—";
  const link = `${window.location.origin}${isOrderRoute ? `/orders/${id}` : `/projects/${id}`}`;

  return (
    <div className="bg-muted/30 min-h-screen print:bg-white">
      {/* Toolbar — kun synlig på skjerm */}
      <div className="no-print sticky top-0 z-10 border-b bg-card">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-4 py-2">
          <Button variant="ghost" size="sm" onClick={() => window.close()}>
            <ArrowLeft className="h-4 w-4" /> Lukk
          </Button>
          <div className="text-sm text-muted-foreground">
            Status: <strong className="text-foreground">{MATERIAL_STATUS_LABELS[list.status as MaterialListStatus] ?? list.status}</strong>
          </div>
          <Button onClick={() => window.print()} size="sm">
            <Printer className="h-4 w-4" /> Skriv ut
          </Button>
        </div>
      </div>
      <style>{`
        @page { size: A4; margin: 14mm; }
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
        }
        .picklist { font-family: Arial, sans-serif; padding: 24px; max-width: 800px; margin: 0 auto; }
        .picklist table { width: 100%; border-collapse: collapse; }
        .picklist th, .picklist td { border: 1px solid #444; padding: 6px 8px; font-size: 12px; text-align: left; }
        .picklist th { background: #eee; }
        .picklist h1 { font-size: 20px; margin: 0 0 4px 0; }
        .picklist h2 { font-size: 14px; margin: 0 0 12px 0; color: #555; font-weight: normal; }
        .picklist .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; font-size: 12px; margin: 12px 0; }
        .picklist .meta div { padding: 2px 0; }
        .picklist .label { color: #666; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
        .picklist .footer { margin-top: 24px; }
        .picklist .sig { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 32px; }
        .picklist .sig div { border-top: 1px solid #444; padding-top: 4px; font-size: 11px; }
        .picklist .qr { float: right; width: 80px; height: 80px; border: 1px dashed #999; display: flex; align-items: center; justify-content: center; font-size: 9px; text-align: center; color: #666; }
      `}</style>

      <div className="picklist">
        <div className="qr">QR / lenke<br />{link.replace(/^https?:\/\//, "")}</div>
        <h1>Lier VPS — Plukkliste materiell</h1>
        <h2>{job.title}</h2>

        <div className="meta">
          <div><span className="label">Jobbnummer</span><br /><strong>{job.job_number ?? "—"}</strong></div>
          <div><span className="label">Planlagt</span><br />{planned}</div>
          <div><span className="label">Kunde</span><br />{job.customer ?? "—"}</div>
          <div><span className="label">Montør</span><br />{technicianNames.join(", ") || "—"}</div>
          <div style={{ gridColumn: "1 / span 2" }}><span className="label">Anleggsadresse</span><br />{job.address ?? "—"}</div>
          <div><span className="label">Kasse / hylleplass</span><br />{list.crate_location ?? "______________________"}</div>
          <div><span className="label">Plukket av / dato</span><br />{list.picked_at ? new Date(list.picked_at).toLocaleDateString("nb-NO") : "______________________"}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th style={{ width: "24px" }}>✓</th>
              <th style={{ width: "70px" }}>Elnr</th>
              <th>Beskrivelse</th>
              <th style={{ width: "50px", textAlign: "right" }}>Antall</th>
              <th style={{ width: "40px" }}>Enhet</th>
              <th style={{ width: "110px" }}>Leveres av</th>
              <th>Kommentar</th>
              <th style={{ width: "50px", textAlign: "right" }}>Retur</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id}>
                <td style={{ textAlign: "center" }}>☐</td>
                <td>{it.elnr ?? ""}</td>
                <td>{it.description}</td>
                <td style={{ textAlign: "right" }}>{it.quantity_ordered}</td>
                <td>{it.unit}</td>
                <td>{it.provided_by ? (MATERIAL_PROVIDED_BY_LABELS[it.provided_by as MaterialProvidedBy] ?? it.provided_by) : ""}</td>
                <td>{it.comment ?? ""}</td>
                <td style={{ textAlign: "right" }}>____</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: "center", color: "#888" }}>Ingen linjer</td></tr>
            )}
          </tbody>
        </table>

        <div className="footer">
          <div className="sig">
            <div>Signatur lager / dato</div>
            <div>Signatur montør / dato</div>
          </div>
          <p style={{ marginTop: 24, fontSize: 11, color: "#555" }}>
            Kommentar / mangler:<br />
            ___________________________________________________<br /><br />
            ___________________________________________________
          </p>
          <p style={{ marginTop: 16, fontSize: 11, fontStyle: "italic", color: "#666" }}>
            Etter utført jobb: registrer brukt mengde og retur i Lier VPS.
          </p>
        </div>

        <div className="no-print" style={{ marginTop: 24, textAlign: "center" }}>
          <button onClick={() => window.print()} style={{ padding: "8px 16px" }}>Skriv ut</button>
        </div>
      </div>
    </div>
  );
}
