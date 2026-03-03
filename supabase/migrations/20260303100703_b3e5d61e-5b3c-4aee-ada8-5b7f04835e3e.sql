
-- ═══════════════════════════════════════════════════════
-- Docs & Files – Basecamp-style document room
-- ═══════════════════════════════════════════════════════

-- 1. Project Spaces (logical rooms per project)
CREATE TABLE public.project_spaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  space_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, space_key)
);
ALTER TABLE public.project_spaces ENABLE ROW LEVEL SECURITY;

-- 2. Space Members
CREATE TABLE public.space_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.project_spaces(id) ON DELETE CASCADE,
  user_account_id uuid NOT NULL REFERENCES public.user_accounts(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  added_by uuid REFERENCES public.user_accounts(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (space_id, user_account_id)
);
ALTER TABLE public.space_members ENABLE ROW LEVEL SECURITY;

-- 3. Document Folders
CREATE TABLE public.doc_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  parent_folder_id uuid REFERENCES public.doc_folders(id) ON DELETE CASCADE,
  has_member_override boolean NOT NULL DEFAULT false,
  icon text,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES public.user_accounts(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.doc_folders ENABLE ROW LEVEL SECURITY;

-- 4. Folder Members (override)
CREATE TABLE public.folder_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id uuid NOT NULL REFERENCES public.doc_folders(id) ON DELETE CASCADE,
  user_account_id uuid NOT NULL REFERENCES public.user_accounts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (folder_id, user_account_id)
);
ALTER TABLE public.folder_members ENABLE ROW LEVEL SECURITY;

-- 5. Docs & Files
CREATE TABLE public.docs_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  folder_id uuid REFERENCES public.doc_folders(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  source_type text NOT NULL DEFAULT 'internal',
  source_meta jsonb DEFAULT '{}'::jsonb,
  mime_type text,
  file_size bigint,
  created_by uuid REFERENCES public.user_accounts(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.docs_files ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════
-- Security definer helpers
-- ═══════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.is_project_admin(_auth_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = _project_id
      AND e.created_by = (SELECT ua.id FROM public.user_accounts ua WHERE ua.auth_user_id = _auth_user_id AND ua.is_active LIMIT 1)
  )
  OR public.check_permission_v2(_auth_user_id, 'admin.manage_users')
$$;

CREATE OR REPLACE FUNCTION public.has_space_access(_auth_user_id uuid, _space_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.project_spaces ps
      WHERE ps.id = _space_id
        AND public.is_project_admin(_auth_user_id, ps.project_id)
    )
    OR
    EXISTS (
      SELECT 1 FROM public.space_members sm
      JOIN public.user_accounts ua ON ua.id = sm.user_account_id
      WHERE sm.space_id = _space_id
        AND ua.auth_user_id = _auth_user_id
        AND ua.is_active = true
    )
$$;

CREATE OR REPLACE FUNCTION public.has_folder_access(_auth_user_id uuid, _folder_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.doc_folders df
      WHERE df.id = _folder_id
        AND public.is_project_admin(_auth_user_id, df.project_id)
    )
    OR
    (
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
    OR
    (
      EXISTS (
        SELECT 1 FROM public.doc_folders df
        WHERE df.id = _folder_id AND df.has_member_override = false
      )
      AND EXISTS (
        SELECT 1 FROM public.doc_folders df2
        JOIN public.project_spaces ps ON ps.project_id = df2.project_id AND ps.space_key = 'dokumenter'
        JOIN public.space_members sm ON sm.space_id = ps.id
        JOIN public.user_accounts ua ON ua.id = sm.user_account_id
        WHERE df2.id = _folder_id
          AND ua.auth_user_id = _auth_user_id
          AND ua.is_active = true
      )
    )
$$;

-- ═══════════════════════════════════════════════════════
-- RLS Policies
-- ═══════════════════════════════════════════════════════

-- project_spaces
CREATE POLICY "ps_select" ON public.project_spaces FOR SELECT TO authenticated
USING (
  public.is_project_admin(auth.uid(), project_id)
  OR EXISTS (
    SELECT 1 FROM public.space_members sm
    JOIN public.user_accounts ua ON ua.id = sm.user_account_id
    WHERE sm.space_id = project_spaces.id AND ua.auth_user_id = auth.uid() AND ua.is_active
  )
);

CREATE POLICY "ps_admin" ON public.project_spaces FOR ALL TO authenticated
USING (public.is_project_admin(auth.uid(), project_id))
WITH CHECK (public.is_project_admin(auth.uid(), project_id));

-- space_members
CREATE POLICY "sm_select" ON public.space_members FOR SELECT TO authenticated
USING (public.has_space_access(auth.uid(), space_id));

CREATE POLICY "sm_admin" ON public.space_members FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.project_spaces ps
    WHERE ps.id = space_members.space_id AND public.is_project_admin(auth.uid(), ps.project_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.project_spaces ps
    WHERE ps.id = space_members.space_id AND public.is_project_admin(auth.uid(), ps.project_id)
  )
);

-- doc_folders
CREATE POLICY "df_select" ON public.doc_folders FOR SELECT TO authenticated
USING (public.has_folder_access(auth.uid(), doc_folders.id));

CREATE POLICY "df_admin" ON public.doc_folders FOR ALL TO authenticated
USING (public.is_project_admin(auth.uid(), project_id))
WITH CHECK (public.is_project_admin(auth.uid(), project_id));

CREATE POLICY "df_insert_member" ON public.doc_folders FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.project_spaces ps
    JOIN public.space_members sm ON sm.space_id = ps.id
    JOIN public.user_accounts ua ON ua.id = sm.user_account_id
    WHERE ps.project_id = doc_folders.project_id AND ps.space_key = 'dokumenter'
      AND ua.auth_user_id = auth.uid() AND ua.is_active
  )
);

-- folder_members
CREATE POLICY "fm_select" ON public.folder_members FOR SELECT TO authenticated
USING (public.has_folder_access(auth.uid(), folder_id));

CREATE POLICY "fm_admin" ON public.folder_members FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.doc_folders df
    WHERE df.id = folder_members.folder_id AND public.is_project_admin(auth.uid(), df.project_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.doc_folders df
    WHERE df.id = folder_members.folder_id AND public.is_project_admin(auth.uid(), df.project_id)
  )
);

-- docs_files
CREATE POLICY "dfi_select" ON public.docs_files FOR SELECT TO authenticated
USING (
  public.is_project_admin(auth.uid(), project_id)
  OR (
    folder_id IS NOT NULL AND public.has_folder_access(auth.uid(), folder_id)
  )
  OR (
    folder_id IS NULL AND EXISTS (
      SELECT 1 FROM public.project_spaces ps
      JOIN public.space_members sm ON sm.space_id = ps.id
      JOIN public.user_accounts ua ON ua.id = sm.user_account_id
      WHERE ps.project_id = docs_files.project_id AND ps.space_key = 'dokumenter'
        AND ua.auth_user_id = auth.uid() AND ua.is_active
    )
  )
);

CREATE POLICY "dfi_insert" ON public.docs_files FOR INSERT TO authenticated
WITH CHECK (
  public.is_project_admin(auth.uid(), project_id)
  OR EXISTS (
    SELECT 1 FROM public.project_spaces ps
    JOIN public.space_members sm ON sm.space_id = ps.id
    JOIN public.user_accounts ua ON ua.id = sm.user_account_id
    WHERE ps.project_id = docs_files.project_id AND ps.space_key = 'dokumenter'
      AND ua.auth_user_id = auth.uid() AND ua.is_active
  )
);

CREATE POLICY "dfi_update" ON public.docs_files FOR UPDATE TO authenticated
USING (
  public.is_project_admin(auth.uid(), project_id)
  OR created_by = (SELECT ua.id FROM public.user_accounts ua WHERE ua.auth_user_id = auth.uid() AND ua.is_active LIMIT 1)
);

CREATE POLICY "dfi_delete" ON public.docs_files FOR DELETE TO authenticated
USING (
  public.is_project_admin(auth.uid(), project_id)
  OR created_by = (SELECT ua.id FROM public.user_accounts ua WHERE ua.auth_user_id = auth.uid() AND ua.is_active LIMIT 1)
);

-- Triggers
CREATE TRIGGER update_doc_folders_updated_at
BEFORE UPDATE ON public.doc_folders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_docs_files_updated_at
BEFORE UPDATE ON public.docs_files
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
