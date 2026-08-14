import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  resolveProductGallery,
  type ResolvedImage,
} from "./useProductImages";

import { HeatPumpIllustration } from "./HeatPumpIllustration";
import { useLead, type LeadContext } from "./LeadContext";
import { productDetailsFor, type ProductDetails } from "./product-catalog";
import {
  compactSpecRows,
  fullSpecRows,
  SPEC_DISCLAIMER,
  VARIANT_ROWS,
} from "./product-specs";



export type { BrandName, Segment, ProductType } from "./product-types";
import type { BrandName, Segment, ProductType } from "./product-types";

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

function leadForItem(item: ProductItem, segment: Segment): LeadContext {
  return item.brand
    ? {
        source: "product",
        segment,
        interestType: "modell-anbefaling",
        productName: item.name,
        brand: item.brand,
      }
    : { source: "solution", segment, interestType: "losning-anbefaling", solutionName: item.name };
}

/**
 * Stable anchor id for deep-linking a product.
 * Segment-scoped so the same model can appear in both bolig and næring
 * without producing duplicate ids, e.g.
 *   #produkt-bolig-mitsubishi-electric-nordic-multi
 *   #produkt-naering-mitsubishi-electric-nordic-multi
 */
function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Brand+model part only — used for legacy anchors without segment. */
function productSlug(item: ProductItem) {
  return slugify(`${item.brand ?? "losning"}-${item.name}`);
}

function productAnchorId(item: ProductItem, segment: Segment) {
  return `produkt-${segment}-${productSlug(item)}`;
}

/** Legacy (pre-segment) anchor, kept so old links still resolve. */
function legacyProductAnchorId(item: ProductItem) {
  return `produkt-${productSlug(item)}`;
}


/** Generic fallback usage text per product type, used when no structured entry exists. */
const TYPICAL_USE: Record<string, string> = {
  "Luft-luft":
    "Montert i hovedoppholdsrommet, typisk stue, og varmer opp den delen av boligen du bruker mest.",
  Gulvmodell:
    "Plasseres lavt på vegg der veggplassen er begrenset, eller der planløsningen gjør høy plassering upraktisk.",
  Multisplitt:
    "Flere innedeler koblet til én utedel, slik at varmen fordeles til flere rom eller etasjer.",
  "Luft-vann":
    "Kobles til vannbårent anlegg som gulvvarme eller radiatorer, og kan også dekke varmtvann.",
  Næring:
    "Brukes i næringsbygg der flere soner skal ha jevn temperatur gjennom hele driftsdøgnet.",
  Tilbehør: "Supplerer en eksisterende installasjon.",
};

/** Merged view of a showcase item and its structured catalog entry. */
type ResolvedProduct = {
  item: ProductItem;
  details: ProductDetails | null;
  positioning: string;
  suitableFor: string[];
  typicalUse: string;
  strengths: string[];
  /** "Viktig å vurdere på befaring" — only conservative, non-spec notes. */
  considerations: string[];
  imageAlt: string;
  /** Locally stored images only. First entry is the card image. */
  gallery: ResolvedImage[];
};


function resolveProduct(item: ProductItem): ResolvedProduct {
  const details = productDetailsFor(item.name);
  const considerations = [
    details?.placementNotes,
    details?.heatingNotes,
    details?.coolingNotes,
    details?.designNotes,
    details?.noiseNote,
    details?.coldClimateNote,
  ].filter((v): v is string => Boolean(v));

  const imageAlt = details?.imageAlt ?? `${item.name} varmepumpe`;
  const gallery = resolveProductGallery({
    name: item.name,
    images: details?.images,
    imageKey: details?.imageKey,
    imageAlt,
    directSrc: item.image ?? null,
  });

  return {
    item,
    details,

    positioning: details?.shortPositioning ?? item.description,
    suitableFor: details?.suitableFor?.length ? details.suitableFor : item.bestFor,
    typicalUse:
      details?.typicalUse ??
      TYPICAL_USE[item.productType ?? ""] ??
      "Tilpasses bygget etter befaring, planløsning og varmebehov.",
    strengths: details?.keyStrengths?.length ? details.keyStrengths : item.tags,
    considerations: considerations.length
      ? considerations
      : [
          "Endelig modell og størrelse avhenger av bolig, planløsning, plassering og varmebehov, og må vurderes på befaring.",
        ],
    imageAlt,
    gallery,
  };
}


/** Compact "Nøkkeldata" strip on the card. Hidden when no official specs exist. */
function CardKeyFacts({ details }: { details: ProductDetails | null }) {
  if (!details?.specs) return null;
  const rows = compactSpecRows(details.specs);
  if (!rows.length) return null;

  return (
    <div className="mt-3 rounded-lg bg-[hsl(var(--warm-beige))]/40 border border-[hsl(var(--warm-beige))] px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-wider text-[hsl(var(--mcs-muted))] mb-1.5">
        Nøkkeldata
      </p>
      <dl className="space-y-1">
        {rows.slice(0, 4).map((r) => (
          <div
            key={r.label}
            className="flex flex-wrap items-baseline gap-x-1.5 text-[13px] leading-snug"
          >
            <dt className="text-[hsl(var(--mcs-muted))]">{r.label}:</dt>
            <dd className="min-w-0 font-medium text-[hsl(var(--mcs-navy))] break-words">
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Side-by-side comparison of officially documented sizes in a series. */
function ModalVariants({ details }: { details: ProductDetails | null }) {
  const variants = details?.specVariants;
  if (!variants || variants.length < 2) return null;
  const rows = VARIANT_ROWS.map((r) => ({
    label: r.label,
    values: variants.map((v) => r.get(v.specs)),
  })).filter((r) => r.values.some(Boolean));
  if (!rows.length) return null;

  return (
    <DialogSection title="Størrelser i serien">
      <div className="-mx-1 overflow-x-auto px-1">
        <table className="w-full min-w-[26rem] border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-white text-left font-normal text-[hsl(var(--mcs-muted))] py-2 pr-3 align-bottom">
                Modell
              </th>
              {variants.map((v) => (
                <th
                  key={v.label}
                  className="px-3 py-2 text-left font-semibold text-[hsl(var(--mcs-navy))] whitespace-nowrap"
                >
                  {v.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.label}
                className="border-t border-[hsl(var(--warm-beige))] odd:bg-[hsl(var(--warm-beige))]/25"
              >
                <th className="sticky left-0 z-10 bg-inherit text-left font-normal text-[hsl(var(--mcs-muted))] py-2 pr-3 align-top">
                  {r.label}
                </th>
                {r.values.map((val, i) => (
                  <td
                    key={variants[i].label}
                    className="px-3 py-2 align-top font-medium text-[hsl(var(--mcs-navy))]"
                  >
                    {val ?? "–"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-[hsl(var(--mcs-muted))] leading-relaxed">
        Riktig størrelse velges ut fra bolig, planløsning og varmebehov – vi
        vurderer dette på befaring.
      </p>
    </DialogSection>
  );
}

/** Full spec list in the modal. */
function ModalKeyFacts({ details }: { details: ProductDetails | null }) {
  if (!details?.specs) return null;
  const rows = fullSpecRows(details.specs);
  if (!rows.length) return null;

  return (
    <DialogSection title="Nøkkeldata fra produsent/importør">
      {details.specBasis && (
        <p className="text-xs text-[hsl(var(--mcs-muted))] mb-2">
          Gjelder {details.specBasis}
        </p>
      )}
      <dl className="rounded-lg border border-[hsl(var(--warm-beige))] divide-y divide-[hsl(var(--warm-beige))] overflow-hidden">
        {rows.map((r) => (
          <div
            key={r.label}
            className="grid grid-cols-1 sm:grid-cols-[minmax(0,10rem)_1fr] gap-x-3 px-3 py-2 odd:bg-[hsl(var(--warm-beige))]/25"
          >
            <dt className="text-[13px] text-[hsl(var(--mcs-muted))]">{r.label}</dt>
            <dd className="text-[13px] font-medium text-[hsl(var(--mcs-navy))] min-w-0 break-words">
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-[hsl(var(--mcs-muted))] leading-relaxed">
        {SPEC_DISCLAIMER}
      </p>
    </DialogSection>
  );
}



const IMAGE_TYPE_LABEL: Record<ResolvedImage["type"], string> = {
  primary: "Produktbilde",
  indoor: "Innedel",
  outdoor: "Utedel",
  lifestyle: "I bruk",
  detail: "Detalj",
  variant: "Variant",
};

/** Fixed 4:3 frame so every card and modal image lines up. */
function ImageFrame({
  photo,
  alt,
  rp,
  eager,
}: {
  photo: string | null;
  alt: string;
  rp: ResolvedProduct;
  eager?: boolean;
}) {
  const { item, details } = rp;
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [photo]);
  const showPhoto = Boolean(photo) && !failed;

  return (
    <div className="relative overflow-hidden rounded-lg border border-[hsl(var(--warm-beige))] bg-white">
      <div className="aspect-[4/3] w-full">
        {showPhoto ? (
          <img
            src={photo!}
            alt={alt}
            loading={eager ? "eager" : "lazy"}
            onError={() => setFailed(true)}
            className="h-full w-full object-contain p-3"
          />
        ) : (
          <HeatPumpIllustration
            variant={illustrationVariant(item.productType ?? details?.productType)}
            label={`Illustrasjon · ${item.productType ?? details?.productType ?? item.subtitle}`}
          />
        )}
      </div>
    </div>
  );
}

/** Card image — always a single image (primary), never a carousel. */
function ProductMedia({ rp }: { rp: ResolvedProduct }) {
  const primary =
    rp.gallery.find((g) => g.type === "primary") ?? rp.gallery[0] ?? null;
  return (
    <ImageFrame
      rp={rp}
      photo={primary?.src ?? null}
      alt={primary?.alt ?? rp.imageAlt}
    />
  );
}

/** Modal image area — large image plus thumbnails when more images exist. */
function ProductGallery({ rp }: { rp: ResolvedProduct }) {
  const [active, setActive] = useState(0);
  useEffect(() => setActive(0), [rp.item.name]);

  const images = rp.gallery;
  const current = images[Math.min(active, Math.max(images.length - 1, 0))];

  return (
    <div>
      <ImageFrame
        rp={rp}
        photo={current?.src ?? null}
        alt={current?.alt ?? rp.imageAlt}
        eager
      />

      {images.length > 1 && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {images.map((img, i) => (
            <button
              key={img.key + i}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Vis ${IMAGE_TYPE_LABEL[img.type]} – ${img.alt}`}
              aria-current={i === active}
              className={`shrink-0 w-16 h-16 rounded-md border bg-white overflow-hidden transition ${
                i === active
                  ? "border-[hsl(var(--mcs-orange))] ring-1 ring-[hsl(var(--mcs-orange))]"
                  : "border-[hsl(var(--warm-beige))] hover:border-[hsl(var(--mcs-navy))]/30"
              }`}
            >
              <img
                src={img.src}
                alt=""
                loading="lazy"
                className="h-full w-full object-contain p-1"
              />
            </button>
          ))}
        </div>
      )}

      {images.length > 1 && current && (
        <p className="mt-1 text-xs text-[hsl(var(--mcs-muted))]">
          {IMAGE_TYPE_LABEL[current.type]}
        </p>
      )}
    </div>
  );
}



function BrandRow({
  brand,
  logo,
}: {
  brand?: BrandName;
  logo: string | null;
}) {
  const [logoFailed, setLogoFailed] = useState(false);
  const showLogo = Boolean(brand && logo) && !logoFailed;
  return (
    <div className="h-8 flex items-center">
      {showLogo ? (
        <img
          src={logo!}
          alt={`${brand} logo`}
          loading="lazy"
          onError={() => setLogoFailed(true)}
          className={`w-auto object-contain object-left ${BRAND_LOGO_CLASS[brand!] ?? "max-h-7 max-w-[150px]"}`}
        />
      ) : (
        <span className="text-[12px] font-semibold tracking-[0.14em] uppercase text-[hsl(var(--mcs-navy))]">
          {brand ?? "Løsning"}
        </span>
      )}
    </div>
  );
}

function TagRow({ tags, max }: { tags: string[]; max?: number }) {
  const shown = typeof max === "number" ? tags.slice(0, max) : tags;
  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map((t) => (
        <span
          key={t}
          className="max-w-full truncate text-[11px] leading-4 font-medium text-[hsl(var(--mcs-navy))] bg-[hsl(var(--warm-sand))] rounded-full px-2.5 py-1"
        >
          {t}
        </span>
      ))}
    </div>
  );
}

function ProductCard({
  item,
  logo,
  segment,
  onSelect,
  onQuickView,
  selected,
}: {
  item: ProductItem;
  logo: string | null;
  segment: Segment;
  onSelect: () => void;
  onQuickView: () => void;
  selected: boolean;
}) {
  const { startLead } = useLead();
  const rp = useMemo(() => resolveProduct(item), [item]);
  const displayName = rp.details?.modelName ?? item.name;
  const family = rp.details?.modelFamily;
  const hasVariants = (rp.details?.specVariants?.length ?? 0) > 1;

  return (
    <article
      id={productAnchorId(item, segment)}
      className={`h-full scroll-mt-28 bg-white rounded-xl border p-4 sm:p-5 flex flex-col transition-shadow ${
        selected
          ? "border-[hsl(var(--mcs-orange))] shadow-[0_8px_24px_-12px_hsl(var(--mcs-navy)/0.25)]"
          : "border-[hsl(var(--warm-beige))] shadow-[0_1px_2px_hsl(var(--mcs-navy)/0.04)] hover:shadow-[0_8px_24px_-12px_hsl(var(--mcs-navy)/0.18)]"
      }`}
    >

      <div className="mb-3">
        <BrandRow brand={item.brand} logo={logo} />
      </div>

      <ProductMedia rp={rp} />

      <h4 className="mt-4 text-base font-bold text-[hsl(var(--mcs-navy))] leading-snug">
        {displayName}
      </h4>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5">
        {item.productType && (
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--mcs-orange))] border border-[hsl(var(--mcs-orange))]/30 rounded-full px-2 py-0.5">
            {item.productType}
          </span>
        )}
        <span className="text-[11px] uppercase tracking-wider text-[hsl(var(--mcs-muted))]">
          {family && family !== displayName ? `${family} · ${item.subtitle}` : item.subtitle}
        </span>
      </div>

      <p className="mt-2.5 text-sm text-[hsl(var(--mcs-muted))] leading-relaxed">
        {rp.positioning}
      </p>

      {rp.details?.guidanceNote && (
        <p className="mt-2 text-sm font-medium text-[hsl(var(--mcs-navy))] leading-snug">
          {rp.details.guidanceNote}
        </p>
      )}

      <CardKeyFacts details={rp.details} />



      <div className="mt-4">
        <p className="text-[11px] uppercase tracking-wider text-[hsl(var(--mcs-muted))] mb-2">
          Styrker
        </p>
        <ul className="space-y-1.5">
          {rp.strengths.slice(0, 4).map((s) => (
            <li key={s} className="flex items-start gap-2 text-sm text-[hsl(var(--mcs-muted))]">
              <Check className="h-4 w-4 mt-0.5 shrink-0 text-[hsl(var(--mcs-orange))]" />
              <span className="min-w-0">{s}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 flex-1">
        <p className="text-[11px] uppercase tracking-wider text-[hsl(var(--mcs-muted))] mb-2">
          Passer ofte for
        </p>
        <ul className="space-y-1">
          {rp.suitableFor.slice(0, 3).map((b) => (
            <li key={b} className="text-sm text-[hsl(var(--mcs-muted))] leading-snug">
              · {b}
            </li>
          ))}
        </ul>
      </div>

      {hasVariants && (
        <p className="mt-3 text-xs text-[hsl(var(--mcs-muted))]">
          Nøkkeldata avhenger av valgt størrelse i serien.
        </p>
      )}

      <div className="mt-5 pt-4 border-t border-[hsl(var(--warm-beige))] flex flex-col gap-2">
        <button
          type="button"
          onClick={() => startLead(leadForItem(item, segment))}
          className="w-full inline-flex items-center justify-center gap-2 bg-[hsl(var(--mcs-orange))] hover:bg-[hsl(var(--mcs-orange-hover))] text-white text-sm font-semibold px-4 py-2.5 rounded-md transition-colors"
        >
          <span className="truncate">
            {item.brand ? "Få anbefalt riktig modell" : "Få anbefalt riktig løsning"}
          </span>
          <ArrowRight className="h-4 w-4 shrink-0" />
        </button>
        <button
          type="button"
          onClick={onSelect}
          aria-expanded={selected}
          className="w-full inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-[hsl(var(--mcs-navy))] border border-[hsl(var(--mcs-navy))]/20 hover:border-[hsl(var(--mcs-navy))] px-4 py-2 rounded-md transition-colors"
        >
          {selected ? "Vises under" : "Se detaljer"}
        </button>
        <button
          type="button"
          onClick={onQuickView}
          className="w-full inline-flex items-center justify-center text-xs font-medium text-[hsl(var(--mcs-navy))]/60 hover:text-[hsl(var(--mcs-navy))] py-0.5"
        >
          Hurtigvisning
        </button>
      </div>

    </article>
  );
}

function DialogSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h5 className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--mcs-muted))] mb-2">
        {title}
      </h5>
      {children}
    </section>
  );
}

function ProductDetailDialog({
  item,
  logo,
  segment,
  open,
  onOpenChange,
}: {
  item: ProductItem | null;
  logo: string | null;
  segment: Segment;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { startLead } = useLead();
  if (!item) return null;
  const rp = resolveProduct(item);
  const displayName = rp.details?.modelName ?? item.name;
  const family = rp.details?.modelFamily;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1.5rem)] sm:w-full max-w-xl max-h-[88vh] overflow-y-auto bg-white p-5 sm:p-6">
        <DialogHeader className="space-y-1 text-left sm:text-left">
          <div className="mb-1 pr-8">
            <BrandRow brand={item.brand} logo={logo} />
          </div>
          <DialogTitle className="text-xl sm:text-2xl text-[hsl(var(--mcs-navy))] leading-tight">
            {displayName}
          </DialogTitle>
          <DialogDescription className="text-[hsl(var(--mcs-muted))]">
            {[item.brand, family, item.productType ?? rp.details?.productType]
              .filter(Boolean)
              .join(" · ")}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-1">
          <ProductGallery rp={rp} />

        </div>

        <p className="text-sm text-[hsl(var(--mcs-navy))] leading-relaxed">
          {rp.positioning}
        </p>

        {rp.details?.guidanceNote && (
          <p className="-mt-1 text-sm font-medium text-[hsl(var(--mcs-navy))]">
            {rp.details.guidanceNote}
          </p>
        )}


        <TagRow tags={item.tags} />

        <div className="space-y-5">
          <DialogSection title="Passer ofte for">
            <ul className="space-y-1.5">
              {rp.suitableFor.map((b) => (
                <li
                  key={b}
                  className="flex items-start gap-2 text-sm text-[hsl(var(--mcs-muted))]"
                >
                  <Check className="h-4 w-4 mt-0.5 shrink-0 text-[hsl(var(--mcs-orange))]" />
                  <span className="min-w-0">{b}</span>
                </li>
              ))}
            </ul>
          </DialogSection>

          <ModalKeyFacts details={rp.details} />
          <ModalVariants details={rp.details} />


          <DialogSection title="Typisk bruk">
            <p className="text-sm text-[hsl(var(--mcs-muted))] leading-relaxed">
              {rp.typicalUse}
            </p>
          </DialogSection>

          <DialogSection title="Styrker">
            <ul className="space-y-1.5">
              {rp.strengths.map((s) => (
                <li
                  key={s}
                  className="flex items-start gap-2 text-sm text-[hsl(var(--mcs-muted))]"
                >
                  <Check className="h-4 w-4 mt-0.5 shrink-0 text-[hsl(var(--mcs-orange))]" />
                  <span className="min-w-0">{s}</span>
                </li>
              ))}
            </ul>
          </DialogSection>

          <DialogSection title="Viktig å vurdere på befaring">
            <ul className="space-y-2">
              {rp.considerations.map((c) => (
                <li key={c} className="text-sm text-[hsl(var(--mcs-muted))] leading-relaxed">
                  {c}
                </li>
              ))}
            </ul>
          </DialogSection>


          <DialogSection title="Neste steg">
            <p className="text-sm text-[hsl(var(--mcs-muted))] leading-relaxed mb-3">
              Vi tar en kort prat om boligen din, avtaler befaring og gir deg en anbefaling
              med pris. Endelig modell avhenger av bolig, planløsning, plassering og varmebehov.
            </p>
            <div className="sticky bottom-0 -mx-5 sm:-mx-6 px-5 sm:px-6 pt-3 pb-1 bg-white border-t border-[hsl(var(--warm-beige))] sm:static sm:mx-0 sm:px-0 sm:pt-0 sm:pb-0 sm:border-0 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  startLead(leadForItem(item, segment));
                }}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-[hsl(var(--mcs-orange))] hover:bg-[hsl(var(--mcs-orange-hover))] text-white text-sm font-semibold px-4 py-2.5 rounded-md transition-colors"
              >
                <span className="truncate">
                  {item.brand ? "Få anbefalt riktig modell" : "Få anbefalt riktig løsning"}
                </span>
                <ArrowRight className="h-4 w-4 shrink-0" />
              </button>
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  startLead({ ...leadForItem(item, segment), interestType: "befaring" });
                }}
                className="flex-1 inline-flex items-center justify-center text-sm font-semibold text-[hsl(var(--mcs-navy))] border border-[hsl(var(--mcs-navy))]/20 hover:border-[hsl(var(--mcs-navy))] px-4 py-2.5 rounded-md transition-colors"
              >
                Bestill befaring
              </button>
            </div>
          </DialogSection>
        </div>
      </DialogContent>
    </Dialog>
  );
}



/** Inline "mini product page" shown below the grid for the selected model. */
function InlineProductDetail({
  item,
  logo,
  segment,
  onClose,
}: {
  item: ProductItem;
  logo: string | null;
  segment: Segment;
  onClose: () => void;
}) {
  const { startLead } = useLead();
  const rp = useMemo(() => resolveProduct(item), [item]);
  const displayName = rp.details?.modelName ?? item.name;
  const family = rp.details?.modelFamily;

  return (
    <div className="mt-8 scroll-mt-28 rounded-2xl border border-[hsl(var(--warm-beige))] bg-white p-5 sm:p-7 shadow-[0_8px_30px_-20px_hsl(var(--mcs-navy)/0.35)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <BrandRow brand={item.brand} logo={logo} />
          <h3 className="mt-2 text-xl sm:text-2xl font-bold text-[hsl(var(--mcs-navy))] leading-tight">
            {displayName}
          </h3>
          <p className="mt-1 text-sm text-[hsl(var(--mcs-muted))]">
            {[item.brand, family, item.productType ?? rp.details?.productType]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 text-xs font-semibold text-[hsl(var(--mcs-navy))]/60 hover:text-[hsl(var(--mcs-navy))] underline underline-offset-4"
        >
          Lukk
        </button>
      </div>

      <div className="mt-5 grid grid-cols-1 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] gap-6 lg:gap-8">
        <div>
          <ProductGallery rp={rp} />
          <p className="mt-4 text-sm text-[hsl(var(--mcs-navy))] leading-relaxed">
            {rp.positioning}
          </p>
          {rp.details?.guidanceNote && (
            <p className="mt-2 text-sm font-medium text-[hsl(var(--mcs-navy))]">
              {rp.details.guidanceNote}
            </p>
          )}
          <div className="mt-3">
            <TagRow tags={item.tags} />
          </div>
        </div>

        <div className="min-w-0 space-y-5">
          <DialogSection title="Passer ofte for">
            <ul className="space-y-1.5">
              {rp.suitableFor.map((b) => (
                <li key={b} className="flex items-start gap-2 text-sm text-[hsl(var(--mcs-muted))]">
                  <Check className="h-4 w-4 mt-0.5 shrink-0 text-[hsl(var(--mcs-orange))]" />
                  <span className="min-w-0">{b}</span>
                </li>
              ))}
            </ul>
          </DialogSection>

          <DialogSection title="Typisk bruk">
            <p className="text-sm text-[hsl(var(--mcs-muted))] leading-relaxed">
              {rp.typicalUse}
            </p>
          </DialogSection>

          <DialogSection title="Styrker">
            <ul className="space-y-1.5">
              {rp.strengths.map((s) => (
                <li key={s} className="flex items-start gap-2 text-sm text-[hsl(var(--mcs-muted))]">
                  <Check className="h-4 w-4 mt-0.5 shrink-0 text-[hsl(var(--mcs-orange))]" />
                  <span className="min-w-0">{s}</span>
                </li>
              ))}
            </ul>
          </DialogSection>

          <ModalKeyFacts details={rp.details} />
          <ModalVariants details={rp.details} />

          <DialogSection title="Viktig å vurdere på befaring">
            <ul className="space-y-2">
              {rp.considerations.map((c) => (
                <li key={c} className="text-sm text-[hsl(var(--mcs-muted))] leading-relaxed">
                  {c}
                </li>
              ))}
            </ul>
          </DialogSection>

          <p className="text-xs text-[hsl(var(--mcs-muted))] leading-relaxed">
            Tallene er produsent-/importørdata. Riktig modell og størrelse må vurderes ut fra
            bolig, planløsning, plassering, klima og faktisk varmebehov.
          </p>

          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <button
              type="button"
              onClick={() => startLead(leadForItem(item, segment))}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-[hsl(var(--mcs-orange))] hover:bg-[hsl(var(--mcs-orange-hover))] text-white text-sm font-semibold px-4 py-2.5 rounded-md transition-colors"
            >
              <span className="truncate">
                {item.brand ? "Få anbefalt riktig modell" : "Få anbefalt riktig løsning"}
              </span>
              <ArrowRight className="h-4 w-4 shrink-0" />
            </button>
            <button
              type="button"
              onClick={() =>
                startLead({ ...leadForItem(item, segment), interestType: "befaring" })
              }
              className="flex-1 inline-flex items-center justify-center text-sm font-semibold text-[hsl(var(--mcs-navy))] border border-[hsl(var(--mcs-navy))]/20 hover:border-[hsl(var(--mcs-navy))] px-4 py-2.5 rounded-md transition-colors"
            >
              Bestill befaring
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const COMPARE_ROWS: Array<{
  label: string;
  get: (rp: ResolvedProduct) => string | undefined;
}> = [
  {
    label: "Type/familie",
    get: (rp) =>
      [rp.item.productType ?? rp.details?.productType, rp.details?.modelFamily]
        .filter(Boolean)
        .join(" · ") || undefined,
  },
  {
    label: "Varmeeffekt",
    get: (rp) =>
      rp.details?.specs?.heatingCapacityMinMaxKw ??
      rp.details?.specs?.heatingCapacityNominalKw,
  },
  { label: "SCOP", get: (rp) => rp.details?.specs?.scop },
  { label: "Lydnivå innedel", get: (rp) => rp.details?.specs?.indoorNoiseDb },
  {
    label: "Energiklasse varme",
    get: (rp) => rp.details?.specs?.energyClassHeating,
  },
  {
    label: "Passer ofte for",
    get: (rp) => (rp.suitableFor.length ? rp.suitableFor.slice(0, 2).join(", ") : undefined),
  },
];

/** Compact comparison of the products currently shown. Empty rows are dropped. */
function ComparisonTable({
  items,
  selectedName,
  onSelect,
}: {
  items: ProductItem[];
  selectedName: string | null;
  onSelect: (item: ProductItem) => void;
}) {
  const resolved = useMemo(() => items.map(resolveProduct), [items]);
  const rows = useMemo(
    () =>
      COMPARE_ROWS.map((r) => ({
        label: r.label,
        values: resolved.map((rp) => r.get(rp)),
      })).filter((r) => r.values.some(Boolean)),
    [resolved]
  );

  if (resolved.length < 2 || !rows.length) return null;

  return (
    <div className="mt-8 rounded-2xl border border-[hsl(var(--warm-beige))] bg-white p-4 sm:p-6">
      <h3 className="text-base font-bold text-[hsl(var(--mcs-navy))]">
        Sammenlign modellene i utvalget
      </h3>
      <p className="mt-1 text-sm text-[hsl(var(--mcs-muted))]">
        Kun felt der vi har offisielle tall fra produsent eller importør vises.
      </p>

      <div className="-mx-1 mt-4 overflow-x-auto px-1">
        <table className="w-full min-w-[38rem] border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-white text-left font-normal text-[hsl(var(--mcs-muted))] py-2 pr-3 align-bottom">
                Modell
              </th>
              {resolved.map((rp) => (
                <th
                  key={rp.item.name}
                  className="px-3 py-2 text-left align-bottom"
                >
                  <button
                    type="button"
                    onClick={() => onSelect(rp.item)}
                    className={`font-semibold underline-offset-4 hover:underline ${
                      rp.item.name === selectedName
                        ? "text-[hsl(var(--mcs-orange))]"
                        : "text-[hsl(var(--mcs-navy))]"
                    }`}
                  >
                    {rp.details?.modelName ?? rp.item.name}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.label}
                className="border-t border-[hsl(var(--warm-beige))] odd:bg-[hsl(var(--warm-beige))]/25"
              >
                <th className="sticky left-0 z-10 bg-inherit text-left font-normal text-[hsl(var(--mcs-muted))] py-2 pr-3 align-top whitespace-nowrap">
                  {r.label}
                </th>
                {r.values.map((v, i) => (
                  <td
                    key={resolved[i].item.name}
                    className="px-3 py-2 align-top font-medium text-[hsl(var(--mcs-navy))]"
                  >
                    {v ?? "–"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-[hsl(var(--mcs-muted))] leading-relaxed">
        {SPEC_DISCLAIMER}
      </p>
    </div>
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
  const [selected, setSelected] = useState<ProductItem | null>(null);
  const inlineRef = useRef<HTMLDivElement | null>(null);

  function selectProduct(item: ProductItem) {
    setSelected(item);
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() =>
        inlineRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      );
    }
  }

  // Deep links from the bolig/næring cards: #varmepumper-bolig / #varmepumper-naering
  useEffect(() => {
    const id = hash.replace("#", "");
    if (id === "varmepumper-naering") selectSegment("naering");
    else if (id === "varmepumper-bolig") selectSegment("bolig");
    else if (id.startsWith("produkt-")) {
      for (const g of GROUPS) {
        const match = g.items.find((i) => productAnchorId(i) === id);
        if (match) {
          setSegment(g.segment);
          setGroupId(g.id);
          setBrandFilter(ALL_BRANDS);
          selectProduct(match);
          break;
        }
      }
    }
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

  const activeSelected =
    selected && activeGroup.items.some((i) => i.name === selected.name) ? selected : null;

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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 items-stretch">
          {items.map((item) => (
            <ProductCard
              key={`${item.brand ?? "sol"}-${item.name}`}
              item={item}
              segment={segment}
              logo={logos[item.brand] ?? null}
              selected={activeSelected?.name === item.name}
              onSelect={() => selectProduct(item)}
              onQuickView={() => setDetail(item)}
            />
          ))}
        </div>

        <div ref={inlineRef} className="scroll-mt-28">
          {activeSelected && (
            <InlineProductDetail
              item={activeSelected}
              segment={segment}
              logo={activeSelected.brand ? logos[activeSelected.brand] ?? null : null}
              onClose={() => setSelected(null)}
            />
          )}
        </div>

        <ComparisonTable
          items={items}
          selectedName={activeSelected?.name ?? null}
          onSelect={selectProduct}
        />

        <ProductDetailDialog
          item={detail}
          segment={segment}
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
