import { Link } from "react-router-dom";
import { ArrowRight, Snowflake, Wrench, ShieldCheck, Building2 } from "lucide-react";
import { useLead } from "./LeadContext";

/**
 * Rask valgseksjon rett etter hero — fire tydelige veier videre.
 * Servicebedrift-logikk: kunden velger behov, ikke produkt.
 */
export function QuickChoice() {
  const { startLead } = useLead();

  const CHOICES = [
    {
      icon: Snowflake,
      title: "Ny varmepumpe",
      desc: "Rådgivning, riktig modell og fagmessig montering.",
      cta: "Bestill befaring",
      onClick: () => startLead({ source: "hero", interestType: "befaring" }),
    },
    {
      icon: Wrench,
      title: "Service og feilsøking",
      desc: "Anlegget stopper, varmer dårlig eller viser feilkode.",
      cta: "Bestill service",
      onClick: () => startLead({ source: "service", interestType: "feilsoking" }),
    },
    {
      icon: ShieldCheck,
      title: "Serviceavtale",
      desc: "Årlig kontroll, rengjøring og dokumentert historikk.",
      cta: "Snakk med oss",
      onClick: () => startLead({ source: "service", interestType: "service" }),
    },
    {
      icon: Building2,
      title: "For bedrift og næring",
      desc: "Driftssikker varme og fast oppfølging for næringsbygg.",
      cta: "Ta kontakt",
      onClick: () => startLead({ source: "naering", segment: "naering", interestType: "befaring" }),
    },
  ];

  return (
    <section id="hva-trenger-du" className="bg-[hsl(var(--warm-cream))] pb-14 pt-4 scroll-mt-28">
      <div className="mx-auto max-w-[1600px] px-6 sm:px-10 lg:px-12 xl:px-16 2xl:px-24">
        <h2 className="text-2xl lg:text-3xl font-bold text-[hsl(var(--mcs-navy))] leading-tight">
          Hva trenger du hjelp med?
        </h2>
        <div className="h-0.5 w-10 bg-[hsl(var(--mcs-orange))] mt-3 mb-6" />

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {CHOICES.map((c) => (
            <div
              key={c.title}
              className="bg-white rounded-2xl border border-[hsl(var(--warm-beige))] p-6 flex flex-col shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="h-11 w-11 rounded-full bg-[hsl(var(--mcs-navy))] text-white flex items-center justify-center mb-4">
                <c.icon className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-[hsl(var(--mcs-navy))] mb-1.5">{c.title}</h3>
              <p className="text-sm text-[hsl(var(--mcs-muted))] leading-relaxed mb-5">{c.desc}</p>
              <button
                type="button"
                onClick={c.onClick}
                className="mt-auto inline-flex items-center gap-2 text-sm font-semibold text-[hsl(var(--mcs-navy))] hover:text-[hsl(var(--mcs-orange))]"
              >
                {c.cta} <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <p className="text-xs text-[hsl(var(--mcs-muted))] mt-4">
          Usikker? <Link to="/#kontakt" className="underline hover:text-[hsl(var(--mcs-navy))]">Beskriv situasjonen din</Link> — vi anbefaler riktig neste steg.
        </p>
      </div>
    </section>
  );
}
