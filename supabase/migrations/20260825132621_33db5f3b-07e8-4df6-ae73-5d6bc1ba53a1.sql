DO $$
DECLARE
  v_company uuid := 'd464f011-7911-4c8c-b35f-12f4d3970577';
  v_cat uuid;
  v_tmpl uuid;
  s1 uuid; s2 uuid; s3 uuid;
BEGIN
  SELECT id INTO v_cat FROM public.order_form_categories WHERE company_id = v_company AND slug = 'kontakt-og-pris';
  IF v_cat IS NULL THEN
    INSERT INTO public.order_form_categories (company_id, name, slug, description, sort_order, is_active, show_in_catalog)
    VALUES (v_company, 'Kontakt og prisforespørsel', 'kontakt-og-pris', 'Forespørsler om pris, befaring og service på varmepumper.', 1, true, true)
    RETURNING id INTO v_cat;
  END IF;

  SELECT id INTO v_tmpl FROM public.order_form_templates WHERE company_id = v_company AND slug = 'prisforesporsel';
  IF v_tmpl IS NULL THEN
    INSERT INTO public.order_form_templates (
      company_id, name, slug, category_id, audience_type, internal_title, external_title,
      description, confirmation_text, requires_login, is_active, show_in_catalog
    ) VALUES (
      v_company,
      'Prisforespørsel og kontakt',
      'prisforesporsel',
      v_cat,
      'external',
      'Prisforespørsel (nettside)',
      'Prisforespørsel og kontakt',
      'Fyll ut skjemaet så får du et konkret svar fra oss. Legg gjerne ved bilder eller tegninger — da kan vi ofte gi pris uten befaring.',
      'Takk! Forespørselen er registrert og behandles av oss. Du får svar på e-post, og kan følge saken via lenken under.',
      false, true, true
    ) RETURNING id INTO v_tmpl;

    INSERT INTO public.order_form_template_sections (template_id, title, description, sort_order)
    VALUES (v_tmpl, 'Kontaktopplysninger', 'Slik får vi tak i deg.', 1) RETURNING id INTO s1;
    INSERT INTO public.order_form_template_sections (template_id, title, description, sort_order)
    VALUES (v_tmpl, 'Hva gjelder det?', 'Jo mer vi vet, jo mer treffsikkert blir svaret.', 2) RETURNING id INTO s2;
    INSERT INTO public.order_form_template_sections (template_id, title, description, sort_order)
    VALUES (v_tmpl, 'Vedlegg', 'Bilder av rom, vegg, sikringsskap eller tegninger gir raskere pris.', 3) RETURNING id INTO s3;

    INSERT INTO public.order_form_template_fields
      (template_id, section_id, field_key, label, field_type, placeholder, help_text, is_required, options, sort_order, field_width)
    VALUES
      (v_tmpl, s1, 'kundetype', 'Kundetype', 'radio', NULL, NULL, true, '["Privat (bolig)","Bedrift / næring"]'::jsonb, 1, 'full'),
      (v_tmpl, s1, 'bestiller_navn', 'Navn', 'short_text', 'Fornavn Etternavn', NULL, true, NULL, 2, 'half'),
      (v_tmpl, s1, 'firmanavn', 'Firma', 'short_text', 'Firmanavn', 'Fylles ut av bedriftskunder.', false, NULL, 3, 'half'),
      (v_tmpl, s1, 'bestiller_epost', 'E-post', 'email', 'navn@epost.no', NULL, true, NULL, 4, 'half'),
      (v_tmpl, s1, 'bestiller_telefon', 'Telefon', 'phone', '900 00 000', NULL, true, NULL, 5, 'half'),
      (v_tmpl, s1, 'adresse', 'Adresse', 'short_text', 'Gateadresse', NULL, false, NULL, 6, 'half'),
      (v_tmpl, s1, 'poststed', 'Postnr. og sted', 'short_text', '3400 Lier', NULL, false, NULL, 7, 'half'),
      (v_tmpl, s2, 'henvendelsestype', 'Hva ønsker du hjelp med?', 'dropdown', NULL, NULL, true,
        '["Pris på ny varmepumpe","Befaring","Anbefaling av modell/løsning","Service og vedlikehold","Feilsøking / reparasjon","Serviceavtale","Annet"]'::jsonb, 1, 'full'),
      (v_tmpl, s2, 'bygningstype', 'Type bygg', 'dropdown', NULL, NULL, false,
        '["Enebolig","Rekkehus/tomannsbolig","Leilighet","Hytte","Næringsbygg","Borettslag/sameie","Annet"]'::jsonb, 2, 'half'),
      (v_tmpl, s2, 'oppvarmet_areal', 'Oppvarmet areal (m²)', 'number', 'f.eks. 140', NULL, false, NULL, 3, 'half'),
      (v_tmpl, s2, 'dagens_oppvarming', 'Dagens oppvarming', 'dropdown', NULL, NULL, false,
        '["Panelovner / elektrisk","Vedfyring","Vannbåren varme","Eksisterende varmepumpe","Fjernvarme","Annet / vet ikke"]'::jsonb, 4, 'half'),
      (v_tmpl, s2, 'antall_enheter', 'Antall enheter/rom som skal varmes', 'number', 'f.eks. 2', NULL, false, NULL, 5, 'half'),
      (v_tmpl, s2, 'onsket_tid', 'Når passer det?', 'dropdown', NULL, NULL, false,
        '["Så raskt som mulig","Innen 2-4 uker","Innen 1-3 måneder","Kun prisanslag nå"]'::jsonb, 6, 'half'),
      (v_tmpl, s2, 'eksisterende_anlegg', 'Merke/modell på eksisterende anlegg', 'short_text', 'f.eks. Mitsubishi MSZ-FH', 'Fyll ut ved service eller feilsøking.', false, NULL, 7, 'half'),
      (v_tmpl, s2, 'beskrivelse', 'Beskriv behovet', 'long_text', 'Fortell kort om boligen/bygget, ønsket plassering og eventuelle utfordringer.', NULL, false, NULL, 8, 'full'),
      (v_tmpl, s3, 'vedlegg', 'Bilder, tegninger eller dokumenter', 'file_upload', NULL, 'Bilder av rom/vegg/utedel, plantegning eller tilbud fra andre. Maks 10 MB per fil.', false, NULL, 1, 'full');
  END IF;
END $$;