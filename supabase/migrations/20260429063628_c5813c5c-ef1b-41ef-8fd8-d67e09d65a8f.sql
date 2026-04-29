
-- Allow authenticated users to also submit values/attachments to public forms
-- (mirrors the existing anon policies). This fixes RLS rejection when a logged-in
-- user from another company tests/submits a public order form.

CREATE POLICY "Authenticated can insert values for public forms"
ON public.order_form_submission_values
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.order_form_submissions s
    JOIN public.order_form_templates t ON t.id = s.template_id
    WHERE s.id = order_form_submission_values.submission_id
      AND t.audience_type = ANY (ARRAY['external','both'])
      AND t.requires_login = false
      AND t.is_active = true
  )
);

CREATE POLICY "Authenticated can insert attachments for public forms"
ON public.order_form_submission_attachments
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.order_form_submissions s
    JOIN public.order_form_templates t ON t.id = s.template_id
    WHERE s.id = order_form_submission_attachments.submission_id
      AND t.audience_type = ANY (ARRAY['external','both'])
      AND t.requires_login = false
      AND t.is_active = true
  )
);

-- Also allow authenticated users to create submissions against public forms
-- (the existing authenticated INSERT policy requires is_company_member, which
-- blocks logged-in users from other companies submitting valid public forms).
CREATE POLICY "Authenticated can submit to public forms"
ON public.order_form_submissions
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.order_form_templates t
    WHERE t.id = order_form_submissions.template_id
      AND t.is_active = true
      AND t.audience_type = ANY (ARRAY['external','both'])
      AND t.requires_login = false
  )
);
