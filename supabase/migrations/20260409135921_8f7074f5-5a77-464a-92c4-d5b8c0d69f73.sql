
-- =============================================================
-- FIX 1: Anonymous enumeration of order_form_submissions
-- Replace broad anon SELECT policies with token-scoped RPC
-- =============================================================

-- Create RPC for token-based lookup
CREATE OR REPLACE FUNCTION public.get_submission_by_tracking_token(_token text)
RETURNS SETOF order_form_submissions
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.order_form_submissions
  WHERE public_tracking_token = _token
    AND deleted_at IS NULL
  LIMIT 1;
$$;

-- Grant anon access to the function
GRANT EXECUTE ON FUNCTION public.get_submission_by_tracking_token(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_submission_by_tracking_token(text) TO authenticated;

-- Drop the overly broad anon SELECT policy on order_form_submissions
DROP POLICY IF EXISTS "anon_select_by_tracking_token" ON public.order_form_submissions;
DROP POLICY IF EXISTS "Anon can read own submission" ON public.order_form_submissions;

-- Drop broad anon SELECT on related tables
DROP POLICY IF EXISTS "anon_select_values_by_token" ON public.order_form_submission_values;
DROP POLICY IF EXISTS "anon_select_attachments_by_token" ON public.order_form_submission_attachments;
DROP POLICY IF EXISTS "anon_select_shared_comments" ON public.order_form_comments;
DROP POLICY IF EXISTS "Anon can read visible messages via token" ON public.order_form_messages;

-- Create a helper to check if a submission_id matches a given token
CREATE OR REPLACE FUNCTION public.submission_matches_token(_submission_id uuid, _token text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.order_form_submissions
    WHERE id = _submission_id
      AND public_tracking_token = _token
      AND deleted_at IS NULL
  );
$$;

GRANT EXECUTE ON FUNCTION public.submission_matches_token(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.submission_matches_token(uuid, text) TO authenticated;

-- =============================================================
-- FIX 2: employment_profiles cross-company exposure
-- =============================================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated can read employment_profiles" ON public.employment_profiles;

-- Create company-scoped read policy
CREATE POLICY "Company members can read employment_profiles"
ON public.employment_profiles
FOR SELECT
TO authenticated
USING (
  is_admin()
  OR EXISTS (
    SELECT 1 FROM public.user_memberships um
    JOIN public.employment_profiles ep2 ON ep2.company_id = um.company_id
    WHERE um.user_id = auth.uid()
      AND um.is_active = true
      AND ep2.id = employment_profiles.id
  )
);
