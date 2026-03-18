/**
 * Human-readable Norwegian labels for permission keys.
 * UI-only mapping – does NOT affect backend logic or RLS.
 *
 * TWO-LAYER MODULE MODEL:
 *   module_settings = global system-level feature toggle (tenant/license)
 *   module.* permissions = per-user/role module access (menu, routing)
 */

export interface PermissionMeta {
  label: string;
  description?: string;
  category: string;
}

export const PERMISSION_LABELS: Record<string, PermissionMeta> = {
  // ── Scope ──
  "scope.view.own": {
    label: "Kun prosjekter brukeren deltar på",
    description: "Brukeren ser kun prosjekter de er tildelt eller deltar i.",
    category: "Omfang",
  },
  "scope.view.company": {
    label: "Alle prosjekter i eget selskap",
    description: "Brukeren ser alle prosjekter i selskaper de er medlem av.",
    category: "Omfang",
  },
  "scope.view.all": {
    label: "Alle prosjekter i alle selskaper",
    description: "Brukeren ser alle prosjekter på tvers av selskaper.",
    category: "Omfang",
  },

  // ── Module access (user/role level) ──
  "module.overview": { label: "Hjem", description: "Tilgang til dashboardet.", category: "Modultilgang" },
  "module.projects": { label: "Prosjekter", description: "Tilgang til prosjektmodulen.", category: "Modultilgang" },
  "module.resource_plan": { label: "Ressursplan", description: "Tilgang til ressursplanmodulen.", category: "Modultilgang" },
  "module.absence": { label: "Fravær", description: "Tilgang til fraværsmodulen.", category: "Modultilgang" },
  "module.invoice_basis": { label: "Fakturagrunnlag", description: "Tilgang til fakturagrunnlag.", category: "Modultilgang" },
  "module.fag": { label: "Fagstøtte", description: "Tilgang til fagmodulen.", category: "Modultilgang" },
  "module.inbox": { label: "Postkontoret", description: "Tilgang til postkontoret.", category: "Modultilgang" },
  "module.sales": { label: "Salg", description: "Tilgang til salgsmodulen (leads, tilbud, oversikt).", category: "Modultilgang" },
  "module.customers": { label: "Kunder", description: "Tilgang til kundemodulen.", category: "Modultilgang" },
  "module.management": { label: "Lederoversikt", description: "Tilgang til lederoversikt.", category: "Modultilgang" },
  "module.admin": { label: "Admin", description: "Tilgang til administrasjonspanelet.", category: "Modultilgang" },
  "module.calendar": { label: "Kalender", description: "Tilgang til kalendermodulen.", category: "Modultilgang" },
  "module.documents": { label: "Dokumenter", description: "Tilgang til dokumentmodulen.", category: "Modultilgang" },
  "module.communication": { label: "Kommunikasjon", description: "Tilgang til kommunikasjonsmodulen.", category: "Modultilgang" },
  "module.contracts": { label: "Kontrakter", description: "Tilgang til kontraktsmodulen.", category: "Modultilgang" },
  "module.sharepoint": { label: "SharePoint", description: "Tilgang til SharePoint-integrasjonen.", category: "Modultilgang" },
  "module.leads": { label: "Leads", description: "Tilgang til leadsmodulen.", category: "Modultilgang" },

  // ── Jobs ──
  "jobs.view": { label: "Se prosjekter", category: "Prosjekter" },
  "jobs.create": { label: "Opprette prosjekter", category: "Prosjekter" },
  "jobs.edit": { label: "Redigere prosjekter", category: "Prosjekter" },
  "jobs.delete": { label: "Flytte prosjekt til papirkurv", category: "Prosjekter" },
  "jobs.archive": { label: "Arkivere prosjekt", category: "Prosjekter" },
  "jobs.assign_users": { label: "Tildele montører og deltakere", category: "Prosjekter" },
  "jobs.view_pricing": { label: "Se kalkyle og priser", category: "Prosjekter" },

  // ── Offers ──
  "offers.view": { label: "Se tilbud", category: "Tilbud" },
  "offers.create": { label: "Opprette tilbud", category: "Tilbud" },
  "offers.edit": { label: "Redigere tilbud", category: "Tilbud" },
  "offers.delete": { label: "Flytte tilbud til papirkurv", category: "Tilbud" },
  "offers.archive": { label: "Arkivere tilbud", category: "Tilbud" },

  // ── Calc ──
  "calc.view": { label: "Se kalkyle", category: "Kalkyle" },
  "calc.edit": { label: "Redigere kalkyle", category: "Kalkyle" },

  // ── Docs ──
  "docs.view": { label: "Se dokumenter", category: "Dokumenter" },
  "docs.upload": { label: "Laste opp dokumenter", category: "Dokumenter" },
  "docs.delete": { label: "Slette dokumenter", category: "Dokumenter" },
  "docs.restrict_to_participants": {
    label: "Kun se dokumenter på egne prosjekter",
    description: "Hvis aktiv, kan brukeren ikke se dokumenter på prosjekter de ikke deltar i.",
    category: "Dokumenter",
  },

  // ── Comm ──
  "comm.view": { label: "Se kommunikasjon og notater", category: "Kommunikasjon" },
  "comm.create_note": { label: "Opprette interne notater", category: "Kommunikasjon" },
  "comm.delete_note": { label: "Slette notater", category: "Kommunikasjon" },
  "comm.restrict_to_participants": {
    label: "Kun se kommunikasjon på egne prosjekter",
    description: "Hvis aktiv, kan brukeren ikke se kommunikasjon på prosjekter de ikke deltar i.",
    category: "Kommunikasjon",
  },

  // ── Calendar ──
  "calendar.read_busy": { label: "Se opptatt/ledig i kalender", category: "Kalender" },
  "calendar.view_external": { label: "Se detaljer i eksterne kalenderavtaler", description: "Kan se titler, lokasjoner og annen metadata på eksterne Outlook-hendelser. Uten denne rettigheten vises kun anonymiserte 'Opptatt'-blokker.", category: "Kalender" },
  "calendar.write_events": { label: "Opprette og endre kalenderavtaler", category: "Kalender" },
  "calendar.delete_events": { label: "Slette kalenderavtaler", category: "Kalender" },

  // ── Ressursplan ──
  "resourceplan.view": { label: "Se ressursplan", description: "Tilgang til å åpne og se ressursplanen.", category: "Ressursplan" },
  "resourceplan.view_busy": { label: "Se opptatt/ledig i ressursplan", description: "Kan se tilgjengelighetsstatus for montører.", category: "Ressursplan" },
  "resourceplan.view_external_blocks": { label: "Se eksterne kalenderblokker", description: "Kan se Outlook-importerte blokker i ressursplanen.", category: "Ressursplan" },
  "resourceplan.view_external_titles": { label: "Se titler på eksterne avtaler", description: "Kan se tittel på eksterne Outlook-avtaler i stedet for anonymisert 'Opptatt'.", category: "Ressursplan" },
  "resourceplan.view_external_details": { label: "Se detaljer i eksterne avtaler", description: "Kan se lokasjon, organisator og andre detaljer på eksterne kalenderavtaler.", category: "Ressursplan" },
  "resourceplan.schedule": { label: "Planlegge ressurser", description: "Kan dra og slippe prosjekter og oppgaver inn i ressursplanen.", category: "Ressursplan" },
  "resourceplan.edit_others": { label: "Endre andres planlagte aktiviteter", description: "Kan flytte og endre varighet på aktiviteter planlagt av andre.", category: "Ressursplan" },
  "resourceplan.cross_company": { label: "Se ressursplan på tvers av selskaper", description: "Kan se ressurser og aktiviteter fra alle selskaper i ressursplanen.", category: "Ressursplan" },

  // ── Absence ──
  "absence.create_self": { label: "Søke fravær for seg selv", category: "Fravær" },
  "absence.create_for_others": { label: "Søke fravær for andre", description: "Kan opprette fraværsforespørsler på vegne av andre ansatte.", category: "Fravær" },
  "absence.approve": { label: "Godkjenne fravær", description: "Kan godkjenne eller avvise fraværsforespørsler.", category: "Fravær" },
  "absence.view_team": { label: "Se teamets fravær", description: "Kan se fraværsregistreringer for sitt team.", category: "Fravær" },
  "absence.view_company": { label: "Se alt fravær i selskapet", description: "Kan se fraværsregistreringer for hele selskapet.", category: "Fravær" },

  // ── Admin ──
  "admin.manage_companies": { label: "Administrere selskaper", category: "Administrasjon" },
  "admin.manage_departments": { label: "Administrere avdelinger", category: "Administrasjon" },
  "admin.manage_users": { label: "Administrere brukere", category: "Administrasjon" },
  "admin.manage_roles": { label: "Administrere roller", category: "Administrasjon" },
  "admin.manage_settings": { label: "Administrere systeminnstillinger", category: "Administrasjon" },
  "admin.data_integrity": { label: "Dataintegritet", description: "Tilgang til dataintegritet og systemvedlikehold.", category: "Administrasjon" },

  // ── Leads ──
  "leads.view": { label: "Se leads", category: "Leads" },
  "leads.create": { label: "Opprette leads", category: "Leads" },
  "leads.edit": { label: "Redigere leads", category: "Leads" },
  "leads.transfer_owner": { label: "Overføre eierskap på leads", description: "Kan endre hvem som er ansvarlig eier av en lead.", category: "Leads" },
  "leads.manage_participants": { label: "Administrere deltakere på leads", description: "Kan legge til og fjerne deltakere på leads.", category: "Leads" },
  "leads.convert": { label: "Konvertere lead til prosjekt", description: "Kan konvertere et akseptert tilbud på en lead til et prosjekt.", category: "Leads" },
  "leads.email_draft": { label: "Opprette e-postutkast fra lead", description: "Kan opprette Outlook e-postutkast koblet til en lead.", category: "Leads" },
  "leads.create_meeting": { label: "Opprette møte/befaring fra lead", description: "Kan opprette Outlook kalenderhendelser fra en lead.", category: "Leads" },

  // ── Regulation ──
  "regulation.review": { label: "Godkjenne fagforespørsler", description: "Kan godkjenne eller avvise fagforespørsler som faglig ansvarlig.", category: "Fag" },

  // ── Contracts ──
  "contracts.read": { label: "Se kontrakter", category: "Kontrakter" },
  "contracts.edit": { label: "Opprette og redigere kontrakter", category: "Kontrakter" },
  "contracts.admin": { label: "Administrere kontrakter", description: "Full tilgang til sletting og arkivering av kontrakter.", category: "Kontrakter" },

  // ── Postkontoret ──
  "postkontor.view": { label: "Tilgang til Postkontoret", description: "Kan se henvendelser og bruke Postkontoret-modulen.", category: "Postkontoret" },
  "postkontor.admin": { label: "Administrere Postkontoret", description: "Full tilgang til innstillinger, postkasser og rutingsregler i Postkontoret.", category: "Postkontoret" },

  // ── Data ──
  "data.delete": { label: "Slette data", description: "Kan flytte elementer til papirkurven.", category: "Data" },

  // ── SharePoint ──
  "sharepoint.view": { label: "Se SharePoint-filer", description: "Kan se filer i koblet SharePoint-mappe.", category: "SharePoint" },
  "sharepoint.upload": { label: "Laste opp til SharePoint", description: "Kan laste opp filer til SharePoint.", category: "SharePoint" },
  "sharepoint.delete": { label: "Slette fra SharePoint", description: "Kan slette filer i SharePoint.", category: "SharePoint" },
  "sharepoint.link_job": { label: "Koble jobb til SharePoint", description: "Kan koble en jobb til en SharePoint-mappe.", category: "SharePoint" },
  "sharepoint.admin": { label: "Administrere SharePoint-konfig", description: "Kan kjøre self-heal og endre SharePoint-tilkobling for selskapet.", category: "SharePoint" },
};

/**
 * Module access permissions – shown as a separate section in role editor.
 * These control whether the user sees the module in the menu and can navigate to it.
 */
export const MODULE_PERMISSION_KEYS: string[] = [
  "module.overview", "module.projects", "module.resource_plan", "module.absence",
  "module.invoice_basis", "module.fag", "module.inbox", "module.sales",
  "module.customers", "module.management", "module.admin",
  "module.calendar", "module.documents", "module.communication", "module.contracts",
  "module.sharepoint", "module.leads",
];

/** Action permission categories (excluding scope and module access) */
export const PERMISSION_CATEGORIES: { category: string; description: string; keys: string[] }[] = [
  {
    category: "Prosjekter",
    description: "Tilgang til å se, opprette og administrere prosjekter.",
    keys: ["jobs.view", "jobs.create", "jobs.edit", "jobs.delete", "jobs.archive", "jobs.assign_users", "jobs.view_pricing"],
  },
  {
    category: "Tilbud",
    description: "Tilgang til å håndtere tilbud.",
    keys: ["offers.view", "offers.create", "offers.edit", "offers.delete", "offers.archive"],
  },
  {
    category: "Kalkyle",
    description: "Tilgang til kalkyler og prisberegninger.",
    keys: ["calc.view", "calc.edit"],
  },
  {
    category: "Fravær",
    description: "Tilgang til fraværshåndtering.",
    keys: ["absence.create_self", "absence.create_for_others", "absence.approve", "absence.view_team", "absence.view_company"],
  },
  {
    category: "Dokumenter",
    description: "Tilgang til dokumenter knyttet til prosjekter.",
    keys: ["docs.view", "docs.upload", "docs.delete", "docs.restrict_to_participants"],
  },
  {
    category: "Kommunikasjon",
    description: "Tilgang til intern kommunikasjon og notater.",
    keys: ["comm.view", "comm.create_note", "comm.delete_note", "comm.restrict_to_participants"],
  },
  {
    category: "Kalender",
    description: "Personlige kalenderavtaler og Outlook-integrasjon.",
    keys: ["calendar.read_busy", "calendar.view_external", "calendar.write_events", "calendar.delete_events"],
  },
  {
    category: "Ressursplan",
    description: "Operativ planlegging, bemanning og tilgjengelighet.",
    keys: [
      "resourceplan.view", "resourceplan.view_busy", "resourceplan.view_external_blocks",
      "resourceplan.view_external_titles", "resourceplan.view_external_details",
      "resourceplan.schedule", "resourceplan.edit_others", "resourceplan.cross_company",
    ],
  },
  {
    category: "Administrasjon",
    description: "Tilgang til systeminnstillinger og brukeradministrasjon.",
    keys: ["admin.manage_companies", "admin.manage_departments", "admin.manage_users", "admin.manage_roles", "admin.manage_settings", "admin.data_integrity"],
  },
  {
    category: "Leads",
    description: "Tilgang til leads og salgsprosess.",
    keys: ["leads.view", "leads.create", "leads.edit", "leads.transfer_owner", "leads.manage_participants", "leads.convert", "leads.email_draft", "leads.create_meeting"],
  },
  {
    category: "Fag",
    description: "Tilgang til fagmodul og forskriftsoppslag.",
    keys: ["regulation.review"],
  },
  {
    category: "Kontrakter",
    description: "Tilgang til kontraktsmodulen med risiko og fristanalyse.",
    keys: ["contracts.read", "contracts.edit", "contracts.admin"],
  },
  {
    category: "Postkontoret",
    description: "Tilgang til Postkontoret for henvendelser og e-postsynkronisering.",
    keys: ["postkontor.view", "postkontor.admin"],
  },
  {
    category: "Data",
    description: "Generelle rettigheter for datahåndtering.",
    keys: ["data.delete"],
  },
  {
    category: "SharePoint",
    description: "Tilgang til SharePoint-integrasjonen.",
    keys: ["sharepoint.view", "sharepoint.upload", "sharepoint.delete", "sharepoint.link_job", "sharepoint.admin"],
  },
];

/** Scope options for the dropdown */
export const SCOPE_OPTIONS = [
  { key: "scope.view.own", label: "Kun prosjekter brukeren deltar på" },
  { key: "scope.view.company", label: "Alle prosjekter i eget selskap" },
  { key: "scope.view.all", label: "Alle prosjekter i alle selskaper" },
] as const;

/** Get a friendly label for a permission key */
export function getPermLabel(key: string): string {
  return PERMISSION_LABELS[key]?.label ?? key;
}

/** Get the description for a permission key */
export function getPermDescription(key: string): string | undefined {
  return PERMISSION_LABELS[key]?.description;
}
