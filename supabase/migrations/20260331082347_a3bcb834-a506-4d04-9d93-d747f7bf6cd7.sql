
-- 1. Add tracking token and external status fields to order_form_submissions
ALTER TABLE public.order_form_submissions
  ADD COLUMN IF NOT EXISTS public_tracking_token TEXT UNIQUE DEFAULT gen_random_uuid()::text,
  ADD COLUMN IF NOT EXISTS external_status TEXT DEFAULT 'received',
  ADD COLUMN IF NOT EXISTS external_status_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS customer_last_reply_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS customer_last_viewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_notify_on_status_change BOOLEAN DEFAULT true;

-- 2. Index for fast token lookups (public page)
CREATE UNIQUE INDEX IF NOT EXISTS idx_submissions_tracking_token
  ON public.order_form_submissions(public_tracking_token)
  WHERE public_tracking_token IS NOT NULL;

-- 3. Add visibility field to comments to distinguish internal vs shared
ALTER TABLE public.order_form_comments
  ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'internal',
  ADD COLUMN IF NOT EXISTS author_name TEXT,
  ADD COLUMN IF NOT EXISTS is_customer_reply BOOLEAN DEFAULT false;

-- 4. RLS: Allow anonymous users to SELECT submission by tracking token
CREATE POLICY "anon_select_by_tracking_token"
  ON public.order_form_submissions
  FOR SELECT
  TO anon
  USING (
    public_tracking_token IS NOT NULL
    AND deleted_at IS NULL
  );

-- 5. RLS: Allow anonymous users to read shared comments by submission token
CREATE POLICY "anon_select_shared_comments"
  ON public.order_form_comments
  FOR SELECT
  TO anon
  USING (
    visibility = 'shared'
    AND submission_id IN (
      SELECT id FROM public.order_form_submissions
      WHERE public_tracking_token IS NOT NULL AND deleted_at IS NULL
    )
  );

-- 6. RLS: Allow anonymous users to INSERT customer reply comments
CREATE POLICY "anon_insert_customer_reply"
  ON public.order_form_comments
  FOR INSERT
  TO anon
  WITH CHECK (
    is_customer_reply = true
    AND visibility = 'shared'
    AND submission_id IN (
      SELECT id FROM public.order_form_submissions
      WHERE public_tracking_token IS NOT NULL AND deleted_at IS NULL
    )
  );

-- 7. RLS: Allow anon to SELECT attachments for submissions with tracking token
CREATE POLICY "anon_select_attachments_by_token"
  ON public.order_form_submission_attachments
  FOR SELECT
  TO anon
  USING (
    submission_id IN (
      SELECT id FROM public.order_form_submissions
      WHERE public_tracking_token IS NOT NULL AND deleted_at IS NULL
    )
  );

-- 8. RLS: Allow anon to INSERT attachments for submissions with tracking token (customer uploads)
CREATE POLICY "anon_insert_attachments_by_token"
  ON public.order_form_submission_attachments
  FOR INSERT
  TO anon
  WITH CHECK (
    submission_id IN (
      SELECT id FROM public.order_form_submissions
      WHERE public_tracking_token IS NOT NULL AND deleted_at IS NULL
    )
  );

-- 9. RLS: Allow anon to SELECT submission values for tracking
CREATE POLICY "anon_select_values_by_token"
  ON public.order_form_submission_values
  FOR SELECT
  TO anon
  USING (
    submission_id IN (
      SELECT id FROM public.order_form_submissions
      WHERE public_tracking_token IS NOT NULL AND deleted_at IS NULL
    )
  );

-- 10. RLS: Allow anon to read activity log entries that are customer-visible
CREATE POLICY "anon_select_public_activity"
  ON public.order_form_activity_log
  FOR SELECT
  TO anon
  USING (
    event_type IN ('submitted', 'status_changed', 'customer_reply')
    AND submission_id IN (
      SELECT id FROM public.order_form_submissions
      WHERE public_tracking_token IS NOT NULL AND deleted_at IS NULL
    )
  );

-- 11. Backfill existing submissions with tracking tokens
UPDATE public.order_form_submissions
SET public_tracking_token = gen_random_uuid()::text
WHERE public_tracking_token IS NULL;

-- 12. Backfill external_status from internal status
UPDATE public.order_form_submissions
SET external_status = CASE status
  WHEN 'new' THEN 'received'
  WHEN 'under_review' THEN 'processing'
  WHEN 'missing_info' THEN 'needs_info'
  WHEN 'waiting_customer' THEN 'needs_info'
  WHEN 'waiting_internal' THEN 'processing'
  WHEN 'ready_for_planning' THEN 'planned'
  WHEN 'task_created' THEN 'planned'
  WHEN 'in_progress' THEN 'in_progress'
  WHEN 'closed' THEN 'completed'
  WHEN 'rejected' THEN 'closed'
  ELSE 'received'
END
WHERE external_status IS NULL OR external_status = 'received';

-- 13. Function to auto-update external_status when internal status changes
CREATE OR REPLACE FUNCTION public.sync_external_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.external_status := CASE NEW.status
      WHEN 'new' THEN 'received'
      WHEN 'under_review' THEN 'processing'
      WHEN 'missing_info' THEN 'needs_info'
      WHEN 'waiting_customer' THEN 'needs_info'
      WHEN 'waiting_internal' THEN 'processing'
      WHEN 'ready_for_planning' THEN 'planned'
      WHEN 'task_created' THEN 'planned'
      WHEN 'in_progress' THEN 'in_progress'
      WHEN 'closed' THEN 'completed'
      WHEN 'rejected' THEN 'closed'
      ELSE 'received'
    END;
    NEW.external_status_updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_external_status
  BEFORE UPDATE ON public.order_form_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_external_status();
