-- Allow anon to read back their own submission (needed for .select() after insert)
CREATE POLICY "Anon can read own submission"
ON public.order_form_submissions
AS PERMISSIVE FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1 FROM order_form_templates t
    WHERE t.id = order_form_submissions.template_id
      AND t.is_active = true
      AND t.audience_type IN ('external', 'both')
      AND t.requires_login = false
  )
);

-- Allow anon to insert activity log for public form submissions
CREATE POLICY "Anon can insert activity log"
ON public.order_form_activity_log
AS PERMISSIVE FOR INSERT TO anon
WITH CHECK (
  EXISTS (
    SELECT 1 FROM order_form_submissions s
    JOIN order_form_templates t ON t.id = s.template_id
    WHERE s.id = order_form_activity_log.submission_id
      AND t.audience_type IN ('external', 'both')
      AND t.requires_login = false
  )
);