-- Add linked_order_submission_id to cases
ALTER TABLE public.cases 
ADD COLUMN linked_order_submission_id uuid REFERENCES public.order_form_submissions(id);

CREATE INDEX idx_cases_linked_order_submission_id ON public.cases(linked_order_submission_id) WHERE linked_order_submission_id IS NOT NULL;

-- Trigger function: sync order status changes back to the linked case
CREATE OR REPLACE FUNCTION public.sync_order_status_to_linked_case()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _case_id uuid;
  _new_case_status text;
  _resolution text;
BEGIN
  -- Only fire on status changes
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- Find linked case (either via linked_case_id on the order, or via linked_order_submission_id on cases)
  _case_id := NEW.linked_case_id;
  
  IF _case_id IS NULL THEN
    SELECT id INTO _case_id FROM public.cases
    WHERE linked_order_submission_id = NEW.id
      AND deleted_at IS NULL
    LIMIT 1;
  END IF;

  IF _case_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Map order status to case status
  _resolution := NULL;
  CASE NEW.status
    WHEN 'new' THEN
      _new_case_status := 'in_progress';
    WHEN 'under_review' THEN
      _new_case_status := 'in_progress';
    WHEN 'missing_info' THEN
      _new_case_status := 'waiting_customer';
    WHEN 'waiting_customer' THEN
      _new_case_status := 'waiting_customer';
    WHEN 'waiting_internal' THEN
      _new_case_status := 'waiting_internal';
    WHEN 'ready_for_planning' THEN
      _new_case_status := 'converted';
      _resolution := 'converted_to_order';
    WHEN 'task_created' THEN
      _new_case_status := 'converted';
      _resolution := 'converted_to_order';
    WHEN 'in_progress' THEN
      _new_case_status := 'converted';
      _resolution := 'converted_to_order';
    WHEN 'closed' THEN
      _new_case_status := 'closed';
      _resolution := 'converted_to_order';
    WHEN 'rejected' THEN
      _new_case_status := 'closed';
      _resolution := 'converted_to_order';
    ELSE
      RETURN NEW;
  END CASE;

  -- Update the case
  UPDATE public.cases
  SET status = _new_case_status::case_status,
      resolution_type = COALESCE(_resolution, resolution_type),
      updated_at = now()
  WHERE id = _case_id
    AND deleted_at IS NULL;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_order_status_to_case
AFTER UPDATE OF status ON public.order_form_submissions
FOR EACH ROW
EXECUTE FUNCTION public.sync_order_status_to_linked_case();