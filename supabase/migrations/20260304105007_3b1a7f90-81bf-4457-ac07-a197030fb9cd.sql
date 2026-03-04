
-- Schedule blocks: core table for resource planning with Outlook sync
CREATE TABLE public.schedule_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.internal_companies(id),
  technician_id UUID NOT NULL REFERENCES public.technicians(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  
  -- Outlook sync fields
  outlook_event_id TEXT,
  calendar_id TEXT,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('outlook', 'manual', 'system')),
  
  -- Time
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  
  -- Content
  title TEXT NOT NULL DEFAULT '',
  location TEXT,
  description TEXT,
  
  -- Project matching
  match_confidence INTEGER DEFAULT 0,
  match_reason TEXT,
  match_state TEXT NOT NULL DEFAULT 'external' CHECK (match_state IN ('auto', 'needs_confirmation', 'external', 'confirmed', 'manual')),
  
  -- Sync metadata
  last_modified TIMESTAMPTZ,
  outlook_etag TEXT,
  mcs_block_id TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Idempotency: unique per outlook event + calendar
  CONSTRAINT uq_outlook_event UNIQUE (outlook_event_id, calendar_id)
);

-- Indexes for common queries
CREATE INDEX idx_schedule_blocks_tech_time ON public.schedule_blocks (technician_id, start_at, end_at);
CREATE INDEX idx_schedule_blocks_match_state ON public.schedule_blocks (match_state) WHERE match_state = 'needs_confirmation';
CREATE INDEX idx_schedule_blocks_company ON public.schedule_blocks (company_id);
CREATE INDEX idx_schedule_blocks_project ON public.schedule_blocks (project_id);

-- Enable RLS
ALTER TABLE public.schedule_blocks ENABLE ROW LEVEL SECURITY;

-- RLS policies: authenticated users in same company can read
CREATE POLICY "Users can view schedule blocks in their company"
ON public.schedule_blocks FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_scopes us
    JOIN public.user_accounts ua ON ua.id = us.user_account_id
    WHERE ua.auth_user_id = auth.uid() AND ua.is_active = true
      AND us.company_id = schedule_blocks.company_id
  )
  OR public.check_permission_v2(auth.uid(), 'admin.manage_users')
);

-- Admins can insert/update/delete
CREATE POLICY "Admins can manage schedule blocks"
ON public.schedule_blocks FOR ALL TO authenticated
USING (public.check_permission_v2(auth.uid(), 'admin.manage_users'))
WITH CHECK (public.check_permission_v2(auth.uid(), 'admin.manage_users'));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.schedule_blocks;

-- Auto-update updated_at
CREATE TRIGGER set_schedule_blocks_updated_at
  BEFORE UPDATE ON public.schedule_blocks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
