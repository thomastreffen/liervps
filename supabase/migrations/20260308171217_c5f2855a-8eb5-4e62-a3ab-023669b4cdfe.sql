
-- Add customer approval fields to events for work packages
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS customer_approval_status text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS customer_approved_by text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS customer_approved_at timestamptz DEFAULT NULL;

-- Add constraint for valid approval statuses
-- Using a validation trigger instead of CHECK for flexibility
CREATE OR REPLACE FUNCTION public.validate_wp_approval_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.customer_approval_status IS NOT NULL AND NEW.customer_approval_status NOT IN (
    'awaiting_customer_approval', 'approved', 'rejected', 'ready_for_billing'
  ) THEN
    RAISE EXCEPTION 'Invalid customer_approval_status: %', NEW.customer_approval_status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_wp_approval ON public.events;
CREATE TRIGGER trg_validate_wp_approval
  BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_wp_approval_status();
