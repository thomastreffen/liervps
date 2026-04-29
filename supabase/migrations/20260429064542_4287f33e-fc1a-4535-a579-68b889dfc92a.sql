CREATE OR REPLACE FUNCTION public.order_submission_allows_public_child_insert(_submission_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.order_form_submissions s
    JOIN public.order_form_templates t ON t.id = s.template_id
    WHERE s.id = _submission_id
      AND s.deleted_at IS NULL
      AND t.is_active = true
      AND t.audience_type = ANY (ARRAY['external'::text, 'both'::text])
      AND t.requires_login = false
  );
$$;

DROP POLICY IF EXISTS "Anon can insert submission values" ON public.order_form_submission_values;
DROP POLICY IF EXISTS "Authenticated can insert values for public forms" ON public.order_form_submission_values;

CREATE POLICY "Public can insert values for valid public submissions"
ON public.order_form_submission_values
FOR INSERT
TO anon, authenticated
WITH CHECK (public.order_submission_allows_public_child_insert(submission_id));

DROP POLICY IF EXISTS "Anon can insert submission attachments" ON public.order_form_submission_attachments;
DROP POLICY IF EXISTS "Authenticated can insert attachments for public forms" ON public.order_form_submission_attachments;

CREATE POLICY "Public can insert attachments for valid public submissions"
ON public.order_form_submission_attachments
FOR INSERT
TO anon, authenticated
WITH CHECK (public.order_submission_allows_public_child_insert(submission_id));