import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Check,
  ArrowRight,
  Building2,
  Home as HomeIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useBrandLogos, BRAND_LOGO_CLASS } from "./useBrandLogos";
import { productImageFor } from "./useProductImages";
import { HeatPumpIllustration } from "./HeatPumpIllustration";


export type BrandName = "Mitsubishi Electric" | "Panasonic" | "Toshiba";
export type Segment = "bolig" | "naering";
export type ProductType =
  | "Luft-luft"
  | "Gulvmodell"
  | "Multisplitt"
  | "Luft-vann"
  | "Næring"
  | "Tilbehør";

export type ProductItem = {
  /** Omitted for merkeuavhengige løsningskort. */
  brand?: BrandName;
  /** Product/series name or supplier category name. */
  name: string;
  subtitle: string;
  /** Shown on the card as product identity, e.g. "Luft-luft". */
  productType?: ProductType;
  description: string;
  tags: string[];
  bestFor: string[];
  sourceUrl?: string;
  /** Optional local asset slot — never hotlink supplier images. */
  image?: string | null;
};

export type ProductGroup = {
  id: string;
  segment: Segment;
  title: string;
  description: string;
  items: ProductItem[];
};


const MEE = "https://mee.no/privat/produktkategori/luft-luft-varmepumper/";
const PA = {
  best: "https://www.varmepumpeservice.no/panasonic-bestselgere",
  multi: "https://www.varmepumpeservice.no/panasonic-multisplitt-med-innedeler",
  multiNordic:
    "https://www.varmepumpeservice.no/panasonic-multisplitt-nordisk-med-innedeler",
  vann: "https://www.varmepumpeservice.no/panasonic-luft-vann",
  naering: "https://www.varmepumpeservice.no/panasonic-naering",
};
const TO = {
  best: "https://www.varmepumpeservice.no/toshiba-bestselgere",
  tekstil: "https://www.varmepumpeservice.no/tekstiltrekk-til-toshiba-signatur",
  multi: "https://www.varmepumpeservice.no/toshiba-multisplitt",
  multiNordic: "https://www.varmepumpeservice.no/toshiba-multisplitt-nordic",
};

/** Internal reference only — never rendered or linked publicly. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const BRAND_SOURCE: Record<BrandName, string> = {
  "Mitsubishi Electric": MEE,
  Panasonic: "https://www.varmepumpeservice.no/panasonic?parent=10005",
  Toshiba: "https://www.varmepumpeservice.no/toshiba?parent=10005",
};


function illustrationVariant(type?: ProductType) {
  switch (type) {
    case "Gulvmodell":
      return "floor" as const;
    case "Multisplitt":
      return "multi" as const;
    case "Luft-vann":
      return "water" as const;
    case "Næring":
      return "commercial" as const;
    default:
      return "wall" as const;
  }
}

const GROUPS: ProductGroup[] = [
  /* ---------------- BOLIG ---------------- */
  {
    id: "anbefalt-bolig",
    segment: "bolig",
    title: "Anbefalte modeller",
    description:
      "Modellene vi oftest anbefaler i norske boliger — fra Mitsubishi Electric, Panasonic og Toshiba.",
    items: [
      {
        brand: "Mitsubishi Electric",
        name: "UWANO Pure",
        subtitle: "Toppmodell",
        productType: "Luft-luft",
        description: "Toppmodell for høy komfort og sterk ytelse gjennom hele året.",
        tags: ["Toppmodell", "Premium", "Luft-luft"],
        bestFor: ["Høy komfort", "Sterk ytelse", "Større oppholdsrom"],
        sourceUrl: MEE,
      },
      {
        brand: "Mitsubishi Electric",
        name: "Kaiteki",
        subtitle: "Bestselger",
        productType: "Luft-luft",
        description: "Populær modell med design, ytelse og flere fargevalg.",
        tags: ["Bestselger", "Design", "Luft-luft"],
        bestFor: ["Normal bolig", "Design og fargevalg", "God totalpakke"],
        sourceUrl: MEE,
      },
      {
        brand: "Mitsubishi Electric",
        name: "GUSSURI",
        subtitle: "Komfortmodell",
        productType: "Luft-luft",
        description: "Komfortmodell for jevn varme og lavt lydnivå.",
        tags: ["Komfort", "Stillegående", "Luft-luft"],
        bestFor: ["Jevn varme", "Lavt lydnivå", "Stue og soverom"],
        sourceUrl: MEE,
      },
      {
        brand: "Mitsubishi Electric",
        name: "Nordic Multi",
        subtitle: "Multiløsning",
        productType: "Multisplitt",
        description:
          "Flere innedeler på samme utedel for bedre dekning i større boliger.",
        tags: ["Multisplitt", "Flere innedeler", "Større bolig"],
        bestFor: ["Flere rom", "Større bolig", "Høyere dekningsgrad"],
        sourceUrl: MEE,
      },
      {
        brand: "Panasonic",
        name: "Panasonic HZ Flagship",
        subtitle: "Toppserie",
        productType: "Luft-luft",
        description: "Toppserie med nanoe X-teknologi og høy varmeeffekt.",
        tags: ["Toppmodell", "nanoe X", "Luft-luft"],
        bestFor: ["Høy komfort", "Moderne bolig", "God varmeeffekt"],
        sourceUrl: PA.best,
      },
      {
        brand: "Panasonic",
        name: "Panasonic NZ",
        subtitle: "Pris og ytelse",
        productType: "Luft-luft",
        description:
          "Mye av funksjonaliteten fra toppmodellene til lavere prisnivå.",
        tags: ["Pris/ytelse", "Smart valg", "Luft-luft"],
        bestFor: ["Normal bolig", "God ytelse", "Fornuftig investering"],
        sourceUrl: PA.best,
      },
      {
        brand: "Panasonic",
        name: "Panasonic VZ Heatcharge",
        subtitle: "Kraftig premiummodell",
        productType: "Luft-luft",
        description: "Heatcharge-teknologi for stabil varme i kalde perioder.",
        tags: ["Heatcharge", "Kraftig", "Premium"],
        bestFor: ["Høyt varmebehov", "Kaldt klima", "Premiumløsning"],
        sourceUrl: PA.best,
      },
      {
        brand: "Panasonic",
        name: "Panasonic Gulvmodell",
        subtitle: "Gulvmodell",
        productType: "Gulvmodell",
        description:
          "Lav plassering på vegg der veggplassen er begrenset eller planløsningen krever det.",
        tags: ["Gulvmodell", "Komfort", "Luft-luft"],
        bestFor: ["Lav plassering", "Begrenset veggplass", "Eldre bolig"],
        sourceUrl: PA.best,
      },
      {
        brand: "Toshiba",
        name: "Toshiba Signatur",
        subtitle: "Designmodell",
        productType: "Luft-luft",
        description:
          "Designmodell med energismarte funksjoner og utskiftbar tekstilfront.",
        tags: ["Design", "Tekstilfront", "Luft-luft"],
        bestFor: ["Designbevisste hjem", "Synlig plassering", "Moderne interiør"],
        sourceUrl: TO.best,
      },
      {
        brand: "Toshiba",
        name: "Toshiba Daiseikai 10 Kontur",
        subtitle: "Toppmodell",
        productType: "Luft-luft",
        description: "Toppmodell med kraftig varmeeffekt og avansert teknologi.",
        tags: ["Toppmodell", "Kraftig", "Luft-luft"],
        bestFor: ["Høy komfort", "Kaldt klima", "Høyt varmebehov"],
        sourceUrl: TO.best,
      },
      {
        brand: "Toshiba",
        name: "Toshiba Polar",
        subtitle: "For kaldt klima",
        productType: "Luft-luft",
        description: "Kraftig varmepumpe med høy energiklasse, tilpasset kaldt klima.",
        tags: ["Kaldt klima", "Kraftig", "Luft-luft"],
        bestFor: ["Nordiske forhold", "Enebolig", "Høy varmeeffekt"],
        sourceUrl: TO.best,
      },
      {
        brand: "Toshiba",
        name: "Toshiba Gulvmodell",
        subtitle: "Gulvmodell",
        productType: "Gulvmodell",
        description: "Gulvmodell for alternative plasseringer og eldre boliger.",
        tags: ["Gulvmodell", "Komfort", "Luft-luft"],
        bestFor: ["Lav plassering", "Spesielle planløsninger", "Eldre bolig"],
        sourceUrl: TO.best,
      },
    ],
  },
  {
    id: "luft-luft",

    segment: "bolig",
    title: "Luft-luft varmepumper",
    description:
      "Den vanligste løsningen i norske boliger — god varme i hovedoppholdsrommet og lavere strømforbruk.",
    items: [
      {
        brand: "Mitsubishi Electric",
        name: "UWANO Pure",
        subtitle: "Toppmodell",
        description: "Toppmodell for høy komfort og sterk ytelse.",
        tags: ["Toppmodell", "Premium", "Luft-luft"],
        bestFor: ["Høy komfort", "Sterk ytelse", "Større oppholdsrom"],
        sourceUrl: MEE,
      },
      {
        brand: "Mitsubishi Electric",
        name: "Kaiteki",
        subtitle: "Bestselger",
        description: "Populær modell med design, ytelse og flere fargevalg.",
        tags: ["Bestselger", "Design", "Luft-luft"],
        bestFor: ["Normal bolig", "Design og fargevalg", "God totalpakke"],
        sourceUrl: MEE,
      },
      {
        brand: "Mitsubishi Electric",
        name: "GUSSURI",
        subtitle: "Komfortmodell",
        description: "Komfortmodell for jevn varme og god innekomfort.",
        tags: ["Komfort", "Stillegående", "Luft-luft"],
        bestFor: ["Jevn varme", "Lavt lydnivå", "Stue og soverom"],
        sourceUrl: MEE,
      },
      {
        brand: "Panasonic",
        name: "Panasonic HZ Flagship",
        subtitle: "Toppserie",
        description: "Toppserie med nanoe X-teknologi og høy varmeeffekt.",
        tags: ["Toppmodell", "nanoe X", "Luft-luft"],
        bestFor: ["Høy komfort", "Moderne bolig", "God varmeeffekt"],
        sourceUrl: PA.best,
      },
      {
        brand: "Panasonic",
        name: "Panasonic NZ",
        subtitle: "Pris og ytelse",
        description: "Mye av funksjonaliteten fra toppmodellene til lavere prisnivå.",
        tags: ["Pris/ytelse", "Smart valg", "Luft-luft"],
        bestFor: ["Normal bolig", "God ytelse", "Fornuftig investering"],
        sourceUrl: PA.best,
      },
      {
        brand: "Panasonic",
        name: "Panasonic VZ Heatcharge",
        subtitle: "Kraftig premiummodell",
        description: "Kraftig modell med Heatcharge-teknologi for høyt varmebehov.",
        tags: ["Heatcharge", "Kraftig", "Premium"],
        bestFor: ["Høyt varmebehov", "Kaldt klima", "Premiumløsning"],
        sourceUrl: PA.best,
      },
      {
        brand: "Panasonic",
        name: "Panasonic CZ",
        subtitle: "Kompakt veggmodell",
        description:
          "Kompakt veggmodell med innebygd WiFi, egnet der plassen er begrenset.",
        tags: ["Kompakt", "WiFi", "Luft-luft"],
        bestFor: ["Mindre rom", "Begrenset plass", "Enkel styring"],
        sourceUrl: PA.best,
      },
      {
        brand: "Panasonic",
        name: "Panasonic LZ",
        subtitle: "Utskiftingsmodell",
        description: "Godt egnet som utskiftingspumpe.",
        tags: ["Utskifting", "Luft-luft"],
        bestFor: ["Erstatte gammel varmepumpe", "Eksisterende plassering"],
        sourceUrl: PA.best,
      },
      {
        brand: "Toshiba",
        name: "Toshiba Daiseikai 10 Kontur",
        subtitle: "Toppmodell",
        description: "Toppmodell med kraftig varmeeffekt og avansert teknologi.",
        tags: ["Toppmodell", "Kraftig", "Luft-luft"],
        bestFor: ["Høy komfort", "Kaldt klima", "Høyt varmebehov"],
        sourceUrl: TO.best,
      },
      {
        brand: "Toshiba",
        name: "Toshiba Polar",
        subtitle: "For kaldt klima",
        description: "Kraftig varmepumpe med høy energiklasse, tilpasset kaldt klima.",
        tags: ["Kaldt klima", "Kraftig", "Luft-luft"],
        bestFor: ["Nordiske forhold", "Enebolig", "Høy varmeeffekt"],
        sourceUrl: TO.best,
      },
      {
        brand: "Toshiba",
        name: "Toshiba Seiya",
        subtitle: "Nordisk budsjettmodell",
        description: "Nordisk budsjettmodell med smarte funksjoner.",
        tags: ["Budsjett", "Nordisk", "Luft-luft"],
        bestFor: ["Prisbevisste kunder", "Mindre bolig", "Enkel komfort"],
        sourceUrl: TO.best,
      },
    ],
  },
  {
    id: "design",
    segment: "bolig",
    title: "Designmodeller",
    description:
      "For boliger der innedelen er synlig og skal passe inn i interiøret.",
    items: [
      {
        brand: "Mitsubishi Electric",
        name: "Zen",
        subtitle: "Designmodell",
        description:
          "Designmodell for boliger der utseende og interiørtilpasning betyr mye.",
        tags: ["Design", "Diskret", "Luft-luft"],
        bestFor: ["Synlig plassering", "Moderne interiør", "Designbevisste hjem"],
        sourceUrl: MEE,
      },
      {
        brand: "Mitsubishi Electric",
        name: "IGURU",
        subtitle: "Kompaktmodell",
        description: "Kompakt modell der plass og diskret montering er viktig.",
        tags: ["Kompakt", "Diskret", "Luft-luft"],
        bestFor: ["Begrenset veggplass", "Mindre rom", "Diskret montering"],
        sourceUrl: MEE,
      },
      {
        brand: "Toshiba",
        name: "Toshiba Signatur",
        subtitle: "Designmodell",
        description:
          "Designmodell med energismarte funksjoner og utskiftbar tekstilfront.",
        tags: ["Design", "Tekstilfront", "Luft-luft"],
        bestFor: ["Designbevisste hjem", "Synlig plassering", "Moderne interiør"],
        sourceUrl: TO.best,
      },
      {
        brand: "Toshiba",
        name: "Toshiba Daiseikai 10 Ask",
        subtitle: "Toppmodell, dempet design",
        description: "Toppmodell med avansert teknologi og dempet designuttrykk.",
        tags: ["Toppmodell", "Design", "Komfort"],
        bestFor: ["Premium komfort", "Design", "Større oppholdsrom"],
        sourceUrl: TO.best,
      },
      {
        brand: "Toshiba",
        name: "Tekstiltrekk til Signatur",
        subtitle: "Tilbehør",
        description: "Tilbehør for å tilpasse Toshiba Signatur til interiøret.",
        tags: ["Tilbehør", "Design", "Tekstilfront"],
        bestFor: ["Interiørtilpasning", "Synlig plassering"],
        sourceUrl: TO.tekstil,
      },
    ],
  },
  {
    id: "gulv",
    segment: "bolig",
    title: "Gulvmodeller",
    description:
      "Lav plassering på vegg. Ofte et godt valg i eldre boliger og spesielle planløsninger.",
    items: [
      {
        brand: "Mitsubishi Electric",
        name: "Furo",
        subtitle: "Gulvmodell",
        description:
          "Gulvmodell for plassering lavt på vegg, godt egnet i enkelte planløsninger.",
        tags: ["Gulvmodell", "Komfort", "Luft-luft"],
        bestFor: ["Lav plassering", "Eldre bolig", "Spesielle planløsninger"],
        sourceUrl: MEE,
      },
      {
        brand: "Panasonic",
        name: "Panasonic Gulvmodell",
        subtitle: "Gulvmodell",
        description:
          "Gulvmodell for alternative plasseringer og boliger der veggplass er utfordrende.",
        tags: ["Gulvmodell", "Komfort", "Luft-luft"],
        bestFor: ["Lav plassering", "Begrenset veggplass", "Eldre bolig"],
        sourceUrl: PA.best,
      },
      {
        brand: "Toshiba",
        name: "Toshiba Gulvmodell",
        subtitle: "Gulvmodell",
        description: "Gulvmodell for alternative plasseringer.",
        tags: ["Gulvmodell", "Komfort", "Luft-luft"],
        bestFor: ["Lav plassering", "Spesielle planløsninger", "Eldre bolig"],
        sourceUrl: TO.best,
      },
    ],
  },
  {
    id: "multi-bolig",
    segment: "bolig",
    title: "Multisplitt / flere innedeler",
    description:
      "Flere innedeler på samme utedel gir varme i flere rom og høyere dekningsgrad i større boliger.",
    items: [
      {
        brand: "Mitsubishi Electric",
        name: "Nordic Multi",
        subtitle: "Multimodell",
        description:
          "Multiløsning for flere innedeler og bedre dekning i større boliger.",
        tags: ["Multi", "Flere innedeler", "Større bolig"],
        bestFor: ["Flere rom", "Større bolig", "Høyere dekningsgrad"],
        sourceUrl: MEE,
      },
      {
        brand: "Mitsubishi Electric",
        name: "Duo-modellen",
        subtitle: "To soner",
        description: "Løsning for flere soner eller større dekningsbehov.",
        tags: ["Duo", "Flere soner", "Luft-luft"],
        bestFor: ["To soner", "Større dekningsbehov", "Åpen planløsning"],
        sourceUrl: MEE,
      },
      {
        brand: "Panasonic",
        name: "Multisplitt med innedeler",
        subtitle: "Kategori",
        description:
          "Flere innedeler koblet til samme utedel for bedre dekning i flere rom.",
        tags: ["Multisplitt", "Flere innedeler"],
        bestFor: ["Flere rom", "Bolig over flere plan", "Jevnere varme"],
        sourceUrl: PA.multi,
      },
      {
        brand: "Panasonic",
        name: "Multisplitt nordisk",
        subtitle: "Kategori",
        description: "Multisplitt tilpasset nordiske forhold.",
        tags: ["Multisplitt", "Nordisk"],
        bestFor: ["Kaldt klima", "Flere rom", "Helårsdrift"],
        sourceUrl: PA.multiNordic,
      },
      {
        brand: "Toshiba",
        name: "Toshiba Multisplitt",
        subtitle: "Kategori",
        description: "Flere innedeler for bedre romdekning.",
        tags: ["Multisplitt", "Flere innedeler"],
        bestFor: ["Flere rom", "Større bolig", "Jevnere varme"],
        sourceUrl: TO.multi,
      },
      {
        brand: "Toshiba",
        name: "Toshiba Multisplitt Nordic",
        subtitle: "Kategori",
        description: "Multisplitt tilpasset nordiske forhold.",
        tags: ["Multisplitt", "Nordisk"],
        bestFor: ["Kaldt klima", "Flere rom", "Helårsdrift"],
        sourceUrl: TO.multiNordic,
      },
    ],
  },
  {
    id: "luft-vann-bolig",
    segment: "bolig",
    title: "Luft-vann",
    description:
      "For boliger med vannbåren varme — gulvvarme, radiatorer og ofte høyere dekningsgrad.",
    items: [
      {
        brand: "Panasonic",
        name: "Panasonic Luft/vann",
        subtitle: "Kategori",
        description:
          "Luft-vann-løsninger for vannbåren varme og høyere dekningsgrad.",
        tags: ["Luft-vann", "Vannbåren varme"],
        bestFor: ["Gulvvarme", "Radiatorer", "Høy dekningsgrad"],
        sourceUrl: PA.vann,
      },
    ],
  },

  /* ---------------- NÆRING ---------------- */
  {
    id: "anbefalt-naering",
    segment: "naering",
    title: "Anbefalte løsninger",
    description:
      "Løsningene vi oftest anbefaler i næringsbygg — fra kontor og butikk til flere soner og vannbåren varme.",
    items: [
      {
        brand: "Panasonic",
        name: "Panasonic Næring",
        subtitle: "Næringsserier",
        productType: "Næring",
        description:
          "Serier for næringsbygg, kontor, butikk og tekniske rom med krav til stabil drift.",
        tags: ["Næring", "Kontor", "Butikk"],
        bestFor: ["Kontorlokaler", "Butikk", "Publikumsareal"],
        sourceUrl: PA.naering,
      },
      {
        brand: "Panasonic",
        name: "Panasonic Luft/vann",
        subtitle: "Vannbåren varme",
        productType: "Luft-vann",
        description:
          "Luft-vann for bygg med vannbåren varme og høy dekningsgrad gjennom året.",
        tags: ["Luft-vann", "Vannbåren varme"],
        bestFor: ["Gulvvarme", "Radiatorer", "Driftsøkonomi"],
        sourceUrl: PA.vann,
      },
      {
        brand: "Panasonic",
        name: "Panasonic Multisplitt nordisk",
        subtitle: "Flere soner",
        productType: "Multisplitt",
        description:
          "Multisplitt tilpasset nordiske forhold, med flere innedeler på samme utedel.",
        tags: ["Multisplitt", "Nordisk", "Soner"],
        bestFor: ["Kaldt klima", "Flere rom", "Helårsdrift"],
        sourceUrl: PA.multiNordic,
      },
      {
        brand: "Toshiba",
        name: "Toshiba Multisplitt Nordic",
        subtitle: "Flere soner",
        productType: "Multisplitt",
        description:
          "Multisplitt for nordiske forhold og lokaler med flere rom som skal dekkes.",
        tags: ["Multisplitt", "Nordisk"],
        bestFor: ["Cellekontorer", "Møterom", "Stabil drift"],
        sourceUrl: TO.multiNordic,
      },
      {
        brand: "Mitsubishi Electric",
        name: "Nordic Multi",
        subtitle: "Multiløsning",
        productType: "Multisplitt",
        description:
          "Flere innedeler fra samme utedel — plassbesparende og fleksibel soneinndeling.",
        tags: ["Multisplitt", "Flere innedeler"],
        bestFor: ["Mindre næringslokaler", "Flere soner", "Jevn temperatur"],
        sourceUrl: MEE,
      },
      {
        name: "Større lokaler / flere soner",
        subtitle: "Prosjektert løsning",
        productType: "Næring",
        description:
          "For større bygg setter vi sammen en løsning med riktig kapasitet, soneinndeling og styring — på tvers av merker.",
        tags: ["Prosjektering", "Kapasitet", "Flere soner"],
        bestFor: ["Store lokaler", "Høyt varmebehov", "Krav til driftssikkerhet"],
      },
    ],
  },
  {
    id: "kontor-butikk",

    segment: "naering",
    title: "Kontor og butikk",
    description:
      "Jevn temperatur i publikumsareal og kontorlandskap, med lavt lydnivå og enkel styring.",
    items: [
      {
        brand: "Panasonic",
        name: "Panasonic Næring",
        subtitle: "Næringsserier",
        description:
          "Løsninger for næringsbygg, tekniske rom, kontor og større installasjoner.",
        tags: ["Næring", "Kontor", "Butikk"],
        bestFor: ["Kontorlokaler", "Butikk", "Publikumsareal"],
        sourceUrl: PA.naering,
      },
      {
        brand: "Toshiba",
        name: "Toshiba Multisplitt",
        subtitle: "Flere soner",
        description: "Flere innedeler for bedre dekning i lokaler med flere rom.",
        tags: ["Multisplitt", "Flere soner"],
        bestFor: ["Cellekontorer", "Møterom", "Butikklokaler"],
        sourceUrl: TO.multi,
      },
      {
        brand: "Mitsubishi Electric",
        name: "Nordic Multi",
        subtitle: "Multiløsning",
        description: "Multiløsning for flere innedeler og bedre dekning i flere soner.",
        tags: ["Multi", "Flere innedeler"],
        bestFor: ["Mindre næringslokaler", "Flere soner", "Jevn temperatur"],
        sourceUrl: MEE,
      },
    ],
  },
  {
    id: "storre-lokaler",
    segment: "naering",
    title: "Større lokaler",
    description:
      "Høyt varmebehov, store volumer og krav til stabil drift gjennom hele året.",
    items: [
      {
        brand: "Panasonic",
        name: "Panasonic Næring",
        subtitle: "Større installasjoner",
        description:
          "Næringsserier for større installasjoner og bygg med høyere kapasitetsbehov.",
        tags: ["Næring", "Kapasitet", "Drift"],
        bestFor: ["Store lokaler", "Høyt varmebehov", "Helårsdrift"],
        sourceUrl: PA.naering,
      },
      {
        brand: "Panasonic",
        name: "Panasonic VZ Heatcharge",
        subtitle: "Kraftig modell",
        description: "Kraftig modell med Heatcharge-teknologi for høyt varmebehov.",
        tags: ["Heatcharge", "Kraftig", "Premium"],
        bestFor: ["Høyt varmebehov", "Kaldt klima", "Krevende lokaler"],
        sourceUrl: PA.best,
      },
      {
        brand: "Toshiba",
        name: "Toshiba Polar",
        subtitle: "For kaldt klima",
        description: "Kraftig varmepumpe med høy energiklasse, tilpasset kaldt klima.",
        tags: ["Kaldt klima", "Kraftig"],
        bestFor: ["Nordiske forhold", "Høy varmeeffekt", "Stabil drift"],
        sourceUrl: TO.best,
      },
    ],
  },
  {
    id: "tekniske-rom",
    segment: "naering",
    title: "Tekniske rom og drift",
    description:
      "Kjøling og temperaturkontroll i serverrom, tekniske rom og arealer med jevn varmelast.",
    items: [
      {
        brand: "Panasonic",
        name: "Panasonic Næring",
        subtitle: "Tekniske rom",
        description:
          "Næringsløsninger for tekniske rom og installasjoner med behov for stabil temperatur.",
        tags: ["Teknisk rom", "Drift", "Næring"],
        bestFor: ["Serverrom", "Tekniske rom", "Jevn temperatur"],
        sourceUrl: PA.naering,
      },
      {
        brand: "Mitsubishi Electric",
        name: "Nordic Multi",
        subtitle: "Flere soner",
        description: "Multiløsning der flere rom skal dekkes fra samme utedel.",
        tags: ["Multi", "Drift"],
        bestFor: ["Flere tekniske soner", "Plassbesparende utedel"],
        sourceUrl: MEE,
      },
    ],
  },
  {
    id: "multi-naering",
    segment: "naering",
    title: "Multisplitt",
    description:
      "Flere innedeler på samme utedel gir fleksibel soneinndeling og færre utedeler på fasaden.",
    items: [
      {
        brand: "Panasonic",
        name: "Multisplitt med innedeler",
        subtitle: "Kategori",
        description:
          "Flere innedeler koblet til samme utedel for bedre dekning i flere rom.",
        tags: ["Multisplitt", "Soner"],
        bestFor: ["Flere rom", "Fleksibel soneinndeling"],
        sourceUrl: PA.multi,
      },
      {
        brand: "Panasonic",
        name: "Multisplitt nordisk",
        subtitle: "Kategori",
        description: "Multisplitt tilpasset nordiske forhold.",
        tags: ["Multisplitt", "Nordisk"],
        bestFor: ["Kaldt klima", "Helårsdrift", "Flere soner"],
        sourceUrl: PA.multiNordic,
      },
      {
        brand: "Toshiba",
        name: "Toshiba Multisplitt Nordic",
        subtitle: "Kategori",
        description: "Multisplitt tilpasset nordiske forhold.",
        tags: ["Multisplitt", "Nordisk"],
        bestFor: ["Kaldt klima", "Flere soner", "Stabil drift"],
        sourceUrl: TO.multiNordic,
      },
    ],
  },
  {
    id: "luft-vann-naering",
    segment: "naering",
    title: "Luft-vann",
    description:
      "For bygg med vannbåren varme, der varmepumpen kan dekke en stor del av oppvarmingsbehovet.",
    items: [
      {
        brand: "Panasonic",
        name: "Panasonic Luft/vann",
        subtitle: "Kategori",
        description:
          "Luft-vann-løsninger for vannbåren varme og høyere dekningsgrad.",
        tags: ["Luft-vann", "Vannbåren varme"],
        bestFor: ["Vannbåren varme", "Høy dekningsgrad", "Driftsøkonomi"],
        sourceUrl: PA.vann,
      },
    ],
  },
  {
    id: "profesjonelle",
    segment: "naering",
    title: "Næringsserier og profesjonelle løsninger",
    description:
      "Profesjonelle serier for bygg med krav til kapasitet, styring og driftssikkerhet.",
    items: [
      {
        brand: "Panasonic",
        name: "Panasonic Næring",
        subtitle: "Profesjonelle serier",
        description:
          "Løsninger for næringsbygg, tekniske rom, kontor og større installasjoner.",
        tags: ["Næring", "Profesjonell", "Drift"],
        bestFor: ["Næringsbygg", "Driftssikkerhet", "Større installasjoner"],
        sourceUrl: PA.naering,
      },
    ],
  },
];

const SEGMENT_LABEL: Record<Segment, string> = { bolig: "Bolig", naering: "Næring" };
const SEGMENT_ICON: Record<Segment, typeof HomeIcon> = {
  bolig: HomeIcon,
  naering: Building2,
};
const ALL_BRANDS = "Alle merker";

function ProductCard({
  item,
  logo,
  onOpen,
}: {
  item: ProductItem;
  logo: string | null;
  onOpen: () => void;
}) {

  const photo = item.image ?? productImageFor(item.name);
  return (
    <article className="bg-white rounded-xl border border-[hsl(var(--warm-beige))] p-5 flex flex-col">
      <div className="h-10 flex items-center mb-4">
        {item.brand && logo ? (
          <img
            src={logo}
            alt={`${item.brand} logo`}
            loading="lazy"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
            className={`w-auto object-contain ${BRAND_LOGO_CLASS[item.brand] ?? "max-h-10 max-w-[180px]"}`}
          />
        ) : (
          <span className="text-[13px] font-semibold tracking-[0.14em] uppercase text-[hsl(var(--mcs-navy))]">
            {item.brand ?? "Løsning"}
          </span>
        )}
      </div>

      <div className="rounded-lg overflow-hidden mb-4 border border-[hsl(var(--warm-beige))]">
        {photo ? (
          <img
            src={photo}
            alt={`${item.name} varmepumpe`}
            loading="lazy"
            className="aspect-[4/3] w-full object-contain bg-white"
          />
        ) : (
          <HeatPumpIllustration
            variant={illustrationVariant(item.productType)}
            label={`Illustrasjon · ${item.productType ?? item.subtitle}`}
          />
        )}

      </div>

      <h4 className="text-base font-bold text-[hsl(var(--mcs-navy))] leading-tight">
        {item.name}
      </h4>
      <div className="flex flex-wrap items-center gap-2 mt-1.5 mb-2">
        {item.productType && (
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--mcs-orange))] border border-[hsl(var(--mcs-orange))]/30 rounded-full px-2 py-0.5">
            {item.productType}
          </span>
        )}
        <span className="text-[11px] uppercase tracking-wider text-[hsl(var(--mcs-muted))]">
          {item.subtitle}
        </span>
      </div>
      <p className="text-sm text-[hsl(var(--mcs-muted))] leading-relaxed mb-4">
        {item.description}
      </p>


      <div className="flex flex-wrap gap-1.5 mb-4">
        {item.tags.map((t) => (
          <span
            key={t}
            className="text-xs font-medium text-[hsl(var(--mcs-navy))] bg-[hsl(var(--warm-sand))] rounded-full px-2.5 py-1"
          >
            {t}
          </span>
        ))}
      </div>

      <div className="mb-5 flex-1">
        <p className="text-[11px] uppercase tracking-wider text-[hsl(var(--mcs-muted))] mb-2">
          Passer for
        </p>
        <ul className="space-y-1.5">
          {item.bestFor.map((b) => (
            <li key={b} className="flex items-start gap-2 text-sm text-[hsl(var(--mcs-muted))]">
              <Check className="h-4 w-4 mt-0.5 shrink-0 text-[hsl(var(--mcs-orange))]" />
              {b}
            </li>
          ))}
        </ul>
      </div>

      <Link
        to="/#kontakt"
        className="inline-flex items-center justify-center gap-2 bg-[hsl(var(--mcs-orange))] hover:bg-[hsl(var(--mcs-orange-hover))] text-white text-sm font-semibold px-4 py-2.5 rounded-md"
      >
        {item.brand ? "Få anbefalt riktig modell" : "Få anbefalt riktig løsning"}{" "}
        <ArrowRight className="h-4 w-4" />

      </Link>
      <button
        type="button"
        onClick={onOpen}
        className="mt-2 inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-[hsl(var(--mcs-navy))]/70 hover:text-[hsl(var(--mcs-navy))]"
      >
        {item.brand ? "Les mer om modellen" : "Les mer om løsningen"}
      </button>
    </article>
  );
}

function ProductDetailDialog({
  item,
  logo,
  open,
  onOpenChange,
}: {
  item: ProductItem | null;
  logo: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  if (!item) return null;
  const photo = item.image ?? productImageFor(item.name);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1.5rem)] sm:w-full max-w-lg max-h-[85vh] overflow-y-auto bg-white">
        <DialogHeader>
          <div className="h-9 flex items-center mb-2 pr-8">
            {item.brand && logo ? (
              <img
                src={logo}
                alt={`${item.brand} logo`}
                onError={(e) => { e.currentTarget.style.display = "none"; }}
                className={`w-auto object-contain ${BRAND_LOGO_CLASS[item.brand] ?? "max-h-9 max-w-[170px]"}`}
              />
            ) : (
              <span className="text-[13px] font-semibold tracking-[0.14em] uppercase text-[hsl(var(--mcs-navy))]">
                {item.brand ?? "Løsning"}
              </span>
            )}
          </div>
          <DialogTitle className="text-xl text-[hsl(var(--mcs-navy))]">{item.name}</DialogTitle>
          <DialogDescription className="text-[hsl(var(--mcs-muted))]">
            {[item.productType, item.subtitle].filter(Boolean).join(" · ")}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg overflow-hidden border border-[hsl(var(--warm-beige))]">
          {photo ? (
            <img
              src={photo}
              alt={`${item.name} varmepumpe`}
              className="aspect-[4/3] w-full object-contain bg-white"
            />
          ) : (
            <HeatPumpIllustration
              variant={illustrationVariant(item.productType)}
              label={`Illustrasjon · ${item.productType ?? item.subtitle}`}
            />
          )}

        </div>

        <p className="text-sm text-[hsl(var(--mcs-muted))] leading-relaxed">{item.description}</p>

        <div className="flex flex-wrap gap-1.5">
          {item.tags.map((t) => (
            <span
              key={t}
              className="text-xs font-medium text-[hsl(var(--mcs-navy))] bg-[hsl(var(--warm-sand))] rounded-full px-2.5 py-1"
            >
              {t}
            </span>
          ))}
        </div>

        <div>
          <p className="text-[11px] uppercase tracking-wider text-[hsl(var(--mcs-muted))] mb-2">
            Passer for
          </p>
          <ul className="space-y-1.5">
            {item.bestFor.map((b) => (
              <li key={b} className="flex items-start gap-2 text-sm text-[hsl(var(--mcs-muted))]">
                <Check className="h-4 w-4 mt-0.5 shrink-0 text-[hsl(var(--mcs-orange))]" />
                {b}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-[hsl(var(--mcs-muted))] bg-[hsl(var(--warm-sand))] rounded-md p-3 leading-relaxed">
          Endelig anbefaling av modell avhenger av bolig, planløsning, plassering og varmebehov.
        </p>

        <div className="sticky bottom-0 -mx-6 px-6 pt-3 pb-1 bg-white border-t border-[hsl(var(--warm-beige))] sm:static sm:mx-0 sm:px-0 sm:pt-0 sm:pb-0 sm:border-0 flex flex-col sm:flex-row gap-2">
          <Link
            to="/#kontakt"
            onClick={() => onOpenChange(false)}
            className="flex-1 inline-flex items-center justify-center gap-2 bg-[hsl(var(--mcs-orange))] hover:bg-[hsl(var(--mcs-orange-hover))] text-white text-sm font-semibold px-4 py-2.5 rounded-md"
          >
            Bestill befaring <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/#kontakt"
            onClick={() => onOpenChange(false)}
            className="flex-1 inline-flex items-center justify-center text-sm font-semibold text-[hsl(var(--mcs-navy))] border border-[hsl(var(--mcs-navy))]/20 hover:border-[hsl(var(--mcs-navy))] px-4 py-2.5 rounded-md"
          >
            Send meg anbefaling
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}


export function ProductShowcase() {
  const logos = useBrandLogos();
  const { hash } = useLocation();
  const [segment, setSegment] = useState<Segment>("bolig");
  const [groupId, setGroupId] = useState<string>("anbefalt-bolig");
  const [brandFilter, setBrandFilter] = useState<BrandName | typeof ALL_BRANDS>(
    ALL_BRANDS
  );
  const [detail, setDetail] = useState<ProductItem | null>(null);


  // Deep links from the bolig/næring cards: #varmepumper-bolig / #varmepumper-naering
  useEffect(() => {
    const id = hash.replace("#", "");
    if (id === "varmepumper-naering") selectSegment("naering");
    else if (id === "varmepumper-bolig") selectSegment("bolig");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash]);

  const groups = useMemo(
    () => GROUPS.filter((g) => g.segment === segment),
    [segment]
  );

  const activeGroup = groups.find((g) => g.id === groupId) ?? groups[0];

  const brandsInGroup = useMemo(
    () =>
      Array.from(
        new Set(activeGroup.items.map((i) => i.brand).filter(Boolean) as BrandName[])
      ),
    [activeGroup]
  );

  const filtered = activeGroup.items.filter(
    (i) => brandFilter === ALL_BRANDS || i.brand === brandFilter
  );
  // Never show an empty product area — fall back to the full group.
  const items = filtered.length > 0 ? filtered : activeGroup.items;


  function selectSegment(next: Segment) {
    setSegment(next);
    const first = GROUPS.find((g) => g.segment === next)!;
    setGroupId(first.id);
    setBrandFilter(ALL_BRANDS);
  }

  return (
    <section id="varmepumper" className="bg-[hsl(var(--warm-cream))] pb-16 scroll-mt-28">
      {/* Deep-link anchors used by the bolig/næring entry cards */}
      <span id="varmepumper-bolig" className="block scroll-mt-28" aria-hidden />
      <span id="varmepumper-naering" className="block scroll-mt-28" aria-hidden />

      <div className="mx-auto max-w-[1600px] px-6 sm:px-10 lg:px-12 xl:px-16 2xl:px-24">
        <div className="max-w-2xl mb-7">
          <h2 className="text-2xl lg:text-3xl font-bold text-[hsl(var(--mcs-navy))] leading-tight">
            Løsninger og kvalitetsmerker vi anbefaler
          </h2>
          <div className="h-0.5 w-10 bg-[hsl(var(--mcs-orange))] mt-3 mb-4" />
          <p className="text-sm text-[hsl(var(--mcs-muted))] leading-relaxed">
            Start med hva bygget ditt trenger. Vi hjelper deg å finne riktig løsning for bolig,
            næring, flere rom eller vannbåren varme.
          </p>
        </div>

        {/* Primary segment control */}
        <div
          role="tablist"
          aria-label="Bolig eller næring"
          className="inline-flex gap-1 bg-white border border-[hsl(var(--warm-beige))] rounded-full p-1 mb-5"
        >
          {(["bolig", "naering"] as Segment[]).map((s) => {
            const active = s === segment;
            const Icon = SEGMENT_ICON[s];
            return (
              <button
                key={s}
                role="tab"
                aria-selected={active}
                onClick={() => selectSegment(s)}
                className={`inline-flex items-center gap-2 text-sm font-semibold px-5 py-2 rounded-full transition-colors ${
                  active
                    ? "bg-[hsl(var(--mcs-navy))] text-white"
                    : "text-[hsl(var(--mcs-navy))] hover:bg-[hsl(var(--warm-sand))]"
                }`}
              >
                <Icon className="h-4 w-4" /> {SEGMENT_LABEL[s]}
              </button>
            );
          })}
        </div>

        {/* Group pills */}
        <div className="flex flex-wrap gap-2 mb-5">
          {groups.map((g) => {
            const active = g.id === activeGroup.id;
            return (
              <button
                key={g.id}
                onClick={() => {
                  setGroupId(g.id);
                  setBrandFilter(ALL_BRANDS);
                }}
                className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                  active
                    ? "bg-[hsl(var(--mcs-orange))] text-white border-transparent"
                    : "bg-white text-[hsl(var(--mcs-navy))] border-[hsl(var(--warm-beige))] hover:border-[hsl(var(--mcs-navy))]/30"
                }`}
              >
                {g.title}
              </button>
            );
          })}
        </div>

        <div className="mb-5">
          <h3 className="text-lg font-bold text-[hsl(var(--mcs-navy))]">
            {activeGroup.title}
          </h3>
          <p className="text-sm text-[hsl(var(--mcs-muted))] max-w-2xl mt-1">
            {activeGroup.description}
          </p>
        </div>

        {/* Brand filter */}
        {brandsInGroup.length > 1 && (
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <span className="text-[11px] uppercase tracking-wider text-[hsl(var(--mcs-muted))]">
              Merke
            </span>
            {[ALL_BRANDS, ...brandsInGroup].map((b) => {
              const active = b === brandFilter;
              return (
                <button
                  key={b}
                  onClick={() => setBrandFilter(b as BrandName | typeof ALL_BRANDS)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                    active
                      ? "bg-[hsl(var(--mcs-navy))] text-white border-transparent"
                      : "bg-white text-[hsl(var(--mcs-navy))] border-[hsl(var(--warm-beige))] hover:border-[hsl(var(--mcs-navy))]/30"
                  }`}
                >
                  {b}
                </button>
              );
            })}
          </div>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((item) => (
            <ProductCard
              key={`${item.brand ?? "sol"}-${item.name}`}
              item={item}
              logo={logos[item.brand] ?? null}
              onOpen={() => setDetail(item)}
            />
          ))}
        </div>

        <ProductDetailDialog
          item={detail}
          logo={detail?.brand ? logos[detail.brand] ?? null : null}
          open={detail !== null}
          onOpenChange={(v) => !v && setDetail(null)}
        />

        <div className="mt-6">
          <p className="text-xs text-[hsl(var(--mcs-muted))]">
            Utvalget over er veiledende. Endelig modell og løsning anbefales etter befaring,
            planløsning og varmebehov. Modellutvalg kan variere.
          </p>
        </div>

      </div>
    </section>
  );
}
