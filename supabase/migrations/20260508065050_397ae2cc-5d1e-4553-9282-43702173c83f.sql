
CREATE OR REPLACE FUNCTION public.compute_submission_summary(_submission_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _result jsonb := '{}'::jsonb;
  _existing jsonb;
  _site text;
  _street text;
  _postal text;
  _city text;
  _firma text;
  _kunde text;
  _bestiller text;
  _kontakt text;
  r record;
  _val text;
  _label text;
  _fk text;
BEGIN
  SELECT COALESCE(s.summary, '{}'::jsonb) INTO _existing
  FROM public.order_form_submissions s WHERE s.id = _submission_id;

  FOR r IN
    SELECT v.field_key, v.value, COALESCE(f.label, '') AS label
    FROM public.order_form_submission_values v
    LEFT JOIN public.order_form_submissions s ON s.id = v.submission_id
    LEFT JOIN public.order_form_template_fields f
      ON f.template_id = s.template_id AND f.field_key = v.field_key
    WHERE v.submission_id = _submission_id
  LOOP
    IF jsonb_typeof(r.value) = 'string' THEN
      _val := trim(r.value #>> '{}');
    ELSIF jsonb_typeof(r.value) IN ('number','boolean') THEN
      _val := r.value #>> '{}';
    ELSE
      _val := NULL;
    END IF;
    IF _val IS NULL OR _val = '' THEN CONTINUE; END IF;

    _label := lower(trim(r.label));
    _fk := lower(r.field_key);

    IF _site IS NULL AND (
      _label IN ('oppdragssted','lokasjon','arbeidssted','anlegg','anleggsnavn',
                 'prosjekt','prosjektnavn','project','project name','site','site name',
                 'facility','facility name','customer site','job site')
    ) THEN
      _site := _val;
    ELSIF _street IS NULL AND (
      _label IN ('adresse','addresse','gateadresse','oppdragsadresse','anleggsadresse',
                 'street','street address','address','address line','address line 1',
                 'job address','site address')
      OR _fk LIKE 'anleggsadresse%' OR _fk LIKE 'gateadresse%'
    ) AND _val !~ '^\d{4}\s' THEN
      _street := _val;
    ELSIF (_postal IS NULL OR _city IS NULL) AND _val ~ '^\d{4}\s' THEN
      _postal := substring(_val from '^(\d{4})');
      _city := trim(substring(_val from '^\d{4}\s+(.*)$'));
    ELSIF _postal IS NULL AND _label IN ('postnummer','postcode','postal code','zip','zip code') THEN
      _postal := _val;
    ELSIF _city IS NULL AND _label IN ('poststed','postal city','city','sted') THEN
      _city := _val;
    ELSIF _firma IS NULL AND (
      _label IN ('firmanavn','firma','company','company name','fakturamottaker')
      OR _fk LIKE 'firmanavn%' OR _fk LIKE 'fakturamottaker%'
    ) THEN
      _firma := _val;
    ELSIF _kunde IS NULL AND _label IN ('kundenavn','kunde','customer','customer name') THEN
      _kunde := _val;
    ELSIF _kontakt IS NULL AND (
      _label IN ('kontaktperson','kontaktperson kunde','contact','contact name')
      OR _fk LIKE 'kontaktperson%'
    ) THEN
      _kontakt := _val;
    ELSIF _bestiller IS NULL AND (
      _label IN ('bestiller','bestiller – navn','bestiller navn','bestiller-navn')
      OR _fk LIKE 'bestiller_navn%'
    ) THEN
      _bestiller := _val;
    END IF;
  END LOOP;

  RETURN _existing || jsonb_strip_nulls(jsonb_build_object(
    'oppdragssted', _site,
    'adresse', _street,
    'postnummer', _postal,
    'poststed', _city,
    'firmanavn', _firma,
    'kundenavn', _kunde,
    'kontaktperson_kunde', _kontakt,
    'bestiller_navn', _bestiller
  ));
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_submission_summary_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _sid uuid;
BEGIN
  _sid := COALESCE(NEW.submission_id, OLD.submission_id);
  UPDATE public.order_form_submissions s
  SET summary = public.compute_submission_summary(_sid),
      updated_at = now()
  WHERE s.id = _sid;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_submission_summary
  ON public.order_form_submission_values;
CREATE TRIGGER trg_refresh_submission_summary
AFTER INSERT OR UPDATE OR DELETE ON public.order_form_submission_values
FOR EACH ROW EXECUTE FUNCTION public.refresh_submission_summary_trigger();

UPDATE public.order_form_submissions s
SET summary = public.compute_submission_summary(s.id)
WHERE s.deleted_at IS NULL;
