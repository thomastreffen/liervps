CREATE OR REPLACE FUNCTION public.auto_create_commercial_case_for_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _new_id uuid;
  _row jsonb;
  _customer_id uuid;
  _contact_person_id uuid;
  _title text;
BEGIN
  IF NEW.commercial_case_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.company_id IS NULL THEN
    RETURN NEW;
  END IF;

  _row := to_jsonb(NEW);
  _customer_id := NULLIF(_row->>'customer_id','')::uuid;
  _contact_person_id := NULLIF(_row->>'contact_person_id','')::uuid;
  _title := COALESCE(
    NULLIF(_row->>'title',''),
    NULLIF(_row->>'subject',''),
    NULLIF(_row->>'company_name',''),
    'Lead'
  );

  -- Only auto-create commercial case when a customer is linked
  IF _customer_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.commercial_cases (company_id, title, customer_id, contact_person_id, created_by, source, phase)
  VALUES (
    NEW.company_id,
    _title,
    _customer_id,
    _contact_person_id,
    NULLIF(_row->>'created_by','')::uuid,
    'lead',
    'lead'
  )
  RETURNING id INTO _new_id;
  NEW.commercial_case_id := _new_id;
  RETURN NEW;
END;
$function$;