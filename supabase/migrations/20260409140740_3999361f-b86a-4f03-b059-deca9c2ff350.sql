
-- Drop the broken recursive policy
DROP POLICY IF EXISTS "Company members can read employment_profiles" ON public.employment_profiles;

-- Create a non-recursive replacement: check user's company membership against the row's company_id directly
CREATE POLICY "Company members can read employment_profiles"
ON public.employment_profiles
FOR SELECT TO authenticated
USING (
  is_admin()
  OR EXISTS (
    SELECT 1 FROM public.user_memberships um
    WHERE um.user_id = auth.uid()
      AND um.company_id = employment_profiles.company_id
      AND um.is_active = true
  )
);
