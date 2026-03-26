
-- Add role_id to user_memberships for per-company role assignment
ALTER TABLE public.user_memberships 
  ADD COLUMN role_id uuid REFERENCES public.roles(id) ON DELETE SET NULL;

-- Comment for clarity
COMMENT ON COLUMN public.user_memberships.role_id IS 'Per-company role. When set, overrides global user_role_assignments for this company context.';
