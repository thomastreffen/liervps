-- Allow planners (with resource_plan permission) to manage event_technicians
-- Currently only admins can INSERT/UPDATE/DELETE; planners need it too

CREATE POLICY "Planners can manage event_technicians"
ON public.event_technicians
FOR ALL
TO authenticated
USING (
  public.check_permission_v2(auth.uid(), 'resource_plan.plan_resources')
  OR public.check_permission_v2(auth.uid(), 'resourceplan.schedule')
)
WITH CHECK (
  public.check_permission_v2(auth.uid(), 'resource_plan.plan_resources')
  OR public.check_permission_v2(auth.uid(), 'resourceplan.schedule')
);

-- Also allow company members to read event_technicians (needed for calendar display)
CREATE POLICY "Company members can read event_technicians"
ON public.event_technicians
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_technicians.event_id
      AND public.user_has_company_access(auth.uid(), e.company_id)
  )
);