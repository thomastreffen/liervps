# HMS & HR-modul – Førsteleveranse

Dette er en stor modul. Jeg foreslår å levere i to faser slik at vi får et solid fundament først, og bygger AI/avanserte rapporter som fase 2.

## Fase 1 (denne leveransen)

### 1. Datamodell og RLS

Én migrasjon som oppretter alle tabellene. Alle har `company_id`, `created_at`, `updated_at`, `deleted_at`, `created_by`. RLS via eksisterende `user_has_company_access(auth.uid(), company_id)` og `check_permission_v2`.

**Håndbøker**
- `hms_handbooks` – type (hms|arbeid|annet), tittel, status (draft|published|archived), current_version_id
- `hms_handbook_versions` – versjonsnummer, publisert_at, publisert_av, changelog, requires_acknowledgement
- `hms_handbook_sections` – innhold per kapittel (rich text), ordering
- `hms_handbook_acknowledgements` – user_id, version_id, acknowledged_at, ip, user_agent

**Maler og innsendinger (SJA / sjekklister / risiko)**
- `hms_templates` – kind (sja|checklist|risk), navn, kategori (datacenter|næringsbygg|tavle|strømskinne|service|generell), aktiv
- `hms_template_sections` – seksjoner med rekkefølge
- `hms_template_items` – item_type (text|number|select|multi|yes_no|signature|photo|risk_matrix|severity), required, options, ai_hint
- `hms_submissions` – template_id, project_id (nullable), status (draft|submitted|approved|rejected), submitted_by, location, gps
- `hms_submission_answers` – item_id, value (jsonb), photos[]
- `hms_submission_participants` – user_id eller fritekst-navn, rolle
- `hms_submission_signatures` – signer_name, signature_data, signed_at

**Risiko / avvik / tiltak**
- `hms_risk_assessments` – kobles til template eller fri
- `hms_risk_items` – beskrivelse, sannsynlighet, konsekvens, score, foreslått_tiltak, ai_generated
- `hms_action_items` – tittel, ansvarlig_user_id, frist, status, lenke til risk/incident/submission
- `hms_incidents` – type (avvik|RUH|near_miss|skade), severity, beskrivelse, status, lukket_av

**Ansatte / arbeidstidsregler**
- `employee_work_profiles` – user_id, stillingsprosent, gjennomsnittsberegning_aktiv, ruleset_id, ukentlig_norm
- `worktime_rulesets` – navn, regler (jsonb: max_per_day, max_per_week, overtime_7d, overtime_4w, overtime_52w, min_rest_hours)
- `worktime_import_batches` – source_system (tripletex), filename, imported_by, total_rows, new_rows, updated_rows, skipped_rows, status
- `worktime_entries` – user_id (nullable hvis ikke matchet), employee_external_id, work_date, start_at, end_at, hours, hours_overtime, project_external_ref, activity, source_system, source_external_id, source_hash, batch_id. UNIQUE(source_system, source_external_id)
- `worktime_rule_checks` – periodisert sjekkresultat (daily/weekly/4w/52w/rest)
- `worktime_alerts` – user_id, rule_key, period_start, period_end, severity (info|warn|critical), value, threshold, why, consequence, suggested_action, status (open|ack|resolved)
- `worktime_alert_actions` – varsel-id, handling, performed_by
- `overtime_approvals` – user_id, periode, timer, godkjent_av, status

**Audit**
- `hms_audit_log` – entity_type, entity_id, action, performed_by, payload (jsonb)

Alle skrive-RLS krever `user_has_company_access`. Ansatte kan se egne `worktime_*` og `hms_handbook_acknowledgements`. Ledere/admin (permission `hms.manage` + `hms.view_all`) ser alt i selskapet. Vi legger til to nye permission keys: `hms.view`, `hms.manage`, `hms.approve_overtime`.

### 2. Routing og navigasjon

Ny seksjon "HMS & HR" i sidebar (med icon `ShieldCheck`), kun synlig hvis `hms.view`. Ruter under `/hms/*`:

```
/hms                       Oversikt
/hms/handbooks             Håndbøker (liste)
/hms/handbooks/:id         Håndbok-detalj/redigering/versjoner
/hms/sja                   SJA (innsendinger + ny)
/hms/checklists            Sjekklister
/hms/risk                  Risikoanalyser
/hms/incidents             Avvik / RUH
/hms/actions               Tiltak
/hms/employees             Ansatte (HMS-perspektiv)
/hms/worktime              Arbeidstid / AML
/hms/worktime/:userId      AML-detalj per ansatt
/hms/import                Import (Tripletex)
/hms/reports               Rapporter
/hms/settings              Innstillinger (maler, regelsett, kategorier)

/hms/m/:templateId         Mobil utfyllingsside (responsiv, optimert for mobil)
/hms/m/submissions/:id     Mobil sammendrag/signering
```

`CompanyProvider` styrer `activeCompanyId`. Superadmin ser velger; vanlige brukere har bare egen.

### 3. UI-skjelett (denne fasen leverer fungerende sider, ikke alle ferdige interaksjoner)

- **Oversikt**: KPI-kort (åpne avvik, AML-varsler, ulest håndbok, manglende SJA siste 30d), liste over kritiske AML-varsler, siste innsendinger.
- **Håndbøker**: Liste, opprett, versjoner, publiser → trigger lesebekreftelse for alle aktive ansatte i selskapet. Lesebekreftelse-side med "Jeg har lest og forstått".
- **Malmotor**: Visual builder (seksjoner + items, dra/slipp lett versjon), forhåndsvisning. Pre-seedede maler for datacenter, tavle, strømskinne, service.
- **Mobil utfylling**: Stepper per seksjon, store touch targets, kamera/foto-opplasting til `hms-attachments` storage bucket, GPS-stempling, signatur (canvas).
- **AML per ansatt**: Tidslinje med daglige/ukentlige timer, fargekodet (OK / nærmer seg / krever handling), liste over åpne varsler med "hvorfor / konsekvens / forslag", godkjenning av overtid.
- **Import Tripletex**: Last opp Excel/CSV → bruk eksisterende `tripletex-csv-parser` → mapping-UI (kolonne → felt) → forhåndsvisning med diff (nye / oppdaterte / uendret / hoppet over) → bekreft import. Idempotens via `source_external_id` (Tripletex tidsregistrerings-ID) eller fallback `source_hash = sha256(employee_id|date|start|end|activity)`.

### 4. AML-varselmotor (versjon 1)

Edge function `worktime-aml-evaluate` kjøres etter import og kan trigges manuelt. Sjekker per `employee_work_profile`:

- timer per dag (default 13t kritisk, 10t advarsel)
- timer per uke (default 48t kritisk, 40t advarsel; AML §10-4 inkl. gj.snittsberegning)
- overtid siste 7 dager (10t advarsel, 13t kritisk)
- overtid siste 4 uker (25t advarsel, 30t kritisk)
- overtid siste 52 uker (200t advarsel, 240t kritisk)
- hviletid < 11t mellom økter
- overtid uten matchende `overtime_approvals`

Hvert varsel lagres med strukturert `why`, `consequence`, `suggested_action`. UI viser "Forklar" som åpner forklaringspanel.

## Fase 2 (foreslått, ikke i denne leveransen)

- AI-assistanse: forslag til risiko/tiltak/sjekkpunkter via Lovable AI (`google/gemini-2.5-flash`), forklaring av AML-varsler i naturlig språk, smart mapping ved import.
- Avanserte rapporter (PDF-eksport, kvartalsvis HMS-rapport, AML-rapport til verneombud).
- Repeterende sjekklister (planlagte oppgaver i kalender).
- Integrasjon med eksisterende `events`/prosjekt for å foreslå SJA før jobboppstart.
- Push-varsler for ulest håndbok / kritiske AML-varsler.

## Tekniske detaljer

- Migrasjon kjøres som én stor fil (alle tabeller, indekser, RLS, helpers, audit-trigger). Permissions seedes via insert-tool etter migrasjon.
- Storage bucket `hms-attachments` (privat) for foto/signatur fra mobil.
- Helper-functions: `has_hms_permission(_user, _company, _perm)` (SECURITY DEFINER) for å unngå RLS-loop mot `user_memberships`.
- Audit-trigger `hms_audit()` på alle hms_* og worktime_* tabeller skriver til `hms_audit_log`.
- Felles komponent `<HmsLayout>` med tabs/sidebar for /hms-rutene.
- Mobil-ruter har egen layout uten sidebar (full-screen, optimert for små skjermer).
- Import: bruker eksisterende `readFileWithEncoding` + `parseCSV` fra `src/lib/tripletex-csv-parser.ts`. Også støtte for `.xlsx` via `xlsx`-bibliotek (legges til hvis ikke finnes).
- Idempotens: UNIQUE-constraint på `(source_system, source_external_id) WHERE source_external_id IS NOT NULL`. Når denne mangler brukes `source_hash` UNIQUE per `(company_id, source_hash)`.

## Hva jeg trenger fra deg

1. Bekreft at fase-oppdelingen er OK (AI-assistanse og avanserte rapporter går til fase 2).
2. Bekreft tabellnavn/kolonnenavn i grove trekk – jeg legger til detaljer underveis, men strukturen blir som beskrevet.
3. Standardgrenseverdier for AML – bruker AML §10-4/§10-6 + 10t/dag, 48t/uke som default. Si fra hvis MCS har egne grenser.
4. Tripletex-eksport: har dere en konkret eksportkolonne for "tidsregistrerings-ID" vi kan bruke som `source_external_id`? Hvis ikke faller vi tilbake til hash.

Når du sier OK setter jeg i gang med migrasjon først (du får godkjenne den), så bygger jeg ut UI og edge-funksjon i samme tråd.
