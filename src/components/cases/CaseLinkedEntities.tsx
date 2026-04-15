import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { FileText, FolderKanban, Wrench, Users, ExternalLink, ClipboardList } from "lucide-react";

interface CaseLinkedEntitiesProps {
  linkedOfferId?: string | null;
  linkedProjectId?: string | null;
  linkedWorkOrderId?: string | null;
  linkedLeadId?: string | null;
  linkedOrderSubmissionId?: string | null;
  /** Legacy fields from before lifecycle v1 */
  offerId?: string | null;
  projectId?: string | null;
  serviceJobId?: string | null;
  leadId?: string | null;
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  new: "Ny",
  under_review: "Til vurdering",
  missing_info: "Mangler info",
  waiting_customer: "Venter svar",
  waiting_internal: "Internt",
  ready_for_planning: "Klar for plan",
  task_created: "Oppgave opprettet",
  in_progress: "Pågår",
  closed: "Fullført",
  rejected: "Avvist",
};

export function CaseLinkedEntities({
  linkedOfferId, linkedProjectId, linkedWorkOrderId, linkedLeadId, linkedOrderSubmissionId,
  offerId, projectId, serviceJobId, leadId,
}: CaseLinkedEntitiesProps) {
  const navigate = useNavigate();

  const effectiveOffer = linkedOfferId || offerId;
  const effectiveProject = linkedProjectId || projectId;
  const effectiveService = linkedWorkOrderId || serviceJobId;
  const effectiveLead = linkedLeadId || leadId;

  // Fetch linked order details
  const { data: linkedOrder } = useQuery({
    queryKey: ["case-linked-order", linkedOrderSubmissionId],
    queryFn: async () => {
      if (!linkedOrderSubmissionId) return null;
      const { data } = await supabase
        .from("order_form_submissions")
        .select("id, submission_no, status, assigned_to, summary")
        .eq("id", linkedOrderSubmissionId)
        .single();
      return data;
    },
    enabled: !!linkedOrderSubmissionId,
  });

  const hasAny = effectiveOffer || effectiveProject || effectiveService || effectiveLead || linkedOrderSubmissionId;
  if (!hasAny) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap mt-2">
      {linkedOrderSubmissionId && (
        <Badge
          variant="outline"
          className="cursor-pointer text-[10px] gap-1 hover:bg-primary/10 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300"
          onClick={() => navigate(`/orders/${linkedOrderSubmissionId}`)}
        >
          <ClipboardList className="h-3 w-3" />
          {linkedOrder ? (
            <>
              {linkedOrder.submission_no} · {ORDER_STATUS_LABELS[linkedOrder.status] || linkedOrder.status}
            </>
          ) : (
            "Koblet til Bestilling"
          )}
          <ExternalLink className="h-2.5 w-2.5 ml-0.5" />
        </Badge>
      )}
      {effectiveOffer && (
        <Badge
          variant="outline"
          className="cursor-pointer text-[10px] gap-1 hover:bg-primary/10 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300"
          onClick={() => navigate(`/sales/offers/${effectiveOffer}`)}
        >
          <FileText className="h-3 w-3" /> Koblet til Tilbud
          <ExternalLink className="h-2.5 w-2.5 ml-0.5" />
        </Badge>
      )}
      {effectiveProject && (
        <Badge
          variant="outline"
          className="cursor-pointer text-[10px] gap-1 hover:bg-primary/10 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
          onClick={() => navigate(`/projects/${effectiveProject}?tab=epost`)}
        >
          <FolderKanban className="h-3 w-3" /> Koblet til Prosjekt
          <ExternalLink className="h-2.5 w-2.5 ml-0.5" />
        </Badge>
      )}
      {effectiveService && (
        <Badge
          variant="outline"
          className="cursor-pointer text-[10px] gap-1 hover:bg-primary/10 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300"
          onClick={() => navigate(`/projects/${effectiveService}?tab=epost`)}
        >
          <Wrench className="h-3 w-3" /> Koblet til Jobb
          <ExternalLink className="h-2.5 w-2.5 ml-0.5" />
        </Badge>
      )}
      {effectiveLead && (
        <Badge
          variant="outline"
          className="cursor-pointer text-[10px] gap-1 hover:bg-primary/10 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300"
          onClick={() => navigate(`/sales/leads/${effectiveLead}`)}
        >
          <Users className="h-3 w-3" /> Koblet til Lead
          <ExternalLink className="h-2.5 w-2.5 ml-0.5" />
        </Badge>
      )}
    </div>
  );
}
