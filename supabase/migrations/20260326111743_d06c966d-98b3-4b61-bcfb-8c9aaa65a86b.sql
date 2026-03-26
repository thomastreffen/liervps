
-- Create a security definer function to check company membership
CREATE OR REPLACE FUNCTION public.user_has_company_access(_auth_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- scope.view.all bypasses company check
    public.check_permission_v2(_auth_user_id, 'scope.view.all')
    OR EXISTS (
      SELECT 1 FROM public.user_memberships
      WHERE user_id = _auth_user_id
        AND company_id = _company_id
        AND is_active = true
    )
$$;

-- Update events SELECT policy to enforce company scope
DROP POLICY IF EXISTS "Admins see all events, technicians see own" ON public.events;
CREATE POLICY "Company-scoped event access" ON public.events
FOR SELECT TO authenticated
USING (
  public.user_has_company_access(auth.uid(), company_id)
  OR (id IN (
    SELECT event_technicians.event_id
    FROM event_technicians
    WHERE event_technicians.technician_id IN (
      SELECT technicians.id FROM technicians WHERE technicians.user_id = auth.uid()
    )
  ))
);

-- Update technicians SELECT policy: restrict to technicians in user's companies
DROP POLICY IF EXISTS "Authenticated users can view technicians" ON public.technicians;
CREATE POLICY "Company-scoped technician access" ON public.technicians
FOR SELECT TO authenticated
USING (
  public.check_permission_v2(auth.uid(), 'scope.view.all')
  OR EXISTS (
    SELECT 1 FROM public.employment_profiles ep
    JOIN public.user_memberships um ON um.company_id = ep.company_id AND um.is_active = true
    WHERE ep.person_id IN (
      SELECT ua.person_id FROM public.user_accounts ua WHERE ua.auth_user_id = auth.uid() AND ua.is_active = true
    )
    OR um.user_id = auth.uid()
  )
  OR user_id = auth.uid()
);
