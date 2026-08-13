import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Check, ArrowRight, ExternalLink, Snowflake, Wind, Volume2 } from "lucide-react";
import { useBrandLogos, BRAND_LOGO_CLASS } from "./useBrandLogos";

export type BrandName = "Mitsubishi Electric" | "Panasonic" | "Toshiba";

export type ProductItem = {
  name: string;
  subtitle: string;
  description: string;
  tags: string[];
  bestFor: string[];
  sourceUrl: string;
  /** Optional local asset slot — never hotlink supplier images. */
  image?: string | null;
  featured?: boolean;
};

export type ProductCategory = {
  title: string;
  description: string;
  sourceUrl: string;
  products: ProductItem[];
};

export type ProductBrand = {
  brand: BrandName;
  logo?: string | null;
  intro: string;
  sourceUrl: string;
  categories: ProductCategory[];
};

const MEE = "https://mee.no/privat/produktkategori/luft-luft-varmepumper/";

const BRAND_ICON: Record<BrandName, typeof Wind> = {
  "Mitsubishi Electric": Snowflake,
  Panasonic: Wind,
  Toshiba: Volume2,
};

const BRANDS: ProductBrand[] = [
  {
    brand: "Mitsubishi Electric",
    intro:
      "Premium driftssikkerhet og høy komfort, med et bredt utvalg modeller for ulike planløsninger.",
    sourceUrl: MEE,
    categories: [
      {
        title: "Toppmodell",
        description: "Toppmodell for høy komfort og sterk ytelse.",
        sourceUrl: MEE,
        products: [
          {
            name: "UWANO Pure",
            subtitle: "Toppmodell",
            description: "Toppmodell for høy komfort og sterk ytelse.",
            tags: ["Toppmodell", "Premium", "Luft-luft"],
            bestFor: ["Høy komfort", "Sterk ytelse", "Større oppholdsrom"],
            sourceUrl: MEE,
            featured: true,
          },
        ],
      },
      {
        title: "Komfortmodell",
        description: "Komfortmodell for jevn varme og god innekomfort.",
        sourceUrl: MEE,
        products: [
          {
            name: "GUSSURI",
            subtitle: "Komfortmodell",
            description: "Komfortmodell for jevn varme og god innekomfort.",
            tags: ["Komfort", "Stillegående", "Luft-luft"],
            bestFor: ["Jevn varme", "Lavt lydnivå", "Soverom og stue"],
            sourceUrl: MEE,
            featured: true,
          },
        ],
      },
      {
        title: "Bestselger",
        description: "Populær modell med design, ytelse og flere fargevalg.",
        sourceUrl: MEE,
        products: [
          {
            name: "Kaiteki",
            subtitle: "Bestselger",
            description: "Populær modell med design, ytelse og flere fargevalg.",
            tags: ["Bestselger", "Design", "Luft-luft"],
            bestFor: ["Normal bolig", "Design og fargevalg", "God totalpakke"],
            sourceUrl: MEE,
            featured: true,
          },
        ],
      },
      {
        title: "Kompaktmodell",
        description: "Kompakt modell der plass og diskret montering er viktig.",
        sourceUrl: MEE,
        products: [
          {
            name: "IGURU",
            subtitle: "Kompaktmodell",
            description:
              "Kompakt modell for boliger der plass og diskret montering er viktig.",
            tags: ["Kompakt", "Diskret", "Luft-luft"],
            bestFor: ["Begrenset veggplass", "Mindre rom", "Diskret montering"],
            sourceUrl: MEE,
          },
        ],
      },
      {
        title: "Gulvmodell",
        description: "Gulvmodell for lav plassering på vegg.",
        sourceUrl: MEE,
        products: [
          {
            name: "Furo",
            subtitle: "Gulvmodell",
            description:
              "Gulvmodell for plassering lavt på vegg, godt egnet i enkelte planløsninger.",
            tags: ["Gulvmodell", "Komfort", "Luft-luft"],
            bestFor: ["Lav plassering", "Eldre bolig", "Spesielle planløsninger"],
            sourceUrl: MEE,
          },
        ],
      },
      {
        title: "Designmodell",
        description: "Designmodell for interiørtilpasning.",
        sourceUrl: MEE,
        products: [
          {
            name: "Zen",
            subtitle: "Designmodell",
            description:
              "Designmodell for boliger der utseende og interiørtilpasning betyr mye.",
            tags: ["Design", "Diskret", "Luft-luft"],
            bestFor: ["Synlig plassering", "Moderne interiør", "Designbevisste hjem"],
            sourceUrl: MEE,
          },
        ],
      },
      {
        title: "Duo-modellen",
        description: "Løsning for flere soner eller større dekningsbehov.",
        sourceUrl: MEE,
        products: [
          {
            name: "Duo-modellen",
            subtitle: "To soner",
            description: "Løsning for flere soner eller større dekningsbehov.",
            tags: ["Duo", "Flere soner", "Luft-luft"],
            bestFor: ["To soner", "Større dekningsbehov", "Åpen planløsning"],
            sourceUrl: MEE,
          },
        ],
      },
      {
        title: "Multimodell",
        description: "Multiløsning for flere innedeler i større boliger.",
        sourceUrl: MEE,
        products: [
          {
            name: "Nordic Multi",
            subtitle: "Multimodell",
            description:
              "Multiløsning for flere innedeler og bedre dekning i større boliger.",
            tags: ["Multi", "Flere innedeler", "Større bolig"],
            bestFor: ["Flere rom", "Større bolig", "Høyere dekningsgrad"],
            sourceUrl: MEE,
            featured: true,
          },
        ],
      },
    ],
  },
  {
    brand: "Panasonic",
    intro:
      "Effektiv oppvarming, moderne design og smart styring — fra kompakte modeller til luft-vann og næring.",
    sourceUrl: "https://www.varmepumpeservice.no/panasonic?parent=10005",
    categories: [
      {
        title: "Bestselgere Panasonic",
        description: "De mest solgte seriene for norske boliger.",
        sourceUrl: "https://www.varmepumpeservice.no/panasonic-bestselgere",
        products: [
          {
            name: "Panasonic HZ Flagship",
            subtitle: "Toppserie",
            description: "Toppserie med nanoe X-teknologi og høy varmeeffekt.",
            tags: ["Toppmodell", "nanoe X", "Luft-luft"],
            bestFor: ["Høy komfort", "Moderne bolig", "God varmeeffekt"],
            sourceUrl: "https://www.varmepumpeservice.no/panasonic-bestselgere",
            featured: true,
          },
          {
            name: "Panasonic NZ",
            subtitle: "Pris og ytelse",
            description:
              "Mye av funksjonaliteten fra toppmodellene til lavere prisnivå.",
            tags: ["Pris/ytelse", "Luft-luft", "Smart valg"],
            bestFor: ["Normal bolig", "God ytelse", "Fornuftig investering"],
            sourceUrl: "https://www.varmepumpeservice.no/panasonic-bestselgere",
            featured: true,
          },
          {
            name: "Panasonic CZ",
            subtitle: "Kompakt veggmodell",
            description:
              "Kompakt veggmodell med innebygd WiFi, egnet der plassen er begrenset.",
            tags: ["Kompakt", "WiFi", "Luft-luft"],
            bestFor: ["Mindre rom", "Begrenset plass", "Enkel styring"],
            sourceUrl: "https://www.varmepumpeservice.no/panasonic-bestselgere",
          },
          {
            name: "Panasonic Gulvmodell",
            subtitle: "Gulvmodell",
            description:
              "Gulvmodell for alternative plasseringer og boliger der veggplass er utfordrende.",
            tags: ["Gulvmodell", "Komfort", "Luft-luft"],
            bestFor: ["Lav plassering", "Eldre bolig", "Spesielle planløsninger"],
            sourceUrl: "https://www.varmepumpeservice.no/panasonic-bestselgere",
          },
          {
            name: "Panasonic LZ",
            subtitle: "Utskiftingsmodell",
            description: "Godt egnet som utskiftingspumpe.",
            tags: ["Utskifting", "Luft-luft"],
            bestFor: ["Erstatte gammel varmepumpe", "Eksisterende plassering"],
            sourceUrl: "https://www.varmepumpeservice.no/panasonic-bestselgere",
          },
          {
            name: "Panasonic VZ Heatcharge",
            subtitle: "Kraftig premiummodell",
            description: "Kraftig modell med Heatcharge-teknologi for høyt varmebehov.",
            tags: ["Heatcharge", "Kraftig", "Premium"],
            bestFor: ["Høyt varmebehov", "Kaldt klima", "Premiumløsning"],
            sourceUrl: "https://www.varmepumpeservice.no/panasonic-bestselgere",
            featured: true,
          },
        ],
      },
      {
        title: "Multisplitt med innedeler",
        description:
          "Flere innedeler koblet til samme utedel for bedre dekning i flere rom.",
        sourceUrl:
          "https://www.varmepumpeservice.no/panasonic-multisplitt-med-innedeler",
        products: [],
      },
      {
        title: "Multisplitt nordisk med innedeler",
        description: "Multisplitt tilpasset nordiske forhold.",
        sourceUrl:
          "https://www.varmepumpeservice.no/panasonic-multisplitt-nordisk-med-innedeler",
        products: [],
      },
      {
        title: "Luft/vann",
        description:
          "Luft-vann-løsninger for vannbåren varme og høyere dekningsgrad.",
        sourceUrl: "https://www.varmepumpeservice.no/panasonic-luft-vann",
        products: [],
      },
      {
        title: "Panasonic Næring",
        description:
          "Løsninger for næringsbygg, tekniske rom, kontor og større installasjoner.",
        sourceUrl: "https://www.varmepumpeservice.no/panasonic-naering",
        products: [],
      },
    ],
  },
  {
    brand: "Toshiba",
    intro:
      "Stillegående og diskret komfort med stabil varme, og et sterkt utvalg tilpasset nordisk klima.",
    sourceUrl: "https://www.varmepumpeservice.no/toshiba?parent=10005",
    categories: [
      {
        title: "Toshiba bestselgere",
        description: "De mest populære Toshiba-seriene.",
        sourceUrl: "https://www.varmepumpeservice.no/toshiba-bestselgere",
        products: [
          {
            name: "Toshiba Signatur",
            subtitle: "Designmodell",
            description:
              "Designmodell med energismarte funksjoner og utskiftbar tekstilfront.",
            tags: ["Design", "Tekstilfront", "Luft-luft"],
            bestFor: ["Designbevisste hjem", "Synlig plassering", "Moderne interiør"],
            sourceUrl: "https://www.varmepumpeservice.no/toshiba-bestselgere",
            featured: true,
          },
          {
            name: "Toshiba Daiseikai 10 Kontur",
            subtitle: "Toppmodell",
            description: "Toppmodell med kraftig varmeeffekt og avansert teknologi.",
            tags: ["Toppmodell", "Kraftig", "Luft-luft"],
            bestFor: ["Høy komfort", "Kaldt klima", "Høyt varmebehov"],
            sourceUrl: "https://www.varmepumpeservice.no/toshiba-bestselgere",
            featured: true,
          },
          {
            name: "Toshiba Daiseikai 10 Ask",
            subtitle: "Toppmodell, dempet design",
            description: "Toppmodell med avansert teknologi og dempet designuttrykk.",
            tags: ["Toppmodell", "Design", "Komfort"],
            bestFor: ["Premium komfort", "Design", "Større oppholdsrom"],
            sourceUrl: "https://www.varmepumpeservice.no/toshiba-bestselgere",
          },
          {
            name: "Toshiba Polar",
            subtitle: "For kaldt klima",
            description:
              "Kraftig varmepumpe med høy energiklasse, tilpasset kaldt klima.",
            tags: ["Kaldt klima", "Kraftig", "Luft-luft"],
            bestFor: ["Nordiske forhold", "Enebolig", "Høy varmeeffekt"],
            sourceUrl: "https://www.varmepumpeservice.no/toshiba-bestselgere",
            featured: true,
          },
          {
            name: "Toshiba Seiya",
            subtitle: "Nordisk budsjettmodell",
            description: "Nordisk budsjettmodell med smarte funksjoner.",
            tags: ["Budsjett", "Nordisk", "Luft-luft"],
            bestFor: ["Prisbevisste kunder", "Mindre bolig", "Enkel komfort"],
            sourceUrl: "https://www.varmepumpeservice.no/toshiba-bestselgere",
          },
          {
            name: "Toshiba Gulvmodell",
            subtitle: "Gulvmodell",
            description: "Gulvmodell for alternative plasseringer.",
            tags: ["Gulvmodell", "Komfort", "Luft-luft"],
            bestFor: ["Lav plassering", "Spesielle planløsninger", "Eldre bolig"],
            sourceUrl: "https://www.varmepumpeservice.no/toshiba-bestselgere",
          },
        ],
      },
      {
        title: "Tekstiltrekk til Toshiba Signatur",
        description: "Tilbehør for å tilpasse Toshiba Signatur til interiøret.",
        sourceUrl:
          "https://www.varmepumpeservice.no/tekstiltrekk-til-toshiba-signatur",
        products: [],
      },
      {
        title: "Toshiba Multisplitt",
        description: "Flere innedeler for bedre romdekning.",
        sourceUrl: "https://www.varmepumpeservice.no/toshiba-multisplitt",
        products: [],
      },
      {
        title: "Toshiba Multisplitt Nordic",
        description: "Multisplitt tilpasset nordiske forhold.",
        sourceUrl: "https://www.varmepumpeservice.no/toshiba-multisplitt-nordic",
        products: [],
      },
    ],
  },
];

const RECOMMENDED = "Anbefalte modeller";

function ProductCard({
  product,
  brand,
  logo,
}: {
  product: ProductItem;
  brand: BrandName;
  logo: string | null;
}) {
  const Icon = BRAND_ICON[brand];
  return (
    <article className="bg-white rounded-xl border border-[hsl(var(--warm-beige))] p-5 flex flex-col">
      <div className="h-10 flex items-center mb-4">
        {logo ? (
          <img
            src={logo}
            alt={`${brand} logo`}
            loading="lazy"
            className={`w-auto object-contain ${BRAND_LOGO_CLASS[brand] ?? "max-h-10 max-w-[180px]"}`}
          />
        ) : (
          <span className="text-[13px] font-semibold tracking-[0.14em] uppercase text-[hsl(var(--mcs-navy))]">
            {brand}
          </span>
        )}
      </div>

      <div className="rounded-lg overflow-hidden mb-4 border border-[hsl(var(--warm-beige))]">
        {product.image ? (
          <img
            src={product.image}
            alt={`${product.name} varmepumpe`}
            loading="lazy"
            className="aspect-[4/3] w-full object-contain bg-white"
          />
        ) : (
          <div className="aspect-[4/3] w-full bg-gradient-to-br from-[hsl(var(--mcs-navy))] to-[hsl(var(--mcs-blue-deep))] flex flex-col items-center justify-center gap-2">
            <Icon className="h-9 w-9 text-white/85" strokeWidth={1.4} aria-hidden />
            <span className="text-[11px] uppercase tracking-[0.18em] text-white/70">
              {product.subtitle}
            </span>
          </div>
        )}
      </div>

      <h3 className="text-base font-bold text-[hsl(var(--mcs-navy))] leading-tight">
        {product.name}
      </h3>
      <p className="text-[11px] uppercase tracking-wider text-[hsl(var(--mcs-muted))] mt-1 mb-2">
        {product.subtitle}
      </p>
      <p className="text-sm text-[hsl(var(--mcs-muted))] leading-relaxed mb-4">
        {product.description}
      </p>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {product.tags.map((t) => (
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
          {product.bestFor.map((b) => (
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
        Få anbefalt riktig modell <ArrowRight className="h-4 w-4" />
      </Link>
      <a
        href={product.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center justify-center gap-1.5 text-xs font-medium text-[hsl(var(--mcs-navy))]/70 hover:text-[hsl(var(--mcs-navy))]"
      >
        Les mer hos leverandør <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </article>
  );
}

export function ProductShowcase() {
  const logos = useBrandLogos();
  const [activeBrand, setActiveBrand] = useState<BrandName>("Mitsubishi Electric");
  const [activeCategory, setActiveCategory] = useState<string>(RECOMMENDED);

  const brand = BRANDS.find((b) => b.brand === activeBrand)!;
  const logo = logos[activeBrand] ?? null;

  const visibleProducts = useMemo(() => {
    if (activeCategory === RECOMMENDED) {
      return brand.categories.flatMap((c) => c.products.filter((p) => p.featured));
    }
    return brand.categories.find((c) => c.title === activeCategory)?.products ?? [];
  }, [brand, activeCategory]);

  const activeCat =
    activeCategory === RECOMMENDED
      ? null
      : brand.categories.find((c) => c.title === activeCategory) ?? null;

  const selectBrand = (name: BrandName) => {
    setActiveBrand(name);
    setActiveCategory(RECOMMENDED);
  };

  return (
    <section id="varmepumper" className="bg-[hsl(var(--warm-cream))] pb-16 scroll-mt-28">
      <div className="mx-auto max-w-[1600px] px-6 sm:px-10 lg:px-12 xl:px-16 2xl:px-24">
        <div className="max-w-2xl mb-7">
          <h2 className="text-2xl lg:text-3xl font-bold text-[hsl(var(--mcs-navy))] leading-tight">
            Kvalitetsmerker vi anbefaler
          </h2>
          <div className="h-0.5 w-10 bg-[hsl(var(--mcs-orange))] mt-3 mb-4" />
          <p className="text-sm text-[hsl(var(--mcs-muted))] leading-relaxed">
            Vi fører og anbefaler flere serier fra Mitsubishi Electric, Panasonic og Toshiba.
            Riktig modell avhenger av bolig, planløsning, plassering, lydkrav og ønsket komfort.
          </p>
        </div>

        {/* Brand tabs */}
        <div
          role="tablist"
          aria-label="Merker"
          className="inline-flex flex-wrap gap-1 bg-white border border-[hsl(var(--warm-beige))] rounded-full p-1 mb-5"
        >
          {BRANDS.map((b) => {
            const active = b.brand === activeBrand;
            return (
              <button
                key={b.brand}
                role="tab"
                aria-selected={active}
                onClick={() => selectBrand(b.brand)}
                className={`text-sm font-semibold px-4 py-2 rounded-full transition-colors ${
                  active
                    ? "bg-[hsl(var(--mcs-navy))] text-white"
                    : "text-[hsl(var(--mcs-navy))] hover:bg-[hsl(var(--warm-sand))]"
                }`}
              >
                {b.brand}
              </button>
            );
          })}
        </div>

        <p className="text-sm text-[hsl(var(--mcs-navy))] font-medium mb-4 max-w-2xl">
          {brand.intro}
        </p>

        {/* Category pills */}
        <div className="flex flex-wrap gap-2 mb-6">
          {[RECOMMENDED, ...brand.categories.map((c) => c.title)].map((title) => {
            const active = title === activeCategory;
            return (
              <button
                key={title}
                onClick={() => setActiveCategory(title)}
                className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                  active
                    ? "bg-[hsl(var(--mcs-orange))] text-white border-transparent"
                    : "bg-white text-[hsl(var(--mcs-navy))] border-[hsl(var(--warm-beige))] hover:border-[hsl(var(--mcs-navy))]/30"
                }`}
              >
                {title}
              </button>
            );
          })}
        </div>

        {activeCat && (
          <div className="mb-5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <p className="text-sm text-[hsl(var(--mcs-muted))]">{activeCat.description}</p>
            <a
              href={activeCat.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--mcs-navy))] hover:underline"
            >
              Se kategorien hos leverandør <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        )}

        {visibleProducts.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {visibleProducts.map((p) => (
              <ProductCard key={p.name} product={p} brand={brand.brand} logo={logo} />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-[hsl(var(--warm-beige))] p-6 max-w-2xl">
            <p className="text-sm text-[hsl(var(--mcs-navy))] font-medium mb-2">
              {activeCat?.title}
            </p>
            <p className="text-sm text-[hsl(var(--mcs-muted))] mb-4">
              {activeCat?.description} Vi setter sammen riktig løsning etter befaring.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/#kontakt"
                className="inline-flex items-center gap-2 bg-[hsl(var(--mcs-orange))] hover:bg-[hsl(var(--mcs-orange-hover))] text-white text-sm font-semibold px-4 py-2.5 rounded-md"
              >
                Få anbefalt riktig modell <ArrowRight className="h-4 w-4" />
              </Link>
              {activeCat && (
                <a
                  href={activeCat.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-[hsl(var(--mcs-navy))]/70 hover:text-[hsl(var(--mcs-navy))]"
                >
                  Les mer hos leverandør <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <p className="text-xs text-[hsl(var(--mcs-muted))]">
            Utvalget over er ment som veiledning. Endelig modell anbefales etter befaring, og
            modellutvalg kan variere med tilgjengelighet og behov.
          </p>
          <a
            href={brand.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--mcs-navy))] hover:underline shrink-0"
          >
            Se hele utvalget fra {brand.brand} <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </section>
  );
}
