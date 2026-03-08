export type HelpRole = "all" | "admin" | "montør" | "kunde";

export type HelpCategory =
  | "ressursplan"
  | "min-dag"
  | "prosjekter"
  | "skjema"
  | "servicejournal"
  | "kundeportal"
  | "fakturagrunnlag"
  | "varsler";

export interface HelpArticle {
  id: string;
  title: string;
  category: HelpCategory;
  roles: HelpRole[];
  summary: string;
  steps?: string[];
  relatedIds?: string[];
  popular?: boolean;
}

export const CATEGORY_LABELS: Record<HelpCategory, string> = {
  ressursplan: "Ressursplan",
  "min-dag": "Min dag",
  prosjekter: "Prosjekter",
  skjema: "Skjema & maler",
  servicejournal: "Servicejournal",
  kundeportal: "Kundeportal",
  fakturagrunnlag: "Fakturagrunnlag",
  varsler: "Varsler",
};

export const CATEGORY_ICONS: Record<HelpCategory, string> = {
  ressursplan: "CalendarDays",
  "min-dag": "Sun",
  prosjekter: "FolderKanban",
  skjema: "ClipboardCheck",
  servicejournal: "FileText",
  kundeportal: "Globe",
  fakturagrunnlag: "Receipt",
  varsler: "Bell",
};

export const ROLE_LABELS: Record<HelpRole, string> = {
  all: "Alle",
  admin: "Admin / Prosjektleder",
  montør: "Montør",
  kunde: "Kunde",
};

export const helpArticles: HelpArticle[] = [
  // ─── Ressursplan ───
  {
    id: "rp-create-block",
    title: "Planlegge arbeid for en montør",
    category: "ressursplan",
    roles: ["admin"],
    summary: "Opprett en planleggingsblokk for å tildele arbeid til en montør.",
    steps: [
      "Gå til Ressursplan fra sidemenyen.",
      "Klikk på ønsket dag og montør i kalenderen.",
      "Fyll ut oppdrags- eller prosjektinformasjon.",
      "Lagre – montøren ser oppdraget i Min dag og Outlook.",
    ],
    popular: true,
  },
  {
    id: "rp-remove-block",
    title: "Fjerne en montør fra planen",
    category: "ressursplan",
    roles: ["admin"],
    summary: "Slett en planleggingsblokk for å fjerne arbeid fra en montørs kalender.",
    steps: [
      "Åpne blokken i Ressursplanen.",
      "Klikk «Fjern fra plan».",
      "Bekreft slettingen. Montørens Outlook-hendelse fjernes automatisk.",
    ],
  },
  {
    id: "rp-capacity",
    title: "Sjekke kapasitet for en uke",
    category: "ressursplan",
    roles: ["admin"],
    summary: "Kapasitetsoversikten viser hvor mye ledig tid hver montør har.",
    steps: [
      "Gå til Ressursplan.",
      "Se kapasitetsindikatoren ved siden av hver montør.",
      "Grønn = ledig, gul = nesten fullt, rød = overbelastet.",
    ],
  },

  // ─── Min dag ───
  {
    id: "md-start-work",
    title: "Starte arbeid på et oppdrag",
    category: "min-dag",
    roles: ["montør"],
    summary: "Trykk «Start arbeid» for å registrere at du har begynt. Systemet sjekker posisjonen din automatisk.",
    steps: [
      "Åpne Min dag fra menyen.",
      "Trykk på oppdraget du skal jobbe med.",
      "Trykk «Start arbeid» – GPS-posisjonen sjekkes.",
      "Du er klar til å dokumentere arbeid.",
    ],
    popular: true,
  },
  {
    id: "md-take-photo",
    title: "Dokumentere med bilder",
    category: "min-dag",
    roles: ["montør"],
    summary: "Ta bilder direkte fra Min dag for å dokumentere utført arbeid.",
    steps: [
      "Start oppdraget hvis ikke allerede startet.",
      "Trykk «Dokumenter arbeid» eller kameraikonet.",
      "Ta bilde – det lastes automatisk opp.",
      "Bildene lagres på prosjektet og vises i servicejournal.",
    ],
    popular: true,
  },
  {
    id: "md-complete",
    title: "Ferdigstille et oppdrag",
    category: "min-dag",
    roles: ["montør"],
    summary: "Marker oppdraget som ferdig. Obligatoriske sjekklister må være utfylt først.",
    steps: [
      "Trykk «Marker ferdig» på oppdraget.",
      "Fyll ut eventuelt oppsummeringsnotat.",
      "Systemet sjekker at alle obligatoriske skjema er fullført.",
      "Oppdraget markeres som ferdig og servicejournal genereres.",
    ],
  },

  // ─── Prosjekter ───
  {
    id: "proj-create",
    title: "Opprette et nytt prosjekt",
    category: "prosjekter",
    roles: ["admin"],
    summary: "Opprett prosjekt med kunde, adresse og beskrivelse.",
    steps: [
      "Gå til Prosjekter og trykk «Nytt prosjekt».",
      "Fyll inn kunde, tittel, adresse og beskrivelse.",
      "Trykk Lagre – prosjektet er klart til planlegging.",
    ],
    popular: true,
  },
  {
    id: "proj-conversations",
    title: "Bruke samtaler i prosjekt",
    category: "prosjekter",
    roles: ["all"],
    summary: "Start en samtale for å kommunisere med teamet direkte i prosjektet.",
    steps: [
      "Åpne prosjektet og gå til Samtaler-fanen.",
      "Opprett ny tråd eller svar i eksisterende.",
      "Bruk @mentions for å varsle spesifikke personer.",
      "Bilder og filer kan legges ved direkte.",
    ],
  },

  // ─── Skjema & maler ───
  {
    id: "form-fill",
    title: "Fylle ut en sjekkliste",
    category: "skjema",
    roles: ["montør"],
    summary: "Sjekklister og kontrollskjema fylles ut direkte fra Min dag eller prosjektsiden.",
    steps: [
      "Åpne oppdraget i Min dag.",
      "Finn sjekklisten under «Sjekklister».",
      "Trykk «Start» for å begynne utfylling.",
      "Fyll ut alle felt og signer hvis påkrevd.",
      "Trykk «Fullfør» for å lagre.",
    ],
    popular: true,
  },
  {
    id: "form-create-template",
    title: "Opprette en skjemamal",
    category: "skjema",
    roles: ["admin"],
    summary: "Admin kan lage nye sjekkliste- og kontrollmaler via skjemabyggeren.",
    steps: [
      "Gå til Admin → Skjema.",
      "Trykk «Ny mal».",
      "Dra og slipp felt fra paletten.",
      "Sett innstillinger for synlighet, roller og krav.",
      "Publiser malen.",
    ],
  },

  // ─── Servicejournal ───
  {
    id: "sj-view",
    title: "Se servicejournalen for et prosjekt",
    category: "servicejournal",
    roles: ["admin"],
    summary: "Servicejournalen samler all dokumentasjon: bilder, sjekklister, notater og tidsbruk.",
    steps: [
      "Åpne prosjektet.",
      "Gå til Servicejournal-fanen.",
      "Se oversikt over alt utført arbeid med tidslinje.",
    ],
  },
  {
    id: "sj-share",
    title: "Dele servicejournal med kunde",
    category: "servicejournal",
    roles: ["admin"],
    summary: "Send servicejournalen som PDF til kunden eller vis den i kundeportalen.",
    steps: [
      "Åpne servicejournalen for prosjektet.",
      "Trykk «Del» eller «Last ned PDF».",
      "Velg om du vil sende via e-post eller gjøre tilgjengelig i kundeportalen.",
    ],
  },

  // ─── Kundeportal ───
  {
    id: "cp-login",
    title: "Logge inn i kundeportalen",
    category: "kundeportal",
    roles: ["kunde"],
    summary: "Bruk lenken du fikk på e-post for å aktivere og logge inn i portalen.",
    steps: [
      "Åpne aktiveringslenken fra e-posten.",
      "Sett passord for kontoen din.",
      "Logg inn på portalen.",
      "Se oversikt over dine prosjekter og leveranser.",
    ],
    popular: true,
  },
  {
    id: "cp-approve",
    title: "Godkjenne utført arbeid",
    category: "kundeportal",
    roles: ["kunde"],
    summary: "Kunder kan se utført arbeid og godkjenne fra portalen.",
    steps: [
      "Logg inn i kundeportalen.",
      "Åpne prosjektet som er merket som ferdig.",
      "Se gjennom sjekklister, bilder og servicejournal.",
      "Trykk «Godkjenn» for å bekrefte arbeidet.",
    ],
  },

  // ─── Fakturagrunnlag ───
  {
    id: "inv-basis",
    title: "Opprette fakturagrunnlag",
    category: "fakturagrunnlag",
    roles: ["admin"],
    summary: "Fakturagrunnlag samles automatisk fra ferdigstilte oppdrag.",
    steps: [
      "Gå til Fakturagrunnlag fra sidemenyen.",
      "Se liste over oppdrag som er klare for fakturering.",
      "Sjekk at alle obligatoriske skjema er fullført.",
      "Marker rader og trykk «Send til økonomi».",
    ],
    popular: true,
  },

  // ─── Varsler ───
  {
    id: "notif-settings",
    title: "Stille inn varslinger",
    category: "varsler",
    roles: ["all"],
    summary: "Tilpass hvilke varsler du mottar via e-post og i systemet.",
    steps: [
      "Gå til Innstillinger → Varsler.",
      "Velg hvilke hendelser du vil varsles om.",
      "Lagre endringene.",
    ],
  },
  {
    id: "notif-portal",
    title: "Varsler i kundeportalen",
    category: "varsler",
    roles: ["kunde"],
    summary: "Kunder mottar varsler når oppdrag oppdateres eller trenger godkjenning.",
    steps: [
      "Varsler vises som bjelle-ikon i portalen.",
      "Klikk for å se alle varsler.",
      "Trykk på et varsel for å gå direkte til relevant prosjekt.",
    ],
  },
];

export function searchArticles(query: string, role?: HelpRole, category?: HelpCategory): HelpArticle[] {
  const q = query.toLowerCase().trim();
  return helpArticles.filter((a) => {
    if (role && role !== "all" && !a.roles.includes(role) && !a.roles.includes("all")) return false;
    if (category && a.category !== category) return false;
    if (!q) return true;
    return (
      a.title.toLowerCase().includes(q) ||
      a.summary.toLowerCase().includes(q) ||
      a.steps?.some((s) => s.toLowerCase().includes(q))
    );
  });
}

export function getArticleById(id: string): HelpArticle | undefined {
  return helpArticles.find((a) => a.id === id);
}

/** Build a compact knowledge base string for AI context */
export function buildKnowledgeBase(): string {
  return helpArticles
    .map((a) => `## ${a.title}\nKategori: ${CATEGORY_LABELS[a.category]}\n${a.summary}\n${a.steps ? a.steps.map((s, i) => `${i + 1}. ${s}`).join("\n") : ""}`)
    .join("\n\n");
}
