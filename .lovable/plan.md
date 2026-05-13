# Runde B: HMS & HR-modul

Runde B er omfattende (≈40+ filer, 3 edge-funksjoner, ~10 nye/utvidede tabeller) og må leveres i flere etapper for å holde kvalitet, gjøre testing mulig og holde hvert sprang innenfor en gjennomgåelig endring.

Forslag til 5 etapper. Hver etappe avsluttes med fungerende UI og er klar til godkjenning før neste starter.

---

## B1 — Malmotor (datamodell + admin-CRUD)

Admin-visning under `/hms/templates` som dekker punkt 1 i bestillingen, og seeding av standardmalene fra punkt 2.

- Datamodellutvidelser
  - `hms_templates`: legg til `kind` ('sja' | 'checklist'), `mcs_work_types[]`, `is_active`, `version`, `requires_signature`
  - `hms_template_sections`: rekkefølge og tittel
  - `hms_template_items`: utvid `field_type`-enum til {`yes_no_na`, `text`, `long_text`, `attachment`, `risk`, `mitigation`, `signature`, `responsible`, `due_date`}, `is_required`, `help_text`, `default_value`
- UI
  - Liste `/hms/templates` med filter på kind + område + arbeidstype
  - Editor `/hms/templates/:id` med drag-and-drop seksjoner og punkter
  - Tag-velger for `hms_areas` koblet mot `hms_area_catalog`
- Seed
  - 7 SJA-maler + 5 sjekklister (MCS-tilpassede, generiske punkter, ingen kopiert tekst)
  - Tagget med `mcs_work_types` + `hms_areas` så `suggest_hms_areas` kan rangere dem
- RLS
  - Lese: alle med `hms.view` i samme `company_id`
  - Endre: `hms.manage`

## B2 — Mobil utfylling + innsendinger

Punkt 3 og 4. Operativ for montør i felt.

- Datamodell
  - `hms_submissions` får `event_id`, `submitted_by_user_account_id`, `submitted_at`, `lat/lng`
  - `hms_submission_answers`: ett rad per template_item, JSONB-verdi
  - `hms_submission_signatures`: PNG i `hms-attachments`
  - `hms_submission_attachments`: bilde/vedlegg per svar
- Mobilside `/hms/mobile`
  - "Mine HMS i dag": foreslåtte SJA + obligatoriske sjekklister fra dagens jobber
  - Stepper-flyt: jobb → mal → punkter → bilder → ekstra risikopunkt → signatur → fullfør
  - Kameraknapp og tegne-signatur (canvas)
  - RUH/avvik-knapp som lager `hms_incidents` med foto + GPS
- Liste over egne innsendinger med status

## B3 — Tripletex-import + AML-motor V1

Punkt 5 og 6, satt sammen fordi importen mater motoren.

- Importside `/hms/import`
  - Excel/CSV-opplasting (klient-parser med `xlsx`)
  - Auto-foreslått kolonnemapping (header-matching)
  - Forhåndsvisning + bekreft
  - Idempotens: `source_external_id` foretrukket, ellers `source_hash` av (employee_id|date|start|end|ord|ot|project|type)
  - Rapport: lest, ny, oppdatert, ignorert dublett, usikker, AML-varsler
- Edge-funksjon `worktime-aml-evaluate`
  - Triggeres av importen og kan kjøres manuelt
  - Regler: 13t/dag, 48t/uke, 10t OT/7d, 25t OT/4u, 200t OT/52u, <11t hvile, OT uten godkjenning
  - Skriver `worktime_alerts` med `why`, `consequence`, `suggested_action`, `severity`

## B4 — Ansattvisning + Dashboard-oppdateringer

Punkt 7 og 8.

- `/hms/employees` liste + `/hms/employees/:id` detalj
  - Arbeidstidsprofil + hvilende rull-tall (uke/måned/7d/4u/52u)
  - Åpne AML-varsler med "akkrediter / lukk"
  - Håndbok-status, SJA-deltakelse, åpne tiltak
- `/hms` (dashboard): kortene henter ekte data, ny "Krever handling"-stripe over kortene

## B5 — Sikkerhet + design-finpuss

Punkt 9 og 10.

- RLS gjennomgang per tabell
  - `hms_submissions`: montør ser kun egne; PL ser eget prosjekts; HMS-leder ser hele selskapet
  - `worktime_entries` og `worktime_alerts`: ansatt ser egne, leder ser sine direkterapporter via `employee_work_profiles.manager_user_account_id`
- MCS Signal teal som HMS-primærfarge (egen token), erstatte midlertidig grønt
- Mobil polering, A11y-kontroll, touch targets ≥44px

---

## Tekniske notater

- Edge-funksjon for AML kjører som chained self-invocation per ansatt for å holde latency lav
- `hms-attachments`-bucket finnes (privat) fra runde A — gjenbrukes for signaturer og bilder
- All UI bruker eksisterende design tokens; teal-token introduseres i B5
- Idempotens på SJA-innsending via `client_request_id` (mønster fra prosjekter)

---

## Spørsmål før jeg starter

1. **Rekkefølge**: Foreslår B1 → B2 → B3 → B4 → B5. OK?
2. **Standardmaler i B1**: Vil du godkjenne tekstutkast per mal før seed, eller kan jeg seede direkte med generiske MCS-tilpassede punkter du kan redigere etterpå?
3. **AML-grenser i B3**: Bruker MCS standardgrenser fra runde A (13t/dag, 48t/uke), eller har dere egne tariff-/avtalegrenser jeg skal kode inn?
4. **Signatur i B2**: Canvas-tegning er nok, eller trenger vi BankID-signatur (krever ekstern integrasjon, betydelig ekstra arbeid)?

Si fra hvilken etappe jeg skal starte med, så går jeg rett på datamodell + UI for den.
