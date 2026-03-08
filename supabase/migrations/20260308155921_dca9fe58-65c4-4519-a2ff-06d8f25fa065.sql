
-- Add read_at timestamp to portal_notifications
ALTER TABLE public.portal_notifications ADD COLUMN IF NOT EXISTS read_at timestamptz;

-- Allow portal users to update their own notifications (mark as read)
CREATE POLICY "Portal users update own notifications"
  ON public.portal_notifications FOR UPDATE
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
