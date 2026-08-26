/**
 * Feature-flagg for Lier VPS.
 *
 * Google Workspace er valgt plattform. Microsoft-funksjonalitet (Outlook,
 * SharePoint, Teams, Microsoft 365-import) er deaktivert i UI, men koden er
 * beholdt bak dette flagget for å unngå risikofylte slettinger.
 *
 * TODO: Port to Google Workspace later (Google Kalender, Google Drive, Google Meet).
 */
export const MICROSOFT_UI_ENABLED = false;

/**
 * Når false (pre-launch): den offentlige nettsiden er skjult.
 * Besøkende ser kun påloggingsvinduet. Innloggede brukere sendes rett til
 * dashboardet (/overview). Skru til `true` når nettsiden skal lanseres.
 */
export const PUBLIC_SITE_LIVE = false;

