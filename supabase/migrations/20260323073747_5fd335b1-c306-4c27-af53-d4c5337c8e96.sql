
-- ========================================
-- Order Forms Module – Core Schema
-- ========================================

-- Submission number sequence
CREATE SEQUENCE IF NOT EXISTS public.order_form_submission_no_seq START 1;

-- ── Templates ──
CREATE TABLE public.order_form_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.internal_companies(id),
  name text NOT NULL,
  slug text NOT NULL,
  category text,
  audience_type text NOT NULL DEFAULT 'both',
  internal_title text,
  external_title text,
  description text,
  confirmation_text text,
  send_email_to text[],
  on_submit_action text NOT NULL DEFAULT 'queue',
  is_active boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, slug)
);

ALTER TABLE public.order_form_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view active templates in their company"
  ON public.order_form_templates FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "Admins can manage templates"
  ON public.order_form_templates FOR ALL TO authenticated
  USING (public.check_permission_v2(auth.uid(), 'admin.manage_users') AND public.is_company_member(auth.uid(), company_id))
  WITH CHECK (public.check_permission_v2(auth.uid(), 'admin.manage_users') AND public.is_company_member(auth.uid(), company_id));

-- ── Sections ──
CREATE TABLE public.order_form_template_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.order_form_templates(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  visibility_rules jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.order_form_template_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sections follow template access"
  ON public.order_form_template_sections FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.order_form_templates t WHERE t.id = template_id AND public.is_company_member(auth.uid(), t.company_id)));

CREATE POLICY "Admins can manage sections"
  ON public.order_form_template_sections FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.order_form_templates t WHERE t.id = template_id AND public.check_permission_v2(auth.uid(), 'admin.manage_users') AND public.is_company_member(auth.uid(), t.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.order_form_templates t WHERE t.id = template_id AND public.check_permission_v2(auth.uid(), 'admin.manage_users') AND public.is_company_member(auth.uid(), t.company_id)));

-- ── Fields ──
CREATE TABLE public.order_form_template_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.order_form_templates(id) ON DELETE CASCADE,
  section_id uuid NOT NULL REFERENCES public.order_form_template_sections(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  label text NOT NULL,
  field_type text NOT NULL,
  placeholder text,
  help_text text,
  is_required boolean NOT NULL DEFAULT false,
  is_readonly boolean NOT NULL DEFAULT false,
  default_value jsonb,
  options jsonb,
  validation jsonb,
  conditional_logic jsonb,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.order_form_template_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Fields follow template access"
  ON public.order_form_template_fields FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.order_form_templates t WHERE t.id = template_id AND public.is_company_member(auth.uid(), t.company_id)));

CREATE POLICY "Admins can manage fields"
  ON public.order_form_template_fields FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.order_form_templates t WHERE t.id = template_id AND public.check_permission_v2(auth.uid(), 'admin.manage_users') AND public.is_company_member(auth.uid(), t.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.order_form_templates t WHERE t.id = template_id AND public.check_permission_v2(auth.uid(), 'admin.manage_users') AND public.is_company_member(auth.uid(), t.company_id)));

-- ── Submissions ──
CREATE TABLE public.order_form_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.internal_companies(id),
  template_id uuid NOT NULL REFERENCES public.order_form_templates(id),
  submission_no text NOT NULL DEFAULT ('BST-' || LPAD(nextval('public.order_form_submission_no_seq')::text, 6, '0')),
  status text NOT NULL DEFAULT 'new',
  source text NOT NULL DEFAULT 'internal',
  requester_type text NOT NULL DEFAULT 'internal',
  submitted_by uuid,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  linked_customer_id uuid,
  linked_project_id uuid,
  assigned_to uuid,
  priority text NOT NULL DEFAULT 'normal',
  summary jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.order_form_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view submissions in their company"
  ON public.order_form_submissions FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "Authenticated users can insert submissions"
  ON public.order_form_submissions FOR INSERT TO authenticated
  WITH CHECK (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "Admins can update submissions"
  ON public.order_form_submissions FOR UPDATE TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));

-- ── Submission Values ──
CREATE TABLE public.order_form_submission_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.order_form_submissions(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.order_form_submission_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Values follow submission access"
  ON public.order_form_submission_values FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.order_form_submissions s WHERE s.id = submission_id AND public.is_company_member(auth.uid(), s.company_id)));

CREATE POLICY "Users can insert values"
  ON public.order_form_submission_values FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.order_form_submissions s WHERE s.id = submission_id AND public.is_company_member(auth.uid(), s.company_id)));

-- ── Submission Attachments ──
CREATE TABLE public.order_form_submission_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.order_form_submissions(id) ON DELETE CASCADE,
  field_key text,
  category text,
  file_name text NOT NULL,
  file_path text NOT NULL,
  mime_type text,
  file_size bigint,
  uploaded_by uuid,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.order_form_submission_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Attachments follow submission access"
  ON public.order_form_submission_attachments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.order_form_submissions s WHERE s.id = submission_id AND public.is_company_member(auth.uid(), s.company_id)));

CREATE POLICY "Users can insert attachments"
  ON public.order_form_submission_attachments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.order_form_submissions s WHERE s.id = submission_id AND public.is_company_member(auth.uid(), s.company_id)));

-- ── Comments ──
CREATE TABLE public.order_form_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.order_form_submissions(id) ON DELETE CASCADE,
  body text NOT NULL,
  comment_type text NOT NULL DEFAULT 'internal',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.order_form_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comments follow submission access"
  ON public.order_form_comments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.order_form_submissions s WHERE s.id = submission_id AND public.is_company_member(auth.uid(), s.company_id)));

CREATE POLICY "Users can insert comments"
  ON public.order_form_comments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.order_form_submissions s WHERE s.id = submission_id AND public.is_company_member(auth.uid(), s.company_id)));

-- ── Activity Log ──
CREATE TABLE public.order_form_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.order_form_submissions(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.order_form_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Activity follows submission access"
  ON public.order_form_activity_log FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.order_form_submissions s WHERE s.id = submission_id AND public.is_company_member(auth.uid(), s.company_id)));

CREATE POLICY "System can insert activity"
  ON public.order_form_activity_log FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.order_form_submissions s WHERE s.id = submission_id AND public.is_company_member(auth.uid(), s.company_id)));

-- ── Storage bucket for order form attachments ──
INSERT INTO storage.buckets (id, name, public) VALUES ('order-form-attachments', 'order-form-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload order form attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'order-form-attachments');

CREATE POLICY "Authenticated users can read order form attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'order-form-attachments');

-- ── Indexes ──
CREATE INDEX idx_order_form_submissions_company ON public.order_form_submissions(company_id);
CREATE INDEX idx_order_form_submissions_status ON public.order_form_submissions(status);
CREATE INDEX idx_order_form_submissions_template ON public.order_form_submissions(template_id);
CREATE INDEX idx_order_form_submission_values_submission ON public.order_form_submission_values(submission_id);
CREATE INDEX idx_order_form_template_fields_section ON public.order_form_template_fields(section_id);
CREATE INDEX idx_order_form_template_sections_template ON public.order_form_template_sections(template_id);

-- ── Updated_at triggers ──
CREATE TRIGGER set_updated_at_order_form_templates
  BEFORE UPDATE ON public.order_form_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_updated_at_order_form_submissions
  BEFORE UPDATE ON public.order_form_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
