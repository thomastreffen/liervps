/**
 * Official manufacturer / distributor specifications per product.
 *
 * Rules for this file:
 * - ONLY values published by the manufacturer or the Norwegian importer/
 *   distributor. Nothing is estimated, interpolated or rounded "to look nice".
 * - Missing values are simply left out — never guessed.
 * - No prices, no "best i test", no savings guarantees.
 * - `specSourceUrl` / `specSourceLabel` are INTERNAL traceability fields and
 *   must never be rendered or linked in public UI.
 * - Where a series exists in several sizes, the specs below are for the size
 *   the source page documents (stated in `specBasis`).
 */

export type ProductSpecs = {
  heatingCapacityNominalKw?: string;
  heatingCapacityMinMaxKw?: string;
  coolingCapacityNominalKw?: string;
  coolingCapacityMinMaxKw?: string;
  scop?: string;
  seer?: string;
  energyClassHeating?: string;
  energyClassCooling?: string;
  indoorNoiseDb?: string;
  outdoorNoiseDb?: string;
  operationTempHeating?: string;
  refrigerant?: string;
  indoorUnitDimensions?: string;
  outdoorUnitDimensions?: string;
  weightIndoor?: string;
  weightOutdoor?: string;
  suitableAreaIndicative?: string;
};


/** One size/variant within a series, with its own official numbers. */
export type ProductSpecVariant = {
  /** Type designation as published by manufacturer/importer. */
  label: string;
  specs: ProductSpecs;
};

export type ProductSpecEntry = {
  specs: ProductSpecs;
  /** Other officially documented sizes in the same series. */
  variants?: ProductSpecVariant[];
  /** Which model size / type designation the numbers apply to. Shown publicly. */
  specBasis?: string;
  /** Short customer-friendly guidance line. Shown publicly. */
  guidanceNote?: string;
  /** Internal only. */
  specSourceUrl: string;
  /** Internal only. */
  specSourceLabel: string;
  /** Internal only. ISO date of last spec review. */
  specLastReviewed: string;
};

const R = "2026-08-14";
const MEE = "Mitsubishi Electric Norge (produsent)";
const TOS = "Toshiba Norge / ABK-Qviller (importør)";
const PAN_OFF = "Panasonic (produsent)";
const PAN_DIST = "Panasonic – norsk distributørkatalog";

export const PRODUCT_SPECS: Record<string, ProductSpecEntry> = {
  /* ---------------- Mitsubishi Electric ----------------
   * MEE publiserer ikke fullstendige spesifikasjonstabeller på de offentlige
   * produktsidene. Verdiene under er de som er oppgitt eksplisitt i teksten
   * på produsentens egne sider. Resten er bevisst utelatt.
   */
  "UWANO Pure": {
    specs: {
      scop: "4,1 (kaldt klima)",
      energyClassHeating: "A+++",
      indoorNoiseDb: "fra 19 dB(A)",
      outdoorNoiseDb: "49 dB(A)",
      operationTempHeating:
        "Nominell kapasitet ned til -25 °C, fabrikkgarantert ned til -30 °C",
      refrigerant: "R290 (naturlig kuldemedium)",
    },
    specBasis: "UWANO Pure 7000 (produsentens oppgitte tall)",
    guidanceNote: "Aktuell ved større varmebehov og kalde vintre.",
    specSourceUrl:
      "https://mee.no/privat/produktkategori/luft-luft-varmepumper/uwanopure/",
    specSourceLabel: MEE,
    specLastReviewed: R,
  },
  Kaiteki: {
    specs: {
      scop: "5,2 (Kaiteki 6300)",
      energyClassHeating: "A+++",
      indoorNoiseDb: "fra 19 dB(A)",
      outdoorNoiseDb: "49 dB(A)",
      operationTempHeating:
        "Fabrikkgarantert varmekapasitet ned til -25 °C (testet til -35 °C)",
      refrigerant: "R32",
    },
    specBasis: "Kaiteki 6300 / 6600 (produsentens oppgitte tall)",
    guidanceNote: "Allroundmodell som treffer de fleste vanlige boliger.",
    specSourceUrl:
      "https://mee.no/privat/produktkategori/luft-luft-varmepumper/kaiteki/",
    specSourceLabel: MEE,
    specLastReviewed: R,
  },
  GUSSURI: {
    specs: {
      indoorNoiseDb: "fra 18 dB(A)",
      outdoorNoiseDb: "48 dB(A)",
    },
    guidanceNote: "God når lavt lydnivå er viktig.",
    specSourceUrl:
      "https://mee.no/privat/produktkategori/luft-luft-varmepumper/gussuri/",
    specSourceLabel: MEE,
    specLastReviewed: R,
  },
  IGURU: {
    specs: {
      heatingCapacityNominalKw: "3,2 kW (IGURU 6200)",
      operationTempHeating:
        "Fabrikkgarantert drift ned til -25 °C. Nominell kapasitet ned til -21 °C (IGURU 6200)",
      refrigerant: "R32",
      indoorUnitDimensions: "H 280 × B 838 mm (innedel)",
    },
    specBasis: "IGURU 6200 (produsentens oppgitte tall)",
    guidanceNote: "Passer ofte der veggplassen er begrenset.",
    specSourceUrl:
      "https://mee.no/privat/produktkategori/luft-luft-varmepumper/iguru/",
    specSourceLabel: MEE,
    specLastReviewed: R,
  },
  Furo: {
    specs: {
      indoorNoiseDb: "fra 18 dB(A)",
      operationTempHeating:
        "Fabrikkgarantert 3,4 kW ved -15 °C (Furo 5100) og 4,3 kW ved -15 °C (Furo 6000), garantert kapasitet ned til -25 °C",
    },
    specBasis: "Furo 5100 / 6000 (produsentens oppgitte tall)",
    guidanceNote: "Aktuell når høy montering på vegg ikke passer.",
    specSourceUrl:
      "https://mee.no/privat/produktkategori/luft-luft-varmepumper/furo/",
    specSourceLabel: MEE,
    specLastReviewed: R,
  },
  Zen: {
    specs: {
      scop: "4,5",
      indoorNoiseDb: "fra 21 dB(A)",
      operationTempHeating: "Fabrikkgarantert varmekapasitet ned til -20 °C",
      indoorUnitDimensions: "Dybde 195 mm (innedel)",
    },
    guidanceNote: "God når design og lavt lydnivå er viktig.",
    specSourceUrl:
      "https://mee.no/privat/produktkategori/luft-luft-varmepumper/zen/",
    specSourceLabel: MEE,
    specLastReviewed: R,
  },
  "Duo-modellen": {
    specs: {
      operationTempHeating:
        "6,4 kW ved -15 °C, fabrikkgarantert varmekapasitet ned til -25 °C",
      refrigerant: "R32",
    },
    specBasis: "Duo 7000 (produsentens oppgitte tall)",
    guidanceNote: "Aktuell ved behov for flere innedeler på én utedel.",
    specSourceUrl:
      "https://mee.no/privat/produktkategori/luft-luft-varmepumper/duo-7000/",
    specSourceLabel: MEE,
    specLastReviewed: R,
  },
  "Nordic Multi": {
    specs: {
      operationTempHeating:
        "Fabrikkgarantert varmekapasitet ned til -20 °C (Nordic Multi 2) og -15 °C (Nordic Multi 3 og 4)",
      refrigerant: "R32",
    },
    guidanceNote: "Aktuell ved behov for flere innedeler.",
    specSourceUrl:
      "https://mee.no/privat/produktkategori/luft-luft-varmepumper/nordic-multi/",
    specSourceLabel: MEE,
    specLastReviewed: R,
  },

  /* ---------------- Toshiba (ABK-Qviller) ----------------
   * Tallene under er hentet fra importørens produktdatablad per størrelse.
   * Der serien finnes i flere størrelser ligger tallene i `variants`, slik at
   * ingen verdi presenteres som om den gjelder hele serien.
   */
  "Toshiba Signatur": {
    specs: {
      heatingCapacityNominalKw: "3,2 kW ved 7 °C",
      heatingCapacityMinMaxKw: "opptil 7,2 kW ved 7 °C",
      coolingCapacityNominalKw: "2,8 kW",
      coolingCapacityMinMaxKw: "opptil 3,5 kW",
      scop: "5,1",
      seer: "7,7",
      energyClassHeating: "A+++",
      energyClassCooling: "A++",
      indoorNoiseDb: "fra 19 dB(A) (stillemodus), maks 45 dB(A)",
      outdoorNoiseDb: "maks 48 dB(A)",
      operationTempHeating:
        "2,6 kW ved -25 °C, fabrikktestet for varmedrift ned til -25 °C",
      refrigerant: "R32",
      indoorUnitDimensions: "H 300 × B 987 × D 210 mm",
      outdoorUnitDimensions: "H 550 × B 780 × D 290 mm",
      weightIndoor: "11 kg",
      weightOutdoor: "33 kg",
    },
    variants: [
      {
        label: "Signatur 25",
        specs: {
          heatingCapacityNominalKw: "3,2 kW ved 7 °C",
          heatingCapacityMinMaxKw: "opptil 7,2 kW ved 7 °C",
          coolingCapacityNominalKw: "2,8 kW",
          coolingCapacityMinMaxKw: "opptil 3,5 kW",
          scop: "5,1",
          seer: "7,7",
          energyClassHeating: "A+++",
          energyClassCooling: "A++",
          indoorNoiseDb: "19 – 45 dB(A)",
          outdoorNoiseDb: "maks 48 dB(A)",
          operationTempHeating: "2,6 kW ved -25 °C",
          refrigerant: "R32",
          indoorUnitDimensions: "H 300 × B 987 × D 210 mm",
          outdoorUnitDimensions: "H 550 × B 780 × D 290 mm",
          weightIndoor: "11 kg",
          weightOutdoor: "33 kg",
        },
      },
      {
        label: "Signatur 35",
        specs: {
          heatingCapacityNominalKw: "4,2 kW ved 7 °C",
          heatingCapacityMinMaxKw: "opptil 7,6 kW ved 7 °C",
          coolingCapacityNominalKw: "3,5 kW",
          coolingCapacityMinMaxKw: "opptil 4,5 kW",
          scop: "5,1",
          seer: "7,3",
          energyClassHeating: "A+++",
          energyClassCooling: "A++",
          indoorNoiseDb: "19 – 46 dB(A)",
          outdoorNoiseDb: "maks 48 dB(A)",
          operationTempHeating: "2,7 kW ved -25 °C",
          refrigerant: "R32",
          indoorUnitDimensions: "H 300 × B 987 × D 210 mm",
          outdoorUnitDimensions: "H 550 × B 780 × D 290 mm",
          weightIndoor: "11 kg",
          weightOutdoor: "33 kg",
        },
      },
    ],
    specBasis: "Signatur 25 (RAS-B25N4KVRG-ND / RAS-25G3AVSG-ND)",
    guidanceNote: "God når design og lavt lydnivå er viktig.",
    specSourceUrl:
      "https://www.toshibavarmepumper.no/varmepumper-luft-luft/signatur-25/",
    specSourceLabel: TOS,
    specLastReviewed: R,
  },
  "Toshiba Daiseikai 10 Kontur": {
    specs: {
      heatingCapacityNominalKw: "3,2 kW ved 7 °C",
      heatingCapacityMinMaxKw: "opptil 6,7 kW ved 7 °C",
      coolingCapacityNominalKw: "2,5 kW",
      coolingCapacityMinMaxKw: "opptil 4,5 kW",
      scop: "5,5",
      seer: "10,5",
      energyClassHeating: "A+++",
      energyClassCooling: "A+++",
      indoorNoiseDb: "fra 19 dB(A) (stillemodus), maks 41 dB(A)",
      outdoorNoiseDb: "maks 47 dB(A)",
      operationTempHeating: "3,9 kW ved -25 °C, driftsområde ned til -30 °C",
      refrigerant: "R32",
      indoorUnitDimensions: "H 293 × B 930 × D 255 mm",
      outdoorUnitDimensions: "H 630 × B 800 × D 300 mm",
      weightIndoor: "14 kg",
      weightOutdoor: "43 kg",
    },
    variants: [
      {
        label: "Kontur 25",
        specs: {
          heatingCapacityNominalKw: "3,2 kW ved 7 °C",
          heatingCapacityMinMaxKw: "opptil 6,7 kW ved 7 °C",
          coolingCapacityNominalKw: "2,5 kW",
          coolingCapacityMinMaxKw: "opptil 4,5 kW",
          scop: "5,5",
          seer: "10,5",
          energyClassHeating: "A+++",
          energyClassCooling: "A+++",
          indoorNoiseDb: "19 – 41 dB(A)",
          outdoorNoiseDb: "maks 47 dB(A)",
          operationTempHeating: "3,9 kW ved -25 °C, driftsområde -30 til 24 °C",
          refrigerant: "R32",
          indoorUnitDimensions: "H 293 × B 930 × D 255 mm",
          outdoorUnitDimensions: "H 630 × B 800 × D 300 mm",
          weightIndoor: "14 kg",
          weightOutdoor: "43 kg",
        },
      },
      {
        label: "Kontur 35",
        specs: {
          heatingCapacityNominalKw: "4,0 kW ved 7 °C",
          heatingCapacityMinMaxKw: "opptil 7,7 kW ved 7 °C",
          coolingCapacityNominalKw: "3,5 kW",
          coolingCapacityMinMaxKw: "opptil 5,5 kW",
          scop: "5,4",
          seer: "9,5",
          energyClassHeating: "A+++",
          energyClassCooling: "A+++",
          indoorNoiseDb: "19 – 41 dB(A)",
          outdoorNoiseDb: "maks 49 dB(A)",
          operationTempHeating: "4,1 kW ved -25 °C, driftsområde -30 til 24 °C",
          refrigerant: "R32",
          indoorUnitDimensions: "H 293 × B 930 × D 255 mm",
          outdoorUnitDimensions: "H 630 × B 800 × D 300 mm",
          weightIndoor: "14 kg",
          weightOutdoor: "43 kg",
        },
      },
    ],
    specBasis: "Kontur 25 (RAS-B25S4KVPG-ND / RAS-25S4AVPG-ND)",
    guidanceNote: "Aktuell ved større varmebehov og kalde vintre.",
    specSourceUrl:
      "https://www.toshibavarmepumper.no/varmepumper-luft-luft/toshiba-kontur-25/",
    specSourceLabel: TOS,
    specLastReviewed: R,
  },
  "Toshiba Daiseikai 10 Ask": {
    specs: {
      heatingCapacityNominalKw: "3,2 kW ved 7 °C",
      heatingCapacityMinMaxKw: "opptil 6,7 kW ved 7 °C",
      coolingCapacityNominalKw: "2,5 kW",
      coolingCapacityMinMaxKw: "opptil 4,5 kW",
      scop: "5,5",
      seer: "10,5",
      energyClassHeating: "A+++",
      energyClassCooling: "A+++",
      indoorNoiseDb: "fra 19 dB(A) (stillemodus), maks 41 dB(A)",
      outdoorNoiseDb: "maks 47 dB(A)",
      operationTempHeating: "3,9 kW ved -25 °C, driftsområde ned til -30 °C",
      refrigerant: "R32",
      indoorUnitDimensions: "H 293 × B 940 × D 257 mm",
      outdoorUnitDimensions: "H 630 × B 800 × D 300 mm",
      weightIndoor: "16 kg",
      weightOutdoor: "43 kg",
    },
    variants: [
      {
        label: "Ask 25",
        specs: {
          heatingCapacityNominalKw: "3,2 kW ved 7 °C",
          heatingCapacityMinMaxKw: "opptil 6,7 kW ved 7 °C",
          coolingCapacityNominalKw: "2,5 kW",
          coolingCapacityMinMaxKw: "opptil 4,5 kW",
          scop: "5,5",
          seer: "10,5",
          energyClassHeating: "A+++",
          energyClassCooling: "A+++",
          indoorNoiseDb: "19 – 41 dB(A)",
          outdoorNoiseDb: "maks 47 dB(A)",
          operationTempHeating: "3,9 kW ved -25 °C, driftsområde -30 til 24 °C",
          refrigerant: "R32",
          indoorUnitDimensions: "H 293 × B 940 × D 257 mm",
          outdoorUnitDimensions: "H 630 × B 800 × D 300 mm",
          weightIndoor: "16 kg",
          weightOutdoor: "43 kg",
        },
      },
      {
        label: "Ask 35",
        specs: {
          heatingCapacityNominalKw: "4,0 kW ved 7 °C",
          heatingCapacityMinMaxKw: "opptil 7,7 kW ved 7 °C",
          coolingCapacityNominalKw: "3,5 kW",
          coolingCapacityMinMaxKw: "opptil 5,5 kW",
          scop: "5,4",
          seer: "9,5",
          energyClassHeating: "A+++",
          energyClassCooling: "A+++",
          indoorNoiseDb: "19 – 41 dB(A)",
          outdoorNoiseDb: "maks 49 dB(A)",
          operationTempHeating: "4,1 kW ved -25 °C, driftsområde -30 til 24 °C",
          refrigerant: "R32",
          indoorUnitDimensions: "H 292 × B 940 × D 257 mm",
          outdoorUnitDimensions: "H 630 × B 800 × D 300 mm",
          weightIndoor: "16 kg",
          weightOutdoor: "43 kg",
        },
      },
    ],
    specBasis: "Ask 25 (RAS-B25S4KVDG-ND / RAS-25S4AVPG-ND)",
    guidanceNote: "Aktuell ved større varmebehov og kalde vintre.",
    specSourceUrl:
      "https://www.toshibavarmepumper.no/varmepumper-luft-luft/toshiba-ask-25/",
    specSourceLabel: TOS,
    specLastReviewed: R,
  },
  "Toshiba Polar": {
    specs: {
      heatingCapacityNominalKw: "3,2 kW ved 7 °C",
      heatingCapacityMinMaxKw: "opptil 7,2 kW ved 7 °C",
      coolingCapacityNominalKw: "2,8 kW",
      coolingCapacityMinMaxKw: "opptil 3,5 kW",
      scop: "5,1",
      seer: "7,7",
      energyClassHeating: "A+++",
      energyClassCooling: "A++",
      indoorNoiseDb: "fra 19 dB(A) (stillemodus), maks 45 dB(A)",
      outdoorNoiseDb: "maks 48 dB(A)",
      operationTempHeating: "2,6 kW ved -25 °C",
      refrigerant: "R32",
      indoorUnitDimensions: "H 293 × B 800 × D 226 mm",
      outdoorUnitDimensions: "H 550 × B 780 × D 290 mm",
      weightIndoor: "10 kg",
      weightOutdoor: "33 kg",
    },
    variants: [
      {
        label: "Polar 25",
        specs: {
          heatingCapacityNominalKw: "3,2 kW ved 7 °C",
          heatingCapacityMinMaxKw: "opptil 7,2 kW ved 7 °C",
          coolingCapacityNominalKw: "2,8 kW",
          coolingCapacityMinMaxKw: "opptil 3,5 kW",
          scop: "5,1",
          seer: "7,7",
          energyClassHeating: "A+++",
          energyClassCooling: "A++",
          indoorNoiseDb: "19 – 45 dB(A)",
          outdoorNoiseDb: "maks 48 dB(A)",
          operationTempHeating: "2,6 kW ved -25 °C",
          refrigerant: "R32",
          indoorUnitDimensions: "H 293 × B 800 × D 226 mm",
          outdoorUnitDimensions: "H 550 × B 780 × D 290 mm",
          weightIndoor: "10 kg",
          weightOutdoor: "33 kg",
        },
      },
      {
        label: "Polar 35",
        specs: {
          heatingCapacityNominalKw: "4,2 kW ved 7 °C",
          heatingCapacityMinMaxKw: "opptil 7,7 kW ved 7 °C",
          coolingCapacityNominalKw: "3,5 kW",
          coolingCapacityMinMaxKw: "opptil 4,5 kW",
          scop: "5,1",
          seer: "7,3",
          energyClassHeating: "A++",
          energyClassCooling: "A++",
          indoorNoiseDb: "19 – 45 dB(A)",
          outdoorNoiseDb: "maks 48 dB(A)",
          operationTempHeating: "2,7 kW ved -25 °C",
          refrigerant: "R32",
          indoorUnitDimensions: "H 293 × B 800 × D 226 mm",
          outdoorUnitDimensions: "H 550 × B 780 × D 290 mm",
          weightIndoor: "10 kg",
          weightOutdoor: "33 kg",
        },
      },
      {
        label: "Polar 50",
        specs: {
          heatingCapacityNominalKw: "6,0 kW ved 7 °C",
          heatingCapacityMinMaxKw: "opptil 8,7 kW ved 7 °C",
          coolingCapacityNominalKw: "5,0 kW",
          coolingCapacityMinMaxKw: "opptil 6,5 kW",
          scop: "4,6",
          seer: "7,0",
          energyClassHeating: "A++",
          energyClassCooling: "A++",
          indoorNoiseDb: "26 – 47 dB(A)",
          outdoorNoiseDb: "maks 52 dB(A)",
          operationTempHeating: "5,1 kW ved -25 °C, driftsområde ned til -25 °C",
          refrigerant: "R32",
          indoorUnitDimensions: "H 320 × B 1053 × D 245 mm",
          outdoorUnitDimensions: "H 710 × B 900 × D 320 mm",
          weightIndoor: "14 kg",
          weightOutdoor: "56 kg",
        },
      },
    ],
    specBasis: "Polar 25 (RAS-B25G3KVSG-ND / RAS-25G3AVSG-ND)",
    guidanceNote: "Allroundmodell for vanlige boliger.",
    specSourceUrl:
      "https://www.toshibavarmepumper.no/varmepumper-luft-luft/toshiba-polar-25/",
    specSourceLabel: TOS,
    specLastReviewed: R,
  },
  "Toshiba Seiya": {
    specs: {
      heatingCapacityNominalKw: "3,2 kW ved 7 °C",
      heatingCapacityMinMaxKw: "opptil 5,0 kW ved 7 °C",
      coolingCapacityNominalKw: "2,5 kW",
      coolingCapacityMinMaxKw: "opptil 3,2 kW",
      scop: "4,6",
      seer: "6,5",
      energyClassHeating: "A++",
      energyClassCooling: "A++",
      indoorNoiseDb: "maks 44 dB(A)",
      outdoorNoiseDb: "maks 49 dB(A)",
      operationTempHeating: "1,6 kW ved -25 °C, driftsområde ned til -25 °C",
      refrigerant: "R32",
      indoorUnitDimensions: "H 293 × B 798 × D 230 mm",
      outdoorUnitDimensions: "H 550 × B 780 × D 290 mm",
      weightIndoor: "10 kg",
    },
    variants: [
      {
        label: "Seiya Nordic 25",
        specs: {
          heatingCapacityNominalKw: "3,2 kW ved 7 °C",
          heatingCapacityMinMaxKw: "opptil 5,0 kW ved 7 °C",
          coolingCapacityNominalKw: "2,5 kW",
          coolingCapacityMinMaxKw: "opptil 3,2 kW",
          scop: "4,6",
          seer: "6,5",
          energyClassHeating: "A++",
          energyClassCooling: "A++",
          indoorNoiseDb: "maks 44 dB(A)",
          outdoorNoiseDb: "maks 49 dB(A)",
          operationTempHeating: "1,6 kW ved -25 °C",
          refrigerant: "R32",
          indoorUnitDimensions: "H 293 × B 798 × D 230 mm",
          outdoorUnitDimensions: "H 550 × B 780 × D 290 mm",
          weightIndoor: "10 kg",
        },
      },
      {
        label: "Seiya Nordic 35",
        specs: {
          heatingCapacityNominalKw: "4,2 kW ved 7 °C",
          heatingCapacityMinMaxKw: "opptil 5,6 kW ved 7 °C",
          coolingCapacityNominalKw: "3,5 kW",
          coolingCapacityMinMaxKw: "opptil 4,4 kW",
          scop: "4,5",
          seer: "6,5",
          energyClassHeating: "A+",
          energyClassCooling: "A++",
          indoorNoiseDb: "21 – 46 dB(A)",
          outdoorNoiseDb: "maks 50 dB(A)",
          operationTempHeating: "2,2 kW ved -25 °C",
          refrigerant: "R32",
          indoorUnitDimensions: "H 293 × B 798 × D 230 mm",
          outdoorUnitDimensions: "H 550 × B 780 × D 290 mm",
          weightIndoor: "10 kg",
        },
      },
    ],
    specBasis: "Seiya Nordic 25 (RAS-B25E2KVG-ND / RAS-25E2AVG-ND)",
    guidanceNote: "Passer ofte for mindre boliger og moderat varmebehov.",
    specSourceUrl:
      "https://www.toshibavarmepumper.no/varmepumper-luft-luft/toshiba-seiya-nordic-25/",
    specSourceLabel: TOS,
    specLastReviewed: R,
  },
  "Toshiba Gulvmodell": {
    specs: {
      heatingCapacityNominalKw: "3,4 kW ved 7 °C",
      heatingCapacityMinMaxKw: "opptil 5,2 kW ved 7 °C",
      coolingCapacityNominalKw: "2,5 kW",
      coolingCapacityMinMaxKw: "opptil 3,4 kW",
      scop: "4,3",
      seer: "7,0",
      energyClassHeating: "A+",
      energyClassCooling: "A++",
      indoorNoiseDb: "fra 19 dB(A) (stillemodus), maks 41 dB(A)",
      outdoorNoiseDb: "maks 48 dB(A)",
      operationTempHeating: "2,1 kW ved -25 °C, driftsområde -25 til 24 °C",
      refrigerant: "R32",
      indoorUnitDimensions: "H 600 × B 700 × D 220 mm",
      outdoorUnitDimensions: "H 550 × B 780 × D 290 mm",
      weightIndoor: "16 kg",
      weightOutdoor: "33 kg",
    },
    specBasis: "Gulvmodell 25 (RAS-B25G3FVG-ND / RAS-25G3AVSG-ND)",
    guidanceNote: "Aktuell når høy montering på vegg ikke passer.",
    specSourceUrl:
      "https://www.toshibavarmepumper.no/varmepumper-luft-luft/toshiba-gulvmodell-25/",
    specSourceLabel: TOS,
    specLastReviewed: R,
  },
  "Toshiba Multisplitt Nordic": {
    specs: {
      heatingCapacityNominalKw: "7,4 kW ved 7 °C (samlet)",
      heatingCapacityMinMaxKw: "opptil 8,7 kW ved 7 °C",
      coolingCapacityNominalKw: "6,0 kW",
      coolingCapacityMinMaxKw: "opptil 7,0 kW",
      scop: "4,6",
      seer: "7,0",
      energyClassHeating: "A++",
      energyClassCooling: "A++",
      indoorNoiseDb: "fra 19 dB(A) (stillemodus), maks 45 dB(A)",
      outdoorNoiseDb: "maks 50 dB(A)",
      operationTempHeating: "5,1 kW ved -25 °C, driftsområde -25 til 24 °C",
      refrigerant: "R32",
      indoorUnitDimensions: "H 293 × B 800 × D 226 mm (per innedel)",
      outdoorUnitDimensions: "H 710 × B 900 × D 320 mm",
      weightIndoor: "10 kg (per innedel)",
      weightOutdoor: "58 kg",
    },
    specBasis:
      "Multi Nordic med 2 innedeler (RAS-B25G3KVSG-ND + RAS-B35G3KVSG-ND / RAS-2M60S4AVG-ND)",
    guidanceNote: "Aktuell ved behov for flere innedeler.",
    specSourceUrl:
      "https://www.toshibavarmepumper.no/varmepumper-luft-luft/multi-nordic/",
    specSourceLabel: TOS,
    specLastReviewed: R,
  },


  /* ---------------- Panasonic ---------------- */
  "Panasonic HZ Flagship": {
    specs: {
      heatingCapacityNominalKw: "3,2 kW",
      heatingCapacityMinMaxKw: "0,85 – 7,5 kW",
      coolingCapacityNominalKw: "2,5 kW",
      coolingCapacityMinMaxKw: "0,85 – 3,6 kW",
      scop: "5,69",
      energyClassHeating: "A+++",
      indoorNoiseDb: "18 – 45 dB(A)",
      outdoorNoiseDb: "47 dB(A)",
      operationTempHeating: "3,6 kW ved -25 °C, driftsområde ned til -25 °C",
      refrigerant: "R32",
      indoorUnitDimensions: "H 295 × B 870 × D 229 mm",
      outdoorUnitDimensions: "H 622 × B 824 × D 299 mm",
    },
    variants: [
      {
        label: "KIT-HZ25ZKE",
        specs: {
          heatingCapacityNominalKw: "3,20 kW",
          heatingCapacityMinMaxKw: "0,85 – 7,50 kW",
          coolingCapacityNominalKw: "2,50 kW",
          coolingCapacityMinMaxKw: "0,85 – 3,60 kW",
          scop: "5,69",
          energyClassHeating: "A+++",
          indoorNoiseDb: "18 – 45 dB(A)",
          outdoorNoiseDb: "47 dB(A)",
          operationTempHeating: "3,60 kW ved -25 °C",
          refrigerant: "R32",
          indoorUnitDimensions: "H 295 × B 870 × D 229 mm",
          outdoorUnitDimensions: "H 622 × B 824 × D 299 mm",
        },
      },
      {
        label: "KIT-HZ35ZKE",
        specs: {
          heatingCapacityNominalKw: "4,20 kW",
          heatingCapacityMinMaxKw: "0,85 – 7,90 kW",
          coolingCapacityNominalKw: "3,50 kW",
          coolingCapacityMinMaxKw: "0,85 – 4,60 kW",
          scop: "5,30",
          energyClassHeating: "A+++",
          indoorNoiseDb: "18 – 45 dB(A)",
          outdoorNoiseDb: "50 dB(A)",
          operationTempHeating: "3,70 kW ved -25 °C",
          refrigerant: "R32",
          indoorUnitDimensions: "H 295 × B 870 × D 229 mm",
          outdoorUnitDimensions: "H 622 × B 824 × D 299 mm",
        },
      },
    ],
    specBasis: "KIT-HZ25ZKE",
    guidanceNote: "Aktuell ved større varmebehov og kalde vintre.",
    specSourceUrl:
      "https://www.varmepumpeservice.no/panasonic-hz25zke-flagship-kit",
    specSourceLabel: PAN_DIST,
    specLastReviewed: R,
  },
  "Panasonic NZ": {
    specs: {
      heatingCapacityNominalKw: "3,4 kW",
      heatingCapacityMinMaxKw: "0,85 – 6,5 kW",
      coolingCapacityNominalKw: "2,5 kW",
      coolingCapacityMinMaxKw: "0,85 – 3,0 kW",
      scop: "5,0",
      seer: "8,0",
      energyClassHeating: "A++",
      energyClassCooling: "A++",
      indoorNoiseDb: "19 – 42 dB(A)",
      outdoorNoiseDb: "48 dB(A)",
      operationTempHeating: "2,25 kW ved -25 °C, driftsområde ned til -25 °C",
      refrigerant: "R32",
      indoorUnitDimensions: "H 295 × B 870 × D 229 mm",
      outdoorUnitDimensions: "H 622 × B 824 × D 299 mm",
    },
    variants: [
      {
        label: "KIT-NZ25YKE",
        specs: {
          heatingCapacityNominalKw: "3,40 kW",
          heatingCapacityMinMaxKw: "0,85 – 6,50 kW",
          coolingCapacityNominalKw: "2,50 kW",
          coolingCapacityMinMaxKw: "0,85 – 3,00 kW",
          scop: "5,00",
          energyClassHeating: "A++",
          indoorNoiseDb: "19 – 42 dB(A)",
          outdoorNoiseDb: "48 dB(A)",
          operationTempHeating: "2,25 kW ved -25 °C",
          refrigerant: "R32",
          indoorUnitDimensions: "H 295 × B 870 × D 229 mm",
          outdoorUnitDimensions: "H 622 × B 824 × D 299 mm",
        },
      },
      {
        label: "KIT-NZ35YKE",
        specs: {
          heatingCapacityNominalKw: "4,00 kW",
          heatingCapacityMinMaxKw: "0,85 – 7,40 kW",
          coolingCapacityNominalKw: "3,50 kW",
          coolingCapacityMinMaxKw: "0,85 – 4,00 kW",
          scop: "5,00",
          energyClassHeating: "A++",
          indoorNoiseDb: "19 – 44 dB(A)",
          outdoorNoiseDb: "50 dB(A)",
          operationTempHeating: "3,03 kW ved -25 °C",
          refrigerant: "R32",
          indoorUnitDimensions: "H 295 × B 870 × D 229 mm",
          outdoorUnitDimensions: "H 622 × B 824 × D 299 mm",
        },
      },
      {
        label: "KIT-NZ50YKE",
        specs: {
          heatingCapacityNominalKw: "5,80 kW",
          heatingCapacityMinMaxKw: "0,98 – 8,30 kW",
          coolingCapacityNominalKw: "5,00 kW",
          coolingCapacityMinMaxKw: "0,98 – 6,10 kW",
          scop: "4,80",
          energyClassHeating: "A++",
          indoorNoiseDb: "30 – 44 dB(A)",
          outdoorNoiseDb: "50 dB(A)",
          operationTempHeating: "3,72 kW ved -25 °C",
          refrigerant: "R32",
          indoorUnitDimensions: "H 295 × B 1040 × D 244 mm",
          outdoorUnitDimensions: "H 701 × B 875 × D 320 mm",
        },
      },
    ],
    specBasis: "KIT-NZ25YKE (CS-NZ25YKE + CU-NZ25YKE)",
    guidanceNote: "Allroundmodell som treffer de fleste vanlige boliger.",
    specSourceUrl:
      "https://www.aircon.panasonic.eu/NO_no/product/panasonic-nz25yke-etherea-inverter---r32/",
    specSourceLabel: `${PAN_OFF} + ${PAN_DIST}`,
    specLastReviewed: R,
  },
  "Panasonic CZ": {
    specs: {
      heatingCapacityNominalKw: "3,4 kW",
      heatingCapacityMinMaxKw: "0,85 – 5,3 kW",
      coolingCapacityNominalKw: "2,5 kW",
      coolingCapacityMinMaxKw: "0,85 – 3,0 kW",
      scop: "4,3",
      energyClassHeating: "A+",
      indoorNoiseDb: "20 – 40 dB(A)",
      outdoorNoiseDb: "47 dB(A)",
      operationTempHeating: "1,5 kW ved -25 °C, driftsområde ned til -25 °C",
      refrigerant: "R32",
      indoorUnitDimensions: "H 290 × B 779 × D 209 mm",
      outdoorUnitDimensions: "H 622 × B 824 × D 299 mm",
    },
    variants: [
      {
        label: "KIT-CZ25ZKE",
        specs: {
          heatingCapacityNominalKw: "3,40 kW",
          heatingCapacityMinMaxKw: "0,85 – 5,30 kW",
          coolingCapacityNominalKw: "2,50 kW",
          coolingCapacityMinMaxKw: "0,85 – 3,00 kW",
          scop: "4,30",
          energyClassHeating: "A+",
          indoorNoiseDb: "20 – 40 dB(A)",
          outdoorNoiseDb: "47 dB(A)",
          operationTempHeating: "1,50 kW ved -25 °C",
          refrigerant: "R32",
          indoorUnitDimensions: "H 290 × B 779 × D 209 mm",
          outdoorUnitDimensions: "H 622 × B 824 × D 299 mm",
        },
      },
      {
        label: "KIT-CZ35ZKE",
        specs: {
          heatingCapacityNominalKw: "4,00 kW",
          heatingCapacityMinMaxKw: "0,85 – 6,70 kW",
          coolingCapacityNominalKw: "3,50 kW",
          coolingCapacityMinMaxKw: "0,85 – 4,00 kW",
          scop: "4,30",
          energyClassHeating: "A+",
          indoorNoiseDb: "20 – 43 dB(A)",
          outdoorNoiseDb: "50 dB(A)",
          operationTempHeating: "2,40 kW ved -25 °C",
          refrigerant: "R32",
          indoorUnitDimensions: "H 290 × B 779 × D 209 mm",
          outdoorUnitDimensions: "H 622 × B 824 × D 299 mm",
        },
      },
    ],
    specBasis: "KIT-CZ25ZKE",
    guidanceNote: "Passer ofte for mindre boliger, hytte eller bod.",
    specSourceUrl:
      "https://www.varmepumpeservice.no/panasonic-cz25zke-kit-5-20-kw-",
    specSourceLabel: PAN_DIST,
    specLastReviewed: R,
  },
  "Panasonic LZ": {
    specs: {
      heatingCapacityNominalKw: "3,2 kW",
      heatingCapacityMinMaxKw: "0,85 – 6,55 kW",
      coolingCapacityNominalKw: "2,5 kW",
      coolingCapacityMinMaxKw: "0,85 – 3,0 kW",
      scop: "5,0",
      energyClassHeating: "A++",
      indoorNoiseDb: "18 – 45 dB(A)",
      outdoorNoiseDb: "44 dB(A)",
      operationTempHeating: "3,9 kW ved -15 °C",
      refrigerant: "R32",
      indoorUnitDimensions: "H 249 × B 790 × D 355 mm",
      outdoorUnitDimensions: "H 622 × B 824 × D 299 mm",
    },
    variants: [
      {
        label: "KIT-LZ25TKE",
        specs: {
          heatingCapacityNominalKw: "3,20 kW",
          heatingCapacityMinMaxKw: "0,85 – 6,55 kW",
          coolingCapacityNominalKw: "2,50 kW",
          coolingCapacityMinMaxKw: "0,85 – 3,00 kW",
          scop: "5,0",
          energyClassHeating: "A++",
          indoorNoiseDb: "18 – 45 dB(A)",
          outdoorNoiseDb: "44 dB(A)",
          operationTempHeating: "3,90 kW ved -15 °C",
          refrigerant: "R32",
          indoorUnitDimensions: "H 249 × B 790 × D 355 mm",
          outdoorUnitDimensions: "H 622 × B 824 × D 299 mm",
        },
      },
      {
        label: "KIT-LZ35TKE",
        specs: {
          heatingCapacityNominalKw: "4,20 kW",
          heatingCapacityMinMaxKw: "0,85 – 7,65 kW",
          coolingCapacityNominalKw: "3,50 kW",
          coolingCapacityMinMaxKw: "0,85 – 4,00 kW",
          scop: "4,9",
          energyClassHeating: "A++",
          indoorNoiseDb: "19 – 46 dB(A)",
          outdoorNoiseDb: "47 dB(A)",
          operationTempHeating: "4,35 kW ved -15 °C",
          refrigerant: "R32",
          indoorUnitDimensions: "H 249 × B 790 × D 355 mm",
          outdoorUnitDimensions: "H 622 × B 824 × D 299 mm",
        },
      },
    ],
    specBasis: "KIT-LZ25TKE",
    guidanceNote: "Aktuell ved utskifting av en eldre varmepumpe.",
    specSourceUrl: "https://www.varmepumpeservice.no/panasonic-lz25tke-kit",
    specSourceLabel: PAN_DIST,
    specLastReviewed: R,
  },
  "Panasonic VZ Heatcharge": {
    specs: {
      heatingCapacityNominalKw: "4,2 kW",
      heatingCapacityMinMaxKw: "0,60 – 9,2 kW",
      coolingCapacityNominalKw: "3,5 kW",
      coolingCapacityMinMaxKw: "0,60 – 4,0 kW",
      scop: "5,9",
      energyClassHeating: "A+++",
      indoorNoiseDb: "18 – 45 dB(A)",
      outdoorNoiseDb: "50 dB(A)",
      operationTempHeating: "3,67 kW ved -25 °C, driftsområde ned til -30 °C",
      refrigerant: "R32",
      indoorUnitDimensions: "H 295 × B 798 × D 375 mm",
      outdoorUnitDimensions: "H 630 × B 799 mm",
    },
    specBasis: "KIT-VZ12-SKE",
    guidanceNote: "Aktuell ved større varmebehov og kalde vintre.",
    specSourceUrl:
      "https://www.varmepumpeservice.no/vz12-ske-panasonic-heatcharge-kit-9-20-kw-",
    specSourceLabel: PAN_DIST,
    specLastReviewed: R,
  },
  "Panasonic Gulvmodell": {
    specs: {
      heatingCapacityNominalKw: "3,4 kW",
      heatingCapacityMinMaxKw: "0,85 – 5,5 kW",
      coolingCapacityNominalKw: "2,5 kW",
      coolingCapacityMinMaxKw: "0,85 – 3,4 kW",
      scop: "4,7",
      energyClassHeating: "A++",
      energyClassCooling: "A++",
      indoorNoiseDb: "19 – 38 dB(A)",
      outdoorNoiseDb: "48 dB(A)",
      operationTempHeating: "2,4 kW ved -25 °C, driftsområde ned til -25 °C",
      refrigerant: "R32",
      indoorUnitDimensions: "H 600 × B 750 × D 207 mm",
      outdoorUnitDimensions: "H 622 × B 824 × D 299 mm",
    },
    variants: [
      {
        label: "KIT-Z25CFEA-1",
        specs: {
          heatingCapacityNominalKw: "3,4 kW",
          heatingCapacityMinMaxKw: "0,85 – 5,50 kW",
          coolingCapacityNominalKw: "2,5 kW",
          coolingCapacityMinMaxKw: "0,85 – 3,40 kW",
          scop: "4,7",
          energyClassHeating: "A++",
          indoorNoiseDb: "19 – 38 dB(A)",
          outdoorNoiseDb: "48 dB(A)",
          operationTempHeating: "2,40 kW ved -25 °C",
          refrigerant: "R32",
          indoorUnitDimensions: "H 600 × B 750 × D 207 mm",
          outdoorUnitDimensions: "H 622 × B 824 × D 299 mm",
        },
      },
      {
        label: "KIT-Z35CFEA-1",
        specs: {
          heatingCapacityNominalKw: "4,3 kW",
          heatingCapacityMinMaxKw: "0,85 – 6,20 kW",
          coolingCapacityNominalKw: "3,5 kW",
          coolingCapacityMinMaxKw: "0,85 – 3,80 kW",
          scop: "4,6",
          energyClassHeating: "A++",
          indoorNoiseDb: "19 – 39 dB(A)",
          outdoorNoiseDb: "50 dB(A)",
          operationTempHeating: "2,85 kW ved -25 °C",
          refrigerant: "R32",
          indoorUnitDimensions: "H 600 × B 750 × D 207 mm",
          outdoorUnitDimensions: "H 622 × B 824 × D 299 mm",
        },
      },
    ],
    specBasis: "KIT-Z25CFEA-1",
    guidanceNote: "Aktuell når høy montering på vegg ikke passer.",
    specSourceUrl:
      "https://www.varmepumpeservice.no/panasonic-z25cfea-1-gulvmodell-kit-5-5kw-",
    specSourceLabel: PAN_DIST,
    specLastReviewed: R,
  },
};

export function productSpecsFor(name: string): ProductSpecEntry | null {
  return PRODUCT_SPECS[name] ?? null;
}

/** Compact card rows — only the few lines a customer scans quickly. */
export function compactSpecRows(
  specs: ProductSpecs,
): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = [];
  const heat = specs.heatingCapacityMinMaxKw ?? specs.heatingCapacityNominalKw;
  if (heat) rows.push({ label: "Varmeeffekt", value: heat });
  if (specs.scop) rows.push({ label: "SCOP", value: specs.scop });
  if (specs.indoorNoiseDb)
    rows.push({ label: "Lydnivå innedel", value: specs.indoorNoiseDb });
  if (specs.energyClassHeating)
    rows.push({ label: "Energiklasse varme", value: specs.energyClassHeating });
  return rows;
}

/** Full modal rows, in reading order. */
export function fullSpecRows(
  specs: ProductSpecs,
): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = [];
  const push = (label: string, value?: string) => {
    if (value) rows.push({ label, value });
  };
  push("Varmeeffekt (nominell)", specs.heatingCapacityNominalKw);
  push("Varmeeffekt (min–maks)", specs.heatingCapacityMinMaxKw);
  push("Kjøleeffekt (nominell)", specs.coolingCapacityNominalKw);
  push("Kjøleeffekt (min–maks)", specs.coolingCapacityMinMaxKw);
  push("SCOP", specs.scop);
  push("SEER", specs.seer);
  push("Energiklasse varme", specs.energyClassHeating);
  push("Energiklasse kjøling", specs.energyClassCooling);
  push("Lydnivå innedel", specs.indoorNoiseDb);
  push("Lydnivå utedel", specs.outdoorNoiseDb);
  push("Driftstemperatur varme", specs.operationTempHeating);
  push("Kuldemedium", specs.refrigerant);
  push("Mål innedel", specs.indoorUnitDimensions);
  push("Mål utedel", specs.outdoorUnitDimensions);
  push("Vekt innedel", specs.weightIndoor);
  push("Vekt utedel", specs.weightOutdoor);
  push("Veiledende areal", specs.suitableAreaIndicative);
  return rows;
}

/**
 * "Tekniske mål og data" — dimensions first, then capacity, efficiency,
 * noise, operating range and refrigerant. Missing values are dropped.
 */
export function technicalSpecRows(
  specs: ProductSpecs,
): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = [];
  const push = (label: string, value?: string) => {
    if (value) rows.push({ label, value });
  };
  push("Mål innedel", specs.indoorUnitDimensions);
  push("Vekt innedel", specs.weightIndoor);
  push("Mål utedel", specs.outdoorUnitDimensions);
  push("Vekt utedel", specs.weightOutdoor);
  push("Varmeeffekt (nominell)", specs.heatingCapacityNominalKw);
  push("Varmeeffekt (min–maks)", specs.heatingCapacityMinMaxKw);
  push("Kjøleeffekt (nominell)", specs.coolingCapacityNominalKw);
  push("Kjøleeffekt (min–maks)", specs.coolingCapacityMinMaxKw);
  push("SCOP", specs.scop);
  push("SEER", specs.seer);
  push("Energiklasse varme", specs.energyClassHeating);
  push("Energiklasse kjøling", specs.energyClassCooling);
  push("Lydnivå innedel", specs.indoorNoiseDb);
  push("Lydnivå utedel", specs.outdoorNoiseDb);
  push("Driftstemperatur varme", specs.operationTempHeating);
  push("Kuldemedium", specs.refrigerant);
  return rows;
}

/** Rows used for the side-by-side variant comparison in the modal. */
export const VARIANT_ROWS: Array<{
  label: string;
  get: (s: ProductSpecs) => string | undefined;
}> = [
  { label: "Varmeeffekt (min–maks)", get: (s) => s.heatingCapacityMinMaxKw },
  { label: "Varmeeffekt (nominell)", get: (s) => s.heatingCapacityNominalKw },
  { label: "Kjøleeffekt (nominell)", get: (s) => s.coolingCapacityNominalKw },
  { label: "Kjøleeffekt (min–maks)", get: (s) => s.coolingCapacityMinMaxKw },
  { label: "SCOP", get: (s) => s.scop },
  { label: "SEER", get: (s) => s.seer },
  { label: "Energiklasse varme", get: (s) => s.energyClassHeating },
  { label: "Energiklasse kjøling", get: (s) => s.energyClassCooling },
  { label: "Lydnivå innedel", get: (s) => s.indoorNoiseDb },
  { label: "Lydnivå utedel", get: (s) => s.outdoorNoiseDb },
  { label: "Drift varme", get: (s) => s.operationTempHeating },
  { label: "Mål innedel", get: (s) => s.indoorUnitDimensions },
  { label: "Vekt innedel", get: (s) => s.weightIndoor },
  { label: "Mål utedel", get: (s) => s.outdoorUnitDimensions },
  { label: "Vekt utedel", get: (s) => s.weightOutdoor },
  { label: "Kuldemedium", get: (s) => s.refrigerant },
];

export const SPEC_DISCLAIMER =
  "Tallene er produsent-/importørdata. Riktig modell må vurderes ut fra bolig, planløsning, plassering, klima og faktisk varmebehov.";

/** Note shown under the technical section and the variant table. */
export const TECH_DATA_NOTE =
  "Data er hentet fra produsent/importør. Riktig størrelse vurderes på befaring ut fra bolig, plassering og varmebehov.";

