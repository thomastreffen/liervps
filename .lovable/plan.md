# Migrering til Google Workspace for Lier VPS

## Mål

Gjøre Google Workspace til aktiv standard-integrasjon for Lier VPS (SSO, Kalender, Gmail, Drive) — samtidig som all eksisterende Microsoft-kode beholdes, deaktiveres og skjules bak en provider-flagg, slik at Microsoft 365 kan re-aktiveres for andre kunder senere.

Ingen destruktive endringer. Ingen sletting av edge functions, tabeller eller hooks.

---

## 1. Kartlegging: eksisterende Microsoft-avhengigheter

**Edge functions (28 stk) — beholdes urørt, kun deaktiveres:**
- Auth/SSO: `auth-callback`
- Kalender: `ms-calendar`, `outlook-sync`, `outlook-schedule-sync`, `calendar-write-sync`, `absence-calendar-sync`, `lead-calendar-event`, `sync-task-to-calendar`, `import-outlook-tasks`
- E-post: `ms-mail`, `conversation-email-send`, `conversation-email-reprocess`, `order-message-email-send`, `task-thread-email-send`, `task-thread-email-inbound`, `create-lead-email-draft`, `inbox-sync`, `inbox-scan`, `inbox-debug`, `suggest-task-from-email`
- Webhooks/subs: `graph-subscription-manage`, `graph-subscription-renew-cron`, `graph-subscription-sync`, `graph-webhook-inbound`
- SharePoint: `sharepoint-connect`, `sharepoint-list`, `sharepoint-preview-url`, `sharepoint-upload`
- Møter: `teams-meeting`
- Debug: `ms-debug`

**Tabeller — beholdes, ny provider-kolonne legges til:**
- `microsoft_tokens`, `ms_graph_subscriptions`, `job_calendar_links`, `lead_calendar_links`, `schedule_sync_runs`, `schedule_sync_state`, `job_calendar_audit`

**Frontend (~78 filer med MS-referanser) — skjules bak feature-flag:**
- Login-flyt (`Login.tsx`, `AuthCallback.tsx`, `useAuth.tsx`)
- MS-banner (`MsConnectionBanner.tsx`), MicrosoftAdminPage
- SharePoint-UI (`SharePointExplorer`, `SharePointPicker`, `SharePointCategoryMapper`)
- Outlook-konflikt (`OutlookConflictDialog`), sync-status i sidebar/topbar
- Teams-møter, e-post-composers, kalendersync-knapper

---

## 2. Provider-abstraksjon

Ny `integration_provider`-arkitektur som styrer hvilken tjeneste som brukes for hver tenant/bruker.

**Ny tabell `integration_providers`** (per company):
```
company_id      uuid
scope           text    -- 'sso' | 'calendar' | 'mail' | 'files'
provider        text    -- 'google' | 'microsoft'
is_active       boolean
```
Seed for Lier VPS: alle scopes → `google`.

**Ny tabell `user_integration_tokens`** (per bruker + provider):
```
user_id         uuid
provider        text    -- 'google' | 'microsoft'
scope           text    -- 'calendar' | 'mail' | 'drive'
access_token    text
refresh_token   text
expires_at      timestamptz
granted_scopes  text[]
```
`microsoft_tokens` beholdes urørt for bakoverkompatibilitet; ny kode leser fra `user_integration_tokens`.

**Provider-router (frontend + edge):**
- `src/lib/integrations/provider-router.ts` — `getActiveProvider(companyId, scope)`
- Edge: `_shared/provider-router.ts` — samme signatur
- All ny funksjonalitet ruter gjennom denne. MS-edge-functions kalles fortsatt hvis provider = `microsoft`.

---

## 3. Google-integrasjon per bruker (OAuth per user)

Lovable Google-connector connecter *builder-kontoen* og passer ikke for feltteknikere som skal ha egen kalender/inbox. Vi implementerer full per-user OAuth mot Google.

**Oppsett (én gang, av admin):**
1. Google Cloud-prosjekt for Lier VPS
2. OAuth Consent Screen (Internal / External)
3. Client ID + Secret → lagres som `GOOGLE_OAUTH_CLIENT_ID` og `GOOGLE_OAUTH_CLIENT_SECRET`
4. Aktiverte API-er: Calendar, Gmail, Drive, People
5. Redirect URI: `${APP_URL}/auth/google/callback`

**Scopes forespørres progressivt:**
- SSO: `openid email profile`
- Kalender: `.../auth/calendar`
- Gmail: `.../auth/gmail.modify` + `.../auth/gmail.send`
- Drive: `.../auth/drive.file`

**Nye edge functions:**
- `google-auth-callback` — bytter code mot tokens, lagrer i `user_integration_tokens`, oppretter Supabase-sesjon
- `google-token-refresh` — brukes internt av alle google-* functions
- `google-calendar-sync` — speil av `outlook-sync` men mot Calendar API
- `google-mail-send` / `google-mail-inbound` — speil av `ms-mail`
- `google-drive-upload` / `google-drive-list` — speil av sharepoint-*

Alle nye functions bruker felles `_shared/google-client.ts` med token-refresh.

---

## 4. Trinnvis implementeringsrekkefølge

**Fase A — Fundament (ingen brukersynlig endring)**
1. Migration: `integration_providers` + `user_integration_tokens` + RLS + GRANTs
2. Seed Lier VPS → google på alle scopes
3. `provider-router.ts` (frontend + edge shared)
4. Feature-flag `useIntegrationProvider(scope)`-hook

**Fase B — Google SSO**
5. Secrets: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`
6. Edge function `google-auth-callback`
7. Ny side `/auth/google/callback`
8. Oppdater `Login.tsx`: "Logg inn med Google" som primær-knapp; MS-knapp skjules når provider=google
9. Behold e-post/passord som fallback

**Fase C — Google Calendar**
10. Edge functions: `google-calendar-sync`, `google-calendar-write`
11. Hook `useCalendarSync` ruter til google eller ms
12. UI (`JobCalendarSync`, `ScheduleBlockDetailPanel`, absence): identisk oppførsel, google i backend

**Fase D — Gmail**
13. Edge functions: `google-mail-send`, `google-mail-inbound` (via Gmail push)
14. `conversation-email-send`, `order-message-email-send`, `task-thread-email-send` ruter via provider
15. Inbox-scan bruker Gmail API

**Fase E — Google Drive**
16. Edge functions: `google-drive-upload`, `google-drive-list`, `google-drive-preview`
17. Docs-UI (`DocsFilesRoom`, `SharePointPicker` → `FilePickerRouter`) bruker provider
18. SharePoint-komponenter renames ikke — pakkes bak `<FilePicker provider="..." />`

**Fase F — Skjul Microsoft for Lier VPS**
19. Alle "Koble til Microsoft"-CTAer skjules når `getActiveProvider(scope) !== 'microsoft'`
20. `MsConnectionBanner` returnerer `null` for google-tenants
21. `MicrosoftAdminPage`-rute lukkes for ikke-super_admin
22. Cron `graph-subscription-renew-cron` sjekker at company har `provider='microsoft'` før den kjører for en bruker
23. Kopi/labels: "Koble kalender", ikke "Koble Microsoft"

---

## 5. Hva som skjules/deaktiveres for Lier VPS

| Område | Handling |
|---|---|
| MS SSO-knapp i Login | Skjules når SSO-provider=google |
| MsConnectionBanner | Renderer `null` |
| /admin/microsoft | 404 for company med provider=google |
| SharePoint-picker | Erstattes av `FilePickerRouter` → Google Drive UI |
| Outlook-sync-status i topbar | Bytter etikett til "Google Calendar" |
| Teams-møter | Skjules (Google Meet-integrasjon i fase G, senere) |
| MS-relaterte cron jobs | Sjekker provider før arbeid utføres |
| `MAIL_INGEST_DEBUG` MS-flows | Blir no-op for google-tenants |

Ingenting slettes. Alt aktiveres tilbake ved å sette `integration_providers.provider='microsoft'` for en gitt company/scope.

---

## 6. Første praktiske leveranse etter godkjent plan

1. Migration for `integration_providers` + `user_integration_tokens`
2. Provider-router
3. Google SSO (Fase B komplett)

Deretter Kalender → Gmail → Drive i egne runder.

---

## 7. Åpne avklaringer

- **Google Cloud-prosjekt:** har Lier VPS allerede et Google Cloud-prosjekt vi kan bruke, eller skal jeg gi steg-for-steg-guide for å opprette?
- **Domenerestriksjon (`hd=liervps.no`):** skal SSO låses til `@liervps.no`-domenet?
- **Gmail push-notifications** krever Pub/Sub — ok å starte med polling som midlertidig løsning?
- **Historiske Outlook-hendelser** i `job_calendar_links`: la stå (read-only), eller re-syncs mot Google når bruker kobler seg?

Bekreft planen (eventuelt med justeringer), så starter jeg med Fase A + B.
