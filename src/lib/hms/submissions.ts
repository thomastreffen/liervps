import { supabase } from "@/integrations/supabase/client";

export type SubmissionStatus = "draft" | "submitted" | "approved" | "rejected" | "archived";

export interface TemplateSnapshot {
  template_id: string;
  template_version: number;
  kind: "sja" | "checklist";
  category: string;
  name: string;
  description?: string | null;
  hms_areas: string[];
  sections: Array<{
    id: string;
    title: string;
    description?: string | null;
    ordering: number;
    items: Array<{
      id: string;
      item_type: string;
      label: string;
      help_text?: string | null;
      is_required: boolean;
      options?: any;
      ordering: number;
    }>;
  }>;
}

export const STATUS_LABELS: Record<SubmissionStatus, string> = {
  draft: "Utkast",
  submitted: "Sendt inn",
  approved: "Godkjent",
  rejected: "Avvist",
  archived: "Arkivert",
};

export async function buildTemplateSnapshot(templateId: string): Promise<TemplateSnapshot | null> {
  const sb = supabase as any;
  const { data: tpl } = await sb
    .from("hms_templates")
    .select("id, version, kind, category, name, description, hms_areas")
    .eq("id", templateId)
    .maybeSingle();
  if (!tpl) return null;
  const { data: sections } = await sb
    .from("hms_template_sections")
    .select("id, title, description, ordering")
    .eq("template_id", templateId)
    .order("ordering", { ascending: true });
  const { data: items } = await sb
    .from("hms_template_items")
    .select("id, section_id, item_type, label, help_text, is_required, options, ordering")
    .eq("template_id", templateId)
    .order("ordering", { ascending: true });
  return {
    template_id: tpl.id,
    template_version: tpl.version ?? 1,
    kind: tpl.kind,
    category: tpl.category,
    name: tpl.name,
    description: tpl.description,
    hms_areas: tpl.hms_areas ?? [],
    sections: (sections ?? []).map((s: any) => ({
      ...s,
      items: (items ?? []).filter((i: any) => i.section_id === s.id),
    })),
  };
}

export async function startSubmission(opts: {
  companyId: string;
  templateId: string;
  userId: string;
  userName: string;
  projectId?: string | null;
  eventId?: string | null;
  title?: string | null;
}): Promise<string> {
  const sb = supabase as any;
  const snap = await buildTemplateSnapshot(opts.templateId);
  if (!snap) throw new Error("Mal ikke funnet");
  const { data, error } = await sb
    .from("hms_submissions")
    .insert({
      company_id: opts.companyId,
      template_id: opts.templateId,
      template_snapshot: snap,
      template_version: snap.template_version,
      kind: snap.kind,
      hms_areas: snap.hms_areas,
      title: opts.title ?? snap.name,
      status: "draft",
      submitted_by: opts.userId,
      project_id: opts.projectId ?? null,
      event_id: opts.eventId ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;

  // Add the creator as the first participant
  await sb.from("hms_submission_participants").insert({
    submission_id: data.id,
    user_id: opts.userId,
    display_name: opts.userName,
    role: "Ansvarlig",
  });

  return data.id;
}

export async function upsertAnswer(opts: {
  submissionId: string;
  itemId: string;
  itemKey: string;
  value: any;
  photos?: string[] | null;
}) {
  const sb = supabase as any;
  // Try update first by item_id
  const { data: existing } = await sb
    .from("hms_submission_answers")
    .select("id")
    .eq("submission_id", opts.submissionId)
    .eq("item_id", opts.itemId)
    .maybeSingle();
  if (existing) {
    await sb
      .from("hms_submission_answers")
      .update({ value: opts.value, photos: opts.photos ?? null })
      .eq("id", existing.id);
  } else {
    await sb.from("hms_submission_answers").insert({
      submission_id: opts.submissionId,
      item_id: opts.itemId,
      item_key: opts.itemKey,
      value: opts.value,
      photos: opts.photos ?? null,
    });
  }
}

export async function signSubmission(opts: {
  submissionId: string;
  userId: string;
  userName: string;
  templateVersion: number;
  participantId?: string | null;
  signatureType?: "internal_confirm" | "drawn_signature";
  signatureData?: string | null;
  roleLabel?: string | null;
}) {
  const sb = supabase as any;
  const { data: sig, error } = await sb
    .from("hms_submission_signatures")
    .insert({
      submission_id: opts.submissionId,
      signer_user_id: opts.userId,
      signer_name: opts.userName,
      signature_data: opts.signatureData ?? null,
      signature_type: opts.signatureType ?? "internal_confirm",
      role_label: opts.roleLabel ?? null,
      template_version: opts.templateVersion,
      participant_id: opts.participantId ?? null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null,
    })
    .select("id")
    .single();
  if (error) throw error;

  if (opts.participantId) {
    await sb
      .from("hms_submission_participants")
      .update({ signed_at: new Date().toISOString(), signature_id: sig.id })
      .eq("id", opts.participantId);
  } else {
    // Mark first matching participant as signed
    await sb
      .from("hms_submission_participants")
      .update({ signed_at: new Date().toISOString(), signature_id: sig.id })
      .eq("submission_id", opts.submissionId)
      .eq("user_id", opts.userId)
      .is("signed_at", null);
  }
  return sig.id;
}

export async function submitForReview(submissionId: string) {
  const sb = supabase as any;
  const { error } = await sb
    .from("hms_submissions")
    .update({ status: "submitted", submitted_at: new Date().toISOString() })
    .eq("id", submissionId);
  if (error) throw error;
}

export async function reviewSubmission(opts: {
  submissionId: string;
  approve: boolean;
  reviewerUserId: string;
  reason?: string | null;
}) {
  const sb = supabase as any;
  const { error } = await sb
    .from("hms_submissions")
    .update({
      status: opts.approve ? "approved" : "rejected",
      reviewed_by: opts.reviewerUserId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: opts.approve ? null : opts.reason ?? null,
    })
    .eq("id", opts.submissionId);
  if (error) throw error;
}
