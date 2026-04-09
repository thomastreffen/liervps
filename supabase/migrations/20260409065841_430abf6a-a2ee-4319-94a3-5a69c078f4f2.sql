
-- Create the order_form_messages table
CREATE TABLE public.order_form_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.order_form_submissions(id) ON DELETE CASCADE,
  sender_type text NOT NULL CHECK (sender_type IN ('admin', 'customer', 'system')),
  sender_user_id uuid,
  sender_name text,
  message_type text NOT NULL DEFAULT 'message' CHECK (message_type IN ('message', 'request_info', 'system')),
  body text NOT NULL,
  is_visible_to_customer boolean NOT NULL DEFAULT false,
  requires_reply boolean NOT NULL DEFAULT false,
  replied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add helper columns to submissions
ALTER TABLE public.order_form_submissions
  ADD COLUMN IF NOT EXISTS awaiting_customer_reply boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_customer_message_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_admin_message_at timestamptz,
  ADD COLUMN IF NOT EXISTS open_request_message_id uuid REFERENCES public.order_form_messages(id);

-- Indexes
CREATE INDEX idx_ofm_submission ON public.order_form_messages(submission_id, created_at);
CREATE INDEX idx_ofm_requires_reply ON public.order_form_messages(submission_id) WHERE requires_reply = true AND replied_at IS NULL;

-- Enable RLS
ALTER TABLE public.order_form_messages ENABLE ROW LEVEL SECURITY;

-- Policy: internal users can read all messages for their company
CREATE POLICY "Internal users can read messages"
  ON public.order_form_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.order_form_submissions s
      WHERE s.id = submission_id
        AND public.user_has_company_access(auth.uid(), s.company_id)
    )
  );

-- Policy: internal users can create messages
CREATE POLICY "Internal users can create messages"
  ON public.order_form_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.order_form_submissions s
      WHERE s.id = submission_id
        AND public.user_has_company_access(auth.uid(), s.company_id)
    )
  );

-- Policy: anon can read customer-visible messages via public_tracking_token
CREATE POLICY "Anon can read visible messages via token"
  ON public.order_form_messages FOR SELECT
  TO anon
  USING (
    is_visible_to_customer = true
    AND EXISTS (
      SELECT 1 FROM public.order_form_submissions s
      WHERE s.id = submission_id
        AND s.public_tracking_token IS NOT NULL
    )
  );

-- Policy: anon can insert customer replies
CREATE POLICY "Anon can insert customer replies"
  ON public.order_form_messages FOR INSERT
  TO anon
  WITH CHECK (
    sender_type = 'customer'
    AND is_visible_to_customer = true
    AND EXISTS (
      SELECT 1 FROM public.order_form_submissions s
      WHERE s.id = submission_id
        AND s.public_tracking_token IS NOT NULL
    )
  );

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_form_messages;
