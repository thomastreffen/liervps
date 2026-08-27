import { Check, Phone, Mail, Globe, ArrowRight } from "lucide-react";
import { useLead } from "./LeadContext";
import vanAsset from "@/assets/lier/servicebil.png.asset.json";

/**
 * «Møt oss ute hos kunde» — seksjon med profilert servicebil.
 * Alt innhold er samlet i konstanter under slik at tekst, kontaktpunkter
 * og bilde enkelt kan byttes senere.
 */

const CONTENT = {
  title: "Møt oss ute hos kunde",
  lead: "Lier Varmepumpeservice møter deg med lokal oppfølging, profilert servicebil og fagfolk som leverer ryddig arbeid fra befaring til service.",
  trustPoints: [
    "Lokal aktør i Lier og omegn",
    "F-gass-sertifiserte teknikere",
    "Rådgivning, montering og service",
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
    <section id="servicebil" className="bg-[hsl(var(--warm-cream))] pb-16 scroll-mt-28">
      <div className="mx-auto max-w-[1600px] px-6 sm:px-10 lg:px-12 xl:px-16 2xl:px-24">
        <div className="rounded-2xl bg-white border border-[hsl(var(--warm-beige))] shadow-sm overflow-hidden grid lg:grid-cols-2 items-center">
          {/* Bilde — øverst på mobil, høyre side på desktop */}
          <div className="relative bg-[hsl(var(--warm-sand))]/50 flex items-end justify-center px-6 pt-10 lg:pt-14 lg:order-2">
            <img
              src={CONTENT.imageSrc}
              alt={CONTENT.imageAlt}
              loading="lazy"
              width={1448}
              height={1086}
              className="w-full max-w-[620px] h-auto drop-shadow-[0_24px_28px_rgba(15,35,60,0.18)]"
            />
          </div>

          {/* Tekst og CTA */}
          <div className="p-7 lg:p-12 lg:order-1">
            <h2 className="text-2xl lg:text-3xl font-bold text-[hsl(var(--mcs-navy))] leading-tight">
              {CONTENT.title}
            </h2>
            <div className="h-0.5 w-10 bg-[hsl(var(--mcs-orange))] mt-3 mb-4" />
            <p className="text-[hsl(var(--mcs-navy))]/80 text-[15px] leading-relaxed mb-5 max-w-lg">
              {CONTENT.lead}
            </p>

            <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2.5 mb-6">
              {CONTENT.trustPoints.map((p) => (
                <li key={p} className="flex items-start gap-2 text-sm text-[hsl(var(--mcs-navy))]">
                  <Check className="h-4 w-4 text-[hsl(var(--mcs-orange))] mt-0.5 shrink-0" /> {p}
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm mb-7">
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
                className="bg-white border border-[hsl(var(--mcs-navy))]/25 hover:border-[hsl(var(--mcs-navy))] text-[hsl(var(--mcs-navy))] font-semibold px-6 py-3 rounded-md inline-flex items-center justify-center"
              >
                {CONTENT.secondaryCta}
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
