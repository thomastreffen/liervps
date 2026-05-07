## Problem

Når en oppgave som er koblet til en bestilling flyttes (dato/tid endres i ressursplanen / EventDrawer), oppdateres `events.start_time/end_time`, men selve bestillingen og kundens sporingsside viser fortsatt den opprinnelige planlagte datoen. Årsaken:

- `OrderTrackingPage` (`/track/:token`) leser kun fra `order_form_activity_log` for å bygge "Hendelseslogg".
- Den opprinnelige planleggingen logges som `converted_to_order` med `payload.scheduled_start` ved opprettelse, og det skrives ingen ny logg når oppgaven re-planlegges.
- `order_form_submissions.last_activity_at` oppdateres heller ikke, så "Oppdatert X minutter siden" stemmer ikke.
- Kunden ser dermed alltid første dato, selv om oppgaven internt er flyttet.

## Løsning

Når en oppgave med kobling til en bestilling re-planlegges (tid endret), skal vi automatisk:

1. Logge en ny hendelse `task_rescheduled` på bestillingen.
2. Oppdatere `last_activity_at` på bestillingen.
3. Vise hendelsen i kundens sporingsside-tidslinje med tydelig norsk tekst (f.eks. "Oppgaven er flyttet til ny tid – 11. mai 2026 kl. 08:00").

Koblingen finnes via `events.source_order_form_id` (oppgave opprettet fra bestilling) og/eller `order_form_submissions.linked_event_id` (manuelt koblet) — vi må sjekke begge.

## Endringer

### 1. `src/components/EventDrawer.tsx` — `persistEventChanges`
Etter at `events`-raden er oppdatert og når `timeChanged === true`:

- Finn submissions koblet til denne `editEvent.id`:
  - Spør `order_form_submissions` på `linked_event_id = editEvent.id` OR `source_order_form_id IS NOT NULL` matches via `events.source_order_form_id` (vi har allerede `editEvent.id`, så enklest: hent `events.source_order_form_id` for denne raden + select submissions med `linked_event_id = editEvent.id`).
- For hver berørt submission:
  - Insert i `order_form_activity_log`:
    ```
    event_type: "task_rescheduled",
    payload: {
      event_id: editEvent.id,
      old_start: editEvent.start.toISOString(),
      new_start: startISO,
      old_end: editEvent.end.toISOString(),
      new_end: endISO,
      summary: "Flyttet fra <gammel> til <ny>"
    }
    ```
  - Update `order_form_submissions.last_activity_at = now()`.

Plasseres i samme blokk som annen aktivitetslogging i drawer'en, kun når `sendNotifications`/persistering faktisk skjer.

### 2. `src/pages/OrderTrackingPage.tsx` — `CustomerTimeline`
- Legg `task_rescheduled` til whitelisten av synlige `event_type` (linje 77-82).
- Legg til label i `timelineLabels`: `task_rescheduled: "Oppgaven er flyttet til ny tid"`.
- I `payload.summary` (allerede vist under label) sender vi en kort norsk beskrivelse av ny tid; oppdatering av "Sist oppdatert" øverst skjer automatisk via `last_activity_at`.

### 3. (Valgfritt, samme PR) Admin-detaljside
`src/pages/OrderFormDetailPage.tsx` viser allerede live data fra `events`, så koblet oppgave-kortet (`LinkedTaskSection`) reflekterer ny dato umiddelbart. Ingen endringer nødvendig der.

### 4. Ingen DB-migrasjon nødvendig
`order_form_activity_log` aksepterer fri `event_type` (text). RPC `get_submission_activity_by_token` returnerer alle event_types — vi filtrerer kun klient-side.

## Tekniske notater

- Vi propagerer kun ved tid/dato-endringer (`timeChanged`), ikke ved hver liten oppdatering, for å unngå støy i kundens tidslinje.
- Hvis oppgaven har flere koblede bestillinger (sjelden, men mulig), logger vi for alle.
- Fail-soft: feil ved logging skal ikke blokkere selve event-oppdateringen — wrap i try/catch med `console.warn`.
- Vi setter ikke `status` på bestillingen tilbake til `task_created` på nytt — den er allerede der; kun aktivitet + `last_activity_at` oppdateres.

## Verifisering

1. Opprett bestilling, opprett oppgave 1. mai.
2. Endre oppgaven til 11. mai i ressursplanen.
3. Åpne sporingslenke som kunde → "Hendelseslogg" skal vise ny rad "Oppgaven er flyttet til ny tid · 11. mai 2026 kl. 08:00", og "Oppdatert" øverst skal være "for noen sekunder siden".
4. "Koblet oppgave"-kortet i admin viser allerede ny dato (regresjonscheck).
