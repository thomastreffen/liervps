
-- 1. absence_requests: scope by company membership instead of true
DROP POLICY IF EXISTS "Authenticated users can view absence requests" ON public.absence_requests;
DROP POLICY IF EXISTS "Authenticated users can insert absence requests" ON public.absence_requests;
DROP POLICY IF EXISTS "Authenticated users can update absence requests" ON public.absence_requests;

CREATE POLICY "Company members can view absence requests"
ON public.absence_requests FOR SELECT TO authenticated
USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "Company members can insert absence requests"
ON public.absence_requests FOR INSERT TO authenticated
WITH CHECK (
  public.is_company_member(auth.uid(), company_id)
  AND (requested_by = auth.uid() OR public.is_admin())
);

CREATE POLICY "Company admins or requester can update absence requests"
ON public.absence_requests FOR UPDATE TO authenticated
USING (
  public.is_company_member(auth.uid(), company_id)
  AND (requested_by = auth.uid() OR public.is_admin())
)
WITH CHECK (public.is_company_member(auth.uid(), company_id));

-- 2. ai_match_runs: lock the "Service role full access" policy to service_role only
DROP POLICY IF EXISTS "Service role full access" ON public.ai_match_runs;
CREATE POLICY "Service role full access on ai_match_runs"
ON public.ai_match_runs FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Admins can view ai_match_runs"
ON public.ai_match_runs FOR SELECT TO authenticated
USING (public.is_admin());

-- 3. confirmation_learnings: scope SELECT to company
DROP POLICY IF EXISTS "Authenticated read confirmation_learnings" ON public.confirmation_learnings;
CREATE POLICY "Company members can read confirmation_learnings"
ON public.confirmation_learnings FOR SELECT TO authenticated
USING (
  company_id IS NULL
  OR public.is_company_member(auth.uid(), company_id)
  OR public.is_admin()
);

-- 4. conversation_thread_invites: remove anon SELECT (acceptance is via edge function)
DROP POLICY IF EXISTS "Anyone can view invite by token" ON public.conversation_thread_invites;

-- 5. inbox_messages: scope team-visibility branch to company membership
DROP POLICY IF EXISTS "Users can view inbox_messages" ON public.inbox_messages;
CREATE POLICY "Users can view inbox_messages"
ON public.inbox_messages FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR owner_user_id = auth.uid()
  OR auth.uid() = ANY (participant_user_ids)
  OR fetched_by = auth.uid()
  OR (
    visibility = 'team'
    AND company_id IS NOT NULL
    AND public.is_company_member(auth.uid(), company_id)
  )
);

-- 6. mailboxes: restrict view to admins (table has no company_id; contains MS Graph delta tokens)
DROP POLICY IF EXISTS "Authenticated can view mailboxes" ON public.mailboxes;
CREATE POLICY "Admins can view mailboxes"
ON public.mailboxes FOR SELECT TO authenticated
USING (public.is_admin());

-- 7. order_form_submissions: remove the anon UPDATE policy (token-gated updates must go through edge function)
DROP POLICY IF EXISTS "Anon can update submission via tracking token" ON public.order_form_submissions;

-- 8. people: scope reads via shared company employment
DROP POLICY IF EXISTS "Authenticated can read people" ON public.people;
CREATE POLICY "Users can read people in their companies"
ON public.people FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.employment_profiles ep
    WHERE ep.person_id = people.id
      AND public.is_company_member(auth.uid(), ep.company_id)
  )
);
