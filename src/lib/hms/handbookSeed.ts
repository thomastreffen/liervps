// MCS startstruktur for håndbøker.
// Ingen juridisk fasittekst – kun struktur + ledetekst.

export interface HandbookChapterSeed {
  title: string;
  body: string;
}

export interface HandbookSeed {
  kind: "work_handbook" | "hms_handbook";
  title: string;
  description: string;
  chapters: HandbookChapterSeed[];
}

const placeholder = (h: string) =>
  `# ${h}\n\n> Dette kapittelet skal beskrive MCS Service sine rutiner for ${h.toLowerCase()}. Fyll inn faktisk tekst etter intern gjennomgang.\n\n## Ansvar\n\n## Rutine\n\n## Henvisninger\n`;

export const MCS_HANDBOOK_SEEDS: HandbookSeed[] = [
  {
    kind: "work_handbook",
    title: "Arbeidshåndbok – MCS Service",
    description: "Arbeidstid, fravær, pauser, reise og særrutiner for datacenter, næringsbygg og service.",
    chapters: [
      "Arbeidstid",
      "Overtid",
      "Pauser",
      "Hviletid",
      "Reisetid",
      "Nattarbeid og helg",
      "Fravær og sykefravær",
      "Ferie",
      "HMS-ansvar",
      "Avvik og varsling",
      "Bruk av verneutstyr",
      "Datacenter-rutiner",
      "Næringsbygg-rutiner",
      "Tavle og strømskinner",
      "Serviceoppdrag",
    ].map((t) => ({ title: t, body: placeholder(t) })),
  },
  {
    kind: "hms_handbook",
    title: "HMS-håndbok – MCS Service",
    description: "Internkontroll, elsikkerhet, SJA, ulykker, kjemikalier, asbest, beredskap.",
    chapters: [
      "Internkontroll",
      "Roller og ansvar",
      "FSE og elsikkerhet",
      "SJA og risikovurdering",
      "Strømulykke / strømgjennomgang",
      "Alvorlig ulykke",
      "Personlig verneutstyr",
      "Stoffkartotek / kjemikalier",
      "EE-avfall",
      "Asbest / eldre bygg",
      "Vernerunde",
      "Avvik / RUH",
      "Opplæring",
      "Beredskap",
    ].map((t) => ({ title: t, body: placeholder(t) })),
  },
];
