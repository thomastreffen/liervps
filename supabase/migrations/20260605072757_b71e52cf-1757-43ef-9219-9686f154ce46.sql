DROP POLICY IF EXISTS "Company members can update submission attachments" ON public.order_form_submission_attachments;

CREATE POLICY "Company members can update submission attachments"
ON public.order_form_submission_attachments
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.order_form_submissions s
    WHERE s.id = order_form_submission_attachments.submission_id
      AND public.is_company_member(auth.uid(), s.company_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.order_form_submissions s
    WHERE s.id = order_form_submission_attachments.submission_id
      AND public.is_company_member(auth.uid(), s.company_id)
  )
);