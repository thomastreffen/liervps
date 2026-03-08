import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { subDays } from "date-fns";

export interface TechStatus {
  id: string;
  name: string;
  blocks: number;
  bookedMinutes: number;
  status: "ledig" | "delvis" | "full" | "overbooket";
}

export interface AttentionProject {
  id: string;
  title: string;
  customer: string;
  status: string;
  reason: string;
}

export interface InvoiceItem {
  id: string;
  project_title: string;
  customer_name: string;
  total_hours: number;
  technicians: string[];
  approved_at: string;
  billing_status: string;
}

export interface CustomerActivity {
  id: string;
  title: string;
  type: string;
  created_at: string;
}

export interface ManagementKPIs {
  availableTechs: number;
  overbookedTechs: number;
  unplannedProjects: number;
  pendingApprovals: number;
  readyForInvoice: number;
  openDeviations: number;
}

export interface Alert {
  severity: "ok" | "warning" | "critical";
  message: string;
  link?: string;
}

export function useManagementData() {
  const [kpis, setKpis] = useState<ManagementKPIs>({
    availableTechs: 0,
    overbookedTechs: 0,
    unplannedProjects: 0,
    pendingApprovals: 0,
    readyForInvoice: 0,
    openDeviations: 0,
  });
  const [techStatuses, setTechStatuses] = useState<TechStatus[]>([]);
  const [attentionProjects, setAttentionProjects] = useState<Record<string, AttentionProject[]>>({});
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [customerActivities, setCustomerActivities] = useState<CustomerActivity[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const staleDate = subDays(today, 14).toISOString();

    try {
      // 1. Fetch today's schedule blocks to compute tech statuses
      const { data: blocks } = await supabase
        .from("schedule_blocks")
        .select("id, technician_id, technician_name, start_at, end_at")
        .gte("start_at", `${todayStr}T00:00:00`)
        .lte("start_at", `${todayStr}T23:59:59`);

      // 2. Fetch all schedulable people
      const { data: techs } = await supabase
        .from("employment_profiles")
        .select("id, person_id, people(display_name)")
        .eq("is_schedulable", true);

      // Build tech status map
      const techMap: Record<string, { name: string; minutes: number; blockCount: number }> = {};
      for (const t of techs || []) {
        const name = (t as any).people?.display_name || "Ukjent";
        techMap[t.person_id] = { name, minutes: 0, blockCount: 0 };
      }

      for (const b of blocks || []) {
        const tid = b.technician_id;
        if (!tid) continue;
        if (!techMap[tid]) {
          techMap[tid] = { name: b.technician_name || "Ukjent", minutes: 0, blockCount: 0 };
        }
        const dur = (new Date(b.end_at).getTime() - new Date(b.start_at).getTime()) / 60000;
        techMap[tid].minutes += dur;
        techMap[tid].blockCount += 1;
      }

      const WORK_DAY = 480;
      const statuses: TechStatus[] = Object.entries(techMap).map(([id, d]) => {
        const pct = (d.minutes / WORK_DAY) * 100;
        let status: TechStatus["status"] = "ledig";
        if (pct > 100) status = "overbooket";
        else if (pct >= 90) status = "full";
        else if (pct >= 50) status = "delvis";
        return { id, name: d.name, blocks: d.blockCount, bookedMinutes: d.minutes, status };
      });
      statuses.sort((a, b) => b.bookedMinutes - a.bookedMinutes);
      setTechStatuses(statuses);

      const availCount = statuses.filter((s) => s.status === "ledig").length;
      const overCount = statuses.filter((s) => s.status === "overbooket").length;

      // 3. Unplanned projects
      const { count: unplanned } = await supabase
        .from("events")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .is("archived_at", null)
        .in("status", ["requested", "approved"])
        .is("microsoft_event_id", null);

      // 4. Pending approvals (service_journals in review status)
      const { count: pendingApproval } = await supabase
        .from("service_journals")
        .select("id", { count: "exact", head: true })
        .eq("status", "review");

      // 5. Ready for invoice
      const { data: invoiceData } = await supabase
        .from("invoice_basis")
        .select("*")
        .eq("billing_status", "ready")
        .order("approved_at", { ascending: false })
        .limit(10);

      setInvoiceItems(
        (invoiceData || []).map((r: any) => ({
          id: r.id,
          project_title: r.project_title,
          customer_name: r.customer_name,
          total_hours: r.total_hours || 0,
          technicians: r.technicians || [],
          approved_at: r.approved_at,
          billing_status: r.billing_status,
        }))
      );

      const { count: readyCount } = await supabase
        .from("invoice_basis")
        .select("id", { count: "exact", head: true })
        .eq("billing_status", "ready");

      // 6. Open deviations
      const { count: deviations } = await supabase
        .from("job_tasks")
        .select("id", { count: "exact", head: true })
        .eq("type", "deviation")
        .in("status", ["open", "new"]);

      setKpis({
        availableTechs: availCount,
        overbookedTechs: overCount,
        unplannedProjects: unplanned || 0,
        pendingApprovals: pendingApproval || 0,
        readyForInvoice: readyCount || 0,
        openDeviations: deviations || 0,
      });

      // 7. Attention projects
      const groups: Record<string, AttentionProject[]> = {};

      // Unplanned
      const { data: unplannedProjects } = await supabase
        .from("events")
        .select("id, title, customer_name, status")
        .is("deleted_at", null)
        .is("archived_at", null)
        .in("status", ["requested", "approved"])
        .is("microsoft_event_id", null)
        .limit(10);
      groups["Uten plan"] = (unplannedProjects || []).map((p: any) => ({
        id: p.id, title: p.title, customer: p.customer_name || "", status: p.status, reason: "Mangler planlagte blokker",
      }));

      // Stale projects (no recent activity)
      const { data: staleProjects } = await supabase
        .from("events")
        .select("id, title, customer_name, status, updated_at")
        .is("deleted_at", null)
        .is("archived_at", null)
        .in("status", ["approved", "scheduled", "in_progress"])
        .lt("updated_at", staleDate)
        .limit(10);
      groups["Uten nylig aktivitet"] = (staleProjects || []).map((p: any) => ({
        id: p.id, title: p.title, customer: p.customer_name || "", status: p.status, reason: "Ikke oppdatert på 14+ dager",
      }));

      // Pending approval projects
      const { data: pendingProjects } = await supabase
        .from("service_journals")
        .select("id, project_id, events(id, title, customer_name, status)")
        .eq("status", "review")
        .limit(10);
      groups["Ventende godkjenning"] = (pendingProjects || []).map((j: any) => ({
        id: j.events?.id || j.project_id, title: j.events?.title || "Ukjent", customer: j.events?.customer_name || "", status: "review", reason: "Venter på kundegodkjenning",
      }));

      setAttentionProjects(groups);

      // 8. Customer activity from activity_log
      const { data: custAct } = await supabase
        .from("activity_log")
        .select("id, title, type, created_at")
        .in("type", ["portal_approval", "portal_view", "portal_message", "journal_approved"])
        .order("created_at", { ascending: false })
        .limit(8);
      setCustomerActivities(
        (custAct || []).map((a: any) => ({
          id: a.id, title: a.title || a.type, type: a.type, created_at: a.created_at,
        }))
      );

      // 9. Alerts
      const alertList: Alert[] = [];
      if (overCount > 0) alertList.push({ severity: "critical", message: `${overCount} montør${overCount > 1 ? "er" : ""} er overbooket i dag`, link: "/projects/plan" });
      if ((unplanned || 0) > 0) alertList.push({ severity: "warning", message: `${unplanned} oppdrag mangler plan`, link: "/projects" });
      if ((readyCount || 0) > 0) alertList.push({ severity: "warning", message: `${readyCount} rapporter er godkjent, men ikke sendt til økonomi`, link: "/invoice-basis" });
      if ((pendingApproval || 0) > 0) alertList.push({ severity: "warning", message: `${pendingApproval} rapporter venter på kundegodkjenning` });
      if (alertList.length === 0) alertList.push({ severity: "ok", message: "Alt ser bra ut – ingen kritiske varsler" });
      setAlerts(alertList);

    } catch (err) {
      console.error("[ManagementData]", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { kpis, techStatuses, attentionProjects, invoiceItems, customerActivities, alerts, loading, refetch: fetchData };
}
