export type MaterialListStatus =
  | "utkast"
  | "klar_for_bestilling"
  | "bestilt"
  | "mottatt"
  | "plukket"
  | "med_montor"
  | "forbruk_registrert"
  | "ferdig";

export const MATERIAL_STATUS_LABELS: Record<MaterialListStatus, string> = {
  utkast: "Utkast",
  klar_for_bestilling: "Klar for bestilling",
  bestilt: "Bestilt",
  mottatt: "Mottatt",
  plukket: "Plukket",
  med_montor: "Med montør",
  forbruk_registrert: "Forbruk registrert",
  ferdig: "Ferdig",
};

export const MATERIAL_STATUS_CLASS: Record<MaterialListStatus, string> = {
  utkast: "bg-muted text-muted-foreground",
  klar_for_bestilling: "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-300",
  bestilt: "bg-blue-100 text-blue-900 dark:bg-blue-500/20 dark:text-blue-300",
  mottatt: "bg-indigo-100 text-indigo-900 dark:bg-indigo-500/20 dark:text-indigo-300",
  plukket: "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-300",
  med_montor: "bg-purple-100 text-purple-900 dark:bg-purple-500/20 dark:text-purple-300",
  forbruk_registrert: "bg-teal-100 text-teal-900 dark:bg-teal-500/20 dark:text-teal-300",
  ferdig: "bg-green-100 text-green-900 dark:bg-green-500/20 dark:text-green-300",
};

export const MATERIAL_STATUS_ORDER: MaterialListStatus[] = [
  "utkast",
  "klar_for_bestilling",
  "bestilt",
  "mottatt",
  "plukket",
  "med_montor",
  "forbruk_registrert",
  "ferdig",
];

export type MaterialItemSource =
  | "manual"
  | "template"
  | "copied"
  | "ai"
  | "added_after";

export const MATERIAL_SOURCE_LABELS: Record<MaterialItemSource, string> = {
  manual: "Manuell",
  template: "Standardpakke",
  copied: "Kopiert",
  ai: "AI-forslag",
  added_after: "Lagt til etter jobb",
};
