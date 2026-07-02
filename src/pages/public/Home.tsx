import { Link } from "react-router-dom";
import { Search, ShoppingBag, Wrench, Settings, Bug, ShieldCheck, Check, ArrowRight, MapPin, Clock, Award, Snowflake, Phone, Mail } from "lucide-react";
import { PublicLayout } from "@/components/public/PublicLayout";
import { PublicSeo, SITE_URL } from "@/components/public/PublicSeo";
import { useAuth } from "@/hooks/useAuth";
import heroImg from "@/assets/lier/hero.jpg";
import serviceImg from "@/assets/lier/service.jpg";

const SERVICES = [
  { slug: "befaring", icon: Search, title: "Befaring og rådgivning", desc: "Vi kommer hjem til deg, vurderer behovet og anbefaler riktig varmepumpe for boligen din." },
  { slug: "salg", icon: ShoppingBag, title: "Salg av varmepumpe", desc: "Kvalitetsmerker og modeller tilpasset norsk klima. Trygge priser uten skjulte kostnader." },
  { slug: "montering", icon: Wrench, title: "Montering", desc: "Fagmessig og ryddig montering av luft-til-luft og luft-til-vann varmepumper." },
  { slug: "service", icon: Settings, title: "Service og vedlikehold", desc: "Regelmessig service holder anlegget effektivt og forlenger levetiden på pumpa." },
  { slug: "feilsoking", icon: Bug, title: "Feilsøking", desc: "Anlegget virker ikke som det skal? Vi finner feilen og retter opp raskt." },
  { slug: "serviceavtale", icon: ShieldCheck, title: "Årlig serviceavtale", desc: "Fastpris på årskontroll, rask respons ved feil og full oversikt over anlegget ditt." },
];

const TRUST = [
  { icon: MapPin, title: "Lokal i Lier", desc: "Kort vei til deg — vi kjenner området og kundene våre." },
  { icon: Award, title: "Sertifiserte teknikere", desc: "F-gassertifisert personell med lang erfaring." },
  { icon: Clock, title: "Rask respons", desc: "Vi svarer raskt og planlegger oppdrag effektivt." },
  { icon: ShieldCheck, title: "Trygg garanti", desc: "Full garantioppfølging på montering og produkter." },
];

const STEPS = [
  { n: "1", title: "Ta kontakt", desc: "Fyll ut skjema eller ring oss. Vi svarer raskt." },
  { n: "2", title: "Befaring", desc: "Vi besøker boligen og anbefaler riktig løsning." },
  { n: "3", title: "Montering", desc: "Fagmessig montering på avtalt dag — vi rydder etter oss." },
  { n: "4", title: "Service", desc: "Årlig kontroll og oppfølging for effektiv drift." },
];

export default function Home() {
  const { user } = useAuth();
  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "Lier Varmepumpeservice AS",
    "@id": SITE_URL,
    url: SITE_URL,
    email: "post@liervps.no",
    address: { "@type": "PostalAddress", addressLocality: "Lier", addressCountry: "NO" },
    areaServed: "Lier og omegn",
    priceRange: "$$",
  };

  return (
    <PublicLayout>
      <PublicSeo
        title="Lier Varmepumpeservice AS — Varmepumper, montering og service i Lier"
        description="Lier VPS hjelper deg med befaring, salg, montering, service og vedlikehold av varmepumper. Lokal fagkompetanse for boliger og næring."
        path="/"
        jsonLd={localBusinessSchema}
      />

      {/* Hero */}
      <section className="relative bg-[hsl(var(--mcs-navy))] text-white overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src={heroImg} alt="Utendørs varmepumpe montert på hus" className="w-full h-full object-cover opacity-40" width={1920} height={1080} />
          <div className="absolute inset-0 bg-gradient-to-r from-[hsl(var(--mcs-navy))] via-[hsl(var(--mcs-navy))]/80 to-transparent" />
        </div>
        <div className={`relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 ${user ? "py-10" : "py-20 lg:py-32"}`}>
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 text-[hsl(var(--mcs-orange))] text-xs font-semibold tracking-widest uppercase mb-4">
              <Snowflake className="h-4 w-4" /> Lokal varmepumpeservice
            </p>
            <h1 className={`font-bold leading-[1.05] mb-5 ${user ? "text-2xl lg:text-3xl" : "text-4xl lg:text-6xl"}`}>
              Varmepumper, service og energieffektiv oppvarming i Lier
            </h1>
            <p className={`text-white/85 leading-relaxed ${user ? "text-sm mb-4" : "text-lg lg:text-xl mb-8"}`}>
              Lier Varmepumpeservice AS hjelper deg med befaring, montering, service og vedlikehold av varmepumper. Fra første spørsmål til ferdig installert anlegg.
            </p>
            {!user && (
              <div className="flex flex-col sm:flex-row gap-3">
                <Link to="/bestill-service" className="bg-[hsl(var(--mcs-orange))] hover:bg-[hsl(var(--mcs-orange-hover))] text-white font-semibold px-7 py-3.5 rounded-md text-center">
                  Bestill befaring
                </Link>
                <Link to="/bestill-service?type=service" className="bg-white/10 hover:bg-white/20 border border-white/30 text-white font-semibold px-7 py-3.5 rounded-md text-center">
                  Bestill service
                </Link>
                <Link to="/tjenester/befaring" className="text-white/90 hover:text-white font-medium px-4 py-3.5 rounded-md text-center inline-flex items-center justify-center gap-1.5">
                  Se våre tjenester <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            )}
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

      {/* Featured brands / products */}
      <section className="bg-white py-16 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-[hsl(var(--mcs-orange))] text-sm font-semibold uppercase tracking-wider mb-2">Produkter</p>
            <h2 className="text-3xl lg:text-4xl font-bold text-[hsl(var(--mcs-charcoal))]">Varmepumper vi anbefaler</h2>
            <p className="mt-3 text-[hsl(var(--mcs-muted))] max-w-2xl mx-auto">
              Vi jobber med ledende produsenter og hjelper deg med å velge en modell som passer boligen, budsjettet og bruksmønsteret ditt.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                brand: "Mitsubishi Electric",
                tagline: "Premium kvalitet og driftssikkerhet",
                body: "Kjent for solide varmepumper med høy driftssikkerhet, lavt lydnivå og god komfort gjennom hele året. Et godt valg for deg som ønsker kvalitet og lang levetid.",
                bullets: ["Høy driftssikkerhet", "Lavt lydnivå", "Lang levetid"],
              },
              {
                brand: "Panasonic",
                tagline: "Ytelse og moderne design",
                body: "Kombinerer effektiv oppvarming, moderne design og smart teknologi. Passer godt for deg som vil ha høy ytelse og en innedel som glir inn i hjemmet.",
                bullets: ["Høy ytelse", "Smart styring", "Elegant innedel"],
              },
              {
                brand: "Toshiba",
                tagline: "Stille drift og smart regulering",
                body: "Fokus på komfort, stillegående drift og stabil varme. Et effektivt og diskret alternativ for boliger der lyd og jevn temperatur betyr mye.",
                bullets: ["Stillegående", "Stabil varme", "Smart regulering"],
              },
            ].map((b) => (
              <div
                key={b.brand}
                className="group bg-white border border-[hsl(var(--mcs-border))] hover:border-[hsl(var(--mcs-navy))] hover:shadow-lg rounded-xl p-6 flex flex-col transition-all"
              >
                {/* Placeholder image slot — ready for approved brand imagery */}
                <div className="aspect-[4/3] rounded-lg mb-5 bg-gradient-to-br from-[hsl(var(--mcs-navy))] to-[hsl(var(--mcs-blue-deep))] flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_30%_20%,white,transparent_60%)]" />
                  <Snowflake className="h-12 w-12 text-white/80 relative" />
                  <span className="absolute bottom-3 right-3 text-[10px] uppercase tracking-widest text-white/60 font-semibold">Anbefalt</span>
                </div>
                <p className="text-[hsl(var(--mcs-orange))] text-xs font-semibold uppercase tracking-wider mb-1.5">{b.tagline}</p>
                <h3 className="font-bold text-xl text-[hsl(var(--mcs-charcoal))] mb-3">{b.brand}</h3>
                <p className="text-sm text-[hsl(var(--mcs-muted))] leading-relaxed mb-4">{b.body}</p>
                <ul className="space-y-1.5 mb-6">
                  {b.bullets.map((x) => (
                    <li key={x} className="flex items-center gap-2 text-sm text-[hsl(var(--mcs-charcoal))]">
                      <Check className="h-4 w-4 text-[hsl(var(--mcs-orange))] shrink-0" /> {x}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto flex flex-col sm:flex-row gap-2">
                  <Link
                    to="/bestill-service"
                    className="flex-1 bg-[hsl(var(--mcs-orange))] hover:bg-[hsl(var(--mcs-orange-hover))] text-white font-semibold text-sm px-4 py-2.5 rounded-md text-center"
                  >
                    Be om anbefaling
                  </Link>
                  <Link
                    to="/tjenester/salg"
                    className="flex-1 border border-[hsl(var(--mcs-navy))] text-[hsl(var(--mcs-navy))] hover:bg-[hsl(var(--mcs-navy))] hover:text-white font-semibold text-sm px-4 py-2.5 rounded-md text-center transition-colors"
                  >
                    Les mer
                  </Link>
                </div>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-[hsl(var(--mcs-muted))] mt-8">
            Merkenavn tilhører sine respektive eiere. Vi fører flere modeller — kontakt oss for komplett utvalg.
          </p>
        </div>
      </section>

      {/* Product guidance */}
      <section className="bg-[hsl(var(--mcs-light))] py-16 lg:py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl bg-white border border-[hsl(var(--mcs-border))] p-8 lg:p-12 grid lg:grid-cols-[1.4fr_1fr] gap-10 items-center shadow-sm">
            <div>
              <p className="text-[hsl(var(--mcs-orange))] text-xs font-semibold uppercase tracking-widest mb-3">Rådgivning</p>
              <h2 className="text-2xl lg:text-3xl font-bold text-[hsl(var(--mcs-charcoal))] mb-4 leading-tight">
                Usikker på hvilken varmepumpe du bør velge?
              </h2>
              <p className="text-[hsl(var(--mcs-muted))] mb-5 leading-relaxed">
                Vi hjelper deg å velge riktig varmepumpe basert på boligtype, oppvarmet areal, plassering av innedel og utedel, lydnivå, effektbehov, design og budsjett — uten forpliktelse.
              </p>
              <ul className="grid sm:grid-cols-2 gap-2 text-sm text-[hsl(var(--mcs-charcoal))] mb-6">
                {["Boligtype og areal", "Effektbehov", "Plassering og lyd", "Design og budsjett"].map((x) => (
                  <li key={x} className="flex items-center gap-2"><Check className="h-4 w-4 text-[hsl(var(--mcs-orange))]" /> {x}</li>
                ))}
              </ul>
              <Link to="/bestill-service" className="inline-flex items-center gap-2 bg-[hsl(var(--mcs-orange))] hover:bg-[hsl(var(--mcs-orange-hover))] text-white font-semibold px-6 py-3 rounded-md">
                Få anbefaling <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="hidden lg:flex items-center justify-center">
              <div className="h-44 w-44 rounded-full bg-[hsl(var(--mcs-navy))]/5 border-2 border-[hsl(var(--mcs-navy))]/20 flex items-center justify-center">
                <Search className="h-16 w-16 text-[hsl(var(--mcs-navy))]" />
              </div>
            </div>
          </div>
        </div>
      </section>



      {/* Services */}
      <section className="bg-white py-16 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-[hsl(var(--mcs-orange))] text-sm font-semibold uppercase tracking-wider mb-2">Hva vi leverer</p>
            <h2 className="text-3xl lg:text-4xl font-bold text-[hsl(var(--mcs-charcoal))]">Våre tjenester</h2>
            <p className="mt-3 text-[hsl(var(--mcs-muted))] max-w-2xl mx-auto">Ett kontaktpunkt for hele varmepumpe-livsløpet — fra rådgivning til drift.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
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

      {/* Why choose Lier VPS */}
      <section className="bg-[hsl(var(--mcs-light))] py-16 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <p className="text-[hsl(var(--mcs-orange))] text-sm font-semibold uppercase tracking-wider mb-2">Hvorfor velge oss</p>
              <h2 className="text-3xl lg:text-4xl font-bold text-[hsl(var(--mcs-charcoal))] mb-5 leading-tight">
                Lokal fagkunnskap — hele veien fra befaring til service
              </h2>
              <p className="text-[hsl(var(--mcs-muted))] mb-7 leading-relaxed">
                Vi er et lokalt firma som lever av å levere varmepumper som fungerer år etter år. Ingen underleverandører, ingen skjulte gebyrer — bare praktisk fagkompetanse og god oppfølging.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  "Uforpliktende befaring hjemme hos deg",
                  "Fastpris før arbeidet starter",
                  "F-gassertifiserte teknikere",
                  "Full garantioppfølging og servicehistorikk",
                ].map((x) => (
                  <li key={x} className="flex items-center gap-3 text-[hsl(var(--mcs-charcoal))]">
                    <Check className="h-5 w-5 text-[hsl(var(--mcs-orange))]" /> {x}
                  </li>
                ))}
              </ul>
              <Link to="/bestill-service" className="inline-flex items-center gap-2 bg-[hsl(var(--mcs-navy))] text-white font-medium px-6 py-3 rounded-md hover:opacity-90">
                Bestill befaring <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div>
              <img src={serviceImg} alt="Tekniker fra Lier VPS utfører service på innedel" loading="lazy" width={1280} height={832} className="rounded-xl shadow-xl w-full h-auto" />
            </div>
          </div>
        </div>
      </section>

      {/* Service agreement */}
      <section className="bg-white py-16 lg:py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl bg-[hsl(var(--mcs-navy))] text-white p-8 lg:p-12 grid lg:grid-cols-[1.3fr_1fr] gap-10 items-center">
            <div>
              <p className="text-[hsl(var(--mcs-orange))] text-xs font-semibold uppercase tracking-widest mb-3">Serviceavtale</p>
              <h2 className="text-2xl lg:text-3xl font-bold mb-4 leading-tight">Årlig serviceavtale — ro i sinnet hele året</h2>
              <p className="text-white/80 mb-6 leading-relaxed">
                Med serviceavtale hos Lier VPS får du årlig kontroll, rengjøring, filterbytte og en gjennomgang av anlegget. Vi følger opp deg proaktivt — du slipper å huske det selv.
              </p>
              <ul className="grid sm:grid-cols-2 gap-2.5 text-sm mb-6">
                {["Årlig fysisk kontroll", "Filterbytte og rengjøring", "Prioritert responstid", "Rabatt på reservedeler", "Digital servicehistorikk", "Fast pris hele avtaleåret"].map((x) => (
                  <li key={x} className="flex items-center gap-2"><Check className="h-4 w-4 text-[hsl(var(--mcs-orange))] shrink-0" /> {x}</li>
                ))}
              </ul>
              <Link to="/tjenester/serviceavtale" className="inline-flex items-center gap-2 bg-[hsl(var(--mcs-orange))] hover:bg-[hsl(var(--mcs-orange-hover))] text-white font-semibold px-6 py-3 rounded-md">
                Les mer om serviceavtale <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="hidden lg:flex items-center justify-center">
              <div className="h-40 w-40 rounded-full bg-[hsl(var(--mcs-orange))]/10 border-2 border-[hsl(var(--mcs-orange))] flex items-center justify-center">
                <ShieldCheck className="h-16 w-16 text-[hsl(var(--mcs-orange))]" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-[hsl(var(--mcs-light))] py-16 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-[hsl(var(--mcs-orange))] text-sm font-semibold uppercase tracking-wider mb-2">Slik gjør vi det</p>
            <h2 className="text-3xl lg:text-4xl font-bold text-[hsl(var(--mcs-charcoal))]">Fire enkle steg</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {STEPS.map((s) => (
              <div key={s.n} className="bg-white rounded-xl p-6 border border-[hsl(var(--mcs-border))]">
                <div className="h-10 w-10 rounded-full bg-[hsl(var(--mcs-orange))] text-white font-bold flex items-center justify-center mb-4">{s.n}</div>
                <h3 className="font-semibold text-lg text-[hsl(var(--mcs-charcoal))] mb-2">{s.title}</h3>
                <p className="text-sm text-[hsl(var(--mcs-muted))] leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Customer portal / track service */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm uppercase tracking-wider text-[hsl(var(--mcs-orange))] font-semibold mb-3">Kundeportal</p>
          <h2 className="text-2xl lg:text-3xl font-bold text-[hsl(var(--mcs-charcoal))] mb-3">Følg service og anlegget ditt digitalt</h2>
          <p className="text-[hsl(var(--mcs-muted))] mb-6 max-w-2xl mx-auto">
            Se servicehistorikk, kommende årskontroller, dokumentasjon og fakturagrunnlag i din personlige kundeportal.
          </p>
          <Link to="/login" className="inline-flex items-center gap-2 bg-[hsl(var(--mcs-navy))] text-white font-semibold px-6 py-3 rounded-md hover:opacity-90">
            Logg inn i kundeportalen <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Contact CTA */}
      <section className="bg-[hsl(var(--mcs-navy))] text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold mb-3">Klar for varmepumpe eller trenger service?</h2>
          <p className="text-white/80 mb-8 max-w-2xl mx-auto">
            Ta kontakt for uforpliktende befaring. Vi svarer raskt og hjelper deg med å finne riktig løsning.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/bestill-service" className="bg-[hsl(var(--mcs-orange))] hover:bg-[hsl(var(--mcs-orange-hover))] text-white font-semibold px-7 py-3.5 rounded-md inline-flex items-center justify-center gap-2">
              <Phone className="h-4 w-4" /> Bestill befaring
            </Link>
            <a href="mailto:post@liervps.no" className="border border-white/30 hover:border-white text-white font-medium px-7 py-3.5 rounded-md inline-flex items-center justify-center gap-2">
              <Mail className="h-4 w-4" /> post@liervps.no
            </a>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
