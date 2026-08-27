import { Check, Phone, Mail, Globe, ArrowRight } from "lucide-react";
import { useLead } from "./LeadContext";
// Renset alpha-cutout (v3). Bruk kun på lys bakgrunn — se docs for produksjonsasset.
import vanAsset from "@/assets/lier/servicebil-v3.webp.asset.json";

/**
 * «Vi kommer til deg» — seksjon med profilert servicebil.
 * Alt innhold er samlet i konstanter under slik at tekst, kontaktpunkter
 * og bilde enkelt kan byttes senere.
 */

const CONTENT = {
  title: "Vi kommer til deg – lokalt og ryddig",
  lead: "Lier Varmepumpeservice møter deg med lokal oppfølging, profilert servicebil og fagfolk som leverer ryddig arbeid fra befaring til service.",
  trustPoints: [
    "Lokal aktør i Lier og omegn",
    "F-gass-sertifiserte teknikere",
    "Befaring, montering og service",
    "Dokumentert oppfølging og servicehistorikk",
  ],
  phone: { label: "466 22 028", href: "tel:+4746622028" },
  email: { label: "post@liervarmepumpeservice.no", href: "mailto:post@liervarmepumpeservice.no" },
  web: { label: "liervarmepumpeservice.no", href: "https://liervarmepumpeservice.no" },
  primaryCta: "Bestill befaring",
  secondaryCta: "Kontakt oss",
  imageAlt: "Profilert servicebil fra Lier Varmepumpeservice — VW ID. Buzz med logo og kontaktinfo",
  imageSrc: vanAsset.url,
};

export function ServiceVanSection() {
  const { startLead } = useLead();

  return (
    <section id="servicebil" className="bg-[hsl(var(--warm-cream))] py-20 lg:py-28 scroll-mt-28">
      <div className="mx-auto max-w-[1600px] px-6 sm:px-10 lg:px-12 xl:px-16 2xl:px-24">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          {/* Tekst og CTA */}
          <div className="lg:order-1 max-w-xl">
            <h2 className="text-2xl lg:text-[2.1rem] font-bold text-[hsl(var(--mcs-navy))] leading-tight">
              {CONTENT.title}
            </h2>
            <div className="h-0.5 w-10 bg-[hsl(var(--mcs-orange))] mt-4 mb-5" />
            <p className="text-[hsl(var(--mcs-navy))]/80 text-[15px] lg:text-base leading-relaxed mb-7">
              {CONTENT.lead}
            </p>

            <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-3 mb-8">
              {CONTENT.trustPoints.map((p) => (
                <li key={p} className="flex items-start gap-2 text-sm text-[hsl(var(--mcs-navy))]">
                  <Check className="h-4 w-4 text-[hsl(var(--mcs-orange))] mt-0.5 shrink-0" /> {p}
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm mb-8">
              <a href={CONTENT.phone.href} className="inline-flex items-center gap-2 font-semibold text-[hsl(var(--mcs-navy))] hover:text-[hsl(var(--mcs-orange))]">
                <Phone className="h-4 w-4" /> {CONTENT.phone.label}
              </a>
              <a href={CONTENT.email.href} className="inline-flex items-center gap-2 font-semibold text-[hsl(var(--mcs-navy))] hover:text-[hsl(var(--mcs-orange))]">
                <Mail className="h-4 w-4" /> {CONTENT.email.label}
              </a>
              <a href={CONTENT.web.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 font-semibold text-[hsl(var(--mcs-navy))] hover:text-[hsl(var(--mcs-orange))]">
                <Globe className="h-4 w-4" /> {CONTENT.web.label}
              </a>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => startLead({ source: "hero", interestType: "befaring" })}
                className="bg-[hsl(var(--mcs-orange))] hover:bg-[hsl(var(--mcs-orange-hover))] text-white font-semibold px-6 py-3 rounded-md inline-flex items-center justify-center gap-2"
              >
                {CONTENT.primaryCta} <ArrowRight className="h-4 w-4" />
              </button>
              <a
                href="/#kontakt"
                className="border border-[hsl(var(--mcs-navy))]/25 hover:border-[hsl(var(--mcs-navy))] text-[hsl(var(--mcs-navy))] font-semibold px-6 py-3 rounded-md inline-flex items-center justify-center"
              >
                {CONTENT.secondaryCta}
              </a>
            </div>
          </div>

          {/* Bil — under teksten på mobil, høyre side på desktop */}
          <div className="lg:order-2 relative flex items-center justify-center">
            {/* Diskret lys flate bak bilen — holder cutouten på lys bakgrunn */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 h-[78%] rounded-[999px] bg-[radial-gradient(closest-side,rgba(255,255,255,0.95),rgba(255,255,255,0))]"
            />
            <img
              src={CONTENT.imageSrc}
              alt={CONTENT.imageAlt}
              loading="lazy"
              decoding="async"
              width={1608}
              height={855}
              className="relative w-full max-w-[760px] xl:max-w-[840px] h-auto drop-shadow-[0_28px_30px_rgba(15,35,60,0.14)]"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
