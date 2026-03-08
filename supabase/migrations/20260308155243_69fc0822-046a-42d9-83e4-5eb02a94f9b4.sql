
-- Notification preferences per portal user
CREATE TABLE public.portal_notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_user_id uuid NOT NULL REFERENCES public.customer_portal_users(id) ON DELETE CASCADE,
  -- v1 toggles
  notify_new_report boolean NOT NULL DEFAULT true,
  notify_pending_approval boolean NOT NULL DEFAULT true,
  notify_new_message boolean NOT NULL DEFAULT true,
  -- future toggles (default off)
  notify_new_document boolean NOT NULL DEFAULT false,
  notify_project_update boolean NOT NULL DEFAULT false,
  notify_weekly_summary boolean NOT NULL DEFAULT false,
  -- channel preferences (prepared for future)
  channel_email boolean NOT NULL DEFAULT true,
  channel_portal boolean NOT NULL DEFAULT true,
  channel_sms boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (portal_user_id)
);

ALTER TABLE public.portal_notification_preferences ENABLE ROW LEVEL SECURITY;

-- Users can read/update their own preferences
CREATE POLICY "Portal users manage own preferences"
  ON public.portal_notification_preferences FOR ALL
  TO authenticated
  USING (
    portal_user_id IN (
      SELECT id FROM public.customer_portal_users WHERE auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    portal_user_id IN (
      SELECT id FROM public.customer_portal_users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Admins manage all preferences"
  ON public.portal_notification_preferences FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Notification log for dedup and audit
CREATE TABLE public.portal_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_user_id uuid NOT NULL REFERENCES public.customer_portal_users(id) ON DELETE CASCADE,
  notification_type text NOT NULL CHECK (notification_type IN ('new_report', 'pending_approval', 'new_message')),
  entity_id text NOT NULL,
  entity_type text NOT NULL DEFAULT 'service_journal',
  subject text NOT NULL,
  body_preview text,
  channel text NOT NULL DEFAULT 'email',
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'skipped')),
  error_message text,
  portal_link text,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Dedup: one notification per user+type+entity
  UNIQUE (portal_user_id, notification_type, entity_id)
);

ALTER TABLE public.portal_notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own notifications
CREATE POLICY "Portal users read own notifications"
  ON public.portal_notifications FOR SELECT
  TO authenticated
  USING (
    portal_user_id IN (
      SELECT id FROM public.customer_portal_users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert notifications"
  ON public.portal_notifications FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
