// ── Order Forms Module Types ──

export type OrderFormFieldType =
  | "short_text"
  | "long_text"
  | "number"
  | "date"
  | "time"
  | "time_window"
  | "email"
  | "phone"
  | "address"
  | "org_number"
  | "dropdown"
  | "multi_select"
  | "yes_no"
  | "checkbox_list"
  | "radio"
  | "file_upload"
  | "image_upload"
  | "customer_lookup"
  | "project_lookup"
  | "user_lookup"
  | "info_box"
  | "section_header";

export const ORDER_FIELD_TYPE_LABELS: Record<OrderFormFieldType, string> = {
  short_text: "Kort tekst",
  long_text: "Lang tekst",
  number: "Tall",
  date: "Dato",
  time: "Klokkeslett",
  time_window: "Tidsvindu",
  email: "E-post",
  phone: "Telefon",
  address: "Adresse",
  org_number: "Org.nr",
  dropdown: "Nedtrekksliste",
  multi_select: "Flervalg",
  yes_no: "Ja / Nei",
  checkbox_list: "Sjekkliste",
  radio: "Radioknapper",
  file_upload: "Filopplasting",
  image_upload: "Bildeopplasting",
  customer_lookup: "Kundeoppslag",
  project_lookup: "Prosjektoppslag",
  user_lookup: "Brukeroppslag",
  info_box: "Infoboks",
  section_header: "Overskrift",
};

// ── Conditional Logic ──

export interface ConditionalRule {
  field_key: string;
  operator: "equals" | "not_equals" | "contains" | "is_empty" | "is_not_empty";
  value?: string;
}

export interface ConditionalLogic {
  action: "show" | "hide" | "require";
  rules: ConditionalRule[];
  logic: "and" | "or";
}

// ── Template ──

export interface OrderFormTemplate {
  id: string;
  company_id: string;
  name: string;
  slug: string;
  category: string | null;
  audience_type: "internal" | "external" | "both";
  internal_title: string | null;
  external_title: string | null;
  description: string | null;
  confirmation_text: string | null;
  send_email_to: string[] | null;
  on_submit_action: "queue" | "create_case" | "create_task";
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderFormSection {
  id: string;
  template_id: string;
  title: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  visibility_rules: ConditionalLogic[] | null;
  created_at: string;
}

export interface OrderFormField {
  id: string;
  template_id: string;
  section_id: string;
  field_key: string;
  label: string;
  field_type: OrderFormFieldType;
  placeholder: string | null;
  help_text: string | null;
  is_required: boolean;
  is_readonly: boolean;
  default_value: any;
  options: string[] | { label: string; value: string }[] | null;
  validation: Record<string, any> | null;
  conditional_logic: ConditionalLogic | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

// ── Submission ──

export type OrderFormSubmissionStatus =
  | "new"
  | "missing_info"
  | "ready_for_review"
  | "in_progress"
  | "planned"
  | "converted"
  | "rejected"
  | "closed";

export const ORDER_STATUS_CONFIG: Record<
  OrderFormSubmissionStatus,
  { label: string; color: string; dotClass: string }
> = {
  new: { label: "Ny bestilling", color: "bg-blue-100 text-blue-800", dotClass: "bg-blue-500" },
  missing_info: { label: "Mangler info", color: "bg-amber-100 text-amber-800", dotClass: "bg-amber-500" },
  ready_for_review: { label: "Klar for vurdering", color: "bg-indigo-100 text-indigo-800", dotClass: "bg-indigo-500" },
  in_progress: { label: "Under behandling", color: "bg-purple-100 text-purple-800", dotClass: "bg-purple-500" },
  planned: { label: "Planlagt", color: "bg-cyan-100 text-cyan-800", dotClass: "bg-cyan-500" },
  converted: { label: "Konvertert til oppdrag", color: "bg-green-100 text-green-800", dotClass: "bg-green-500" },
  rejected: { label: "Avvist", color: "bg-red-100 text-red-800", dotClass: "bg-red-500" },
  closed: { label: "Lukket", color: "bg-muted text-muted-foreground", dotClass: "bg-muted-foreground" },
};

export const ORDER_PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  critical: { label: "Kritisk stopp", color: "bg-red-100 text-red-800" },
  high: { label: "Høy", color: "bg-orange-100 text-orange-800" },
  normal: { label: "Normal", color: "bg-muted text-muted-foreground" },
  low: { label: "Lav", color: "bg-muted text-muted-foreground" },
};

export interface OrderFormSubmission {
  id: string;
  company_id: string;
  template_id: string;
  submission_no: string;
  status: OrderFormSubmissionStatus;
  source: string;
  requester_type: "internal" | "external";
  submitted_by: string | null;
  submitted_at: string;
  linked_customer_id: string | null;
  linked_project_id: string | null;
  assigned_to: string | null;
  priority: string;
  summary: Record<string, any> | null;
  created_at: string;
  updated_at: string;
  // Joined
  template?: OrderFormTemplate;
}

export interface OrderFormSubmissionValue {
  id: string;
  submission_id: string;
  field_key: string;
  value: any;
}

export interface OrderFormAttachment {
  id: string;
  submission_id: string;
  field_key: string | null;
  category: string | null;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  uploaded_at: string;
}

export interface OrderFormComment {
  id: string;
  submission_id: string;
  body: string;
  comment_type: "internal" | "external" | "system";
  created_by: string | null;
  created_at: string;
}

export interface OrderFormActivityEntry {
  id: string;
  submission_id: string;
  event_type: string;
  payload: Record<string, any> | null;
  created_by: string | null;
  created_at: string;
}

// ── Template with sections and fields (for builder/renderer) ──

export interface OrderFormTemplateWithStructure extends OrderFormTemplate {
  sections: (OrderFormSection & { fields: OrderFormField[] })[];
}

// ── "Bestill service" default sections ──

export const SERVICE_ORDER_SECTIONS = [
  "bestillingstype",
  "bestiller",
  "kunde_og_anlegg",
  "oppdrag",
  "teknisk_grunnlag",
  "material_og_ansvar",
  "gjennomforing_hms",
  "vedlegg",
  "intern_kontroll",
  "bekreftelse",
] as const;
