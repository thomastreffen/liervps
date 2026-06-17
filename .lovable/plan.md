## Mål
Bygge ny offentlig MCS Service-nettside (erstatter mcsservice.no) inne i eksisterende Lovable-prosjekt, med personlig portalinngang for innloggede Microsoft-brukere. SEO-first, mørk industriell premium-stil etter vedlagt mockup.

## Arkitektur og ruting

Eksisterende app bruker `/` som dashboard og `/login` som innlogging. Vi må ikke ødelegge dette. Plan:

- Flytt nåværende interne dashboard fra `/` til `/app` (eller behold via redirect for innloggede).
- Ny offentlig forside ligger på `/` og er åpen for alle.
- Ny `PublicLayout` (header + footer) og `PublicHome` brukes på alle nye offentlige sider.
- Hvis bruker er innlogget med MCS-konto → forsiden viser i tillegg en personlig "portal-hero" øverst med "Åpne dashboard"-CTA (lenker til `/app`). Offentlig SEO-innhold vises fortsatt under – ikke gjemt.
- Hvis ikke innlogget → "Logg inn"-knapp i header lenker til `/login`.

## Sider som lages
- `/` Forside (hero, tillitsrad, tjenestekort, trygghet-seksjon, kundelogoer, kontakt-CTA, footer)
- `/tjenester/service-og-feilsoking`
- `/tjenester/elektrotavler`
- `/tjenester/stromskinner`
- `/tjenester/hasteoppdrag`
- `/om-mcs`
- `/referanser`
- `/kontakt`
- `/bestill-service`

Alle bruker felles `PublicLayout`, `ServicePageTemplate` (breadcrumb, hero, ingress, bilde, leveranser, fordelsrad, CTA, internlenker), `ContactForm`, `PortalShortcuts`.

## Design-system
- Tokens i `index.css`: navy `#081320`, charcoal `#142433`, light `#F5F7FA`, steel `#EFB7EB` (rettes til mockup `#EFB7EB`→faktisk steel grå), orange `#FF6400`.
- Font: Inter (allerede tilgjengelig via fonts.googleapis).
- Komponenter: `Header` (sticky, logo venstre, nav, "Logg inn" + oransje "Bestill service"), `Footer`, `Hero`, `TrustRow`, `ServiceCard`, `Breadcrumb`, `LogoCloud`, `PortalHeroLoggedIn`.
- Bruker MCS-logo fra `user-uploads://logo_Service2_med_ernstrom.png` lagret via lovable-assets.

## Innhold
- Henter ekte tekster/bilder fra mcsservice.no (fetch_website) for tjenestebeskrivelser. Hvis bilder ikke kan hentes lovlig/teknisk, bruker vi profesjonelle placeholder fra eksisterende prosjektassets eller genererer dempede industrifoto.
- Kontaktinfo hardkodes: Orkidèhøgda 2A, 3050 Mjøndalen / post@mcsservice.no / +47 45 70 70 73.

## SEO
- `react-helmet-async` legges til, `HelmetProvider` i `main.tsx`.
- Hver offentlig side får unik `<title>`, meta description, canonical, og og:tags.
- `index.html` oppdateres med sitewide Organization + LocalBusiness JSON-LD.
- Hver tjenesteside: `Service` schema + `BreadcrumbList`.
- `public/sitemap.xml` generert via `scripts/generate-sitemap.ts` med predev/prebuild hook.
- `public/robots.txt` med Allow: / og Sitemap-direktiv.
- Semantisk HTML: `<header><nav><main><section><article><footer>`.

## Portalvisning (innlogget)
- `PortalHero` komponent vises på `/` når `useAuth().user` finnes:
  - "Hei, {fornavn}!"
  - Tilknytning hentes fra `useCompanyContext().activeCompany?.name`
  - Primær CTA: "Åpne dashboard" → `/app`
  - Snarveiskort: Ny bestilling, Mine saker, Aktive oppdrag, Dokumentasjon, Avvik, Last opp underlag, Kontakt, Innstillinger
  - Rollebasert filter via `isAdmin` for å skille interne vs eksterne snarveier.

## App-ruting
- `src/App.tsx`: legg til offentlige routes UTENFOR `AuthGuard`. Flytt eksisterende beskyttede ruter under `/app/*`. Legacy `/` for innlogget interne brukere kan redirecte til `/app` automatisk hvis de ønsker, men vi viser PortalHero på `/` i stedet (enklere og matcher kravet).

## Ikke-mål
- Ingen CMS, ingen redigering i UI.
- Ingen endring i eksisterende backend/RLS.
- Ingen ny auth-flow – bruker eksisterende Microsoft-login.

## Filer som opprettes/endres
- `src/layouts/PublicLayout.tsx`, `src/components/public/Header.tsx`, `Footer.tsx`, `Hero.tsx`, `TrustRow.tsx`, `ServiceCard.tsx`, `Breadcrumb.tsx`, `LogoCloud.tsx`, `ContactForm.tsx`, `PortalHero.tsx`, `ServicePageTemplate.tsx`.
- `src/pages/public/Home.tsx`, `ServiceFeilsoking.tsx`, `Elektrotavler.tsx`, `Stromskinner.tsx`, `Hasteoppdrag.tsx`, `OmMcs.tsx`, `Referanser.tsx`, `Kontakt.tsx`, `BestillService.tsx`.
- `src/App.tsx` (ruting), `src/index.css` (tokens), `index.html` (sitewide head + JSON-LD).
- `public/robots.txt`, `public/sitemap.xml`, `scripts/generate-sitemap.ts`, `package.json` (predev/prebuild + react-helmet-async).
- Lovable-asset for logo.

## Etter implementasjon
- Kjør full SEO review.
- Mobil/desktop sjekk via Playwright screenshot.

## Spørsmål før jeg starter
1. **Ruting**: Er det greit at jeg flytter det interne dashboardet fra `/` til `/app/*` (alle eksisterende beskyttede ruter får `/app`-prefix)? Eller vil du heller at `/` viser portalvisning for innloggede og marketing for ikke-innloggede, og at `/dashboard`, `/jobs` osv. forblir på sine eksisterende URLer? Jeg anbefaler det siste – mindre risiko for å brekke deep-links.
2. **Bilder fra mcsservice.no**: Skal jeg forsøke å hente eksisterende bilder fra mcsservice.no direkte (referere CDN-URLer), eller generere nye profesjonelle industribilder med imagegen i samme stil som mockupen?
3. **Bestill-service-skjema**: Skal innsendinger lagres i databasen (ny `service_orders`-tabell + e-postvarsel via edge function), eller er det nok å sende e-post til post@mcsservice.no via en enkel edge function uten lagring?
