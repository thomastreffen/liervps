import { Link } from "react-router-dom";
import { Clock, Users, ShieldCheck, Zap, Wrench, Cpu, BatteryCharging, Siren, Check, ArrowRight } from "lucide-react";
import { PublicLayout } from "@/components/public/PublicLayout";
import { PublicSeo, SITE_URL } from "@/components/public/PublicSeo";
import { PortalHero } from "@/components/public/PortalHero";
import heroImg from "@/assets/mcs/hero.jpg";
import teamImg from "@/assets/mcs/team.jpg";

const SERVICES = [
  { slug: "service-og-feilsoking", icon: Wrench, title: "Service og feilsøking", desc: "Feilsøking og vedlikehold av elektriske tavler og strømskinnesystemer. Vi sikrer stabil drift og rask problemløsning." },
  { slug: "elektrotavler", icon: Cpu, title: "Elektrotavler", desc: "Ferdig levert, oppgradering og vedlikehold av elektriske tavler for fordelingsanlegg i næring og industri." },
  { slug: "stromskinner", icon: BatteryCharging, title: "Montasje av strømskinner", desc: "Prosjektering og montasje av strømskinner for trygg og effektiv kraftfordeling i moderne anlegg." },
  { slug: "hasteoppdrag", icon: Siren, title: "Hasteoppdrag", desc: "Akutt behov? Vi rykker ut 24/7 og løser problemer raskt og effektivt — også utenom åpningstid." },
];

const TRUST = [
  { icon: Clock, title: "Rask responstid", desc: "Vi rykker ut når du trenger oss — akutt eller planlagt." },
  { icon: Users, title: "Erfarne fagfolk", desc: "Våre elektrikere har høy kompetanse og lang erfaring." },
  { icon: ShieldCheck, title: "Kvalitet i alle ledd", desc: "Vi leverer løsninger som sikrer driftssikkerhet og pålitelighet." },
  { icon: Zap, title: "Tilgjengelig hele året", desc: "Service 24/7 — vi er beredskapsklar når behovet oppstår." },
];

const CUSTOMER_LOGOS = ["Equinor", "Statkraft", "Bane NOR", "Posten", "Ahlsell", "Skanska"];

export default function Home() {
  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "MCS Service",
    image: `${SITE_URL}/icons/icon-512.png`,
    "@id": SITE_URL,
    url: SITE_URL,
    telephone: "+47 45 70 70 73",
    email: "post@mcsservice.no",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Orkidèhøgda 2A",
      postalCode: "3050",
      addressLocality: "Mjøndalen",
      addressCountry: "NO",
    },
    areaServed: "Norway",
    priceRange: "$$",
  };

  return (
    <PublicLayout>
      <PublicSeo
        title="MCS Service — Service og installasjon av elektriske tavler og strømskinner"
        description="MCS Service leverer driftssikkerhet, kompetanse og kvalitet til næring, industri og offentlige aktører. Spesialister på arbeid i eksisterende anlegg."
        path="/"
        jsonLd={localBusinessSchema}
      />

      <PortalHero />

      {/* Hero */}
      <section className="relative bg-[hsl(var(--mcs-navy))] text-white overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src={heroImg} alt="MCS Service-elektrikere arbeider i et tavlerom" className="w-full h-full object-cover opacity-30" width={1920} height={1080} />
          <div className="absolute inset-0 bg-gradient-to-r from-[hsl(var(--mcs-navy))] via-[hsl(var(--mcs-navy))]/85 to-transparent" />
        </div>
        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
          <div className="max-w-2xl">
            <p className="text-[hsl(var(--mcs-orange))] text-sm font-semibold tracking-widest uppercase mb-4">Spesialister på eksisterende anlegg</p>
            <h1 className="text-4xl lg:text-6xl font-bold leading-[1.05] mb-6">
              Service og installasjon av elektriske tavler og strømskinnesystemer
            </h1>
            <p className="text-lg lg:text-xl text-white/80 mb-8 leading-relaxed">
              Vi er spesialister på arbeid i eksisterende anlegg. Når strøm ikke kan stå stille.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link to="/bestill-service" className="bg-[hsl(var(--mcs-orange))] hover:bg-[hsl(var(--mcs-orange-hover))] text-white font-semibold px-7 py-3.5 rounded-md text-center">Bestill service</Link>
              <Link to="/tjenester/service-og-feilsoking" className="border border-white/30 hover:border-white text-white font-medium px-7 py-3.5 rounded-md text-center">Se våre tjenester</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Trust row */}
      <section className="bg-[hsl(var(--mcs-navy))] border-t border-white/5 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {TRUST.map((t) => (
              <div key={t.title} className="flex gap-3">
                <div className="h-10 w-10 rounded-md bg-white/5 flex items-center justify-center text-[hsl(var(--mcs-orange))] shrink-0">
                  <t.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm mb-1">{t.title}</h3>
                  <p className="text-xs text-white/60 leading-relaxed">{t.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="bg-white py-16 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-[hsl(var(--mcs-orange))] text-sm font-semibold uppercase tracking-wider mb-2">Hva vi leverer</p>
            <h2 className="text-3xl lg:text-4xl font-bold text-[hsl(var(--mcs-charcoal))]">Våre tjenester</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {SERVICES.map((s) => (
              <Link
                key={s.slug}
                to={`/tjenester/${s.slug}`}
                className="group bg-white border border-[hsl(var(--mcs-border))] hover:border-[hsl(var(--mcs-navy))] hover:shadow-lg rounded-xl p-6 transition-all flex flex-col"
              >
                <div className="h-11 w-11 rounded-lg bg-[hsl(var(--mcs-navy))] text-[hsl(var(--mcs-orange))] flex items-center justify-center mb-5">
                  <s.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-lg text-[hsl(var(--mcs-charcoal))] mb-2">{s.title}</h3>
                <p className="text-sm text-[hsl(var(--mcs-muted))] leading-relaxed mb-5 flex-1">{s.desc}</p>
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[hsl(var(--mcs-orange))]">
                  Les mer <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* About / safety section */}
      <section className="bg-[hsl(var(--mcs-light))] py-16 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <p className="text-[hsl(var(--mcs-orange))] text-sm font-semibold uppercase tracking-wider mb-2">Trygghet og kompetanse</p>
              <h2 className="text-3xl lg:text-4xl font-bold text-[hsl(var(--mcs-charcoal))] mb-5 leading-tight">
                Trygghet gjennom hele anleggets livssyklus
              </h2>
              <p className="text-[hsl(var(--mcs-muted))] mb-7 leading-relaxed">
                Vi kombinerer solid fagkompetanse med moderne systemer og dokumentasjon. Resultatet er driftssikre løsninger og full sporbarhet — fra første befaring til siste rapport.
              </p>
              <ul className="space-y-3 mb-8">
                {["Høy fagkompetanse", "Moderne verktøy og metoder", "Dokumentert kvalitet", "Fleksible serviceavtaler"].map((x) => (
                  <li key={x} className="flex items-center gap-3 text-[hsl(var(--mcs-charcoal))]">
                    <Check className="h-5 w-5 text-[hsl(var(--mcs-orange))]" /> {x}
                  </li>
                ))}
              </ul>
              <Link to="/om-mcs" className="inline-flex items-center gap-2 bg-[hsl(var(--mcs-navy))] text-white font-medium px-6 py-3 rounded-md hover:bg-[hsl(var(--mcs-navy))]/90">
                Les mer om oss <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div>
              <img src={teamImg} alt="MCS Service-teamet planlegger oppdrag" loading="lazy" width={1280} height={832} className="rounded-xl shadow-xl w-full h-auto" />
            </div>
          </div>
        </div>
      </section>

      {/* Customer logos */}
      <section className="bg-white py-14 border-y border-[hsl(var(--mcs-border))]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-[hsl(var(--mcs-muted))] mb-7">Noen av våre kunder og samarbeidspartnere</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6 items-center">
            {CUSTOMER_LOGOS.map((n) => (
              <div key={n} className="text-center text-[hsl(var(--mcs-muted))] font-semibold tracking-wide text-lg opacity-70 hover:opacity-100 transition-opacity">
                {n}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact CTA */}
      <section className="bg-[hsl(var(--mcs-navy))] text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold mb-3">Trenger du service eller installasjon?</h2>
          <p className="text-white/70 mb-8 max-w-2xl mx-auto">
            Ta kontakt — vi hjelper deg med en trygg og effektiv løsning.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/bestill-service" className="bg-[hsl(var(--mcs-orange))] hover:bg-[hsl(var(--mcs-orange-hover))] text-white font-semibold px-7 py-3.5 rounded-md">Bestill service</Link>
            <Link to="/kontakt" className="border border-white/30 hover:border-white text-white font-medium px-7 py-3.5 rounded-md">Ta kontakt</Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
