
-- ============================================================
-- FIX: RLS recursion, backfill members/spaces, auto-seed
-- ============================================================

-- 1. Helper functions (SECURITY DEFINER – bypass RLS internally)

CREATE OR REPLACE FUNCTION public.is_internal_nonfollow_member(_auth_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_members pm
    JOIN user_accounts ua ON ua.id = pm.user_account_id
    WHERE pm.project_id = _project_id
      AND ua.auth_user_id = _auth_user_id
      AND ua.is_active = true
      AND pm.member_type = 'internal'
      AND pm.role NOT IN ('follower')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_explicit_space_member(_auth_user_id uuid, _space_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM space_members sm
    JOIN user_accounts ua ON ua.id = sm.user_account_id
    WHERE sm.space_id = _space_id
      AND ua.auth_user_id = _auth_user_id
      AND ua.is_active = true
  )
$$;

-- Non-recursive variant: checks space access without reading project_spaces through RLS
CREATE OR REPLACE FUNCTION public.has_docs_space_access(_auth_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_spaces ps
    WHERE ps.project_id = _project_id
      AND ps.space_key = 'dokumenter'
      AND ps.is_enabled = true
      AND (
        public.is_project_admin(_auth_user_id, _project_id)
        OR public.is_internal_nonfollow_member(_auth_user_id, _project_id)
        OR public.is_explicit_space_member(_auth_user_id, ps.id)
      )
  )
$$;

-- 2. Drop ALL old policies that cause recursion

DROP POLICY IF EXISTS ps_select_v2 ON project_spaces;
DROP POLICY IF EXISTS ps_admin_v2 ON project_spaces;
DROP POLICY IF EXISTS sm_select_v2 ON space_members;
DROP POLICY IF EXISTS sm_admin_v2 ON space_members;
DROP POLICY IF EXISTS pm_manage ON project_members;
DROP POLICY IF EXISTS pm_select ON project_members;
DROP POLICY IF EXISTS df_insert_v2 ON doc_folders;
DROP POLICY IF EXISTS df_select_v2 ON doc_folders;
DROP POLICY IF EXISTS df_manage_v2 ON doc_folders;
DROP POLICY IF EXISTS dfi_insert_v2 ON docs_files;
DROP POLICY IF EXISTS dfi_select_v2 ON docs_files;
DROP POLICY IF EXISTS dfi_update_v2 ON docs_files;
DROP POLICY IF EXISTS dfi_delete_v2 ON docs_files;
DROP POLICY IF EXISTS fm_admin_v2 ON folder_members;
DROP POLICY IF EXISTS fm_select_v2 ON folder_members;

-- 3. project_spaces: NO subquery on space_members (breaks recursion)

CREATE POLICY ps_select_v3 ON project_spaces FOR SELECT
  TO authenticated
  USING (
    is_enabled = true
    AND (
      public.is_project_admin(auth.uid(), project_id)
      OR public.is_internal_nonfollow_member(auth.uid(), project_id)
      OR public.is_explicit_space_member(auth.uid(), id)
    )
  );

-- Admin: project admin OR company admin
CREATE POLICY ps_admin_v3 ON project_spaces FOR ALL
  TO authenticated
  USING (
    public.is_project_admin(auth.uid(), project_id)
  )
  WITH CHECK (
    public.is_project_admin(auth.uid(), project_id)
  );

-- 4. space_members: NO call to has_space_access (breaks recursion)

CREATE POLICY sm_select_v3 ON space_members FOR SELECT
  TO authenticated
  USING (
    public.is_project_admin(
      auth.uid(),
      (SELECT ps.project_id FROM project_spaces ps WHERE ps.id = space_id)
    )
    OR user_account_id = public.get_user_account_id(auth.uid())
  );

CREATE POLICY sm_admin_v3 ON space_members FOR ALL
  TO authenticated
  USING (
    public.is_project_admin(
      auth.uid(),
      (SELECT ps.project_id FROM project_spaces ps WHERE ps.id = space_id)
    )
  )
  WITH CHECK (
    public.is_project_admin(
      auth.uid(),
      (SELECT ps.project_id FROM project_spaces ps WHERE ps.id = space_id)
    )
  );

-- 5. project_members: allow company admin (check_permission_v2) to manage ANY project

CREATE POLICY pm_select_v3 ON project_members FOR SELECT
  TO authenticated
  USING (
    public.is_project_member(auth.uid(), project_id)
    OR public.check_permission_v2(auth.uid(), 'admin.manage_users')
  );

CREATE POLICY pm_manage_v3 ON project_members FOR ALL
  TO authenticated
  USING (
    public.is_project_admin(auth.uid(), project_id)
    OR public.check_permission_v2(auth.uid(), 'admin.manage_users')
  )
  WITH CHECK (
    public.is_project_admin(auth.uid(), project_id)
    OR public.check_permission_v2(auth.uid(), 'admin.manage_users')
  );

-- 6. doc_folders: use has_docs_space_access (SECURITY DEFINER, no RLS recursion)

CREATE POLICY df_select_v3 ON doc_folders FOR SELECT
  TO authenticated
  USING (public.has_folder_access(auth.uid(), id));

CREATE POLICY df_insert_v3 ON doc_folders FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_docs_space_access(auth.uid(), project_id)
  );

CREATE POLICY df_manage_v3 ON doc_folders FOR ALL
  TO authenticated
  USING (public.is_project_admin(auth.uid(), project_id))
  WITH CHECK (public.is_project_admin(auth.uid(), project_id));

-- 7. docs_files: use has_docs_space_access

CREATE POLICY dfi_select_v3 ON docs_files FOR SELECT
  TO authenticated
  USING (
    public.is_project_admin(auth.uid(), project_id)
    OR (folder_id IS NOT NULL AND public.has_folder_access(auth.uid(), folder_id))
    OR (folder_id IS NULL AND public.has_docs_space_access(auth.uid(), project_id))
  );

CREATE POLICY dfi_insert_v3 ON docs_files FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_docs_space_access(auth.uid(), project_id)
  );

CREATE POLICY dfi_update_v3 ON docs_files FOR UPDATE
  TO authenticated
  USING (
    public.is_project_admin(auth.uid(), project_id)
    OR created_by = public.get_user_account_id(auth.uid())
  );

CREATE POLICY dfi_delete_v3 ON docs_files FOR DELETE
  TO authenticated
  USING (
    public.is_project_admin(auth.uid(), project_id)
    OR created_by = public.get_user_account_id(auth.uid())
  );

-- 8. folder_members

CREATE POLICY fm_select_v3 ON folder_members FOR SELECT
  TO authenticated
  USING (public.has_folder_access(auth.uid(), folder_id));

CREATE POLICY fm_admin_v3 ON folder_members FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM doc_folders df
      WHERE df.id = folder_members.folder_id
        AND public.is_project_admin(auth.uid(), df.project_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM doc_folders df
      WHERE df.id = folder_members.folder_id
        AND public.is_project_admin(auth.uid(), df.project_id)
    )
  );

-- 9. Update has_space_access to also use non-recursive helpers

CREATE OR REPLACE FUNCTION public.has_space_access(_auth_user_id uuid, _space_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_spaces ps
    WHERE ps.id = _space_id
      AND ps.is_enabled = true
      AND (
        public.is_project_admin(_auth_user_id, ps.project_id)
        OR public.is_internal_nonfollow_member(_auth_user_id, ps.project_id)
        OR public.is_explicit_space_member(_auth_user_id, ps.id)
      )
  )
$$;

-- 10. Update has_folder_access to use has_docs_space_access

CREATE OR REPLACE FUNCTION public.has_folder_access(_auth_user_id uuid, _folder_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM doc_folders df
      WHERE df.id = _folder_id
        AND public.is_project_admin(_auth_user_id, df.project_id)
    )
    OR (
      EXISTS (SELECT 1 FROM doc_folders df WHERE df.id = _folder_id AND df.has_member_override = true)
      AND EXISTS (
        SELECT 1 FROM folder_members fm
        JOIN user_accounts ua ON ua.id = fm.user_account_id
        WHERE fm.folder_id = _folder_id
          AND ua.auth_user_id = _auth_user_id
          AND ua.is_active = true
      )
    )
    OR (
      EXISTS (SELECT 1 FROM doc_folders df WHERE df.id = _folder_id AND df.has_member_override = false)
      AND (
        SELECT public.has_docs_space_access(
          _auth_user_id,
          (SELECT df2.project_id FROM doc_folders df2 WHERE df2.id = _folder_id)
        )
      )
    )
$$;

-- 11. Auto-seed trigger for new projects

CREATE OR REPLACE FUNCTION public.seed_project_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ua_id uuid;
BEGIN
  -- Add creator as owner
  IF NEW.created_by IS NOT NULL THEN
    SELECT id INTO _ua_id
    FROM user_accounts
    WHERE auth_user_id = NEW.created_by AND is_active = true
    LIMIT 1;

    IF _ua_id IS NOT NULL THEN
      INSERT INTO project_members (project_id, user_account_id, member_type, role)
      VALUES (NEW.id, _ua_id, 'internal', 'owner')
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  -- Create default spaces
  INSERT INTO project_spaces (project_id, space_key, is_enabled)
  VALUES
    (NEW.id, 'samtaler', true),
    (NEW.id, 'oppgaver', true),
    (NEW.id, 'dokumenter', true),
    (NEW.id, 'tidsplan', true)
  ON CONFLICT (project_id, space_key) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_project_access ON events;
CREATE TRIGGER trg_seed_project_access
  AFTER INSERT ON events
  FOR EACH ROW
  EXECUTE FUNCTION seed_project_access();

-- 12. Backfill existing projects: add owner + default spaces

INSERT INTO project_members (project_id, user_account_id, member_type, role)
SELECT e.id, ua.id, 'internal', 'owner'
FROM events e
JOIN user_accounts ua ON ua.auth_user_id = e.created_by AND ua.is_active = true
WHERE e.created_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM project_members pm WHERE pm.project_id = e.id
  )
ON CONFLICT DO NOTHING;

INSERT INTO project_spaces (project_id, space_key, is_enabled)
SELECT e.id, sk.key, true
FROM events e
CROSS JOIN (VALUES ('samtaler'), ('oppgaver'), ('dokumenter'), ('tidsplan')) AS sk(key)
WHERE NOT EXISTS (
  SELECT 1 FROM project_spaces ps WHERE ps.project_id = e.id AND ps.space_key = sk.key
)
ON CONFLICT (project_id, space_key) DO NOTHING;
