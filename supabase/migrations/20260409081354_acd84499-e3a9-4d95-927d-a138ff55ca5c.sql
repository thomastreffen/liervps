
-- Add inbound_token to order_form_participants for email reply matching
ALTER TABLE public.order_form_participants
  ADD COLUMN IF NOT EXISTS inbound_token text UNIQUE DEFAULT gen_random_uuid()::text;

-- Backfill existing rows
UPDATE public.order_form_participants
SET inbound_token = gen_random_uuid()::text
WHERE inbound_token IS NULL;

-- Index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_ofp_inbound_token ON public.order_form_participants(inbound_token) WHERE inbound_token IS NOT NULL;

-- Auto-generate token on insert
CREATE OR REPLACE FUNCTION public.generate_order_participant_token()
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

DROP TRIGGER IF EXISTS trg_generate_order_participant_token ON public.order_form_participants;
CREATE TRIGGER trg_generate_order_participant_token
  BEFORE INSERT ON public.order_form_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_order_participant_token();
