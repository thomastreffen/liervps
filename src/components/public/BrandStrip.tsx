import { useBrandLogos, BRAND_STRIP_LOGO_CLASS } from "./useBrandLogos";

const BRAND_ORDER = ["Mitsubishi Electric", "Panasonic", "Toshiba"];

export function BrandStrip() {
  const logos = useBrandLogos();

  return (
    <section className="bg-[hsl(var(--warm-cream))] border-t border-[hsl(var(--warm-beige))] py-6">
      <div className="mx-auto max-w-[1600px] px-6 sm:px-10 lg:px-12 xl:px-16 2xl:px-24">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8">
          <p className="text-sm text-[hsl(var(--mcs-muted))] text-center sm:text-left">
            Vi jobber med kvalitetsmerker fra
          </p>
          <div className="flex items-center justify-center gap-5 sm:gap-7 flex-wrap">
            {BRAND_ORDER.map((name) =>
              logos[name] ? (
                <img
                  key={name}
                  src={logos[name]!}
                  alt={`${name} logo`}
                  loading="lazy"
                  className="h-7 w-auto max-w-[140px] object-contain"
                />
              ) : (
                <span
                  key={name}
                  className="text-sm font-semibold text-[hsl(var(--mcs-navy))]"
                >
                  {name}
                </span>
              )
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
