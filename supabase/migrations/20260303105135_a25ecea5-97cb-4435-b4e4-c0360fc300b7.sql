
-- ============================================
-- Conversation threads, posts, attachments
-- ============================================

-- Thread types
CREATE TYPE public.conversation_post_type AS ENUM ('internal_message', 'email', 'system');

-- Threads table
CREATE TABLE public.conversation_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.internal_companies(id),
  project_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  title text NOT NULL,
  thread_type text NOT NULL DEFAULT 'conversation' CHECK (thread_type IN ('conversation', 'email_thread')),
  created_by uuid REFERENCES public.user_accounts(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  post_count int NOT NULL DEFAULT 0,
  last_author_name text,
  is_archived boolean NOT NULL DEFAULT false
);

CREATE INDEX idx_conv_threads_project ON public.conversation_threads(project_id);
CREATE INDEX idx_conv_threads_company ON public.conversation_threads(company_id);

-- Posts table
CREATE TABLE public.conversation_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.conversation_threads(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.internal_companies(id),
  author_id uuid REFERENCES public.user_accounts(id),
  post_type public.conversation_post_type NOT NULL DEFAULT 'internal_message',
  subject text,
  body_html text,
  body_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- email fields
  outlook_message_id text,
  outlook_weblink text,
  from_email text,
  from_name text,
  to_emails text[],
  cc_emails text[],
  sent_at timestamptz,
  direction text CHECK (direction IN ('inbound', 'outbound'))
);

CREATE INDEX idx_conv_posts_thread ON public.conversation_posts(thread_id);

-- Attachments table
CREATE TABLE public.conversation_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.conversation_posts(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_size bigint,
  mime_type text,
  storage_path text,
  sharepoint_web_url text,
  sharepoint_drive_item_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_conv_attachments_post ON public.conversation_attachments(post_id);

-- Update post_count and last_activity_at on thread when post is added
CREATE OR REPLACE FUNCTION public.update_thread_stats()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  _author_name text;
BEGIN
  SELECT p.full_name INTO _author_name
  FROM user_accounts ua
  JOIN people p ON p.id = ua.person_id
  WHERE ua.id = NEW.author_id;

  UPDATE conversation_threads
  SET post_count = post_count + 1,
      last_activity_at = NEW.created_at,
      last_author_name = COALESCE(_author_name, NEW.from_name, 'System')
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_thread_stats
  AFTER INSERT ON public.conversation_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_thread_stats();

-- ============================================
-- RLS
-- ============================================
ALTER TABLE public.conversation_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_attachments ENABLE ROW LEVEL SECURITY;

-- Helper: can user access conversations room for a project?
-- Uses existing functions, avoids recursion by not querying these tables
CREATE OR REPLACE FUNCTION public.has_samtaler_access(_auth_user_id uuid, _project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
  SELECT
    -- Company admin bypass
    public.check_permission_v2(_auth_user_id, 'admin.manage_users')
    -- Project admin
    OR public.is_project_admin(_auth_user_id, _project_id)
    -- Internal non-follower (auto room access)
    OR public.is_internal_nonfollow_member(_auth_user_id, _project_id)
    -- Explicit space member for samtaler
    OR EXISTS (
      SELECT 1 FROM project_spaces ps
      JOIN space_members sm ON sm.space_id = ps.id
      JOIN user_accounts ua ON ua.id = sm.user_account_id
      WHERE ps.project_id = _project_id
        AND ps.space_key = 'samtaler'
        AND ps.is_enabled = true
        AND ua.auth_user_id = _auth_user_id
        AND ua.is_active = true
    )
$$;

-- Threads: read if has samtaler access
CREATE POLICY "threads_select" ON public.conversation_threads
  FOR SELECT TO authenticated
  USING (public.has_samtaler_access(auth.uid(), project_id));

-- Threads: insert if has samtaler access
CREATE POLICY "threads_insert" ON public.conversation_threads
  FOR INSERT TO authenticated
  WITH CHECK (public.has_samtaler_access(auth.uid(), project_id));

-- Threads: update own or admin
CREATE POLICY "threads_update" ON public.conversation_threads
  FOR UPDATE TO authenticated
  USING (
    public.is_project_admin(auth.uid(), project_id)
    OR public.check_permission_v2(auth.uid(), 'admin.manage_users')
    OR created_by = public.get_user_account_id(auth.uid())
  );

-- Posts: select via thread access
CREATE POLICY "posts_select" ON public.conversation_posts
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM conversation_threads ct
    WHERE ct.id = thread_id
      AND public.has_samtaler_access(auth.uid(), ct.project_id)
  ));

-- Posts: insert
CREATE POLICY "posts_insert" ON public.conversation_posts
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM conversation_threads ct
    WHERE ct.id = thread_id
      AND public.has_samtaler_access(auth.uid(), ct.project_id)
  ));

-- Attachments: select via post -> thread access
CREATE POLICY "attachments_select" ON public.conversation_attachments
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM conversation_posts cp
    JOIN conversation_threads ct ON ct.id = cp.thread_id
    WHERE cp.id = post_id
      AND public.has_samtaler_access(auth.uid(), ct.project_id)
  ));

-- Attachments: insert
CREATE POLICY "attachments_insert" ON public.conversation_attachments
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM conversation_posts cp
    JOIN conversation_threads ct ON ct.id = cp.thread_id
    WHERE cp.id = post_id
      AND public.has_samtaler_access(auth.uid(), ct.project_id)
  ));

-- Enable realtime for conversation threads
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_threads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_posts;
