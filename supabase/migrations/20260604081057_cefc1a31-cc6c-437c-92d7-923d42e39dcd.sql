CREATE POLICY "Company admins or requester can delete absence requests"
ON public.absence_requests
FOR DELETE
TO authenticated
USING (
  is_company_member(auth.uid(), company_id)
  AND (requested_by = auth.uid() OR is_admin())
);