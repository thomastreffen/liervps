-- Add soft-delete columns to order_form_templates
ALTER TABLE public.order_form_templates
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by uuid DEFAULT NULL;

-- Fix RLS: authenticated users should ALSO see public templates (not just company members)
-- This ensures consistent visibility between anon and authenticated users on /bestilling
CREATE POLICY "Authenticated can view public templates"
  ON public.order_form_templates
  FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND audience_type IN ('external', 'both')
    AND requires_login = false
  );