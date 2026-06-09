import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { FlowStep } from "./FlowTrail";

interface Seed {
  caseId?: string | null;
  caseNumber?: string | null;
  leadId?: string | null;
  leadName?: string | null;
  orderSubmissionId?: string | null;
  orderSubmissionNo?: string | null;
  orderConvertedToId?: string | null;
  orderConvertedToType?: string | null;
  eventId?: string | null;
  eventInternalNumber?: string | null;
}

interface ChainData {
  caseRow?: { id: string; case_number: string | null } | null;
  leadRow?: { id: string; company_name: string } | null;
  orderRow?: {
    id: string;
    submission_no: string;
    converted_to_id: string | null;
    converted_to_type: string | null;
  } | null;
  eventRow?: { id: string; internal_number: string | null } | null;
}

/**
 * Resolve the Postkontor → Lead → Bestilling → Oppdrag chain from any
 * starting point. Each lookup is a tiny single-row query, run only when
 * an id is present.  Use this in detail views only — never in lists.
 */
export function useFlowChain(seed: Seed): { steps: FlowStep[]; loading: boolean } {
  const navigate = useNavigate();

  // Case lookup: either by id, or by linked_lead_id when starting from a lead.
  const { data: caseData, isLoading: l1 } = useQuery({
    queryKey: ["flow-case", seed.caseId, seed.leadId],
    enabled: !!seed.caseId || !!seed.leadId,
    queryFn: async () => {
      let q = (supabase as any)
        .from("cases")
        .select("id, case_number, linked_lead_id, linked_order_submission_id, created_at")
        .is("deleted_at", null);
      if (seed.caseId) {
        q = q.eq("id", seed.caseId);
      } else {
        q = q.eq("linked_lead_id", seed.leadId!);
      }
      q = q.order("created_at", { ascending: false }).limit(1);
      const { data } = await q;
      const row = ((data as any[]) || [])[0] || null;
      return row as
        | { id: string; case_number: string | null; linked_lead_id: string | null; linked_order_submission_id: string | null }
        | null;
    },
  });

  const resolvedLeadId = seed.leadId || caseData?.linked_lead_id || null;
  const resolvedOrderId =
    seed.orderSubmissionId || caseData?.linked_order_submission_id || null;

  // Lead
  const { data: leadData, isLoading: l2 } = useQuery({
    queryKey: ["flow-lead", resolvedLeadId],
    enabled: !!resolvedLeadId && !seed.leadName,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("leads")
        .select("id, company_name")
        .eq("id", resolvedLeadId!)
        .maybeSingle();
      return data as { id: string; company_name: string } | null;
    },
  });

  // Order submission (and discover convert target)
  const { data: orderData, isLoading: l3 } = useQuery({
    queryKey: ["flow-order", resolvedOrderId, resolvedLeadId],
    enabled:
      !!resolvedOrderId ||
      (!!resolvedLeadId && !seed.orderSubmissionId),
    queryFn: async () => {
      let q = (supabase as any)
        .from("order_form_submissions")
        .select("id, submission_no, converted_to_id, converted_to_type, source_lead_id, created_at")
        .is("deleted_at", null);
      if (resolvedOrderId) {
        q = q.eq("id", resolvedOrderId);
      } else {
        q = q.eq("source_lead_id", resolvedLeadId!);
      }
      q = q.order("created_at", { ascending: false }).limit(1);
      const { data } = await q;
      return ((data as any[]) || [])[0] || null;
    },
  });

  const resolvedEventId =
    seed.eventId ||
    (orderData?.converted_to_id && orderData?.converted_to_type !== "case"
      ? orderData.converted_to_id
      : null);

  // Event (job) lookup if we have an id
  const { data: eventData, isLoading: l4 } = useQuery({
    queryKey: ["flow-event", resolvedEventId, resolvedLeadId],
    enabled:
      !!resolvedEventId ||
      (!!resolvedLeadId && !orderData?.converted_to_id),
    queryFn: async () => {
      let q = (supabase as any)
        .from("events")
        .select("id, internal_number, source_lead_id, created_at")
        .is("deleted_at", null);
      if (resolvedEventId) {
        q = q.eq("id", resolvedEventId);
      } else {
        q = q.eq("source_lead_id", resolvedLeadId!);
      }
      q = q.order("created_at", { ascending: false }).limit(1);
      const { data } = await q;
      return ((data as any[]) || [])[0] || null;
    },
  });

  const chain: ChainData = {
    caseRow: seed.caseId ? { id: seed.caseId, case_number: seed.caseNumber || caseData?.case_number || null } : null,
    leadRow: resolvedLeadId
      ? { id: resolvedLeadId, company_name: seed.leadName || leadData?.company_name || "Lead" }
      : null,
    orderRow: orderData
      ? {
          id: orderData.id,
          submission_no: orderData.submission_no || seed.orderSubmissionNo || "",
          converted_to_id: orderData.converted_to_id,
          converted_to_type: orderData.converted_to_type,
        }
      : seed.orderSubmissionId
        ? {
            id: seed.orderSubmissionId,
            submission_no: seed.orderSubmissionNo || "",
            converted_to_id: seed.orderConvertedToId || null,
            converted_to_type: seed.orderConvertedToType || null,
          }
        : null,
    eventRow: eventData
      ? { id: eventData.id, internal_number: eventData.internal_number }
      : seed.eventId
        ? { id: seed.eventId, internal_number: seed.eventInternalNumber || null }
        : null,
  };

  const steps: FlowStep[] = [];

  if (chain.caseRow) {
    const nextExists = !!(chain.leadRow || chain.orderRow || chain.eventRow);
    steps.push({
      kind: "inbox",
      label: "Postkontor",
      status: nextExists ? "completed" : "active",
      ref: chain.caseRow.case_number || null,
      subtitle: nextExists ? "Sendt videre" : "Åpen",
      onClick: () => navigate(`/inbox?case=${chain.caseRow!.id}`),
    });
  }

  if (chain.leadRow) {
    const nextExists = !!(chain.orderRow || chain.eventRow);
    steps.push({
      kind: "lead",
      label: "Lead",
      status: nextExists ? "completed" : "active",
      ref: chain.leadRow.company_name,
      subtitle: nextExists ? "Koblet" : "Aktivt",
      onClick: () => navigate(`/sales/leads/${chain.leadRow!.id}`),
    });
  }

  if (chain.orderRow) {
    const converted = !!chain.orderRow.converted_to_id;
    steps.push({
      kind: "order",
      label: "Bestilling",
      status: converted ? "completed" : "active",
      ref: chain.orderRow.submission_no || null,
      subtitle: converted ? "Konvertert" : "Opprettet",
      onClick: () => navigate(`/orders/${chain.orderRow!.id}`),
    });
  } else if (chain.leadRow) {
    steps.push({
      kind: "order",
      label: "Bestilling",
      status: "not_started",
      subtitle: "Ikke opprettet",
    });
  }

  if (chain.eventRow) {
    steps.push({
      kind: "job",
      label: "Oppdrag",
      status: "completed",
      ref: chain.eventRow.internal_number || null,
      subtitle: "Konvertert til oppdrag",
      onClick: () => navigate(`/projects/plan?openTask=${chain.eventRow!.id}`),
    });
  } else if (chain.orderRow) {
    steps.push({
      kind: "job",
      label: "Oppdrag",
      status: "not_started",
      subtitle: "Ikke konvertert",
    });
  }

  return { steps, loading: l1 || l2 || l3 || l4 };
}
