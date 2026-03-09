CREATE POLICY "posts_update"
ON public.conversation_posts
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM conversation_threads ct
    WHERE ct.id = conversation_posts.thread_id
      AND has_samtaler_access(auth.uid(), ct.project_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM conversation_threads ct
    WHERE ct.id = conversation_posts.thread_id
      AND has_samtaler_access(auth.uid(), ct.project_id)
  )
);