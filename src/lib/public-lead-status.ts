/**
 * Statusmodell for `public_leads` (nettsidehenvendelser).
 *
 * VIKTIG: `public_leads.status` skal aldri skrives direkte fra UI.
 * Databasetriggeren `sync_lead_status_to_public_lead` speiler intern
 * `leads.status` → `public_leads.status`. Oppdater alltid intern lead-status,
 * så tar triggeren resten. Typen her brukes kun til lesing/visning.
 */
export type PublicLeadStatus =
  | "new"
  | "contacted"
  | "befaring_booked"
  | "offer_sent"
  | "won"
  | "lost"
  | "archived"
  | "deleted";

export const PUBLIC_LEAD_STATUS_LABELS: Record<PublicLeadStatus, string> = {
  new: "Ny",
  contacted: "Kontaktet",
  befaring_booked: "Befaring avtalt",
  offer_sent: "Tilbud sendt",
  won: "Vunnet",
  lost: "Tapt",
  archived: "Arkivert",
  deleted: "Slettet",
};

/** Speiler samme mapping som DB-triggeren – kun for visning/forhåndsvisning. */
export function publicLeadStatusFromLeadStatus(status: string): PublicLeadStatus {
  switch (status) {
    case "contacted":
    case "qualified":
      return "contacted";
    case "befaring":
      return "befaring_booked";
    case "tilbud_sendt":
    case "forhandling":
      return "offer_sent";
    case "won":
      return "won";
    case "lost":
      return "lost";
    default:
      return "new";
  }
}
