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
