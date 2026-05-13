-- =========================================================================
-- HMS & HR-modul – grunnstruktur
-- =========================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('hms-attachments', 'hms-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Helper-funksjoner
CREATE OR REPLACE FUNCTION public.has_hms_manage(_auth_user_id uuid, _company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.check_permission_v2(_auth_user_id, 'admin.manage_users')
    OR (
      public.check_permission_v2(_auth_user_id, 'hms.manage')
      AND public.user_has_company_access(_auth_user_id, _company_id)
    )
$$;

CREATE OR REPLACE FUNCTION public.has_hms_view(_auth_user_id uuid, _company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.has_hms_manage(_auth_user_id, _company_id)
    OR (
      public.user_has_company_access(_auth_user_id, _company_id)
      AND (
        public.check_permission_v2(_auth_user_id, 'hms.view')
        OR public.check_permission_v2(_auth_user_id, 'hms.manage')
      )
    )
$$;

-- ===== HÅNDBØKER =====
CREATE TABLE public.hms_handbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  handbook_type text NOT NULL DEFAULT 'hms',
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft',
  current_version_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid
);
CREATE INDEX idx_hms_handbooks_company ON public.hms_handbooks(company_id) WHERE deleted_at IS NULL;

CREATE TABLE public.hms_handbook_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handbook_id uuid NOT NULL REFERENCES public.hms_handbooks(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  version_number int NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  changelog text,
  requires_acknowledgement boolean NOT NULL DEFAULT true,
  published_at timestamptz,
  published_by uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (handbook_id, version_number)
);
CREATE INDEX idx_hms_handbook_versions_handbook ON public.hms_handbook_versions(handbook_id);

ALTER TABLE public.hms_handbooks
  ADD CONSTRAINT hms_handbooks_current_version_fk
  FOREIGN KEY (current_version_id) REFERENCES public.hms_handbook_versions(id) ON DELETE SET NULL;

CREATE TABLE public.hms_handbook_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.hms_handbook_versions(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.hms_handbook_sections(id) ON DELETE CASCADE,
  ordering int NOT NULL DEFAULT 0,
  heading text NOT NULL,
  body text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_hms_handbook_sections_version ON public.hms_handbook_sections(version_id);

CREATE TABLE public.hms_handbook_acknowledgements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.hms_handbook_versions(id) ON DELETE CASCADE,
  handbook_id uuid NOT NULL REFERENCES public.hms_handbooks(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  user_id uuid NOT NULL,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,
  UNIQUE (version_id, user_id)
);
CREATE INDEX idx_hms_handbook_ack_user ON public.hms_handbook_acknowledgements(user_id);

-- ===== MALER =====
CREATE TABLE public.hms_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  kind text NOT NULL,
  category text NOT NULL DEFAULT 'generell',
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  version int NOT NULL DEFAULT 1,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid
);
CREATE INDEX idx_hms_templates_company ON public.hms_templates(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_hms_templates_kind ON public.hms_templates(kind, category) WHERE deleted_at IS NULL;

CREATE TABLE public.hms_template_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.hms_templates(id) ON DELETE CASCADE,
  ordering int NOT NULL DEFAULT 0,
  title text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_hms_template_sections_template ON public.hms_template_sections(template_id);

CREATE TABLE public.hms_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES public.hms_template_sections(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.hms_templates(id) ON DELETE CASCADE,
  ordering int NOT NULL DEFAULT 0,
  item_type text NOT NULL,
  label text NOT NULL,
  help_text text,
  is_required boolean NOT NULL DEFAULT false,
  options jsonb,
  ai_hint text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_hms_template_items_section ON public.hms_template_items(section_id);

-- ===== INNSENDINGER =====
CREATE TABLE public.hms_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  template_id uuid REFERENCES public.hms_templates(id) ON DELETE SET NULL,
  template_snapshot jsonb,
  project_id uuid,
  title text,
  status text NOT NULL DEFAULT 'draft',
  submitted_by uuid,
  submitted_at timestamptz,
  reviewed_by uuid,
  reviewed_at timestamptz,
  location text,
  gps_lat numeric,
  gps_lng numeric,
  client_request_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid
);
CREATE INDEX idx_hms_submissions_company ON public.hms_submissions(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_hms_submissions_template ON public.hms_submissions(template_id);
CREATE INDEX idx_hms_submissions_project ON public.hms_submissions(project_id);
CREATE UNIQUE INDEX idx_hms_submissions_client_request
  ON public.hms_submissions(company_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

CREATE TABLE public.hms_submission_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.hms_submissions(id) ON DELETE CASCADE,
  item_id uuid,
  item_key text,
  value jsonb,
  photos text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_hms_submission_answers_submission ON public.hms_submission_answers(submission_id);

CREATE TABLE public.hms_submission_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.hms_submissions(id) ON DELETE CASCADE,
  user_id uuid,
  display_name text NOT NULL,
  role text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_hms_submission_participants_submission ON public.hms_submission_participants(submission_id);

CREATE TABLE public.hms_submission_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.hms_submissions(id) ON DELETE CASCADE,
  signer_user_id uuid,
  signer_name text NOT NULL,
  signature_data text,
  signed_at timestamptz NOT NULL DEFAULT now(),
  ip_address text
);
CREATE INDEX idx_hms_submission_sigs_submission ON public.hms_submission_signatures(submission_id);

-- ===== RISIKO / TILTAK / AVVIK =====
CREATE TABLE public.hms_risk_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  project_id uuid,
  template_id uuid REFERENCES public.hms_templates(id) ON DELETE SET NULL,
  submission_id uuid REFERENCES public.hms_submissions(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid
);
CREATE INDEX idx_hms_risk_assess_company ON public.hms_risk_assessments(company_id) WHERE deleted_at IS NULL;

CREATE TABLE public.hms_risk_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.hms_risk_assessments(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  description text NOT NULL,
  probability int NOT NULL DEFAULT 1,
  consequence int NOT NULL DEFAULT 1,
  score int GENERATED ALWAYS AS (probability * consequence) STORED,
  proposed_action text,
  ai_generated boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_hms_risk_items_assessment ON public.hms_risk_items(assessment_id);

CREATE TABLE public.hms_action_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  assignee_user_id uuid,
  due_date date,
  status text NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'normal',
  risk_item_id uuid REFERENCES public.hms_risk_items(id) ON DELETE SET NULL,
  incident_id uuid,
  submission_id uuid REFERENCES public.hms_submissions(id) ON DELETE SET NULL,
  alert_id uuid,
  completed_at timestamptz,
  completed_by uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid
);
CREATE INDEX idx_hms_action_items_company ON public.hms_action_items(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_hms_action_items_assignee ON public.hms_action_items(assignee_user_id);

CREATE TABLE public.hms_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  incident_type text NOT NULL,
  severity text NOT NULL DEFAULT 'low',
  title text NOT NULL,
  description text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  reported_by uuid,
  project_id uuid,
  location text,
  status text NOT NULL DEFAULT 'open',
  closed_by uuid,
  closed_at timestamptz,
  closure_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid
);
CREATE INDEX idx_hms_incidents_company ON public.hms_incidents(company_id) WHERE deleted_at IS NULL;

ALTER TABLE public.hms_action_items
  ADD CONSTRAINT hms_action_items_incident_fk
  FOREIGN KEY (incident_id) REFERENCES public.hms_incidents(id) ON DELETE SET NULL;

-- ===== ARBEIDSTID / AML =====
CREATE TABLE public.worktime_rulesets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  is_default boolean NOT NULL DEFAULT false,
  rules jsonb NOT NULL DEFAULT jsonb_build_object(
    'max_hours_per_day', 13,
    'warn_hours_per_day', 10,
    'max_hours_per_week', 48,
    'warn_hours_per_week', 40,
    'max_overtime_7d', 13,
    'warn_overtime_7d', 10,
    'max_overtime_4w', 30,
    'warn_overtime_4w', 25,
    'max_overtime_52w', 240,
    'warn_overtime_52w', 200,
    'min_rest_hours', 11
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_worktime_rulesets_company ON public.worktime_rulesets(company_id);

CREATE TABLE public.employee_work_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  user_id uuid NOT NULL,
  external_employee_id text,
  fte_pct numeric NOT NULL DEFAULT 100,
  weekly_norm_hours numeric NOT NULL DEFAULT 37.5,
  ruleset_id uuid REFERENCES public.worktime_rulesets(id) ON DELETE SET NULL,
  averaging_enabled boolean NOT NULL DEFAULT false,
  averaging_period_weeks int,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id)
);
CREATE INDEX idx_employee_work_profiles_company ON public.employee_work_profiles(company_id);
CREATE INDEX idx_employee_work_profiles_external ON public.employee_work_profiles(company_id, external_employee_id);

CREATE TABLE public.worktime_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  source_system text NOT NULL DEFAULT 'tripletex',
  filename text,
  imported_by uuid,
  status text NOT NULL DEFAULT 'processing',
  total_rows int DEFAULT 0,
  new_rows int DEFAULT 0,
  updated_rows int DEFAULT 0,
  unchanged_rows int DEFAULT 0,
  skipped_rows int DEFAULT 0,
  error_message text,
  mapping jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX idx_worktime_batches_company ON public.worktime_import_batches(company_id);

CREATE TABLE public.worktime_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  user_id uuid,
  external_employee_id text,
  employee_name text,
  work_date date NOT NULL,
  start_at timestamptz,
  end_at timestamptz,
  hours numeric NOT NULL DEFAULT 0,
  hours_overtime numeric NOT NULL DEFAULT 0,
  project_external_ref text,
  activity text,
  description text,
  source_system text NOT NULL DEFAULT 'tripletex',
  source_external_id text,
  source_hash text NOT NULL,
  batch_id uuid REFERENCES public.worktime_import_batches(id) ON DELETE SET NULL,
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_worktime_entries_company_date ON public.worktime_entries(company_id, work_date);
CREATE INDEX idx_worktime_entries_user_date ON public.worktime_entries(user_id, work_date);
CREATE UNIQUE INDEX idx_worktime_entries_source_external
  ON public.worktime_entries(source_system, source_external_id)
  WHERE source_external_id IS NOT NULL;
CREATE UNIQUE INDEX idx_worktime_entries_source_hash
  ON public.worktime_entries(company_id, source_hash);

CREATE TABLE public.worktime_rule_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  user_id uuid NOT NULL,
  rule_key text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  value numeric NOT NULL,
  threshold numeric NOT NULL,
  status text NOT NULL,
  checked_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_worktime_rule_checks_user_period ON public.worktime_rule_checks(user_id, rule_key, period_start);

CREATE TABLE public.worktime_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  user_id uuid NOT NULL,
  rule_key text NOT NULL,
  severity text NOT NULL DEFAULT 'warn',
  period_start date NOT NULL,
  period_end date NOT NULL,
  value numeric NOT NULL,
  threshold numeric NOT NULL,
  why text NOT NULL,
  consequence text NOT NULL,
  suggested_action text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_worktime_alerts_company_status ON public.worktime_alerts(company_id, status);
CREATE INDEX idx_worktime_alerts_user ON public.worktime_alerts(user_id, status);
CREATE UNIQUE INDEX idx_worktime_alerts_dedup
  ON public.worktime_alerts(company_id, user_id, rule_key, period_start, period_end)
  WHERE status IN ('open', 'acknowledged');

ALTER TABLE public.hms_action_items
  ADD CONSTRAINT hms_action_items_alert_fk
  FOREIGN KEY (alert_id) REFERENCES public.worktime_alerts(id) ON DELETE SET NULL;

CREATE TABLE public.worktime_alert_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid NOT NULL REFERENCES public.worktime_alerts(id) ON DELETE CASCADE,
  performed_by uuid,
  action text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_worktime_alert_actions_alert ON public.worktime_alert_actions(alert_id);

CREATE TABLE public.overtime_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  user_id uuid NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  approved_hours numeric NOT NULL DEFAULT 0,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  approved_by uuid,
  approved_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_overtime_approvals_user ON public.overtime_approvals(user_id, period_start);

-- ===== AUDIT =====
CREATE TABLE public.hms_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid,
  entity_type text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  performed_by uuid,
  performed_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb DEFAULT '{}'::jsonb
);
CREATE INDEX idx_hms_audit_company_time ON public.hms_audit_log(company_id, performed_at DESC);
CREATE INDEX idx_hms_audit_entity ON public.hms_audit_log(entity_type, entity_id);

-- updated_at-triggere
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'hms_handbooks','hms_handbook_versions','hms_handbook_sections',
      'hms_templates','hms_submissions','hms_submission_answers',
      'hms_risk_assessments','hms_risk_items','hms_action_items','hms_incidents',
      'worktime_rulesets','employee_work_profiles','worktime_entries',
      'worktime_alerts','overtime_approvals'
    ])
  LOOP
    EXECUTE format(
      'CREATE TRIGGER %I_set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()',
      t, t
    );
  END LOOP;
END$$;

-- ===== RLS =====
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'hms_handbooks','hms_handbook_versions','hms_handbook_sections','hms_handbook_acknowledgements',
      'hms_templates','hms_template_sections','hms_template_items',
      'hms_submissions','hms_submission_answers','hms_submission_participants','hms_submission_signatures',
      'hms_risk_assessments','hms_risk_items','hms_action_items','hms_incidents',
      'worktime_rulesets','employee_work_profiles','worktime_import_batches',
      'worktime_entries','worktime_rule_checks','worktime_alerts','worktime_alert_actions',
      'overtime_approvals','hms_audit_log'
    ])
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END$$;

-- Håndbøker
CREATE POLICY hms_handbooks_select ON public.hms_handbooks FOR SELECT USING (
  deleted_at IS NULL AND (
    public.has_hms_view(auth.uid(), company_id)
    OR (status = 'published' AND public.user_has_company_access(auth.uid(), company_id))
  )
);
CREATE POLICY hms_handbooks_write ON public.hms_handbooks FOR ALL
  USING (public.has_hms_manage(auth.uid(), company_id))
  WITH CHECK (public.has_hms_manage(auth.uid(), company_id));

CREATE POLICY hms_handbook_versions_select ON public.hms_handbook_versions FOR SELECT USING (
  public.has_hms_view(auth.uid(), company_id)
  OR (status = 'published' AND public.user_has_company_access(auth.uid(), company_id))
);
CREATE POLICY hms_handbook_versions_write ON public.hms_handbook_versions FOR ALL
  USING (public.has_hms_manage(auth.uid(), company_id))
  WITH CHECK (public.has_hms_manage(auth.uid(), company_id));

CREATE POLICY hms_handbook_sections_select ON public.hms_handbook_sections FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.hms_handbook_versions v WHERE v.id = version_id
    AND (public.has_hms_view(auth.uid(), v.company_id)
      OR (v.status = 'published' AND public.user_has_company_access(auth.uid(), v.company_id))))
);
CREATE POLICY hms_handbook_sections_write ON public.hms_handbook_sections FOR ALL
  USING (EXISTS (SELECT 1 FROM public.hms_handbook_versions v WHERE v.id = version_id
    AND public.has_hms_manage(auth.uid(), v.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.hms_handbook_versions v WHERE v.id = version_id
    AND public.has_hms_manage(auth.uid(), v.company_id)));

CREATE POLICY hms_handbook_ack_select ON public.hms_handbook_acknowledgements FOR SELECT USING (
  user_id = auth.uid() OR public.has_hms_view(auth.uid(), company_id)
);
CREATE POLICY hms_handbook_ack_insert ON public.hms_handbook_acknowledgements FOR INSERT WITH CHECK (
  user_id = auth.uid() AND public.user_has_company_access(auth.uid(), company_id)
);

-- Maler
CREATE POLICY hms_templates_select ON public.hms_templates FOR SELECT USING (
  deleted_at IS NULL AND (
    public.has_hms_view(auth.uid(), company_id)
    OR (is_active AND public.user_has_company_access(auth.uid(), company_id))
  )
);
CREATE POLICY hms_templates_write ON public.hms_templates FOR ALL
  USING (public.has_hms_manage(auth.uid(), company_id))
  WITH CHECK (public.has_hms_manage(auth.uid(), company_id));

CREATE POLICY hms_template_sections_select ON public.hms_template_sections FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.hms_templates t WHERE t.id = template_id
    AND (public.has_hms_view(auth.uid(), t.company_id)
      OR (t.is_active AND public.user_has_company_access(auth.uid(), t.company_id))))
);
CREATE POLICY hms_template_sections_write ON public.hms_template_sections FOR ALL
  USING (EXISTS (SELECT 1 FROM public.hms_templates t WHERE t.id = template_id
    AND public.has_hms_manage(auth.uid(), t.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.hms_templates t WHERE t.id = template_id
    AND public.has_hms_manage(auth.uid(), t.company_id)));

CREATE POLICY hms_template_items_select ON public.hms_template_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.hms_templates t WHERE t.id = template_id
    AND (public.has_hms_view(auth.uid(), t.company_id)
      OR (t.is_active AND public.user_has_company_access(auth.uid(), t.company_id))))
);
CREATE POLICY hms_template_items_write ON public.hms_template_items FOR ALL
  USING (EXISTS (SELECT 1 FROM public.hms_templates t WHERE t.id = template_id
    AND public.has_hms_manage(auth.uid(), t.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.hms_templates t WHERE t.id = template_id
    AND public.has_hms_manage(auth.uid(), t.company_id)));

-- Innsendinger
CREATE POLICY hms_submissions_select ON public.hms_submissions FOR SELECT USING (
  deleted_at IS NULL AND (
    public.has_hms_view(auth.uid(), company_id)
    OR submitted_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.hms_submission_participants p WHERE p.submission_id = hms_submissions.id AND p.user_id = auth.uid())
  )
);
CREATE POLICY hms_submissions_insert ON public.hms_submissions FOR INSERT
  WITH CHECK (public.user_has_company_access(auth.uid(), company_id));
CREATE POLICY hms_submissions_update ON public.hms_submissions FOR UPDATE
  USING (public.has_hms_manage(auth.uid(), company_id) OR (submitted_by = auth.uid() AND status = 'draft'))
  WITH CHECK (public.has_hms_manage(auth.uid(), company_id) OR (submitted_by = auth.uid() AND status IN ('draft','submitted')));
CREATE POLICY hms_submissions_delete ON public.hms_submissions FOR DELETE
  USING (public.has_hms_manage(auth.uid(), company_id));

CREATE POLICY hms_submission_answers_all ON public.hms_submission_answers FOR ALL
  USING (EXISTS (SELECT 1 FROM public.hms_submissions s WHERE s.id = submission_id
    AND (public.has_hms_view(auth.uid(), s.company_id) OR s.submitted_by = auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.hms_submissions s WHERE s.id = submission_id
    AND (public.has_hms_manage(auth.uid(), s.company_id)
      OR (s.submitted_by = auth.uid() AND s.status IN ('draft','submitted')))));

CREATE POLICY hms_submission_participants_all ON public.hms_submission_participants FOR ALL
  USING (EXISTS (SELECT 1 FROM public.hms_submissions s WHERE s.id = submission_id
    AND (public.has_hms_view(auth.uid(), s.company_id) OR s.submitted_by = auth.uid()
      OR hms_submission_participants.user_id = auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.hms_submissions s WHERE s.id = submission_id
    AND (public.has_hms_manage(auth.uid(), s.company_id)
      OR (s.submitted_by = auth.uid() AND s.status IN ('draft','submitted')))));

CREATE POLICY hms_submission_sigs_select ON public.hms_submission_signatures FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.hms_submissions s WHERE s.id = submission_id
    AND (public.has_hms_view(auth.uid(), s.company_id) OR s.submitted_by = auth.uid())));
CREATE POLICY hms_submission_sigs_insert ON public.hms_submission_signatures FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.hms_submissions s WHERE s.id = submission_id
    AND public.user_has_company_access(auth.uid(), s.company_id)));

-- Risiko / tiltak / avvik
CREATE POLICY hms_risk_assess_select ON public.hms_risk_assessments FOR SELECT
  USING (deleted_at IS NULL AND public.has_hms_view(auth.uid(), company_id));
CREATE POLICY hms_risk_assess_write ON public.hms_risk_assessments FOR ALL
  USING (public.has_hms_manage(auth.uid(), company_id))
  WITH CHECK (public.has_hms_manage(auth.uid(), company_id));

CREATE POLICY hms_risk_items_select ON public.hms_risk_items FOR SELECT
  USING (public.has_hms_view(auth.uid(), company_id));
CREATE POLICY hms_risk_items_write ON public.hms_risk_items FOR ALL
  USING (public.has_hms_manage(auth.uid(), company_id))
  WITH CHECK (public.has_hms_manage(auth.uid(), company_id));

CREATE POLICY hms_action_items_select ON public.hms_action_items FOR SELECT
  USING (deleted_at IS NULL AND (public.has_hms_view(auth.uid(), company_id) OR assignee_user_id = auth.uid()));
CREATE POLICY hms_action_items_write ON public.hms_action_items FOR ALL
  USING (public.has_hms_manage(auth.uid(), company_id) OR assignee_user_id = auth.uid())
  WITH CHECK (public.has_hms_manage(auth.uid(), company_id)
    OR (assignee_user_id = auth.uid() AND public.user_has_company_access(auth.uid(), company_id)));

CREATE POLICY hms_incidents_select ON public.hms_incidents FOR SELECT
  USING (deleted_at IS NULL AND (public.has_hms_view(auth.uid(), company_id) OR reported_by = auth.uid()));
CREATE POLICY hms_incidents_insert ON public.hms_incidents FOR INSERT
  WITH CHECK (public.user_has_company_access(auth.uid(), company_id));
CREATE POLICY hms_incidents_update ON public.hms_incidents FOR UPDATE
  USING (public.has_hms_manage(auth.uid(), company_id) OR (reported_by = auth.uid() AND status = 'open'))
  WITH CHECK (public.has_hms_manage(auth.uid(), company_id) OR (reported_by = auth.uid() AND status = 'open'));
CREATE POLICY hms_incidents_delete ON public.hms_incidents FOR DELETE
  USING (public.has_hms_manage(auth.uid(), company_id));

-- Arbeidstid
CREATE POLICY worktime_rulesets_select ON public.worktime_rulesets FOR SELECT
  USING (public.has_hms_view(auth.uid(), company_id));
CREATE POLICY worktime_rulesets_write ON public.worktime_rulesets FOR ALL
  USING (public.has_hms_manage(auth.uid(), company_id))
  WITH CHECK (public.has_hms_manage(auth.uid(), company_id));

CREATE POLICY employee_work_profiles_select ON public.employee_work_profiles FOR SELECT
  USING (user_id = auth.uid() OR public.has_hms_view(auth.uid(), company_id));
CREATE POLICY employee_work_profiles_write ON public.employee_work_profiles FOR ALL
  USING (public.has_hms_manage(auth.uid(), company_id))
  WITH CHECK (public.has_hms_manage(auth.uid(), company_id));

CREATE POLICY worktime_import_batches_select ON public.worktime_import_batches FOR SELECT
  USING (public.has_hms_view(auth.uid(), company_id));
CREATE POLICY worktime_import_batches_write ON public.worktime_import_batches FOR ALL
  USING (public.has_hms_manage(auth.uid(), company_id))
  WITH CHECK (public.has_hms_manage(auth.uid(), company_id));

CREATE POLICY worktime_entries_select ON public.worktime_entries FOR SELECT
  USING (user_id = auth.uid() OR public.has_hms_view(auth.uid(), company_id));
CREATE POLICY worktime_entries_write ON public.worktime_entries FOR ALL
  USING (public.has_hms_manage(auth.uid(), company_id))
  WITH CHECK (public.has_hms_manage(auth.uid(), company_id));

CREATE POLICY worktime_rule_checks_select ON public.worktime_rule_checks FOR SELECT
  USING (user_id = auth.uid() OR public.has_hms_view(auth.uid(), company_id));
CREATE POLICY worktime_rule_checks_write ON public.worktime_rule_checks FOR ALL
  USING (public.has_hms_manage(auth.uid(), company_id))
  WITH CHECK (public.has_hms_manage(auth.uid(), company_id));

CREATE POLICY worktime_alerts_select ON public.worktime_alerts FOR SELECT
  USING (user_id = auth.uid() OR public.has_hms_view(auth.uid(), company_id));
CREATE POLICY worktime_alerts_write ON public.worktime_alerts FOR ALL
  USING (public.has_hms_manage(auth.uid(), company_id))
  WITH CHECK (public.has_hms_manage(auth.uid(), company_id));

CREATE POLICY worktime_alert_actions_select ON public.worktime_alert_actions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.worktime_alerts a WHERE a.id = alert_id
    AND (a.user_id = auth.uid() OR public.has_hms_view(auth.uid(), a.company_id))));
CREATE POLICY worktime_alert_actions_insert ON public.worktime_alert_actions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.worktime_alerts a WHERE a.id = alert_id
    AND public.has_hms_manage(auth.uid(), a.company_id)));

CREATE POLICY overtime_approvals_select ON public.overtime_approvals FOR SELECT
  USING (user_id = auth.uid() OR public.has_hms_view(auth.uid(), company_id));
CREATE POLICY overtime_approvals_insert ON public.overtime_approvals FOR INSERT
  WITH CHECK (public.user_has_company_access(auth.uid(), company_id));
CREATE POLICY overtime_approvals_update ON public.overtime_approvals FOR UPDATE
  USING (public.has_hms_manage(auth.uid(), company_id) OR public.check_permission_v2(auth.uid(), 'hms.approve_overtime'))
  WITH CHECK (public.has_hms_manage(auth.uid(), company_id) OR public.check_permission_v2(auth.uid(), 'hms.approve_overtime'));

CREATE POLICY hms_audit_log_select ON public.hms_audit_log FOR SELECT
  USING (public.has_hms_manage(auth.uid(), company_id));

-- Storage policies
CREATE POLICY hms_attachments_read ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'hms-attachments');
CREATE POLICY hms_attachments_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'hms-attachments');
CREATE POLICY hms_attachments_update ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'hms-attachments');
CREATE POLICY hms_attachments_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'hms-attachments');

-- Permissions for HMS-modul
INSERT INTO public.permissions (key, module, description) VALUES
  ('module.hms', 'module', 'Vis HMS & HR-modulen i menyen'),
  ('hms.view', 'hms', 'Se HMS-data i eget selskap'),
  ('hms.manage', 'hms', 'Opprett og endre HMS-innhold, AML-data og maler'),
  ('hms.approve_overtime', 'hms', 'Godkjenne overtid for ansatte')
ON CONFLICT (key) DO NOTHING;