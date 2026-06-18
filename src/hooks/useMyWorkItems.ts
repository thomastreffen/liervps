import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface WorkItem {
  kind: "order" | "job";
  id: string;
  number: string;
  title: string;
  customer: string | null;
  status: string;
  statusLabel: string;
  date: string | null;
  href: string;
}

const ORDER_STATUS_LABEL: Record<string, string> = {
  new: "Ny bestilling",
  submitted: "Ny bestilling",
  under_review: "Til vurdering",
  in_review: "Til vurdering",
  waiting_internal: "Avventer internt",
  needs_info: "Trenger info",
  task_created: "Oppgave opprettet",
  closed: "Avsluttet",
};

const JOB_STATUS_LABEL: Record<string, string> = {
  requested: "Forespurt",
  approved: "Godkjent",
  time_change_proposed: "Tidsendring foreslått",
  scheduled: "Planlagt",
  in_progress: "Pågår",
  completed: "Ferdig",
  ready_for_invoicing: "Klar for faktura",
  invoiced: "Fakturert",
};

export function useMyWorkItems(limit = 6) {
  const { user, isAdmin } = useAuth();
  const [items, setItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }

    async function load() {
      setLoading(true);
      const isInternal = isAdmin || user!.role === "montør";

      // Orders: internal sees newest open; non-internal sees own submissions
      const ordersBase = supabase
        .from("order_form_submissions")
        .select("id, submission_no, summary, status, created_at, submitter_name, linked_project_id")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(limit);

      const ordersQ = isInternal
        ? ordersBase.in("status", ["new", "submitted", "under_review", "waiting_internal", "needs_info"])
        : ordersBase.eq("submitter_user_id", user!.id);

      // Jobs: internal sees active/scheduled recent; non-internal skips
      const jobsQ = isInternal
        ? supabase
            .from("events")
            .select("id, title, customer, status, start_time, internal_number, job_number, project_number")
            .is("deleted_at", null)
            .in("status", ["requested", "approved", "scheduled", "in_progress", "time_change_proposed"])
            .order("start_time", { ascending: true, nullsFirst: false })
            .limit(limit)
        : Promise.resolve({ data: [] as any[] });

      const [ordersRes, jobsRes] = await Promise.all([ordersQ, jobsQ]);
      if (cancelled) return;

      const orderItems: WorkItem[] = (ordersRes.data || []).map((o: any) => ({
        kind: "order",
        id: o.id,
        number: o.submission_no ? `BST-${o.submission_no}` : "Bestilling",
        title: o.summary || "Servicebestilling",
        customer: o.submitter_name,
        status: o.status,
        statusLabel: ORDER_STATUS_LABEL[o.status] || o.status,
        date: o.created_at,
        href: `/orders/${o.id}`,
      }));

      const normalizeCustomer = (c: any): string | null => {
        if (!c) return null;
        if (typeof c === "string") return c;
        if (typeof c === "object") {
          return (
            c.firmanavn ||
            c.kontaktperson_kunde ||
            c.bestiller_navn ||
            c.name ||
            c.oppdragssted ||
            c.adresse ||
            null
          );
        }
        return String(c);
      };

      const jobItems: WorkItem[] = ((jobsRes as any).data || []).map((e: any) => ({
        kind: "job",
        id: e.id,
        number: e.job_number || e.internal_number || e.project_number || "Jobb",
        title: e.title || "Servicejobb",
        customer: normalizeCustomer(e.customer),
        status: e.status,
        statusLabel: JOB_STATUS_LABEL[e.status] || e.status,
        date: e.start_time,
        href: `/projects/${e.id}`,
      }));

      // Merge, sort by date desc, cap to limit
      const merged = [...orderItems, ...jobItems]
        .sort((a, b) => {
          const da = a.date ? new Date(a.date).getTime() : 0;
          const db = b.date ? new Date(b.date).getTime() : 0;
          return db - da;
        })
        .slice(0, limit);

      setItems(merged);
      setLoading(false);
    }

    load();
  }, [user, isAdmin, limit]);

  return { items, loading };
}
