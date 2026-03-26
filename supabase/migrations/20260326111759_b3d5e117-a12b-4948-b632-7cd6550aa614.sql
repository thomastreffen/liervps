
-- Fix technicians SELECT policy to properly check company membership via employment_profiles
DROP POLICY IF EXISTS "Company-scoped technician access" ON public.technicians;
CREATE POLICY "Company-scoped technician access" ON public.technicians
FOR SELECT TO authenticated
USING (
  -- Users with scope.view.all can see all technicians
  public.check_permission_v2(auth.uid(), 'scope.view.all')
  -- Users can always see their own technician record
  OR user_id = auth.uid()
  -- Users can see technicians who are plannable in companies they belong to
  OR EXISTS (
    SELECT 1 FROM public.employment_profiles ep
    JOIN public.user_memberships um 
      ON um.company_id = ep.company_id 
      AND um.user_id = auth.uid()
      AND um.is_active = true
    WHERE ep.person_id = (
      SELECT ua.person_id FROM public.user_accounts ua 
      WHERE ua.auth_user_id = technicians.user_id AND ua.is_active = true
      LIMIT 1
    )
    AND ep.archived_at IS NULL
  )
);
