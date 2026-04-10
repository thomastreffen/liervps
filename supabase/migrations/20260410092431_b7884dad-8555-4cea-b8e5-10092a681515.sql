
-- Helper function to check company access for an event_technician row
CREATE OR REPLACE FUNCTION public.event_technician_company_access(_auth_user_id uuid, _event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = _event_id
      AND public.user_has_company_access(_auth_user_id, e.company_id)
  );
$$;

-- Drop the recursive policy
DROP POLICY IF EXISTS "Company members can read event_technicians" ON public.event_technicians;

-- Recreate using the security definer function
CREATE POLICY "Company members can read event_technicians"
ON public.event_technicians
FOR SELECT
TO authenticated
USING (
  public.event_technician_company_access(auth.uid(), event_id)
);
