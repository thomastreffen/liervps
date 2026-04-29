-- 1. Add explicit linked_event_id on order submissions
ALTER TABLE public.order_form_submissions
  ADD COLUMN IF NOT EXISTS linked_event_id uuid REFERENCES public.events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_order_submissions_linked_event ON public.order_form_submissions(linked_event_id) WHERE linked_event_id IS NOT NULL;

-- 2. Field requests table (admin asks customer to fill)
CREATE TABLE IF NOT EXISTS public.order_form_field_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.order_form_submissions(id) ON DELETE CASCADE,
  request_batch_id uuid NOT NULL,
  -- Two modes: existing template field (field_key set) OR free text (free_text_label set)
  field_key text,
  field_label text NOT NULL,
  field_type text NOT NULL DEFAULT 'short_text',
  is_free_text boolean NOT NULL DEFAULT false,
  options jsonb,
  -- Status
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','answered','cancelled')),
  answer_value jsonb,
  answered_at timestamptz,
  -- Audit
  requested_by uuid,
  requested_by_name text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ofr_submission ON public.order_form_field_requests(submission_id);
CREATE INDEX IF NOT EXISTS idx_ofr_batch ON public.order_form_field_requests(request_batch_id);
CREATE INDEX IF NOT EXISTS idx_ofr_open ON public.order_form_field_requests(submission_id, status) WHERE status = 'open';

CREATE TRIGGER trg_ofr_updated_at
  BEFORE UPDATE ON public.order_form_field_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. RLS
ALTER TABLE public.order_form_field_requests ENABLE ROW LEVEL SECURITY;

-- Admins / company members can read & write
CREATE POLICY "company users read field requests"
  ON public.order_form_field_requests FOR SELECT
  TO authenticated
  USING (
    public.user_has_company_access(auth.uid(), public.get_order_company_id(submission_id))
    OR public.has_cross_company_order_access(auth.uid(), submission_id)
  );

CREATE POLICY "company users insert field requests"
  ON public.order_form_field_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_company_access(auth.uid(), public.get_order_company_id(submission_id))
    OR public.has_cross_company_order_access(auth.uid(), submission_id)
  );

CREATE POLICY "company users update field requests"
  ON public.order_form_field_requests FOR UPDATE
  TO authenticated
  USING (
    public.user_has_company_access(auth.uid(), public.get_order_company_id(submission_id))
    OR public.has_cross_company_order_access(auth.uid(), submission_id)
  );

-- 4. Token-scoped RPCs for the customer tracking page
CREATE OR REPLACE FUNCTION public.get_field_requests_by_token(_token text)
RETURNS SETOF public.order_form_field_requests
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT fr.*
  FROM public.order_form_field_requests fr
  JOIN public.order_form_submissions s ON s.id = fr.submission_id
  WHERE s.public_tracking_token = _token
    AND s.deleted_at IS NULL
  ORDER BY fr.requested_at ASC;
$$;

-- Customer answers a field request (anonymous via token)
CREATE OR REPLACE FUNCTION public.answer_field_request_by_token(
  _token text,
  _request_id uuid,
  _value jsonb,
  _submitter_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _submission record;
  _request record;
  _value_text text;
BEGIN
  -- Validate token + request belong together
  SELECT s.id, s.company_id, s.submission_no, s.status
  INTO _submission
  FROM public.order_form_submissions s
  WHERE s.public_tracking_token = _token
    AND s.deleted_at IS NULL;

  IF _submission.id IS NULL THEN
    RETURN jsonb_build_object('error', 'invalid_token');
  END IF;

  SELECT * INTO _request
  FROM public.order_form_field_requests
  WHERE id = _request_id
    AND submission_id = _submission.id;

  IF _request.id IS NULL THEN
    RETURN jsonb_build_object('error', 'request_not_found');
  END IF;

  IF _request.status <> 'open' THEN
    RETURN jsonb_build_object('error', 'already_answered');
  END IF;

  -- Mark request as answered
  UPDATE public.order_form_field_requests
  SET status = 'answered',
      answer_value = _value,
      answered_at = now(),
      updated_at = now()
  WHERE id = _request_id;

  -- If it maps to a template field, also write the value into submission_values
  IF _request.field_key IS NOT NULL AND _request.field_key <> '' THEN
    DELETE FROM public.order_form_submission_values
      WHERE submission_id = _submission.id AND field_key = _request.field_key;
    IF _value IS NOT NULL AND jsonb_typeof(_value) <> 'null' THEN
      INSERT INTO public.order_form_submission_values (submission_id, field_key, value)
      VALUES (_submission.id, _request.field_key, _value);
    END IF;
  END IF;

  -- Convert value to display text
  IF jsonb_typeof(_value) = 'string' THEN
    _value_text := _value #>> '{}';
  ELSE
    _value_text := _value::text;
  END IF;

  -- Activity log
  INSERT INTO public.order_form_activity_log (submission_id, event_type, payload)
  VALUES (
    _submission.id,
    'customer_filled_field',
    jsonb_build_object(
      'request_id', _request_id,
      'field_key', _request.field_key,
      'field_label', _request.field_label,
      'is_free_text', _request.is_free_text,
      'value_display', LEFT(COALESCE(_value_text, ''), 500),
      'submitter_name', _submitter_name,
      'summary', _request.field_label || ' fylt inn av bestiller'
    )
  );

  -- Touch submission timestamps
  UPDATE public.order_form_submissions
  SET last_activity_at = now(),
      customer_last_reply_at = now(),
      last_customer_message_at = now(),
      updated_at = now()
  WHERE id = _submission.id;

  RETURN jsonb_build_object('ok', true, 'request_id', _request_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_field_requests_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.answer_field_request_by_token(text, uuid, jsonb, text) TO anon, authenticated;
