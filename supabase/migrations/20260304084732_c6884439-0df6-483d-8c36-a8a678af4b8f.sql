
-- Add body_raw and body_clean columns to conversation_posts
ALTER TABLE public.conversation_posts 
  ADD COLUMN IF NOT EXISTS body_raw text,
  ADD COLUMN IF NOT EXISTS body_clean text;

-- Backfill: copy existing body_html/body_text to body_raw for email posts
UPDATE public.conversation_posts 
SET body_raw = COALESCE(body_html, body_text)
WHERE post_type = 'email' AND body_raw IS NULL;
