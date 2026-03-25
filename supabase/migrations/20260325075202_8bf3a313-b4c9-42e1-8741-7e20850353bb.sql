CREATE POLICY "Anon can view public templates"
ON public.order_form_templates
AS PERMISSIVE FOR SELECT TO anon
USING (
  is_active = true
  AND audience_type IN ('external', 'both')
  AND requires_login = false
);