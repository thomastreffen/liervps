
-- Enum for offer followup task types
CREATE TYPE public.offer_followup_type AS ENUM (
  'offer_follow_up',
  'offer_hot_lead_follow_up',
  'offer_expiry_warning',
  'offer_next_step_missing',
  'offer_active_customer_follow_up'
);

-- Enum for followup task status
CREATE TYPE public.offer_followup_status AS ENUM (
  'open',
  'snoozed',
  'completed',
  'cancelled'
);

-- Enum for followup task priority
CREATE TYPE public.offer_followup_priority AS ENUM (
  'low',
  'medium',
  'high',
  'urgent'
);

-- Offer followup tasks table
CREATE TABLE public.offer_followup_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  offer_id UUID NOT NULL REFERENCES public.calculations(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.internal_companies(id),
  task_type public.offer_followup_type NOT NULL,
  status public.offer_followup_status NOT NULL DEFAULT 'open',
  priority public.offer_followup_priority NOT NULL DEFAULT 'medium',
  title TEXT NOT NULL,
  description TEXT,
  assigned_to UUID,
  due_date DATE,
  snoozed_until TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completed_by UUID,
  lead_id UUID,
  customer_name TEXT,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Deduplication: only one active task per offer per type
  CONSTRAINT uq_offer_followup_active UNIQUE (offer_id, task_type, status)
);

-- Note: The UNIQUE constraint above won't work perfectly for dedup since status changes.
-- Drop it and use a partial unique index instead.
ALTER TABLE public.offer_followup_tasks DROP CONSTRAINT uq_offer_followup_active;

CREATE UNIQUE INDEX idx_offer_followup_dedup
  ON public.offer_followup_tasks (offer_id, task_type)
  WHERE status IN ('open', 'snoozed');

-- Performance indexes
CREATE INDEX idx_offer_followup_assigned ON public.offer_followup_tasks (assigned_to, status, due_date);
CREATE INDEX idx_offer_followup_offer ON public.offer_followup_tasks (offer_id, status);
CREATE INDEX idx_offer_followup_company ON public.offer_followup_tasks (company_id, status, due_date);

-- Updated_at trigger
CREATE TRIGGER set_offer_followup_updated_at
  BEFORE UPDATE ON public.offer_followup_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.offer_followup_tasks ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read tasks for their company
CREATE POLICY "Users can read followup tasks for their company"
  ON public.offer_followup_tasks
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT um.company_id FROM public.user_memberships um
      WHERE um.user_id = auth.uid() AND um.is_active = true
    )
    OR assigned_to = auth.uid()
    OR public.check_permission_v2(auth.uid(), 'admin.manage_users')
  );

-- Users can update their assigned tasks
CREATE POLICY "Users can update their followup tasks"
  ON public.offer_followup_tasks
  FOR UPDATE
  TO authenticated
  USING (
    assigned_to = auth.uid()
    OR public.check_permission_v2(auth.uid(), 'admin.manage_users')
  )
  WITH CHECK (
    assigned_to = auth.uid()
    OR public.check_permission_v2(auth.uid(), 'admin.manage_users')
  );

-- System/authenticated can insert
CREATE POLICY "Authenticated users can insert followup tasks"
  ON public.offer_followup_tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
