import { Link } from "react-router-dom";
import { Check, ArrowRight, Snowflake, Wind, Volume2 } from "lucide-react";
import { useBrandLogos, BRAND_LOGO_CLASS } from "./useBrandLogos";

/**
 * Brand logo / product image slots.
 *
 * Real, rights-cleared assets can be dropped in here without touching the layout:
 *   1. Put the file in `src/assets/lier/brands/` (e.g. `mitsubishi-electric-logo.png`)
 *   2. The component discovers it automatically via import.meta.glob.
 *
 * While a logo is missing the card renders a clean typographic brand name.
 * Product image slots remain optional and render an icon illustration when empty.
 */
type BrandAsset = string | null;

type Brand = {
  name: string;
  logo: BrandAsset;
  product: BrandAsset;
  positioning: string;
  models: string[];
  bestFor: string[];
  icon: typeof Wind;
};

const BASE_BRANDS: Omit<Brand, "logo">[] = [
  {
    name: "Mitsubishi Electric",
    product: null,
    positioning: "Premium driftssikkerhet og høy komfort.",
    models: ["Kaiteki", "Hara", "Gulvmodell"],
    bestFor: ["Høy komfort", "Lavt lydnivå", "Lang levetid"],
    icon: Snowflake,
  },
  {
    name: "Panasonic",
    product: null,
    positioning: "Effektiv oppvarming, moderne design og smart styring.",
    models: ["HZ", "NZ", "LZ"],
    bestFor: ["God varmeeffekt", "Appstyring", "Moderne boliger"],
    icon: Wind,
  },
  {
    name: "Toshiba",
    product: null,
    positioning: "Stillegående og diskret komfort med stabil varme.",
    models: ["Daiseikai", "Polar", "Seiya"],
    bestFor: ["Stille drift", "Jevn temperatur", "Diskret design"],
    icon: Volume2,
  },
];

function BrandCard({ brand }: { brand: Brand }) {
  const Icon = brand.icon;
  return (
    <article className="bg-white rounded-xl border border-[hsl(var(--warm-beige))] p-6 flex flex-col">
      {/* Logo slot */}
      <div className="h-14 flex items-center justify-center mb-4">
        {brand.logo ? (
          <img
            src={brand.logo}
            alt={`${brand.name} logo`}
            loading="lazy"
            className={`w-auto object-contain ${BRAND_LOGO_CLASS[brand.name] ?? "max-h-10 max-w-[180px]"}`}
          />
        ) : (
          <h3 className="text-[15px] font-semibold tracking-[0.14em] uppercase text-[hsl(var(--mcs-navy))]">
            {brand.name}
          </h3>
        )}
      </div>

      {/* Product image slot — icon illustration when no asset exists */}
      <div className="rounded-lg overflow-hidden mb-5 border border-[hsl(var(--warm-beige))]">
        {brand.product ? (
          <img
            src={brand.product}
            alt={`Varmepumpe fra ${brand.name}`}
            loading="lazy"
            className="aspect-[4/3] w-full object-cover"
          />
        ) : (
          <div className="aspect-[4/3] w-full bg-gradient-to-br from-[hsl(var(--mcs-navy))] to-[hsl(var(--mcs-blue-deep))] flex flex-col items-center justify-center gap-2">
            <Icon className="h-9 w-9 text-white/85" strokeWidth={1.4} aria-hidden />
            <span className="text-[11px] uppercase tracking-[0.18em] text-white/70">
              Varmepumpe
            </span>
          </div>
        )}
      </div>

      <p className="text-sm text-[hsl(var(--mcs-navy))] font-medium leading-relaxed mb-4">
        {brand.positioning}
      </p>

      <div className="mb-4">
        <p className="text-[11px] uppercase tracking-wider text-[hsl(var(--mcs-muted))] mb-2">
          Aktuelle modellfamilier
        </p>
        <div className="flex flex-wrap gap-1.5">
          {brand.models.map((m) => (
            <span
              key={m}
              className="text-xs font-medium text-[hsl(var(--mcs-navy))] bg-[hsl(var(--warm-sand))] rounded-full px-2.5 py-1"
            >
              {m}
            </span>
          ))}
        </div>
      </div>

      <div className="mb-5 flex-1">
        <p className="text-[11px] uppercase tracking-wider text-[hsl(var(--mcs-muted))] mb-2">
          Passer for
        </p>
        <ul className="space-y-1.5">
          {brand.bestFor.map((b) => (
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
        Be om anbefaling <ArrowRight className="h-4 w-4" />
      </Link>
    </article>
  );
}

export function BrandShowcase() {
  const logos = useBrandLogos();
  const brands: Brand[] = BASE_BRANDS.map((b) => ({ ...b, logo: logos[b.name] ?? null }));

  return (
    <section id="varmepumper" className="bg-[hsl(var(--warm-cream))] pb-16 scroll-mt-28">
      <div className="mx-auto max-w-[1600px] px-6 sm:px-10 lg:px-12 xl:px-16 2xl:px-24">
        <div className="max-w-2xl mb-8">
          <h2 className="text-2xl lg:text-3xl font-bold text-[hsl(var(--mcs-navy))] leading-tight">
            Kvalitetsmerker vi anbefaler
          </h2>
          <div className="h-0.5 w-10 bg-[hsl(var(--mcs-orange))] mt-3 mb-4" />
          <p className="text-sm text-[hsl(var(--mcs-muted))] leading-relaxed">
            Vi anbefaler varmepumper ut fra bolig, planløsning, plassering, lydnivå og ønsket
            komfort. Derfor jobber vi med flere solide merkevarer tilpasset norske forhold.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {brands.map((b) => (
            <BrandCard key={b.name} brand={b} />
          ))}
        </div>

        <p className="text-xs text-[hsl(var(--mcs-muted))] mt-5">
          Modellutvalg varierer med tilgjengelighet og behov. Vi anbefaler konkret modell etter
          befaring.
        </p>
      </div>
    </section>
  );
}
