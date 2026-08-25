import { supabase } from "@/integrations/supabase/client";
import { sanitizeStorageFileName } from "@/lib/storage-path";

/** Slug for det offentlige prisforespørsel-skjemaet (bestillingsmodulen). */
export const PUBLIC_REQUEST_TEMPLATE_SLUG = "prisforesporsel";

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_ATTACHMENTS = 8;
export const ACCEPTED_ATTACHMENT_TYPES =
  "image/*,application/pdf,.pdf,.jpg,.jpeg,.png,.heic,.webp,.dwg,.doc,.docx";

export type PublicRequestValues = Record<string, string | number | null | undefined>;

export type PublicRequestResult = {
  /** Sporingstoken for kundens statusside (/bestilling/status/:token). */
  trackingToken: string | null;
  submissionId: string | null;
  failedAttachments: string[];
};

/**
 * Sender en offentlig forespørsel inn i bestillingsmodulen slik at den
 * behandles på samme sted som øvrige bestillinger. Vedlegg lastes opp til
 * order-form-attachments. Feiler aldri "stille" — kaster ved kritisk feil.
 */
export async function submitPublicRequest(opts: {
  values: PublicRequestValues;
  files: File[];
  summaryTitle: string;
  leadContext?: unknown;
}): Promise<PublicRequestResult> {
  const { data: template, error: tmplErr } = await supabase
    .from("order_form_templates")
    .select("id, company_id")
    .eq("slug", PUBLIC_REQUEST_TEMPLATE_SLUG)
    .eq("is_active", true)
    .maybeSingle();

  if (tmplErr || !template) {
    throw new Error("Skjemaet er midlertidig utilgjengelig");
  }

  const submissionId = crypto.randomUUID();
  const trackingToken = crypto.randomUUID();

  const email = String(opts.values.bestiller_epost || "").trim() || null;
  const name = String(opts.values.bestiller_navn || "").trim() || null;
  const phone = String(opts.values.bestiller_telefon || "").trim() || null;

  const { error: subErr } = await supabase.from("order_form_submissions").insert({
    id: submissionId,
    company_id: template.company_id,
    template_id: template.id,
    status: "new",
    source: "external",
    requester_type: "external",
    priority: "normal",
    summary: {
      oppdragstittel: opts.summaryTitle,
      kundenavn: name,
      firmanavn: opts.values.firmanavn || null,
      bestiller_navn: name,
    },
    submitter_email: email,
    submitter_name: name,
    notification_recipient_email: email,
    notification_recipient_name: name,
    notification_recipient_phone: phone,
    notification_recipient_source: "bestiller_fields",
    public_tracking_token: trackingToken,
  } as never);
  if (subErr) throw subErr;

  const valueRows = Object.entries(opts.values)
    .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "")
    .map(([field_key, value]) => ({
      submission_id: submissionId,
      field_key,
      value: typeof value === "number" ? value : String(value),
    }));

  if (valueRows.length > 0) {
    const { error: valErr } = await supabase
      .from("order_form_submission_values")
      .insert(valueRows as never);
    if (valErr) throw valErr;
  }

  const failedAttachments: string[] = [];
  for (const file of opts.files.slice(0, MAX_ATTACHMENTS)) {
    const path = `${template.company_id}/${submissionId}/${Date.now()}_${sanitizeStorageFileName(file.name)}`;
    const { error: upErr } = await supabase.storage
      .from("order-form-attachments")
      .upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
    if (upErr) {
      failedAttachments.push(file.name);
      continue;
    }
    const { error: attErr } = await supabase.from("order_form_submission_attachments").insert({
      submission_id: submissionId,
      field_key: "vedlegg",
      file_name: file.name,
      file_path: path,
      mime_type: file.type,
      file_size: file.size,
    } as never);
    if (attErr) failedAttachments.push(file.name);
  }

  await supabase.from("order_form_activity_log").insert({
    submission_id: submissionId,
    event_type: "submitted",
    payload: {
      source: "nettside_kontaktskjema",
      value_count: valueRows.length,
      attachment_count: opts.files.length - failedAttachments.length,
      lead_context: opts.leadContext ?? null,
    },
  } as never);

  // Varsling internt + bekreftelse til kunde (fire-and-forget)
  void supabase.functions
    .invoke("order-form-notify", {
      body: { submission_id: submissionId, notification_type: "new_order" },
    })
    .catch(() => undefined);
  void supabase.functions
    .invoke("order-form-notify", {
      body: { submission_id: submissionId, notification_type: "confirmation" },
    })
    .catch(() => undefined);

  return { submissionId, trackingToken, failedAttachments };
}
