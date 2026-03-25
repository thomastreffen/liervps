
-- Company-level reminder settings
CREATE TABLE public.company_reminder_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.internal_companies(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  reminder_1_minutes integer NOT NULL DEFAULT 120,
  reminder_2_minutes integer NOT NULL DEFAULT 1440,
  reminder_3_minutes integer NOT NULL DEFAULT 2880,
  max_reminders integer NOT NULL DEFAULT 3,
  notify_manager boolean NOT NULL DEFAULT false,
  escalation_delay_minutes integer NOT NULL DEFAULT 60,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

ALTER TABLE public.company_reminder_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company settings"
  ON public.company_reminder_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage company settings"
  ON public.company_reminder_settings FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Add reminder fields to job_approvals
ALTER TABLE public.job_approvals
  ADD COLUMN IF NOT EXISTS response_required boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS reminder_profile text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS reminder_config jsonb DEFAULT null,
  ADD COLUMN IF NOT EXISTS reminder_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reminded_at timestamptz DEFAULT null;
