
-- ═══════════════════════════════════════════════════════
-- Access Control: Basecamp-style project membership model
-- ═══════════════════════════════════════════════════════

-- 1. Extend events (projects) with visibility settings
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS visibility_type text NOT NULL DEFAULT 'internal_visible',
  ADD COLUMN IF NOT EXISTS allow_clients boolean NOT NULL DEFAULT false;

-- 2. Project Members
CREATE TABLE public.project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_account_id uuid NOT NULL REFERENCES public.user_accounts(id) ON DELETE CASCADE,
  member_type text NOT NULL DEFAULT 'internal', -- 'internal' | 'external'
  role text NOT NULL DEFAULT 'member', -- 'owner' | 'manager' | 'member' | 'follower'
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_account_id)
);
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- 3. Add is_enabled to project_spaces
ALTER TABLE public.project_spaces
  ADD COLUMN IF NOT EXISTS is_enabled boolean NOT NULL DEFAULT true;

-- 4. Add role column to space_members if missing (editor/viewer)
-- Already has role column from previous migration, update default
-- No action needed, role already exists

-- ═══════════════════════════════════════════════════════
-- Security definer functions (replace existing)
-- ═══════════════════════════════════════════════════════

-- Get project member role for auth user
CREATE OR REPLACE FUNCTION public.get_project_role(_auth_user_id uuid, _project_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pm.role
  FROM public.project_members pm
  JOIN public.user_accounts ua ON ua.id = pm.user_account_id
  WHERE pm.project_id = _project_id
    AND ua.auth_user_id = _auth_user_id
    AND ua.is_active = true
  LIMIT 1
$$;

-- Get project member type for auth user
CREATE OR REPLACE FUNCTION public.get_project_member_type(_auth_user_id uuid, _project_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pm.member_type
  FROM public.project_members pm
  JOIN public.user_accounts ua ON ua.id = pm.user_account_id
  WHERE pm.project_id = _project_id
    AND ua.auth_user_id = _auth_user_id
    AND ua.is_active = true
  LIMIT 1
$$;

-- Check if user is project owner or manager (bypasses all sub-access)
CREATE OR REPLACE FUNCTION public.is_project_admin(_auth_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members pm
    JOIN public.user_accounts ua ON ua.id = pm.user_account_id
    WHERE pm.project_id = _project_id
      AND ua.auth_user_id = _auth_user_id
      AND ua.is_active = true
      AND pm.role IN ('owner', 'manager')
  )
  -- System admin bypass
  OR public.check_permission_v2(_auth_user_id, 'admin.manage_users')
$$;

-- Check if user is a project member at all
CREATE OR REPLACE FUNCTION public.is_project_member(_auth_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members pm
    JOIN public.user_accounts ua ON ua.id = pm.user_account_id
    WHERE pm.project_id = _project_id
      AND ua.auth_user_id = _auth_user_id
      AND ua.is_active = true
  )
$$;

-- Check space access: owner/manager bypass, internal non-follower auto-access, external needs explicit
CREATE OR REPLACE FUNCTION public.has_space_access(_auth_user_id uuid, _space_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Space must be enabled
    EXISTS (SELECT 1 FROM public.project_spaces ps WHERE ps.id = _space_id AND ps.is_enabled = true)
    AND (
      -- Owner/manager bypass
      EXISTS (
        SELECT 1 FROM public.project_spaces ps
        WHERE ps.id = _space_id
          AND public.is_project_admin(_auth_user_id, ps.project_id)
      )
      -- Internal non-follower gets auto access
      OR EXISTS (
        SELECT 1 FROM public.project_spaces ps
        JOIN public.project_members pm ON pm.project_id = ps.project_id
        JOIN public.user_accounts ua ON ua.id = pm.user_account_id
        WHERE ps.id = _space_id
          AND ua.auth_user_id = _auth_user_id
          AND ua.is_active = true
          AND pm.member_type = 'internal'
          AND pm.role != 'follower'
      )
      -- Explicit space member (for externals or followers)
      OR EXISTS (
        SELECT 1 FROM public.space_members sm
        JOIN public.user_accounts ua ON ua.id = sm.user_account_id
        WHERE sm.space_id = _space_id
          AND ua.auth_user_id = _auth_user_id
          AND ua.is_active = true
      )
    )
$$;

-- Check folder access: owner/manager bypass, override check, otherwise inherit space
CREATE OR REPLACE FUNCTION public.has_folder_access(_auth_user_id uuid, _folder_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Owner/manager bypass
    EXISTS (
      SELECT 1 FROM public.doc_folders df
      WHERE df.id = _folder_id
        AND public.is_project_admin(_auth_user_id, df.project_id)
    )
    OR (
      -- Override ON → must be in folder_members
      EXISTS (
        SELECT 1 FROM public.doc_folders df
        WHERE df.id = _folder_id AND df.has_member_override = true
      )
      AND EXISTS (
        SELECT 1 FROM public.folder_members fm
        JOIN public.user_accounts ua ON ua.id = fm.user_account_id
        WHERE fm.folder_id = _folder_id
          AND ua.auth_user_id = _auth_user_id
          AND ua.is_active = true
      )
    )
    OR (
      -- Override OFF → inherit from documents space
      EXISTS (
        SELECT 1 FROM public.doc_folders df
        WHERE df.id = _folder_id AND df.has_member_override = false
      )
      AND EXISTS (
        SELECT 1 FROM public.doc_folders df
        JOIN public.project_spaces ps ON ps.project_id = df.project_id AND ps.space_key = 'dokumenter'
        WHERE df.id = _folder_id
          AND public.has_space_access(_auth_user_id, ps.id)
      )
    )
$$;

-- ═══════════════════════════════════════════════════════
-- RLS Policies for project_members
-- ═══════════════════════════════════════════════════════

-- Members can see other members in their projects
CREATE POLICY "pm_select" ON public.project_members FOR SELECT TO authenticated
USING (public.is_project_member(auth.uid(), project_id));

-- Only owner/manager can manage members
CREATE POLICY "pm_manage" ON public.project_members FOR ALL TO authenticated
USING (public.is_project_admin(auth.uid(), project_id))
WITH CHECK (public.is_project_admin(auth.uid(), project_id));

-- ═══════════════════════════════════════════════════════
-- Update existing RLS policies for project_spaces
-- ═══════════════════════════════════════════════════════

-- Drop old policies and replace
DROP POLICY IF EXISTS "ps_select" ON public.project_spaces;
DROP POLICY IF EXISTS "ps_admin" ON public.project_spaces;

CREATE POLICY "ps_select_v2" ON public.project_spaces FOR SELECT TO authenticated
USING (
  is_enabled = true
  AND (
    public.is_project_admin(auth.uid(), project_id)
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      JOIN public.user_accounts ua ON ua.id = pm.user_account_id
      WHERE pm.project_id = project_spaces.project_id
        AND ua.auth_user_id = auth.uid() AND ua.is_active
        AND pm.member_type = 'internal' AND pm.role != 'follower'
    )
    OR EXISTS (
      SELECT 1 FROM public.space_members sm
      JOIN public.user_accounts ua ON ua.id = sm.user_account_id
      WHERE sm.space_id = project_spaces.id
        AND ua.auth_user_id = auth.uid() AND ua.is_active
    )
  )
);

CREATE POLICY "ps_admin_v2" ON public.project_spaces FOR ALL TO authenticated
USING (public.is_project_admin(auth.uid(), project_id))
WITH CHECK (public.is_project_admin(auth.uid(), project_id));

-- ═══════════════════════════════════════════════════════
-- Update space_members RLS
-- ═══════════════════════════════════════════════════════

DROP POLICY IF EXISTS "sm_select" ON public.space_members;
DROP POLICY IF EXISTS "sm_admin" ON public.space_members;

CREATE POLICY "sm_select_v2" ON public.space_members FOR SELECT TO authenticated
USING (public.has_space_access(auth.uid(), space_id));

CREATE POLICY "sm_admin_v2" ON public.space_members FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.project_spaces ps
    WHERE ps.id = space_members.space_id
      AND public.is_project_admin(auth.uid(), ps.project_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.project_spaces ps
    WHERE ps.id = space_members.space_id
      AND public.is_project_admin(auth.uid(), ps.project_id)
  )
);

-- ═══════════════════════════════════════════════════════
-- Update doc_folders RLS
-- ═══════════════════════════════════════════════════════

DROP POLICY IF EXISTS "df_select" ON public.doc_folders;
DROP POLICY IF EXISTS "df_admin" ON public.doc_folders;
DROP POLICY IF EXISTS "df_insert_member" ON public.doc_folders;

CREATE POLICY "df_select_v2" ON public.doc_folders FOR SELECT TO authenticated
USING (public.has_folder_access(auth.uid(), doc_folders.id));

CREATE POLICY "df_manage_v2" ON public.doc_folders FOR ALL TO authenticated
USING (public.is_project_admin(auth.uid(), project_id))
WITH CHECK (public.is_project_admin(auth.uid(), project_id));

CREATE POLICY "df_insert_v2" ON public.doc_folders FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.project_spaces ps
    WHERE ps.project_id = doc_folders.project_id AND ps.space_key = 'dokumenter'
      AND public.has_space_access(auth.uid(), ps.id)
  )
);

-- ═══════════════════════════════════════════════════════
-- Update folder_members RLS
-- ═══════════════════════════════════════════════════════

DROP POLICY IF EXISTS "fm_select" ON public.folder_members;
DROP POLICY IF EXISTS "fm_admin" ON public.folder_members;

CREATE POLICY "fm_select_v2" ON public.folder_members FOR SELECT TO authenticated
USING (public.has_folder_access(auth.uid(), folder_id));

CREATE POLICY "fm_admin_v2" ON public.folder_members FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.doc_folders df
    WHERE df.id = folder_members.folder_id
      AND public.is_project_admin(auth.uid(), df.project_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.doc_folders df
    WHERE df.id = folder_members.folder_id
      AND public.is_project_admin(auth.uid(), df.project_id)
  )
);

-- ═══════════════════════════════════════════════════════
-- Update docs_files RLS
-- ═══════════════════════════════════════════════════════

DROP POLICY IF EXISTS "dfi_select" ON public.docs_files;
DROP POLICY IF EXISTS "dfi_insert" ON public.docs_files;
DROP POLICY IF EXISTS "dfi_update" ON public.docs_files;
DROP POLICY IF EXISTS "dfi_delete" ON public.docs_files;

CREATE POLICY "dfi_select_v2" ON public.docs_files FOR SELECT TO authenticated
USING (
  public.is_project_admin(auth.uid(), project_id)
  OR (
    folder_id IS NOT NULL AND public.has_folder_access(auth.uid(), folder_id)
  )
  OR (
    folder_id IS NULL AND EXISTS (
      SELECT 1 FROM public.project_spaces ps
      WHERE ps.project_id = docs_files.project_id AND ps.space_key = 'dokumenter'
        AND public.has_space_access(auth.uid(), ps.id)
    )
  )
);

CREATE POLICY "dfi_insert_v2" ON public.docs_files FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.project_spaces ps
    WHERE ps.project_id = docs_files.project_id AND ps.space_key = 'dokumenter'
      AND public.has_space_access(auth.uid(), ps.id)
  )
);

CREATE POLICY "dfi_update_v2" ON public.docs_files FOR UPDATE TO authenticated
USING (
  public.is_project_admin(auth.uid(), project_id)
  OR created_by = public.get_user_account_id(auth.uid())
);

CREATE POLICY "dfi_delete_v2" ON public.docs_files FOR DELETE TO authenticated
USING (
  public.is_project_admin(auth.uid(), project_id)
  OR created_by = public.get_user_account_id(auth.uid())
);
