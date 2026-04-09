
-- Minimal anon SELECT for insert-then-select flow on public form submissions
-- This is scoped: only submissions with tracking tokens (external submissions)
CREATE POLICY "Anon can read submissions with tracking token"
ON public.order_form_submissions
FOR SELECT
TO anon
USING (
  public_tracking_token IS NOT NULL
  AND deleted_at IS NULL
);
