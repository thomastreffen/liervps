
-- 1. Create SECURITY DEFINER function to check order participation without RLS recursion
CREATE OR REPLACE FUNCTION public.is_order_participant(_user_id uuid, _submission_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.order_form_participants
    WHERE submission_id = _submission_id
      AND user_id = _user_id
      AND participant_type = 'internal_user'
  )
$$;

-- 2. Create SECURITY DEFINER function to get the company_id for a submission without RLS
CREATE OR REPLACE FUNCTION public.get_order_company_id(_submission_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.order_form_submissions WHERE id = _submission_id LIMIT 1
$$;

-- 3. Fix order_form_submissions: replace recursive participant policy
DROP POLICY IF EXISTS "Participants can view their orders" ON public.order_form_submissions;
CREATE POLICY "Participants can view their orders"
  ON public.order_form_submissions
  FOR SELECT
  TO authenticated
  USING (public.is_order_participant(auth.uid(), id));

-- 4. Fix order_form_participants: replace recursive policy that queried order_form_submissions
DROP POLICY IF EXISTS "Authenticated users can view participants for accessible orders" ON public.order_form_participants;
CREATE POLICY "Authenticated users can view participants for accessible orders"
  ON public.order_form_participants
  FOR SELECT
  TO authenticated
  USING (
    -- User is the participant themselves
    user_id = auth.uid()
    -- Or user is a company member for the order's company
    OR public.is_company_member(auth.uid(), public.get_order_company_id(submission_id))
    -- Or user has cross-company access grant
    OR public.has_cross_company_order_access(auth.uid(), submission_id)
  );

-- 5. Fix order_form_participants UPDATE policy
DROP POLICY IF EXISTS "Authenticated users can update participants" ON public.order_form_participants;
CREATE POLICY "Authenticated users can update participants"
  ON public.order_form_participants
  FOR UPDATE
  TO authenticated
  USING (
    public.is_company_member(auth.uid(), public.get_order_company_id(submission_id))
    OR public.has_cross_company_order_access(auth.uid(), submission_id)
  );

-- 6. Fix order_form_participants DELETE policy
DROP POLICY IF EXISTS "Authenticated users can delete participants" ON public.order_form_participants;
CREATE POLICY "Authenticated users can delete participants"
  ON public.order_form_participants
  FOR DELETE
  TO authenticated
  USING (
    public.is_company_member(auth.uid(), public.get_order_company_id(submission_id))
    OR public.has_cross_company_order_access(auth.uid(), submission_id)
  );

-- 7. Fix order_form_participants INSERT policy
DROP POLICY IF EXISTS "Authenticated users can manage participants" ON public.order_form_participants;
CREATE POLICY "Authenticated users can manage participants"
  ON public.order_form_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_company_member(auth.uid(), public.get_order_company_id(submission_id))
    OR public.has_cross_company_order_access(auth.uid(), submission_id)
  );

-- 8. Fix order_form_messages: replace recursive participant policy
DROP POLICY IF EXISTS "Participants can read order messages" ON public.order_form_messages;
CREATE POLICY "Participants can read order messages"
  ON public.order_form_messages
  FOR SELECT
  TO authenticated
  USING (public.is_order_participant(auth.uid(), submission_id));

-- 9. Fix order_form_messages: replace recursive participant INSERT policy
DROP POLICY IF EXISTS "Participants can reply to order messages" ON public.order_form_messages;
CREATE POLICY "Participants can reply to order messages"
  ON public.order_form_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.order_form_participants ofp
      WHERE ofp.submission_id = order_form_messages.submission_id
        AND ofp.user_id = auth.uid()
        AND ofp.participant_type = 'internal_user'
        AND ofp.can_reply = true
    )
  );
