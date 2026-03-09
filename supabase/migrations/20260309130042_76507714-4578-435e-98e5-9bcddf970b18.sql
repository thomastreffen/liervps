
-- Enum for offer activity event types
CREATE TYPE public.offer_activity_event_type AS ENUM (
  'offer_created',
  'offer_sent_email',
  'offer_sent_link',
  'offer_viewed',
  'offer_pdf_downloaded',
  'offer_email_opened',
  'offer_link_clicked',
  'offer_accepted',
  'offer_rejected',
  'offer_expired'
);

-- Enum for actor type
CREATE TYPE public.offer_activity_actor_type AS ENUM (
  'system',
  'user',
  'customer'
);

-- Activity events table
CREATE TABLE public.offer_activity_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  offer_id UUID NOT NULL REFERENCES public.calculations(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.internal_companies(id),
  event_type public.offer_activity_event_type NOT NULL,
  event_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_type public.offer_activity_actor_type NOT NULL DEFAULT 'system',
  actor_id UUID,
  meta JSONB DEFAULT '{}'::jsonb
);

-- Indexes
CREATE INDEX idx_offer_activity_offer_time ON public.offer_activity_events (offer_id, event_at DESC);
CREATE INDEX idx_offer_activity_company_time ON public.offer_activity_events (company_id, event_at DESC);

-- Enable RLS
ALTER TABLE public.offer_activity_events ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read events for their company
CREATE POLICY "Users can read offer activity for their company"
  ON public.offer_activity_events
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT um.company_id FROM public.user_memberships um
      WHERE um.user_id = auth.uid() AND um.is_active = true
    )
    OR public.check_permission_v2(auth.uid(), 'admin.manage_users')
  );

-- Authenticated users can insert events
CREATE POLICY "Users can insert offer activity events"
  ON public.offer_activity_events
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow anon inserts for public tracking (viewed, pdf downloaded, email opened, link clicked)
CREATE POLICY "Public tracking events can be inserted"
  ON public.offer_activity_events
  FOR INSERT
  TO anon
  WITH CHECK (
    event_type IN ('offer_viewed', 'offer_pdf_downloaded', 'offer_email_opened', 'offer_link_clicked')
  );
