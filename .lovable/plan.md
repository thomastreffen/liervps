
## Utgangspunkt

Denne appen er et fullt utbygd elektro-/tavlesystem (MCS Service) med mange moduler: prosjekter, materialliste, kalkyle, ordreskjema, HMS, forms, Microsoft-integrasjon (Outlook/Teams/SharePoint), tavle-/høystrøms-AI, m.m. En bit-for-bit omskrivning av **hver** referanse til MCS/tavle/Microsoft er et flere-ukers arbeid og vil bryte mange interne flyter.

For å levere Lier VPS raskt uten å knuse eksisterende auth, tenant, RLS og databaseflyt, foreslår jeg en **faseinndelt konvertering**. Fase 1 (denne runden) leverer alt det synlige — hjemmesiden, navigasjon, terminologi i app-shell, dashboard, branding, integrasjonsspråk. Fase 2+ håndterer dyp modulomskriving trinnvis.

---

## Fase 1 (nå) — synlig konvertering

### 1. Branding
- Bytt alle synlige forekomster av "MCS Service", "MCS", firmalogo/tittel/meta til **Lier Varmepumpeservice AS** / **Lier VPS**.
- Oppdater `index.html` title + meta description + og:tags.
- Oppdater sidebar-header, topbar, login-side, favicons hvor mulig.
- Ny fargepalett: varm/kjølig klima-kontrast (dyp teal + varm oransje-aksent, off-white bakgrunn). Ny typografi som ikke er Inter (f.eks. Sora + Manrope eller Outfit + Figtree).

### 2. Offentlig hjemmeside (`/` når ikke innlogget)
Bygger ny landingsside med seksjoner:
- Hero (tittel/undertittel + CTA "Bestill befaring" / "Bestill service" / "Se våre tjenester")
- Tjenester (6 kort: befaring, salg, montering, service, feilsøking, årlig serviceavtale)
- Hvorfor velge Lier VPS (trust-punkter: lokal, sertifisert, rask respons, garanti)
- Serviceavtale (verdiforslag + prisløfte)
- Slik gjør vi det (4-stegs flyt: kontakt → befaring → montering → service)
- Kundeportal / spor service (CTA til innlogging)
- Kontakt / booking (skjema + telefon/e-post)

Ingen elektro-/tavle-bilder. Bruker AI-genererte varmepumpe-bilder eller nøytrale ikoner.

### 3. App-navigasjon (sidebar)
Erstatter dagens elektro-orienterte sidebar med:
- Dashboard
- Salg: Leads, Befaringer, Tilbud, Aksepterte tilbud
- Drift: Kalender, Oppdrag, Uplanlagte jobber, Teknikere
- Service: Serviceoppdrag, Årskontroller, Feilsøking, Reklamasjoner, Serviceavtaler
- Kunder: Kunderegister, Anlegg, Varmepumper
- Dokumentasjon: Bilder, Sjekklister, FDV, Google Drive
- Økonomi: Fakturagrunnlag, Materiell, Ekstraarbeid
- Innstillinger: Brukere, Google Workspace, Firmaprofil

Ruter beholdes teknisk der de finnes (f.eks. `/projects` → "Oppdrag"), men **etiketter** endres. Rene tavle-/elektro-ruter (kalkyle-tavle, materialliste AI-tavle) skjules fra sidebar men beholdes i koden slik at intet krasjer.

### 4. Dashboard
Erstatter KPI-kort med:
- Nye leads, Befaringer denne uka, Tilbud sendt, Aksepterte tilbud, Planlagte monteringer, Åpne serviceoppdrag, Serviceavtaler, Årskontroller neste 30 dager, Reklamasjoner, Fakturagrunnlag klart.

Kortene bruker eksisterende data-hooks der mulig (leads → leads-tabellen, tilbud → offers, oppdrag → events). Der ingen relevant data finnes, viser vi tomme tilstander med "kommer snart".

### 5. Terminologi (app-shell + hovedsider)
Global søk-og-erstatt i **synlige strenger** (labels, headers, tomtilstander) — ikke i tabellnavn/kode:
- MCS Service → Lier VPS
- Prosjekt → Oppdrag
- Prosjektrom → Jobbmappe
- Tavle/switchboard/busbar/breaker → Varmepumpeanlegg (busbar/breaker fjernes uten erstatning)
- Montør → Tekniker
- Kontrakt → Serviceavtale (kun der det gir mening)
- Endringsordre → Ekstraarbeid
- Outlook → Gmail, Teams → Google Meet, SharePoint → Google Drive, Microsoft 365 → Google Workspace

Databasekolonner, RLS, RPC-navn, funksjonsnavn, filnavn og interne identifikatorer **røres ikke**.

### 6. Integrasjonsspråk
Alle synlige tekster om Microsoft-integrasjon relabelles til Google Workspace. Selve integrasjonskoden (edge-functions, tokens) beholdes urørt i denne fasen — vi endrer kun **hva brukeren ser**. Instillinger-siden får banner: "Google Workspace-integrasjon kommer. Nåværende sync-motor brukes midlertidig."

### 7. Skjules i denne fasen (uten sletting)
- Tavle-/kalkyle-AI-spesifikke sider
- HMS-modul (kan aktiveres senere hvis relevant)
- Fagstøtte (elektro-spesifikk)
- Kontraktsmodul (kompleks, erstattes senere av "Serviceavtaler")
- Postkontor (avhengig av MS-mail)

Skjules via feature-flag i sidebar. Rutene forblir tilgjengelige for admin.

---

## Fase 2 (senere, egen runde) — dyp modulkonvertering

- Bygge ekte "Varmepumpeanlegg" og "Varmepumper" registre med dedikerte tabeller.
- Bygge "Serviceavtaler" som eget datamodell (avløser contracts).
- Bygge "Årskontroller" som schedulert servicejobb-generator.
- Bygge Google Workspace edge-functions (Calendar, Gmail, Drive) som erstatter MS-funksjonene.
- Rydde vekk skjulte tavle-moduler helt.

---

## Tekniske detaljer

- **Ingen destruktive DB-endringer** i fase 1. Ingen migrasjon nødvendig.
- **Auth, RLS, tenant, protected routes** beholdes 100 %.
- Ny fil: `src/pages/PublicHome.tsx` erstatter dagens landingsside for uinnloggede.
- Ny fil: `src/config/navigation.ts` (eller endring av eksisterende sidebar-config) med nye labels + skjul-flagg.
- Ny fil: `src/pages/Dashboard.tsx` (eller endring av eksisterende) med varmepumpe-KPIer.
- `index.html`: nye meta-tags.
- `tailwind.config.ts` + `index.css`: ny fargepalett + fonter (semantiske tokens).
- Ingen endringer i `src/integrations/supabase/*`.
- Terminologi-endringer gjøres i UI-strenger, ikke i type-definisjoner eller DB-navn.

---

## Åpne spørsmål (svar valgfritt — jeg tar rimelige defaults hvis ikke)

1. Skal jeg AI-generere 3–4 varmepumpe-bilder til hero/tjenestekort, eller vil du bruke enkle ikoner/mønster i første runde? (Default: 1 hero-bilde + ikoner.)
2. Fargevalg: dyp teal (#0F4C5C) + varm oransje aksent (#E36414) + off-white, OK? Eller vil du velge palett?
3. Kontaktinfo (telefon, e-post, adresse, org.nr) for footer og kontaktseksjon — har du dette klart, eller bruker jeg placeholders?

Fase 1 er ca. 15–20 filer og bør leveres i én runde. Godkjenner du planen, starter jeg med branding + hjemmeside + navigasjon.
