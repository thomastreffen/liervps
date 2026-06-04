# Lesestatus og deltakeroversikt (Bestilling / Sporingsside)

Bygger iMessage/Teams-light opplevelse for meldingstråden i bestillingsmodulen — både admin og kundens sporingsside.

## 1. Datamodell (migrering)

**Ny tabell `order_form_conversation_participants`**
- `id`, `submission_id`, `participant_type` ('customer' | 'internal_user' | 'technician')
- `user_id`, `technician_id`, `display_name`, `email`, `phone`, `role_label`
- `visibility` ('internal' | 'shared_with_customer'), `added_by`, `added_at`
- `last_seen_at`, `last_seen_message_id`, `is_active`
- Unique partial: (submission_id, user_id) where user_id not null; (submission_id, technician_id) where technician_id not null; (submission_id, participant_type='customer')

**Ny tabell `order_form_message_reads`**
- `id`, `message_id`, `submission_id`, `participant_id`, `read_at`
- `reader_type`, `user_id`, `tracking_token_hash`, `user_agent`
- Unique (message_id, participant_id)

**RLS**
- Participants: les/skriv for interne med tilgang til submission (eksisterende `user_has_company_access` / cross-company grant). Kunde-tilgang via SECURITY DEFINER RPC med tracking_token.
- Reads: samme mønster — interne via auth, kunde via RPC.

**RPC-funksjoner (SECURITY DEFINER)**
- `mark_messages_read_internal(submission_id, message_ids[])` — bruker `auth.uid()`, finner/oppretter participant, upserter reads, oppdaterer `last_seen_*`.
- `mark_messages_read_by_token(tracking_token, message_ids[])` — kunde-flow, ingen auth nødvendig, validerer token.
- `get_conversation_participants(submission_id)` / `get_conversation_participants_by_token(token)` — returnerer aktive deltakere med last_seen status.
- `upsert_conversation_participant(...)` — admin legger til intern bruker/montør.

**Backfill**
- Opprett customer participant for alle eksisterende submissions basert på `customer_name` / `customer_email`.
- Opprett internal_user participants fra historiske `order_form_messages.sender_user_id` (distinct).
- Realtime: legg til de to nye tabellene i `supabase_realtime` publication.

## 2. Admin-UI (bestillingsmodul)

**Ny komponent `ConversationParticipantsCard`** (høyre panel i submission-detalj)
- Liste over aktive deltakere med avatar/initialer, navn, role_label-badge
- Type-badge: Kunde (blå), Intern (grå), Montør (grønn)
- Lesestatus per deltaker: "Lest nå", "Lest 12:25", "Ikke lest siste melding", "Aldri åpnet"
- Knapp: "Legg til deltaker" (intern bruker eller montør, søk + valg av visibility)

**Endring i meldingsliste (`OrderMessageThread` / tilsvarende)**
- Under hver melding: kompakt `MessageReadStatus` (tekst + popover med full liste)
  - "Lest av Stian, Thomas" / "Ikke lest av Andre" / "Lest av 3 av 5"
  - Avsender telles ikke
- Spesiell rendering for siste synlige melding: "Lest av alle" / "Ikke lest av: …" / "Kunde har åpnet"
- Ved mount + ved ny melding: kall `mark_messages_read_internal` for synlige meldinger

**Realtime-hook `useConversationReads(submissionId)`**
- Subscribe til `order_form_message_reads` og `order_form_conversation_participants` for submission
- Oppdater UI uten refresh

## 3. Sporingsside (kunde)

**`CustomerConversationView`**
- Vis kun meldinger med `visibility='shared_with_customer'` (eller eksisterende `is_visible_to_customer`)
- Egne sendte meldinger viser status: "Sendt" / "Lest av MCS" (basert på om noen intern participant har read row)
- Ikke vis intern leseliste (ingen navn på interne)
- Ved mount: kall `mark_messages_read_by_token(token, visibleIds)`
- Realtime via samme kanaler men filtrert via RLS/RPC

## 4. Regler (implementert i RPC + UI-helpers)

- Lest = read row finnes ELLER `last_seen_message_id` ≥ meldingens ordering
- Avsender ekskluderes fra "mangler lest"-listen
- Kun `is_active=true` deltakere telles
- Kunde får aldri se interne meldinger
- Interne meldinger telles kun mot interne deltakere; delte meldinger telles mot alle

## Teknisk

- Migrering i én SQL-fil (tabeller + GRANTs + RLS + policies + RPCs + publication)
- TypeScript types regenereres etter migrering
- Nye komponenter under `src/components/order-module/conversation/`
- Hook `useConversationReads` under `src/hooks/`
- Lett popover for full leseliste (shadcn `Popover`)
- Ingen tekniske IDer i UI — kun display_name og role_label
- Beholder eksisterende `order_form_participants` (rolle-deltakere for bestillingsskjema) — den nye tabellen er separat for dialog-lesestatus

## Akseptanse

- Admin ser deltakerliste med lesestatus per person
- Hver melding viser kompakt lesestatus, popover med full liste
- Siste melding: tydelig samlet status
- Kunde ser kun delte meldinger og enkel "Lest av MCS" på egne
- Realtime oppdateringer uten refresh
- Kunde-leseflow fungerer uten innlogging via tracking token