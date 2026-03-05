
-- Add new columns
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS assigned_user_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS calendar_provider text,
  ADD COLUMN IF NOT EXISTS calendar_event_id text;

-- Backfill owner_user_id
UPDATE public.tasks SET owner_user_id = created_by WHERE owner_user_id IS NULL AND created_by IS NOT NULL;

-- Drop existing policies
DROP POLICY IF EXISTS "Tasks delete by admin or creator" ON public.tasks;
DROP POLICY IF EXISTS "Tasks insert by company member" ON public.tasks;
DROP POLICY IF EXISTS "Tasks select by company" ON public.tasks;
DROP POLICY IF EXISTS "Tasks update by owner or assignee" ON public.tasks;

-- SELECT: owner, assigned, project member, or admin
CREATE POLICY "tasks_select_v2" ON public.tasks FOR SELECT TO authenticated
USING (
  owner_user_id = auth.uid()
  OR assigned_user_id = auth.uid()
  OR created_by = auth.uid()
  OR (linked_project_id IS NOT NULL AND public.is_project_member(auth.uid(), linked_project_id))
  OR public.check_permission_v2(auth.uid(), 'admin.manage_users')
);

-- INSERT
CREATE POLICY "tasks_insert_v2" ON public.tasks FOR INSERT TO authenticated
WITH CHECK (true);

-- UPDATE
CREATE POLICY "tasks_update_v2" ON public.tasks FOR UPDATE TO authenticated
USING (
  owner_user_id = auth.uid()
  OR assigned_user_id = auth.uid()
  OR created_by = auth.uid()
  OR public.check_permission_v2(auth.uid(), 'admin.manage_users')
);

-- DELETE
CREATE POLICY "tasks_delete_v2" ON public.tasks FOR DELETE TO authenticated
USING (
  owner_user_id = auth.uid()
  OR public.check_permission_v2(auth.uid(), 'admin.manage_users')
);
