-- B3: Extend worktime tables for AML engine + Tripletex import

ALTER TABLE public.worktime_entries
  ADD COLUMN IF NOT EXISTS break_minutes int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ordinary_hours numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_hours numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS time_type text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'imported',
  ADD COLUMN IF NOT EXISTS project_id uuid,
  ADD COLUMN IF NOT EXISTS project_number_raw text,
  ADD COLUMN IF NOT EXISTS manually_adjusted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_manually boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS adjustment_reason text;

ALTER TABLE public.worktime_alerts
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS explanation text,
  ADD COLUMN IF NOT EXISTS possible_company_consequence text,
  ADD COLUMN IF NOT EXISTS recommended_action text,
  ADD COLUMN IF NOT EXISTS assigned_to uuid,
  ADD COLUMN IF NOT EXISTS acknowledged_by uuid,
  ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolution_comment text,
  ADD COLUMN IF NOT EXISTS source_import_batch_id uuid REFERENCES public.worktime_import_batches(id) ON DELETE SET NULL;

ALTER TABLE public.worktime_rulesets
  ADD COLUMN IF NOT EXISTS version int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS active_from date,
  ADD COLUMN IF NOT EXISTS active_to date;

ALTER TABLE public.employee_work_profiles
  ADD COLUMN IF NOT EXISTS daily_norm_hours numeric NOT NULL DEFAULT 7.5,
  ADD COLUMN IF NOT EXISTS overtime_requires_approval boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS active_from date,
  ADD COLUMN IF NOT EXISTS active_to date,
  ADD COLUMN IF NOT EXISTS tariff_or_agreement text;

ALTER TABLE public.overtime_approvals
  ADD COLUMN IF NOT EXISTS reason_type text,
  ADD COLUMN IF NOT EXISTS worktime_entry_id uuid REFERENCES public.worktime_entries(id) ON DELETE SET NULL;

-- Helpful index for AML queries
CREATE INDEX IF NOT EXISTS idx_worktime_entries_user_status
  ON public.worktime_entries(company_id, user_id, work_date) WHERE status <> 'voided';