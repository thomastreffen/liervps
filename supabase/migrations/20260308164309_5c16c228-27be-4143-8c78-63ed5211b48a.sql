-- Fix form_instances RLS: allow authenticated users to INSERT and allow project-based SELECT

-- 1. Allow any authenticated user to create a form instance
CREATE POLICY "Authenticated users can create form_instances"
ON public.form_instances
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 2. Allow project members to view all form instances for their projects
CREATE POLICY "Project members view form_instances"
ON public.form_instances
FOR SELECT
TO authenticated
USING (
  project_id IS NOT NULL AND is_project_member(auth.uid(), project_id)
);