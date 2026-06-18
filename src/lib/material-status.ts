export type MaterialListStatus =
  | "utkast"
  | "klar_for_bestilling"
  | "bestilt"
  | "delvis_mottatt"
  | "mottatt"
  | "plukket"
  | "med_montor"
  | "levert_jobb"
  | "forbruk_registrert"
  | "ferdig";

export const MATERIAL_STATUS_LABELS: Record<MaterialListStatus, string> = {
  utkast: "Utkast",
  klar_for_bestilling: "Klar for bestilling",
  bestilt: "Bestilt",
  delvis_mottatt: "Delvis mottatt",
  mottatt: "Mottatt",
  plukket: "Plukket til kasse",
  med_montor: "Med montør",
  levert_jobb: "Levert på jobb",
  forbruk_registrert: "Forbruk registrert",
  ferdig: "Ferdig",
};

export const MATERIAL_STATUS_CLASS: Record<MaterialListStatus, string> = {
  utkast: "bg-muted text-muted-foreground",
  klar_for_bestilling: "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-300",
  bestilt: "bg-blue-100 text-blue-900 dark:bg-blue-500/20 dark:text-blue-300",
  delvis_mottatt: "bg-sky-100 text-sky-900 dark:bg-sky-500/20 dark:text-sky-300",
  mottatt: "bg-indigo-100 text-indigo-900 dark:bg-indigo-500/20 dark:text-indigo-300",
  plukket: "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-300",
  med_montor: "bg-purple-100 text-purple-900 dark:bg-purple-500/20 dark:text-purple-300",
  levert_jobb: "bg-violet-100 text-violet-900 dark:bg-violet-500/20 dark:text-violet-300",
  forbruk_registrert: "bg-teal-100 text-teal-900 dark:bg-teal-500/20 dark:text-teal-300",
  ferdig: "bg-green-100 text-green-900 dark:bg-green-500/20 dark:text-green-300",
};

export const MATERIAL_STATUS_ORDER: MaterialListStatus[] = [
  "utkast",
  "klar_for_bestilling",
  "bestilt",
  "delvis_mottatt",
  "mottatt",
  "plukket",
  "med_montor",
  "levert_jobb",
  "forbruk_registrert",
  "ferdig",
];

export type MaterialItemSource =
  | "manual"
  | "template"
  | "copied"
  | "ai"
  | "added_after"
  | "external_suggestion";

export const MATERIAL_SOURCE_LABELS: Record<MaterialItemSource, string> = {
  manual: "Manuell",
  template: "Standardpakke",
  copied: "Kopiert",
  ai: "AI-forslag",
  added_after: "Lagt til etter jobb",
  external_suggestion: "Forslag fra bestiller",
};

export type MaterialProvidedBy =
  | "mcs_service"
  | "mcs_elektrotavler"
  | "kunde"
  | "grossist_direkte"
  | "lager"
  | "annet";

export const MATERIAL_PROVIDED_BY_LABELS: Record<MaterialProvidedBy, string> = {
  mcs_service: "MCS Service",
  mcs_elektrotavler: "MCS Elektrotavler",
  kunde: "Kunde",
  grossist_direkte: "Grossist direkte",
  lager: "Lager",
  annet: "Annet",
};

export type ProcurementStatus =
  | "planned"
  | "ordered"
  | "partially_received"
  | "received"
  | "cancelled";

export const PROCUREMENT_STATUS_LABELS: Record<ProcurementStatus, string> = {
  planned: "Planlagt",
  ordered: "Bestilt",
  partially_received: "Delvis mottatt",
  received: "Mottatt",
  cancelled: "Kansellert",
};

export const PROCUREMENT_STATUS_CLASS: Record<ProcurementStatus, string> = {
  planned: "bg-muted text-muted-foreground",
  ordered: "bg-blue-100 text-blue-900 dark:bg-blue-500/20 dark:text-blue-300",
  partially_received: "bg-sky-100 text-sky-900 dark:bg-sky-500/20 dark:text-sky-300",
  received: "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-300",
  cancelled: "bg-rose-100 text-rose-900 dark:bg-rose-500/20 dark:text-rose-300",
};

export const COMMON_SUPPLIERS = [
  "Onninen",
  "Solar Norge",
  "Elektroskandia",
  "Ahlsell",
  "MCS Elektrotavler",
  "Lager",
  "Annet",
];

export const DELIVERY_METHODS = [
  "Til MCS lager",
  "Direkte til jobb",
  "Til montør",
  "Leveres av MCS Elektrotavler",
  "Hentes hos grossist",
  "Annet",
];
