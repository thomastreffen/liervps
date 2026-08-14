/**
 * Sentral statussynkronisering mellom tilbud/oppdrag og henvendelse (lead).
 *
 * All speiling til `public_leads` skjer via databasetriggeren
 * `sync_lead_status_to_public_lead` – skriv derfor kun til `leads.status`.
 */
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

export const OFFER_LOST_REASONS = [
  "Pris",
  "Valgte annen leverandør",
  "Ikke aktuelt nå",
  "Fikk ikke kontakt",
  "Annet",
] as const;
export type OfferLostReason = (typeof OFFER_LOST_REASONS)[number];

export function nowStamp(): string {
  return format(new Date(), "dd.MM.yyyy HH:mm");
}

interface NoteArgs {
  leadId: string;
  action: string;
  description: string;
  title?: string;
  userId?: string | null;
  metadata?: Record<string, unknown>;
}

/** Skriver notat både i lead_history og activity_log (felles tidslinje). */
export async function logLeadNote({ leadId, action, description, title, userId, metadata }: NoteArgs) {
  await supabase.from("lead_history").insert({
    lead_id: leadId,
    action,
    description,
    performed_by: userId || null,
    metadata: (metadata || {}) as any,
  } as any);
  await supabase.from("activity_log").insert({
    entity_type: "lead",
    entity_id: leadId,
    action,
    type: "note",
    title: title || description,
    description,
    performed_by: userId || null,
    metadata: (metadata || {}) as any,
  } as any);
}

/** Setter intern lead-status. Trigger speiler til public_leads. */
export async function setLeadStatus(leadId: string, status: string) {
  const { error } = await supabase.from("leads").update({ status: status as any }).eq("id", leadId);
  if (error) throw error;
}

/** Finnes det et bekreftet oppdrag knyttet til tilbudet? */
export async function hasConfirmedJobForOffer(offerId: string): Promise<boolean> {
  const { data } = await supabase
    .from("events")
    .select("id")
    .eq("source_calculation_id", offerId)
    .in("status", ["scheduled", "approved", "in_progress", "completed"] as any)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

/**
 * Tilbud akseptert: lead settes til «vunnet» kun når et oppdrag er bekreftet.
 * Ellers beholdes status, men det logges et tydelig notat.
 */
export async function syncLeadOnOfferAccepted(opts: {
  leadId: string;
  offerId: string;
  offerTitle?: string;
  userId?: string | null;
}): Promise<{ won: boolean }> {
  const { leadId, offerId, offerTitle, userId } = opts;
  const confirmed = await hasConfirmedJobForOffer(offerId);
  if (confirmed) {
    await setLeadStatus(leadId, "won");
  }
  await logLeadNote({
    leadId,
    action: "offer_accepted",
    title: offerTitle || "Tilbud akseptert",
    description: confirmed
      ? `Tilbud akseptert: ${nowStamp()} – oppdrag bekreftet`
      : `Tilbud akseptert, venter på oppdrag (${nowStamp()})`,
    userId,
    metadata: { offer_id: offerId, confirmed },
  });
  return { won: confirmed };
}

/** Tilbud avslått/tapt: lead settes til «tapt» og speiles til public_leads. */
export async function syncLeadOnOfferRejected(opts: {
  leadId: string;
  offerId: string;
  offerTitle?: string;
  reason?: string | null;
  userId?: string | null;
}) {
  const { leadId, offerId, offerTitle, reason, userId } = opts;
  await setLeadStatus(leadId, "lost");
  await logLeadNote({
    leadId,
    action: "offer_rejected",
    title: offerTitle || "Tilbud avslått",
    description: `Tilbud avslått: ${nowStamp()}${reason ? ` – ${reason}` : ""}`,
    userId,
    metadata: { offer_id: offerId, reason: reason || null },
  });
}

/**
 * Konservativ tilbakesynk fra oppdrag/hendelse til henvendelse.
 * Befaringer påvirker aldri vunnet/tapt automatisk.
 */
export async function syncLeadOnJobStatus(opts: {
  leadId: string;
  jobId: string;
  jobTitle?: string;
  status: "confirmed" | "cancelled";
  isBefaring?: boolean;
  userId?: string | null;
}) {
  const { leadId, jobId, jobTitle, status, isBefaring, userId } = opts;
  if (isBefaring) return;
  const next = status === "confirmed" ? "won" : "contacted";
  await setLeadStatus(leadId, next);
  await logLeadNote({
    leadId,
    action: status === "confirmed" ? "job_confirmed" : "job_cancelled",
    title: jobTitle || (status === "confirmed" ? "Oppdrag bekreftet" : "Oppdrag avlyst"),
    description:
      status === "confirmed"
        ? `Oppdrag bekreftet: ${nowStamp()} – henvendelse satt til vunnet`
        : `Oppdrag avlyst: ${nowStamp()} – henvendelse satt tilbake til oppfølging`,
    userId,
    metadata: { job_id: jobId },
  });
}

/**
 * Resolver henvendelse fra et oppdrag og speiler status konservativt.
 * Kalles etter at oppdragsstatus er endret i UI.
 */
export async function syncLeadFromJobStatusChange(opts: {
  jobId: string;
  newStatus: string;
  userId?: string | null;
}) {
  const { jobId, newStatus, userId } = opts;
  const confirmedStatuses = ["scheduled", "approved", "in_progress", "completed"];
  const cancelledStatuses = ["rejected"];
  const kind = confirmedStatuses.includes(newStatus)
    ? "confirmed"
    : cancelledStatuses.includes(newStatus)
      ? "cancelled"
      : null;
  if (!kind) return;

  const { data: job } = await supabase
    .from("events")
    .select("id, title, source_lead_id, source_calculation_id, project_type")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return;

  // Befaringer skal aldri automatisk sette vunnet/tapt.
  const isBefaring = String((job as any).title || "").toLowerCase().startsWith("befaring");
  if (isBefaring) return;

  let leadId: string | null = (job as any).source_lead_id || null;
  if (!leadId && (job as any).source_calculation_id) {
    const { data: calc } = await supabase
      .from("calculations")
      .select("lead_id")
      .eq("id", (job as any).source_calculation_id)
      .maybeSingle();
    leadId = (calc as any)?.lead_id || null;
  }
  if (!leadId) return;

  await syncLeadOnJobStatus({
    leadId,
    jobId,
    jobTitle: (job as any).title || undefined,
    status: kind,
    userId,
  });
}
