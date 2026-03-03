
ALTER TABLE public.conversation_email_messages 
  ADD COLUMN IF NOT EXISTS verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS outlook_weblink text;
