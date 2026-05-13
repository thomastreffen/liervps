-- Helper to check if a user can access an hms submission referenced by a storage path of form
-- 'submissions/<submission_id>/...' inside the hms-attachments bucket.
CREATE OR REPLACE FUNCTION public.has_hms_attachment_access(_auth_user_id uuid, _name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH parts AS (
    SELECT (storage.foldername(_name))[1] AS root,
           NULLIF((storage.foldername(_name))[2], '')::uuid AS submission_id
  )
  SELECT EXISTS (
    SELECT 1 FROM parts p
    JOIN public.hms_submissions s ON s.id = p.submission_id
    WHERE p.root = 'submissions'
      AND s.deleted_at IS NULL
      AND (
        public.has_hms_view(_auth_user_id, s.company_id)
        OR s.submitted_by = _auth_user_id
      )
  )
$$;

-- Drop previous wide-open policies for hms-attachments
DROP POLICY IF EXISTS "hms_attachments_authenticated_read" ON storage.objects;
DROP POLICY IF EXISTS "hms_attachments_authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "hms_attachments_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "hms_attachments_owner_delete" ON storage.objects;
DROP POLICY IF EXISTS "hms_attachments_read" ON storage.objects;
DROP POLICY IF EXISTS "hms_attachments_insert" ON storage.objects;
DROP POLICY IF EXISTS "hms_attachments_update" ON storage.objects;
DROP POLICY IF EXISTS "hms_attachments_delete" ON storage.objects;

-- Scoped policies
CREATE POLICY "hms_attachments_scoped_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'hms-attachments'
    AND public.has_hms_attachment_access(auth.uid(), name)
  );

CREATE POLICY "hms_attachments_scoped_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'hms-attachments'
    AND public.has_hms_attachment_access(auth.uid(), name)
  );

CREATE POLICY "hms_attachments_scoped_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'hms-attachments'
    AND (owner = auth.uid() OR public.has_hms_attachment_access(auth.uid(), name))
  );

CREATE POLICY "hms_attachments_scoped_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'hms-attachments'
    AND (owner = auth.uid() OR public.has_hms_attachment_access(auth.uid(), name))
  );