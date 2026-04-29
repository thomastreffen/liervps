-- Add inbound_token to order_form_submissions for email reply matching
ALTER TABLE public.order_form_submissions
  ADD COLUMN IF NOT EXISTS inbound_token text;

-- Backfill existing rows
UPDATE public.order_form_submissions
SET inbound_token = gen_random_uuid()::text
WHERE inbound_token IS NULL;

-- Make NOT NULL + unique
ALTER TABLE public.order_form_submissions
  ALTER COLUMN inbound_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_order_form_submissions_inbound_token
  ON public.order_form_submissions (inbound_token);

-- Trigger to auto-generate inbound_token on insert when missing
CREATE OR REPLACE FUNCTION public.generate_order_submission_inbound_token()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.inbound_token IS NULL THEN
    NEW.inbound_token := gen_random_uuid()::text;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_order_submission_inbound_token ON public.order_form_submissions;
CREATE TRIGGER trg_generate_order_submission_inbound_token
  BEFORE INSERT ON public.order_form_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_order_submission_inbound_token();

-- Helper for inbox-sync to lookup submission by inbound_token (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_order_submission_by_inbound_token(_token text)
RETURNS TABLE (id uuid, company_id uuid, submission_no text, status text, awaiting_customer_reply boolean, open_request_message_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, company_id, submission_no, status, awaiting_customer_reply, open_request_message_id
  FROM public.order_form_submissions
  WHERE inbound_token = _token
    AND deleted_at IS NULL
  LIMIT 1;
$$;

-- Helper to find submission by submission_no (for subject fallback BST-XXXXXX)
CREATE OR REPLACE FUNCTION public.get_order_submission_by_no(_submission_no text)
RETURNS TABLE (id uuid, company_id uuid, submission_no text, status text, inbound_token text, awaiting_customer_reply boolean, open_request_message_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, company_id, submission_no, status, inbound_token, awaiting_customer_reply, open_request_message_id
  FROM public.order_form_submissions
  WHERE submission_no = _submission_no
    AND deleted_at IS NULL
  LIMIT 1;
$$;