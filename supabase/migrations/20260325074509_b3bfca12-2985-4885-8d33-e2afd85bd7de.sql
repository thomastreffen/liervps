-- Allow anonymous users to read sections for public templates
CREATE POLICY "Anon can view public template sections"
ON public.order_form_template_sections
AS PERMISSIVE FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.order_form_templates t
    WHERE t.id = template_id
      AND t.is_active = true
      AND t.audience_type IN ('external', 'both')
      AND t.requires_login = false
  )
);

-- Allow anonymous users to read fields for public templates
CREATE POLICY "Anon can view public template fields"
ON public.order_form_template_fields
AS PERMISSIVE FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.order_form_templates t
    WHERE t.id = template_id
      AND t.is_active = true
      AND t.audience_type IN ('external', 'both')
      AND t.requires_login = false
  )
);

-- Allow anonymous users to submit orders (insert submissions)
CREATE POLICY "Anon can submit to public forms"
ON public.order_form_submissions
AS PERMISSIVE FOR INSERT TO anon
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.order_form_templates t
    WHERE t.id = template_id
      AND t.is_active = true
      AND t.audience_type IN ('external', 'both')
      AND t.requires_login = false
  )
);

-- Allow anonymous users to insert submission values
CREATE POLICY "Anon can insert submission values"
ON public.order_form_submission_values
AS PERMISSIVE FOR INSERT TO anon
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.order_form_submissions s
    JOIN public.order_form_templates t ON t.id = s.template_id
    WHERE s.id = submission_id
      AND t.audience_type IN ('external', 'both')
      AND t.requires_login = false
  )
);

-- Allow anonymous users to upload attachments for public form submissions
CREATE POLICY "Anon can insert submission attachments"
ON public.order_form_submission_attachments
AS PERMISSIVE FOR INSERT TO anon
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.order_form_submissions s
    JOIN public.order_form_templates t ON t.id = s.template_id
    WHERE s.id = submission_id
      AND t.audience_type IN ('external', 'both')
      AND t.requires_login = false
  )
);