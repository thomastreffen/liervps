/**
 * Structured, product-specific content for the public product showcase.
 *
 * Rules for this file:
 * - Customer-friendly and conservative wording only.
 * - No prices, no exact performance specs, no "best i test"-claims,
 *   no savings guarantees.
 * - `sourceUrl` / `sourceLabel` / `lastReviewed` are INTERNAL traceability
 *   fields. They must never be rendered or linked in public UI.
 * - `imageKey` points at a locally stored, rights-cleared image placed in
 *   `src/assets/lier/products/<brand>/`. Never hotlink supplier images.
 */

import type { BrandName, ProductType } from "./product-types";
import {
  productSpecsFor,
  type ProductSpecs,
  type ProductSpecVariant,
} from "./product-specs";


export type ImageStatus =
  | "missing"
  | "local_approved"
  | "needs_approval"
  | "approved-source-needed";

/** Role an image plays for a product. Only one `primary` is used on cards. */
export type ProductImageType =
  | "primary"
  | "indoor"
  | "outdoor"
  | "lifestyle"
  | "detail"
  | "variant";

/**
 * One image slot for a product. `key` is the local asset base name (no extension)
 * under src/assets/lier/products/<brand>/. Never a remote URL — no hotlinking.
 */
export type ProductImage = {
  key: string;
  type: ProductImageType;
  alt: string;
  status: Extract<ImageStatus, "local_approved" | "needs_approval" | "missing">;
};


export type ProductDetails = {
  brand?: BrandName;
  /** Name as shown to the customer — matches the name used in the showcase groups. */
  modelName: string;
  /** Series/family the model belongs to, when relevant. */
  modelFamily?: string;
  /** One short, specific sentence about where this model sits in the range. */
  shortPositioning: string;
  productType: ProductType;
  /** "Passer ofte for" — customer situations. */
  suitableFor: string[];
  /** How the model typically gets used in practice. */
  typicalUse: string;
  /** 2–4 concrete strengths. */
  keyStrengths: string[];
  designNotes?: string;
  heatingNotes?: string;
  coolingNotes?: string;
  placementNotes?: string;
  /** Only when officially stated by the manufacturer/distributor. */
  noiseNote?: string;
  /** Only when officially stated by the manufacturer/distributor. */
  coldClimateNote?: string;
  /**
   * Local asset base name (without extension) under src/assets/lier/products/<brand>/.
   * Kept for backwards compatibility — used as the primary image when `images` is absent.
   */
  imageKey?: string;
  imageAlt?: string;
  imageStatus: ImageStatus;
  /**
   * Optional multi-image gallery. Cards use the first `primary` entry;
   * the modal shows all entries that resolve to a local file.
   */
  images?: ProductImage[];

  /** Internal only. */
  sourceUrl?: string;
  /** Internal only. */
  sourceLabel?: string;
  /** Internal only. ISO date of last content review. */
  lastReviewed?: string;
  /** Official manufacturer/distributor specifications. Never estimated. */
  specs?: ProductSpecs;
  /** Other officially documented sizes in the same series. Public. */
  specVariants?: ProductSpecVariant[];
  /** Which model size the specs apply to. Public. */
  specBasis?: string;
  /** Short customer-friendly guidance line. Public. */
  guidanceNote?: string;
  /** Internal only. */
  specSourceUrl?: string;
  /** Internal only. */
  specSourceLabel?: string;
  /** Internal only. ISO date of last spec review. */
  specLastReviewed?: string;
};


const REVIEWED = "2026-08-14";

const SRC = {
  mee: {
    url: "https://mee.no/privat/produktkategori/luft-luft-varmepumper/",
    label: "Mitsubishi Electric Norge (produsent)",
  },
  meeUwanoPure: {
    url: "https://mee.no/privat/produktkategori/luft-luft-varmepumper/uwanopure/",
    label: "Mitsubishi Electric Norge (produsent)",
  },
  meeKaiteki: {
    url: "https://mee.no/privat/produktkategori/luft-luft-varmepumper/kaiteki/",
    label: "Mitsubishi Electric Norge (produsent)",
  },
  meeGussuri: {
    url: "https://mee.no/privat/produktkategori/luft-luft-varmepumper/gussuri/",
    label: "Mitsubishi Electric Norge (produsent)",
  },
  meeIguru: {
    url: "https://mee.no/privat/produktkategori/luft-luft-varmepumper/iguru/",
    label: "Mitsubishi Electric Norge (produsent)",
  },
  meeFuro: {
    url: "https://mee.no/privat/produktkategori/luft-luft-varmepumper/furo/",
    label: "Mitsubishi Electric Norge (produsent)",
  },
  meeZen: {
    url: "https://mee.no/privat/produktkategori/luft-luft-varmepumper/zen/",
    label: "Mitsubishi Electric Norge (produsent)",
  },
  meeDuo: {
    url: "https://mee.no/privat/produktkategori/luft-luft-varmepumper/duo-7000/",
    label: "Mitsubishi Electric Norge (produsent)",
  },
  meeNordicMulti: {
    url: "https://mee.no/privat/produktkategori/luft-luft-varmepumper/nordic-multi/",
    label: "Mitsubishi Electric Norge (produsent)",
  },
  paBest: {
    url: "https://www.varmepumpeservice.no/panasonic-bestselgere",
    label: "Panasonic – distributørkatalog",
  },
  paMulti: {
    url: "https://www.varmepumpeservice.no/panasonic-multisplitt-med-innedeler",
    label: "Panasonic multisplitt – distributørkatalog",
  },
  paMultiNordic: {
    url: "https://www.varmepumpeservice.no/panasonic-multisplitt-nordisk-med-innedeler",
    label: "Panasonic multisplitt nordisk – distributørkatalog",
  },
  paVann: {
    url: "https://www.varmepumpeservice.no/panasonic-luft-vann",
    label: "Panasonic luft-vann – distributørkatalog",
  },
  paNaering: {
    url: "https://www.varmepumpeservice.no/panasonic-naering",
    label: "Panasonic næring – distributørkatalog",
  },
  toBest: {
    url: "https://www.varmepumpeservice.no/toshiba-bestselgere",
    label: "Toshiba – distributørkatalog",
  },
  toSignatur: {
    url: "https://www.toshibavarmepumper.no/varmepumper-luft-luft/signatur-25/",
    label: "Toshiba Norge (ABK-Qviller, importør)",
  },
  toKontur: {
    url: "https://www.toshibavarmepumper.no/varmepumper-luft-luft/toshiba-kontur-25/",
    label: "Toshiba Norge (ABK-Qviller, importør)",
  },
  toAsk: {
    url: "https://www.toshibavarmepumper.no/varmepumper-luft-luft/toshiba-ask-25/",
    label: "Toshiba Norge (ABK-Qviller, importør)",
  },
  toPolar: {
    url: "https://www.toshibavarmepumper.no/varmepumper-luft-luft/toshiba-polar-25/",
    label: "Toshiba Norge (ABK-Qviller, importør)",
  },
  toSeiyaNordic: {
    url: "https://www.toshibavarmepumper.no/varmepumper-luft-luft/toshiba-seiya-nordic-25/",
    label: "Toshiba Norge (ABK-Qviller, importør)",
  },
  toGulv: {
    url: "https://www.toshibavarmepumper.no/varmepumper-luft-luft/toshiba-gulvmodell-25/",
    label: "Toshiba Norge (ABK-Qviller, importør)",
  },
  toMultiNordicOff: {
    url: "https://www.toshibavarmepumper.no/varmepumper-luft-luft/multi-nordic/",
    label: "Toshiba Norge (ABK-Qviller, importør)",
  },
  toTekstil: {
    url: "https://www.varmepumpeservice.no/tekstiltrekk-til-toshiba-signatur",
    label: "Toshiba tilbehør – distributørkatalog",
  },
  toMulti: {
    url: "https://www.varmepumpeservice.no/toshiba-multisplitt",
    label: "Toshiba multisplitt – distributørkatalog",
  },
  toMultiNordic: {
    url: "https://www.varmepumpeservice.no/toshiba-multisplitt-nordic",
    label: "Toshiba multisplitt nordic – distributørkatalog",
  },
};

/** Keyed by the exact product name used in the showcase groups. */
export const PRODUCT_DETAILS: Record<string, ProductDetails> = {
  /* ---------------- Mitsubishi Electric ---------------- */
  "UWANO Pure": {
    brand: "Mitsubishi Electric",
    modelName: "UWANO Pure",
    modelFamily: "UWANO",
    productType: "Luft-luft",
    shortPositioning:
      "Toppmodellen i serien hos Mitsubishi Electric, typisk valgt når komfort og stabil varme gjennom hele året veier tyngst.",
    suitableFor: [
      "Enebolig eller rekkehus med ett hovedoppholdsrom",
      "Boliger der varmepumpen skal være hovedvarmekilde",
      "Kunder som prioriterer komfort framfor lavest mulig investering",
    ],
    typicalUse:
      "Montert i stue eller åpen kjøkkenløsning, og brukt som primær varmekilde store deler av året.",
    keyStrengths: [
      "Bygget for helårsdrift i norsk klima",
      "Jevn varmefordeling i større oppholdsrom",
      "Luftrensefunksjon i toppsegmentet",
      "Styring via app når anlegget settes opp for det",
    ],
    heatingNotes:
      "Aktuelt der du ønsker god varmeleveranse også i kalde perioder. Faktisk dekningsgrad avhenger av bolig og plassering, og må vurderes på befaring.",
    placementNotes:
      "Plassering av innedel og utedel har mye å si for resultatet. Vi ser på luftveier, avstander og støy mot naboer på befaring.",
    imageKey: "mitsubishi-uwano-pure",
    imageAlt: "Mitsubishi Electric UWANO Pure innedel montert på vegg",
    imageStatus: "local_approved",
    sourceUrl: SRC.meeUwanoPure.url,
    sourceLabel: SRC.meeUwanoPure.label,
    lastReviewed: REVIEWED,
  },
  Kaiteki: {
    brand: "Mitsubishi Electric",
    modelName: "Kaiteki",
    modelFamily: "Kaiteki",
    productType: "Luft-luft",
    shortPositioning:
      "Bestselgeren hos Mitsubishi Electric, en allroundmodell som treffer de fleste vanlige boliger.",
    suitableFor: [
      "Vanlig enebolig, rekkehus eller leilighet",
      "Boliger som i dag varmes opp med panelovner",
      "Kunder som vil ha en trygg totalpakke",
    ],
    typicalUse:
      "Førstevalget når boligen ikke har spesielle utfordringer og varmepumpen skal dekke hovedoppholdsrommet.",
    keyStrengths: [
      "God totaløkonomi i normale boliger",
      "Flere fargevalg på innedelen",
      "Kjent og godt utbredt modell i Norge",
    ],
    designNotes:
      "Fargevalg gjør det enklere å tilpasse innedelen til rommet. Tilgjengelige varianter avklares ved bestilling.",
    imageKey: "mitsubishi-kaiteki",
    imageAlt: "Mitsubishi Electric Kaiteki innedel",
    imageStatus: "local_approved",
    sourceUrl: SRC.meeKaiteki.url,
    sourceLabel: SRC.meeKaiteki.label,
    lastReviewed: REVIEWED,
  },
  GUSSURI: {
    brand: "Mitsubishi Electric",
    modelName: "GUSSURI",
    modelFamily: "GUSSURI",
    productType: "Luft-luft",
    shortPositioning:
      "Komfortmodellen hos Mitsubishi Electric, der jevn varme og et rolig lydbilde er viktigere enn maksimal effekt.",
    suitableFor: [
      "Soverom, hybel eller mindre oppholdsrom",
      "Boliger der innedelen står nær der man sover eller jobber",
      "Kunder som er sensitive for lyd fra innedelen",
    ],
    typicalUse:
      "Valgt når varmepumpen står i et rom der man oppholder seg over lengre tid og ønsker minst mulig merkbar drift.",
    keyStrengths: [
      "Komfortprofil rettet mot lavt lydnivå",
      "Jevn temperatur uten store svingninger",
      "Enkel daglig bruk",
    ],
    noiseNote:
      "Modellen er posisjonert av produsenten som en stillegående komfortmodell. Faktisk opplevd lyd avhenger av rom, montasje og driftsnivå.",
    imageKey: "mitsubishi-gussuri",
    imageAlt: "Mitsubishi Electric GUSSURI innedel",
    imageStatus: "local_approved",
    sourceUrl: SRC.meeGussuri.url,
    sourceLabel: SRC.meeGussuri.label,
    lastReviewed: REVIEWED,
  },
  IGURU: {
    brand: "Mitsubishi Electric",
    modelName: "IGURU",
    modelFamily: "IGURU",
    productType: "Luft-luft",
    shortPositioning:
      "Kompaktmodellen hos Mitsubishi Electric, for boliger der veggplassen er begrenset eller pumpen skal være lite synlig.",
    suitableFor: [
      "Leilighet eller mindre bolig",
      "Rom med smal eller delvis opptatt vegg",
      "Kunder som vil ha en diskret installasjon",
    ],
    typicalUse:
      "Brukt der en standard innedel blir for dominerende, men behovet for varme fortsatt er reelt.",
    keyStrengths: [
      "Mindre fysisk fotavtrykk på veggen",
      "Diskret uttrykk i rommet",
      "Fleksibel plassering",
    ],
    placementNotes:
      "Kompakt størrelse gir flere plasseringsmuligheter, men luftveien i rommet må fortsatt vurderes på befaring.",
    imageKey: "mitsubishi-iguru",
    imageAlt: "Mitsubishi Electric IGURU kompakt innedel",
    imageStatus: "local_approved",
    sourceUrl: SRC.meeIguru.url,
    sourceLabel: SRC.meeIguru.label,
    lastReviewed: REVIEWED,
  },
  Furo: {
    brand: "Mitsubishi Electric",
    modelName: "Furo",
    modelFamily: "Furo",
    productType: "Gulvmodell",
    shortPositioning:
      "Gulvmodellen hos Mitsubishi Electric, for lav plassering der høy montering ikke passer.",
    suitableFor: [
      "Eldre boliger med lav takhøyde eller mange vinduer",
      "Rom der veggen over er opptatt av vindu eller skap",
      "Boliger der man ønsker varmen nær gulvnivå",
    ],
    typicalUse:
      "Plassert lavt på vegg, ofte der en radiator eller panelovn står i dag.",
    keyStrengths: [
      "Varme nær gulvet der man oppholder seg",
      "Alternativ når høy vegg ikke er tilgjengelig",
      "Passer i planløsninger med mye vindusflate",
    ],
    placementNotes:
      "Krever fri luftvei foran enheten. Møblering og gardiner må hensyntas, og vurderes på befaring.",
    imageKey: "mitsubishi-furo",
    imageAlt: "Mitsubishi Electric Furo gulvmodell",
    imageStatus: "local_approved",
    sourceUrl: SRC.meeFuro.url,
    sourceLabel: SRC.meeFuro.label,
    lastReviewed: REVIEWED,
  },
  Zen: {
    brand: "Mitsubishi Electric",
    modelName: "Zen",
    modelFamily: "Zen",
    productType: "Luft-luft",
    shortPositioning:
      "Designmodellen hos Mitsubishi Electric, for boliger der innedelen er godt synlig og skal passe inn i interiøret.",
    suitableFor: [
      "Stue eller kjøkken med synlig plassering",
      "Nyere boliger med tydelig interiøruttrykk",
      "Kunder som legger vekt på utseende",
    ],
    typicalUse:
      "Valgt når plasseringen er i et representativt rom og et nøytralt, rent uttrykk er viktig.",
    keyStrengths: [
      "Rent og dempet designuttrykk",
      "Passer i synlige plasseringer",
      "Kjent Mitsubishi-plattform i bunn",
    ],
    designNotes:
      "Designmodellene har et flatere frontuttrykk enn standardmodellene. Endelig valg avhenger av rommet og plasseringen.",
    imageKey: "mitsubishi-zen",
    imageAlt: "Mitsubishi Electric Zen designmodell",
    imageStatus: "local_approved",
    sourceUrl: SRC.meeZen.url,
    sourceLabel: SRC.meeZen.label,
    lastReviewed: REVIEWED,
  },
  "Duo-modellen": {
    brand: "Mitsubishi Electric",
    modelName: "Duo-modellen",
    modelFamily: "Duo",
    productType: "Multisplitt",
    shortPositioning:
      "Duomodellen hos Mitsubishi Electric, med to innedeler på samme utedel.",
    suitableFor: [
      "Bolig over to plan",
      "Delt planløsning med to naturlige soner",
      "Boliger med begrenset plass til flere utedeler",
    ],
    typicalUse:
      "Typisk valgt når hovedetasjen dekkes i dag, men en ekstra sone som kjeller, loft eller sokkelleilighet også skal ha varme.",
    keyStrengths: [
      "Én utedel dekker to innedeler",
      "Mindre inngrep på fasaden",
      "Bedre dekning enn ett enkelt anlegg",
    ],
    placementNotes:
      "Rørføring mellom sonene er avgjørende for hva som er praktisk mulig, og må kartlegges på befaring.",
    imageKey: "mitsubishi-duo-modellen",
    imageAlt: "Mitsubishi Electric Duo multiløsning",
    imageStatus: "local_approved",
    sourceUrl: SRC.meeDuo.url,
    sourceLabel: SRC.meeDuo.label,
    lastReviewed: REVIEWED,
  },
  "Nordic Multi": {
    brand: "Mitsubishi Electric",
    modelName: "Nordic Multi",
    modelFamily: "Nordic Multi",
    productType: "Multisplitt",
    shortPositioning:
      "Multimodellen hos Mitsubishi Electric, der flere innedeler kobles til én utedel for å dekke flere rom.",
    suitableFor: [
      "Større boliger med flere rom som skal varmes",
      "Boliger med lukket planløsning",
      "Mindre næringslokaler med flere soner",
    ],
    typicalUse:
      "Brukt der ett anlegg i stua ikke er nok, og varmen skal fordeles til flere rom eller etasjer.",
    keyStrengths: [
      "Flere innedeler fra samme utedel",
      "Fleksibel soneinndeling",
      "Færre utedeler på fasaden",
      "Tilpasset nordiske driftsforhold",
    ],
    coldClimateNote:
      "Serien er posisjonert av produsenten for nordiske forhold. Dimensjonering settes etter befaring.",
    imageKey: "mitsubishi-nordic-multi",
    imageAlt: "Mitsubishi Electric Nordic Multi utedel med flere innedeler",
    imageStatus: "local_approved",
    sourceUrl: SRC.meeNordicMulti.url,
    sourceLabel: SRC.meeNordicMulti.label,
    lastReviewed: REVIEWED,
  },

  /* ---------------- Panasonic ---------------- */
  "Panasonic HZ Flagship": {
    brand: "Panasonic",
    modelName: "HZ Flagship",
    modelFamily: "Etherea HZ",
    productType: "Luft-luft",
    shortPositioning:
      "Panasonics toppserie, typisk valgt når man vil ha det meste av teknologi og komfortfunksjoner.",
    suitableFor: [
      "Boliger der varmepumpen skal dekke mye av oppvarmingen",
      "Kunder som ønsker luftrensefunksjon",
      "Moderne boliger med krav til komfort",
    ],
    typicalUse:
      "Montert i hovedoppholdsrommet og brukt aktivt gjennom hele fyringssesongen.",
    keyStrengths: [
      "Toppserie i Panasonic-utvalget",
      "nanoe X luftbehandling",
      "God varmeleveranse i kalde perioder",
      "App-styring når anlegget settes opp for det",
    ],
    heatingNotes:
      "Aktuelt ved høyere varmebehov. Hvor stor andel av oppvarmingen den dekker må vurderes på befaring.",
    imageKey: "panasonic-hz-flagship",
    imageAlt: "Panasonic HZ Etherea innedel",
    imageStatus: "local_approved",
    sourceUrl: SRC.paBest.url,
    sourceLabel: SRC.paBest.label,
    lastReviewed: REVIEWED,
  },
  "Panasonic NZ": {
    brand: "Panasonic",
    modelName: "NZ Etherea",
    modelFamily: "Etherea NZ",
    productType: "Luft-luft",
    shortPositioning:
      "Ligger like under toppserien og gir mye av samme funksjonalitet til et lavere nivå.",
    suitableFor: [
      "Vanlig bolig med normalt varmebehov",
      "Kunder som vil ha god ytelse uten toppmodell",
      "Utskifting av eldre varmepumpe",
    ],
    typicalUse:
      "Et vanlig valg når boligen ikke har spesielle utfordringer, men man fortsatt vil ha en solid modell.",
    keyStrengths: [
      "God balanse mellom ytelse og investering",
      "Samme designfamilie som toppserien",
      "Enkel styring i hverdagen",
    ],
    imageKey: "panasonic-nz-etherea",
    imageAlt: "Panasonic NZ Etherea innedel",
    imageStatus: "local_approved",
    sourceUrl: SRC.paBest.url,
    sourceLabel: SRC.paBest.label,
    lastReviewed: REVIEWED,
  },
  "Panasonic CZ": {
    brand: "Panasonic",
    modelName: "CZ",
    modelFamily: "CZ",
    productType: "Luft-luft",
    shortPositioning:
      "Kompakt veggmodell for mindre rom og boliger med begrenset plass.",
    suitableFor: [
      "Leilighet, hybel eller mindre rom",
      "Boliger med kort vegg tilgjengelig",
      "Kunder med moderat varmebehov",
    ],
    typicalUse:
      "Brukt der behovet er avgrenset til ett mindre rom, og en full toppmodell blir unødvendig.",
    keyStrengths: [
      "Kompakt innedel",
      "Innebygget WiFi-styring",
      "Enkelt og rimelig utgangspunkt",
    ],
    imageKey: "panasonic-cz",
    imageAlt: "Panasonic CZ kompakt innedel",
    imageStatus: "local_approved",
    sourceUrl: SRC.paBest.url,
    sourceLabel: SRC.paBest.label,
    lastReviewed: REVIEWED,
  },
  "Panasonic LZ": {
    brand: "Panasonic",
    modelName: "LZ",
    modelFamily: "LZ",
    productType: "Luft-luft",
    shortPositioning:
      "Praktisk utskiftingsmodell når en eldre varmepumpe skal byttes på samme sted.",
    suitableFor: [
      "Bolig med eksisterende varmepumpe som skal erstattes",
      "Installasjoner der plassering og rørføring beholdes",
      "Kunder som vil ha en enkel og forutsigbar utskifting",
    ],
    typicalUse:
      "Valgt når kunden er fornøyd med dagens plassering, men anlegget har gått ut på dato.",
    keyStrengths: [
      "Tilpasset utskifting av eksisterende anlegg",
      "Ofte kortere monteringstid",
      "Forutsigbart resultat",
    ],
    placementNotes:
      "Om eksisterende rørføring kan gjenbrukes avgjøres på befaring, og påvirker både arbeid og pris.",
    imageKey: "panasonic-lz-retro-fit",
    imageAlt: "Panasonic LZ innedel",
    imageStatus: "local_approved",
    sourceUrl: SRC.paBest.url,
    sourceLabel: SRC.paBest.label,
    lastReviewed: REVIEWED,
  },
  "Panasonic VZ Heatcharge": {
    brand: "Panasonic",
    modelName: "VZ Heatcharge",
    modelFamily: "Heatcharge VZ",
    productType: "Luft-luft",
    shortPositioning:
      "Kraftig premiummodell med Heatcharge-teknologi, aktuelt ved høyt varmebehov i kalde perioder.",
    suitableFor: [
      "Enebolig med høyt varmebehov",
      "Områder med kalde vintre",
      "Boliger der varmepumpen skal jobbe hardt over tid",
    ],
    typicalUse:
      "Typisk valgt der andre modeller vurderes som for svake til å holde temperaturen når det er kaldest.",
    keyStrengths: [
      "Heatcharge-teknologi for varmeleveranse i kulde",
      "Kraftig modell i Panasonic-utvalget",
      "Premiumnivå på komfortfunksjoner",
    ],
    coldClimateNote:
      "Posisjonert av produsenten for stabil varme i kalde perioder. Konkret effekt avhenger av bolig og dimensjonering.",
    imageKey: "panasonic-vz-heatcharge",
    imageAlt: "Panasonic VZ Heatcharge innedel",
    imageStatus: "local_approved",
    sourceUrl: SRC.paBest.url,
    sourceLabel: SRC.paBest.label,
    lastReviewed: REVIEWED,
  },
  "Panasonic Gulvmodell": {
    brand: "Panasonic",
    modelName: "Gulvmodell",
    modelFamily: "Gulvmodell",
    productType: "Gulvmodell",
    shortPositioning:
      "Lav plassering på vegg, aktuelt der veggplassen over er opptatt eller planløsningen krever det.",
    suitableFor: [
      "Eldre bolig med mye vindusflate",
      "Rom uten ledig plass høyt på vegg",
      "Kunder som ønsker varmen nær gulvnivå",
    ],
    typicalUse:
      "Montert lavt på vegg, ofte der en eksisterende varmekilde står i dag.",
    keyStrengths: [
      "Alternativ plassering når vegg høyt oppe ikke er mulig",
      "Varme nær oppholdssonen",
      "Diskret i rom med lav takhøyde",
    ],
    placementNotes:
      "Møbler, gardiner og fri luftvei foran enheten må vurderes på befaring.",
    imageKey: "panasonic-gulvmodell",
    imageAlt: "Panasonic gulvmodell innedel",
    imageStatus: "local_approved",
    sourceUrl: SRC.paBest.url,
    sourceLabel: SRC.paBest.label,
    lastReviewed: REVIEWED,
  },
  "Panasonic Luft/vann": {
    brand: "Panasonic",
    modelName: "Luft-vann",
    modelFamily: "Aquarea",
    productType: "Luft-vann",
    shortPositioning:
      "For bygg med vannbåren varme, der varmepumpen kobles til eksisterende anlegg.",
    suitableFor: [
      "Boliger med gulvvarme eller radiatorer",
      "Bygg som skal fase ut olje eller elkjel",
      "Kunder som vil dekke en større del av oppvarmingsbehovet",
    ],
    typicalUse:
      "Kobles på det vannbårne anlegget og kan i mange tilfeller også bidra til varmtvann.",
    keyStrengths: [
      "Utnytter eksisterende vannbårent anlegg",
      "Jevn varme i hele bygget",
      "Ofte høyere dekningsgrad enn luft-luft",
    ],
    heatingNotes:
      "Hva anlegget kan levere avhenger av turtemperatur, isolasjon og dagens installasjon. Dette kartlegges alltid på befaring.",
    imageKey: "panasonic-luft-vann",
    imageAlt: "Panasonic luft-vann utedel",
    imageStatus: "missing",
    sourceUrl: SRC.paVann.url,
    sourceLabel: SRC.paVann.label,
    lastReviewed: REVIEWED,
  },
  "Multisplitt med innedeler": {
    brand: "Panasonic",
    modelName: "Multisplitt",
    modelFamily: "Multisplitt",
    productType: "Multisplitt",
    shortPositioning:
      "Flere innedeler koblet til samme utedel, for å dekke flere rom med ett anlegg.",
    suitableFor: [
      "Bolig med lukket planløsning",
      "Bolig over flere plan",
      "Lokaler med flere mindre rom",
    ],
    typicalUse:
      "Brukt når varmen skal fordeles til flere rom uten å sette opp flere separate anlegg.",
    keyStrengths: [
      "Én utedel for flere rom",
      "Fleksibel plassering av innedelene",
      "Ryddigere fasade",
    ],
    imageKey: "panasonic-multisplitt",
    imageAlt: "Panasonic multisplitt utedel",
    imageStatus: "local_approved",
    sourceUrl: SRC.paMulti.url,
    sourceLabel: SRC.paMulti.label,
    lastReviewed: REVIEWED,
  },
  "Multisplitt nordisk": {
    brand: "Panasonic",
    modelName: "Multisplitt nordisk",
    modelFamily: "Multisplitt Nordic",
    productType: "Multisplitt",
    shortPositioning:
      "Multisplitt satt sammen for nordiske driftsforhold og helårsbruk.",
    suitableFor: [
      "Boliger og lokaler i områder med kalde vintre",
      "Bygg som skal ha varme i flere soner hele året",
      "Kunder som vil unngå flere utedeler",
    ],
    typicalUse:
      "Valgt når multiløsning er riktig, men anlegget også skal fungere godt i kulde.",
    keyStrengths: [
      "Nordisk tilpasset multiløsning",
      "Flere soner fra samme utedel",
      "Egnet for helårsdrift",
    ],
    coldClimateNote:
      "Nordisk-serien er posisjonert av leverandøren for kaldt klima. Dimensjonering settes etter befaring.",
    imageKey: "panasonic-multisplitt-nordisk",
    imageAlt: "Panasonic multisplitt nordisk utedel",
    imageStatus: "missing",
    sourceUrl: SRC.paMultiNordic.url,
    sourceLabel: SRC.paMultiNordic.label,
    lastReviewed: REVIEWED,
  },
  "Panasonic Multisplitt nordisk": {
    brand: "Panasonic",
    modelName: "Multisplitt nordisk",
    modelFamily: "Multisplitt Nordic",
    productType: "Multisplitt",
    shortPositioning:
      "Multisplitt for næringslokaler med flere soner og krav til drift hele året.",
    suitableFor: [
      "Cellekontorer og møterom",
      "Butikk med flere avdelinger",
      "Lokaler som skal holde jevn temperatur i driftstiden",
    ],
    typicalUse:
      "Brukt der flere rom skal dekkes uten å fylle fasaden med utedeler.",
    keyStrengths: [
      "Flere soner fra samme utedel",
      "Tilpasset nordiske forhold",
      "Fleksibel plassering av innedeler",
    ],
    imageKey: "panasonic-multisplitt-nordisk",
    imageAlt: "Panasonic multisplitt nordisk for næring",
    imageStatus: "missing",
    sourceUrl: SRC.paMultiNordic.url,
    sourceLabel: SRC.paMultiNordic.label,
    lastReviewed: REVIEWED,
  },
  "Panasonic Næring": {
    brand: "Panasonic",
    modelName: "Næringsserier",
    modelFamily: "Panasonic Pro",
    productType: "Næring",
    shortPositioning:
      "Serier laget for næringsbygg der drift, kapasitet og styring stiller andre krav enn i bolig.",
    suitableFor: [
      "Kontor, butikk og publikumsareal",
      "Tekniske rom med jevn varmelast",
      "Bygg med behov for stabil drift i åpningstiden",
    ],
    typicalUse:
      "Prosjektert som del av en samlet løsning med riktig kapasitet og soneinndeling.",
    keyStrengths: [
      "Bredt utvalg av innedelstyper",
      "Egnet for kontinuerlig drift",
      "Kan settes opp med sentral styring",
    ],
    coolingNotes:
      "I næringslokaler er kjølebehovet ofte like viktig som varmebehovet. Begge deler vurderes i befaringen.",
    imageKey: "panasonic-naering",
    imageAlt: "Panasonic næringsløsning montert i lokale",
    imageStatus: "missing",
    sourceUrl: SRC.paNaering.url,
    sourceLabel: SRC.paNaering.label,
    lastReviewed: REVIEWED,
  },

  /* ---------------- Toshiba ---------------- */
  "Toshiba Signatur": {
    brand: "Toshiba",
    modelName: "Signatur",
    modelFamily: "Signatur",
    productType: "Luft-luft",
    shortPositioning:
      "Designmodellen i Toshiba-utvalget, med tekstiltrekk som kan byttes der innedelen er godt synlig.",
    suitableFor: [
      "Stue eller rom med synlig plassering",
      "Designbevisste hjem",
      "Kunder som vil kunne bytte uttrykk senere",
    ],
    typicalUse:
      "Valgt når varmepumpen skal være en del av interiøret framfor et teknisk element.",
    keyStrengths: [
      "Utskiftbar tekstilfront",
      "Energismarte funksjoner",
      "Dempet designuttrykk",
    ],
    designNotes:
      "Tekstiltrekk kan bestilles separat, slik at uttrykket kan endres uten å bytte anlegg.",
    imageKey: "toshiba-signatur",
    imageAlt: "Toshiba Signatur innedel med tekstilfront",
    imageStatus: "local_approved",
    sourceUrl: SRC.toSignatur.url,
    sourceLabel: SRC.toSignatur.label,
    lastReviewed: REVIEWED,
  },
  "Toshiba Daiseikai 10 Kontur": {
    brand: "Toshiba",
    modelName: "Daiseikai 10 Kontur",
    modelFamily: "Daiseikai 10",
    productType: "Luft-luft",
    shortPositioning:
      "Toppmodellen i Daiseikai 10-serien, typisk valgt når komfortfunksjoner og helårsdrift veier tyngst.",
    suitableFor: [
      "Enebolig med større oppholdsrom",
      "Boliger der pumpen skal dekke mye av oppvarmingen",
      "Områder med kalde vintre",
    ],
    typicalUse:
      "Brukt som hovedvarmekilde i hovedetasjen gjennom hele fyringssesongen.",
    keyStrengths: [
      "Toppmodell med kraftig varmeleveranse",
      "Avansert styring og komfortfunksjoner",
      "Bygget for helårsdrift",
    ],
    heatingNotes:
      "Aktuelt ved høyt varmebehov. Riktig størrelse settes etter befaring, ikke etter kvadratmeter alene.",
    imageKey: "toshiba-daiseikai-10-kontur",
    imageAlt: "Toshiba Daiseikai 10 Kontur innedel",
    imageStatus: "local_approved",
    sourceUrl: SRC.toKontur.url,
    sourceLabel: SRC.toKontur.label,
    lastReviewed: REVIEWED,
  },
  "Toshiba Daiseikai 10 Ask": {
    brand: "Toshiba",
    modelName: "Daiseikai 10 Ask",
    modelFamily: "Daiseikai 10",
    productType: "Luft-luft",
    shortPositioning:
      "Toppmodell i designklassen, samme serie som Kontur, men med et tydeligere nordisk designuttrykk.",
    suitableFor: [
      "Boliger som vil ha toppmodell i et synlig rom",
      "Interiør med nøytrale farger",
      "Kunder som vil ha ytelse uten et teknisk preg",
    ],
    typicalUse:
      "Valgt når man vil ha toppserien, men innedelen skal falle mer inn i rommet.",
    keyStrengths: [
      "Toppserie-teknologi",
      "Rolig og nøytralt uttrykk",
      "God komfort i større oppholdsrom",
    ],
    designNotes:
      "Ask og Kontur er varianter i samme serie. Valget handler først og fremst om uttrykk.",
    imageKey: "toshiba-daiseikai-10-ask",
    imageAlt: "Toshiba Daiseikai 10 Ask innedel",
    imageStatus: "local_approved",
    sourceUrl: SRC.toAsk.url,
    sourceLabel: SRC.toAsk.label,
    lastReviewed: REVIEWED,
  },
  "Toshiba Polar": {
    brand: "Toshiba",
    modelName: "Polar",
    modelFamily: "Polar",
    productType: "Luft-luft",
    shortPositioning:
      "Kompakt modell posisjonert for nordisk klima, aktuelt der vintrene er lange og varmebehovet stort.",
    suitableFor: [
      "Enebolig i kaldere strøk",
      "Boliger med høyt varmebehov",
      "Kunder som prioriterer varme framfor kjøling",
    ],
    typicalUse:
      "Brukt der anlegget skal levere varme også når temperaturen ligger godt under null over tid.",
    keyStrengths: [
      "Tilpasset nordiske forhold",
      "Kraftig varmeleveranse",
      "God energiklasse i serien",
    ],
    coldClimateNote:
      "Serien er posisjonert av leverandøren for kaldt klima. Faktisk ytelse avhenger av bolig og dimensjonering.",
    imageKey: "toshiba-polar",
    imageAlt: "Toshiba Polar innedel",
    imageStatus: "local_approved",
    sourceUrl: SRC.toPolar.url,
    sourceLabel: SRC.toPolar.label,
    lastReviewed: REVIEWED,
  },
  "Toshiba Seiya": {
    brand: "Toshiba",
    modelName: "Seiya Nordic",
    modelFamily: "Seiya",
    productType: "Luft-luft",
    shortPositioning:
      "Inngangsmodellen i Toshiba-utvalget, tilpasset nordiske forhold og boliger med lavt til middels varmebehov.",
    suitableFor: [
      "Mindre bolig, hytte eller hybel",
      "Kunder med moderat varmebehov",
      "Prisbevisste kjøp der grunnfunksjonene holder",
    ],
    typicalUse:
      "Valgt når behovet er avgrenset og man vil komme i gang med varmepumpe uten toppmodell.",
    keyStrengths: [
      "Lavere inngangsnivå",
      "Nordisk tilpasset variant",
      "Enkle, smarte funksjoner",
    ],
    imageKey: "toshiba-seiya-nordic",
    imageAlt: "Toshiba Seiya Nordic innedel",
    imageStatus: "local_approved",
    sourceUrl: SRC.toSeiyaNordic.url,
    sourceLabel: SRC.toSeiyaNordic.label,
    lastReviewed: REVIEWED,
  },
  "Toshiba Gulvmodell": {
    brand: "Toshiba",
    modelName: "Gulvmodell",
    modelFamily: "Gulvmodell",
    productType: "Gulvmodell",
    shortPositioning:
      "Gulvmodellen i Toshiba-utvalget, for plasseringer der høy vegg ikke er tilgjengelig.",
    suitableFor: [
      "Eldre boliger og spesielle planløsninger",
      "Rom med vindusrekke eller skråtak",
      "Kunder som vil ha varmen lavt i rommet",
    ],
    typicalUse:
      "Montert lavt på vegg, ofte som erstatning for en eksisterende varmekilde.",
    keyStrengths: [
      "Fleksibel plassering",
      "Varme nær gulvnivå",
      "Diskret i rom med lav takhøyde",
    ],
    placementNotes:
      "Fri luftvei foran enheten er en forutsetning, og vurderes på befaring.",
    imageKey: "toshiba-gulvmodell",
    imageAlt: "Toshiba gulvmodell innedel",
    imageStatus: "local_approved",
    sourceUrl: SRC.toGulv.url,
    sourceLabel: SRC.toGulv.label,
    lastReviewed: REVIEWED,
  },
  "Toshiba Multisplitt": {
    brand: "Toshiba",
    modelName: "Multisplitt",
    modelFamily: "Multisplitt",
    productType: "Multisplitt",
    shortPositioning:
      "Flere innedeler på samme utedel for bedre romdekning i bolig og mindre lokaler.",
    suitableFor: [
      "Boliger med flere rom som skal dekkes",
      "Cellekontorer og møterom",
      "Bygg med begrenset fasadeplass",
    ],
    typicalUse:
      "Brukt der ett anlegg ikke dekker nok av arealet, og flere soner skal ha varme.",
    keyStrengths: [
      "Flere innedeler fra én utedel",
      "Fleksibel soneinndeling",
      "Ryddigere fasade",
    ],
    imageKey: "toshiba-multisplitt",
    imageAlt: "Toshiba multisplitt utedel",
    imageStatus: "missing",
    sourceUrl: SRC.toMulti.url,
    sourceLabel: SRC.toMulti.label,
    lastReviewed: REVIEWED,
  },
  "Toshiba Multisplitt Nordic": {
    brand: "Toshiba",
    modelName: "Multi Nordic",
    modelFamily: "Multi Nordic",
    productType: "Multisplitt",
    shortPositioning:
      "Multimodellen tilpasset kaldt klima, der flere innedeler kan kombineres på én utedel.",
    suitableFor: [
      "Bygg i områder med kalde vintre",
      "Lokaler med flere rom og fast driftstid",
      "Boliger som skal ha varme i flere soner",
    ],
    typicalUse:
      "Valgt når multiløsning er riktig og anlegget også skal fungere godt i kulde.",
    keyStrengths: [
      "Nordisk tilpasset multiløsning",
      "Stabil drift i flere soner",
      "Færre utedeler på fasaden",
    ],
    coldClimateNote:
      "Nordic-serien er posisjonert av leverandøren for kaldt klima. Kapasitet settes etter befaring.",
    imageKey: "toshiba-multi-nordic",
    imageAlt: "Toshiba Multi Nordic utedel",
    imageStatus: "local_approved",
    sourceUrl: SRC.toMultiNordicOff.url,
    sourceLabel: SRC.toMultiNordicOff.label,
    lastReviewed: REVIEWED,
  },
  "Tekstiltrekk til Signatur": {
    brand: "Toshiba",
    modelName: "Tekstiltrekk til Signatur",
    modelFamily: "Signatur tilbehør",
    productType: "Tilbehør",
    shortPositioning:
      "Tilbehør som lar deg endre fronten på Toshiba Signatur uten å bytte anlegget.",
    suitableFor: [
      "Eiere av Toshiba Signatur",
      "Rom som pusses opp eller endrer farger",
      "Kunder som vil tilpasse uttrykket over tid",
    ],
    typicalUse: "Bestilles sammen med anlegget eller senere ved behov.",
    keyStrengths: [
      "Endrer uttrykket enkelt",
      "Beholder eksisterende installasjon",
      "Flere varianter tilgjengelig",
    ],
    designNotes: "Tilgjengelige varianter avklares ved bestilling.",
    imageKey: "toshiba-signatur-tekstil",
    imageAlt: "Tekstiltrekk til Toshiba Signatur",
    imageStatus: "missing",
    sourceUrl: SRC.toTekstil.url,
    sourceLabel: SRC.toTekstil.label,
    lastReviewed: REVIEWED,
  },

  /* ---------------- Merkeuavhengig ---------------- */
  "Større lokaler / flere soner": {
    modelName: "Større lokaler / flere soner",
    productType: "Næring",
    shortPositioning:
      "Prosjektert løsning på tvers av merker, satt sammen etter bygget sitt faktiske behov.",
    suitableFor: [
      "Større næringsbygg",
      "Lokaler med flere soner og ulik bruk",
      "Bygg med krav til driftssikkerhet",
    ],
    typicalUse:
      "Brukt der standardpakker ikke treffer, og kapasitet, soner og styring må settes sammen fra bunnen.",
    keyStrengths: [
      "Merkeuavhengig sammensetning",
      "Kapasitet tilpasset bygget",
      "Soneinndeling og styring vurderes samlet",
    ],
    imageStatus: "missing",
    lastReviewed: REVIEWED,
  },
};


/**
 * Locally stored gallery per primary image key. Cards use the `primary`
 * entry; the modal shows every entry that resolves to a local file.
 * All files live in src/assets/lier/products/<brand>/ — never hotlinked.
 */
export const PRODUCT_GALLERIES: Record<string, ProductImage[]> = {
  "mitsubishi-duo-modellen": [
    { key: "mitsubishi-duo-modellen", type: "primary", alt: "Mitsubishi Electric Duo-modellen – produktbilde", status: "local_approved" },
    { key: "mitsubishi-duo-modellen-detail", type: "detail", alt: "Mitsubishi Electric Duo-modellen – detalj", status: "local_approved" },
    { key: "mitsubishi-duo-modellen-lifestyle", type: "lifestyle", alt: "Mitsubishi Electric Duo-modellen – i bruk", status: "local_approved" },
  ],
  "mitsubishi-furo": [
    { key: "mitsubishi-furo", type: "primary", alt: "Mitsubishi Electric Furo – produktbilde", status: "local_approved" },
    { key: "mitsubishi-furo-indoor", type: "indoor", alt: "Mitsubishi Electric Furo – innedel", status: "local_approved" },
    { key: "mitsubishi-furo-detail", type: "detail", alt: "Mitsubishi Electric Furo – detalj", status: "local_approved" },
    { key: "mitsubishi-furo-lifestyle", type: "lifestyle", alt: "Mitsubishi Electric Furo – i bruk", status: "local_approved" },
  ],
  "mitsubishi-gussuri": [
    { key: "mitsubishi-gussuri", type: "primary", alt: "Mitsubishi Electric GUSSURI – produktbilde", status: "local_approved" },
    { key: "mitsubishi-gussuri-indoor", type: "indoor", alt: "Mitsubishi Electric GUSSURI – innedel", status: "local_approved" },
    { key: "mitsubishi-gussuri-outdoor", type: "outdoor", alt: "Mitsubishi Electric GUSSURI – utedel", status: "local_approved" },
    { key: "mitsubishi-gussuri-detail", type: "detail", alt: "Mitsubishi Electric GUSSURI – detalj", status: "local_approved" },
    { key: "mitsubishi-gussuri-lifestyle", type: "lifestyle", alt: "Mitsubishi Electric GUSSURI – i bruk", status: "local_approved" },
  ],
  "mitsubishi-iguru": [
    { key: "mitsubishi-iguru", type: "primary", alt: "Mitsubishi Electric IGURU – produktbilde", status: "local_approved" },
    { key: "mitsubishi-iguru-indoor", type: "indoor", alt: "Mitsubishi Electric IGURU – innedel", status: "local_approved" },
    { key: "mitsubishi-iguru-lifestyle", type: "lifestyle", alt: "Mitsubishi Electric IGURU – i bruk", status: "local_approved" },
  ],
  "mitsubishi-kaiteki": [
    { key: "mitsubishi-kaiteki", type: "primary", alt: "Mitsubishi Electric Kaiteki – produktbilde", status: "local_approved" },
    { key: "mitsubishi-kaiteki-indoor", type: "indoor", alt: "Mitsubishi Electric Kaiteki – innedel", status: "local_approved" },
    { key: "mitsubishi-kaiteki-variant", type: "variant", alt: "Mitsubishi Electric Kaiteki – variant", status: "local_approved" },
    { key: "mitsubishi-kaiteki-lifestyle", type: "lifestyle", alt: "Mitsubishi Electric Kaiteki – i bruk", status: "local_approved" },
  ],
  "mitsubishi-nordic-multi": [
    { key: "mitsubishi-nordic-multi", type: "primary", alt: "Mitsubishi Electric Nordic Multi – produktbilde", status: "local_approved" },
    { key: "mitsubishi-nordic-multi-lifestyle", type: "lifestyle", alt: "Mitsubishi Electric Nordic Multi – i bruk", status: "local_approved" },
  ],
  "mitsubishi-uwano-pure": [
    { key: "mitsubishi-uwano-pure", type: "primary", alt: "Mitsubishi Electric UWANO Pure – produktbilde", status: "local_approved" },
    { key: "mitsubishi-uwano-pure-indoor", type: "indoor", alt: "Mitsubishi Electric UWANO Pure – innedel", status: "local_approved" },
    { key: "mitsubishi-uwano-pure-outdoor", type: "outdoor", alt: "Mitsubishi Electric UWANO Pure – utedel", status: "local_approved" },
    { key: "mitsubishi-uwano-pure-detail", type: "detail", alt: "Mitsubishi Electric UWANO Pure – detalj", status: "local_approved" },
    { key: "mitsubishi-uwano-pure-lifestyle", type: "lifestyle", alt: "Mitsubishi Electric UWANO Pure – i bruk", status: "local_approved" },
  ],
  "mitsubishi-zen": [
    { key: "mitsubishi-zen", type: "primary", alt: "Mitsubishi Electric Zen – produktbilde", status: "local_approved" },
    { key: "mitsubishi-zen-indoor", type: "indoor", alt: "Mitsubishi Electric Zen – innedel", status: "local_approved" },
    { key: "mitsubishi-zen-outdoor", type: "outdoor", alt: "Mitsubishi Electric Zen – utedel", status: "local_approved" },
    { key: "mitsubishi-zen-variant", type: "variant", alt: "Mitsubishi Electric Zen – variant", status: "local_approved" },
    { key: "mitsubishi-zen-lifestyle", type: "lifestyle", alt: "Mitsubishi Electric Zen – i bruk", status: "local_approved" },
  ],
  "panasonic-cz": [
    { key: "panasonic-cz", type: "primary", alt: "Panasonic CZ – produktbilde", status: "local_approved" },
    { key: "panasonic-cz-indoor", type: "indoor", alt: "Panasonic CZ – innedel", status: "local_approved" },
  ],
  "panasonic-gulvmodell": [
    { key: "panasonic-gulvmodell", type: "primary", alt: "Panasonic Gulvmodell – produktbilde", status: "local_approved" },
    { key: "panasonic-gulvmodell-indoor", type: "indoor", alt: "Panasonic Gulvmodell – innedel", status: "local_approved" },
    { key: "panasonic-gulvmodell-outdoor", type: "outdoor", alt: "Panasonic Gulvmodell – utedel", status: "local_approved" },
    { key: "panasonic-gulvmodell-detail", type: "detail", alt: "Panasonic Gulvmodell – detalj", status: "local_approved" },
    { key: "panasonic-gulvmodell-variant", type: "variant", alt: "Panasonic Gulvmodell – variant", status: "local_approved" },
  ],
  "panasonic-hz-flagship": [
    { key: "panasonic-hz-flagship", type: "primary", alt: "Panasonic HZ Flagship – produktbilde", status: "local_approved" },
    { key: "panasonic-hz-flagship-indoor", type: "indoor", alt: "Panasonic HZ Flagship – innedel", status: "local_approved" },
    { key: "panasonic-hz-flagship-outdoor", type: "outdoor", alt: "Panasonic HZ Flagship – utedel", status: "local_approved" },
    { key: "panasonic-hz-flagship-variant", type: "variant", alt: "Panasonic HZ Flagship – variant", status: "local_approved" },
    { key: "panasonic-hz-flagship-lifestyle", type: "lifestyle", alt: "Panasonic HZ Flagship – i bruk", status: "local_approved" },
  ],
  "panasonic-lz-retro-fit": [
    { key: "panasonic-lz-retro-fit", type: "primary", alt: "Panasonic LZ – produktbilde", status: "local_approved" },
    { key: "panasonic-lz-retro-fit-indoor", type: "indoor", alt: "Panasonic LZ – innedel", status: "local_approved" },
    { key: "panasonic-lz-retro-fit-outdoor", type: "outdoor", alt: "Panasonic LZ – utedel", status: "local_approved" },
  ],
  "panasonic-nz-etherea": [
    { key: "panasonic-nz-etherea", type: "primary", alt: "Panasonic NZ Etherea – produktbilde", status: "local_approved" },
    { key: "panasonic-nz-etherea-indoor", type: "indoor", alt: "Panasonic NZ Etherea – innedel", status: "local_approved" },
    { key: "panasonic-nz-etherea-outdoor", type: "outdoor", alt: "Panasonic NZ Etherea – utedel", status: "local_approved" },
    { key: "panasonic-nz-etherea-variant", type: "variant", alt: "Panasonic NZ Etherea – variant", status: "local_approved" },
  ],
  "panasonic-vz-heatcharge": [
    { key: "panasonic-vz-heatcharge", type: "primary", alt: "Panasonic VZ Heatcharge – produktbilde", status: "local_approved" },
    { key: "panasonic-vz-heatcharge-indoor", type: "indoor", alt: "Panasonic VZ Heatcharge – innedel", status: "local_approved" },
    { key: "panasonic-vz-heatcharge-outdoor", type: "outdoor", alt: "Panasonic VZ Heatcharge – utedel", status: "local_approved" },
  ],
  "toshiba-daiseikai-10-ask": [
    { key: "toshiba-daiseikai-10-ask", type: "primary", alt: "Toshiba Daiseikai 10 Ask – produktbilde", status: "local_approved" },
    { key: "toshiba-daiseikai-10-ask-variant", type: "variant", alt: "Toshiba Daiseikai 10 Ask – variant", status: "local_approved" },
    { key: "toshiba-daiseikai-10-ask-lifestyle", type: "lifestyle", alt: "Toshiba Daiseikai 10 Ask – i bruk", status: "local_approved" },
  ],
  "toshiba-daiseikai-10-kontur": [
    { key: "toshiba-daiseikai-10-kontur", type: "primary", alt: "Toshiba Daiseikai 10 Kontur – produktbilde", status: "local_approved" },
    { key: "toshiba-daiseikai-10-kontur-detail", type: "detail", alt: "Toshiba Daiseikai 10 Kontur – detalj", status: "local_approved" },
    { key: "toshiba-daiseikai-10-kontur-lifestyle", type: "lifestyle", alt: "Toshiba Daiseikai 10 Kontur – i bruk", status: "local_approved" },
  ],
  "toshiba-gulvmodell": [
    { key: "toshiba-gulvmodell", type: "primary", alt: "Toshiba Gulvmodell – produktbilde", status: "local_approved" },
    { key: "toshiba-gulvmodell-detail", type: "detail", alt: "Toshiba Gulvmodell – detalj", status: "local_approved" },
    { key: "toshiba-gulvmodell-lifestyle", type: "lifestyle", alt: "Toshiba Gulvmodell – i bruk", status: "local_approved" },
  ],
  "toshiba-multi-nordic": [
    { key: "toshiba-multi-nordic", type: "primary", alt: "Toshiba Multi Nordic – produktbilde", status: "local_approved" },
    { key: "toshiba-multi-nordic-lifestyle", type: "lifestyle", alt: "Toshiba Multi Nordic – i bruk", status: "local_approved" },
  ],
  "toshiba-polar": [
    { key: "toshiba-polar", type: "primary", alt: "Toshiba Polar – produktbilde", status: "local_approved" },
    { key: "toshiba-polar-indoor", type: "indoor", alt: "Toshiba Polar – innedel", status: "local_approved" },
    { key: "toshiba-polar-detail", type: "detail", alt: "Toshiba Polar – detalj", status: "local_approved" },
    { key: "toshiba-polar-lifestyle", type: "lifestyle", alt: "Toshiba Polar – i bruk", status: "local_approved" },
  ],
  "toshiba-seiya-nordic": [
    { key: "toshiba-seiya-nordic", type: "primary", alt: "Toshiba Seiya Nordic – produktbilde", status: "local_approved" },
    { key: "toshiba-seiya-nordic-indoor", type: "indoor", alt: "Toshiba Seiya Nordic – innedel", status: "local_approved" },
    { key: "toshiba-seiya-nordic-detail", type: "detail", alt: "Toshiba Seiya Nordic – detalj", status: "local_approved" },
    { key: "toshiba-seiya-nordic-lifestyle", type: "lifestyle", alt: "Toshiba Seiya Nordic – i bruk", status: "local_approved" },
  ],
  "toshiba-signatur": [
    { key: "toshiba-signatur", type: "primary", alt: "Toshiba Signatur – produktbilde", status: "local_approved" },
    { key: "toshiba-signatur-detail", type: "detail", alt: "Toshiba Signatur – detalj", status: "local_approved" },
    { key: "toshiba-signatur-variant", type: "variant", alt: "Toshiba Signatur – variant", status: "local_approved" },
    { key: "toshiba-signatur-lifestyle", type: "lifestyle", alt: "Toshiba Signatur – i bruk", status: "local_approved" },
  ],
};

export function productDetailsFor(name: string): ProductDetails | null {
  const raw = PRODUCT_DETAILS[name];
  if (!raw) return null;
  const gallery =
    raw.images ?? (raw.imageKey ? PRODUCT_GALLERIES[raw.imageKey] : undefined);
  const base: ProductDetails = gallery ? { ...raw, images: gallery } : raw;
  const spec = productSpecsFor(name);
  if (!spec) return base;
  return {
    ...base,
    specVariants: spec.variants,
    specs: spec.specs,
    specBasis: spec.specBasis,
    guidanceNote: spec.guidanceNote,
    specSourceUrl: spec.specSourceUrl,
    specSourceLabel: spec.specSourceLabel,
    specLastReviewed: spec.specLastReviewed,
  };
}

