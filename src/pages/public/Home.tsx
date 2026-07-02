import { Link } from "react-router-dom";
import {
  Search,
  ShoppingBag,
  Wrench,
  Settings,
  Bug,
  ShieldCheck,
  Check,
  ArrowRight,
  MapPin,
  Home as HomeIcon,
  Building2,
  Award,
  Calendar,
  Phone,
  Mail,
  Monitor,
  Leaf,
} from "lucide-react";
import { PublicLayout } from "@/components/public/PublicLayout";
import { PublicSeo, SITE_URL } from "@/components/public/PublicSeo";
import { useAuth } from "@/hooks/useAuth";
import heroImg from "@/assets/lier/hero-warm.jpg";
import homeImg from "@/assets/lier/home-interior.jpg";
import commercialImg from "@/assets/lier/commercial-interior.jpg";
import technicianImg from "@/assets/lier/technician.jpg";

const TRUST = [
  { icon: Award, title: "F-gass-sertifiserte teknikere" },
  { icon: HomeIcon, title: "For bolig og næring" },
  { icon: Calendar, title: "Service hele året" },
  { icon: MapPin, title: "Lokal i Lier" },
];

const SERVICES = [
  { icon: Search, title: "Befaring og rådgivning", desc: "Vi kommer hjem til deg, vurderer behovet og anbefaler riktig løsning." },
  { icon: ShoppingBag, title: "Salg av varmepumpe", desc: "Kvalitetsmerker og modeller tilpasset dine behov og ditt bygg." },
  { icon: Wrench, title: "Montering", desc: "Fagmessig og nøyaktig montering av luft-til-luft og luft-til-vann varmepumper." },
  { icon: Settings, title: "Service og vedlikehold", desc: "Regelmessig service holder anlegget effektivt og forlenger levetiden." },
  { icon: Bug, title: "Feilsøking", desc: "Anlegget virker ikke som det skal? Vi finner feilen og retter opp raskt." },
  { icon: ShieldCheck, title: "Årlig serviceavtale", desc: "Fast pris på årskontroll, rens, rapport og full oversikt over anlegget ditt." },
];

const STEPS = [
  { n: "1", title: "Ta kontakt", desc: "Fyll ut skjema eller ring oss. Vi svarer raskt." },
  { n: "2", title: "Befaring", desc: "Vi besøker deg og anbefaler riktig løsning." },
  { n: "3", title: "Montering", desc: "Fagmessig montering på avtalt tid." },
  { n: "4", title: "Service", desc: "Årlig kontroll og oppfølging for effektiv drift." },
];

const BRANDS = [
  { name: "MITSUBISHI ELECTRIC", text: "Premium kvalitet og driftssikkerhet — et trygt valg med lang levetid." },
  { name: "Panasonic", text: "Effektiv oppvarming og moderne design — smart teknologi." },
  { name: "TOSHIBA", text: "Stillegående drift og stabil varme — et trygt valg for norsk klima." },
];

const AGREEMENT_BENEFITS = [
  "Årlig fysisk kontroll",
  "Prioritert responstid",
  "Digital servicehistorikk",
  "Filterbytte og rengjøring",
  "Rabatt på reservedeler",
  "Fast pris hele avtaleåret",
];

const WHY = [
  "Lokale fagfolk med lang erfaring",
  "Fagstolte og ryddige montører",
  "F-gass-sertifiserte teknikere",
  "Dokumentert servicehistorikk",
  "Oppfølging for både bolig og næring",
];

function SavingsCard({
  icon: Icon,
  title,
  desc,
  before,
  after,
  savings,
}: {
  icon: typeof HomeIcon;
  title: string;
  desc: string;
  before: string;
  after: string;
  savings: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-[hsl(var(--warm-beige))] p-6 lg:p-7 shadow-sm">
      <div className="flex items-start gap-4 mb-5">
        <div className="h-11 w-11 rounded-full bg-[hsl(var(--mcs-navy))] text-white flex items-center justify-center shrink-0">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold text-lg text-[hsl(var(--mcs-navy))]">{title}</h3>
          <p className="text-sm text-[hsl(var(--mcs-muted))] mt-0.5">{desc}</p>
        </div>
      </div>
      <div className="grid md:grid-cols-[1fr_auto] gap-5 items-center">
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
              <span className="text-[hsl(var(--mcs-muted))]">FØR</span>
              <span className="text-[hsl(var(--mcs-muted))]">{before}</span>
            </div>
            <div className="h-2.5 rounded-full bg-[hsl(var(--warm-sand))] overflow-hidden">
              <div className="h-full w-full bg-[hsl(var(--mcs-muted))]/50" />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
              <span className="text-[hsl(var(--mcs-navy))]">ETTER</span>
              <span className="text-[hsl(var(--mcs-navy))]">{after}</span>
            </div>
            <div className="h-2.5 rounded-full bg-[hsl(var(--warm-sand))] overflow-hidden">
              <div className="h-full w-1/2 bg-[hsl(var(--mcs-navy))]" />
            </div>
          </div>
        </div>
        <div className="rounded-xl bg-[hsl(var(--savings-green-soft))] px-5 py-4 text-center min-w-[160px]">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--savings-green))]">
            Estimert besparelse
          </div>
          <div className="text-2xl font-bold text-[hsl(var(--savings-green))] mt-1">{savings}</div>
          <div className="text-xs text-[hsl(var(--savings-green))] mt-0.5 inline-flex items-center gap-1">
            i året <Leaf className="h-3 w-3" />
          </div>
        </div>
      </div>
    </div>
  );
}

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
        description="Lier VPS hjelper både boligeiere og bedrifter med rådgivning, montering, service og driftssikre varmepumpeløsninger tilpasset norske forhold."
        path="/"
        jsonLd={localBusinessSchema}
      />

      {/* HERO */}
      <section className="relative bg-[hsl(var(--warm-cream))]">
        <div className="mx-auto max-w-[1500px] px-0 sm:px-8 lg:px-12 xl:px-16 pt-4 sm:pt-6 lg:pt-8 pb-20 lg:pb-24">
          <div className="relative sm:rounded-3xl overflow-hidden">

            <img
              src={heroImg}
              alt="Varmt Skandinavisk stue-interiør med veggmontert varmepumpe"
              className="w-full h-[560px] lg:h-[700px] xl:h-[740px] object-cover"
              width={1920}
              height={1200}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[hsl(var(--warm-cream))] via-[hsl(var(--warm-cream))]/80 to-transparent" />
            <div className="absolute inset-0 flex items-center">
              <div className="w-full mx-auto max-w-[1400px] px-6 sm:px-12 lg:px-16">
                <div className="max-w-2xl">
                  <h1 className={`font-bold leading-[1.05] tracking-tight text-[hsl(var(--mcs-navy))] mb-6 ${user ? "text-3xl" : "text-4xl lg:text-5xl xl:text-6xl"}`}>
                    Varmepumper som gir komfort, kontroll og lavere strømregning
                  </h1>
                  <p className="text-[hsl(var(--mcs-navy))]/75 text-base lg:text-lg leading-relaxed mb-8 max-w-xl">
                    Lier Varmepumpeservice hjelper både boligeiere og bedrifter med rådgivning,
                    montering, service og driftssikre løsninger tilpasset norske forhold.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Link
                      to="/bestill-service"
                      className="bg-[hsl(var(--mcs-orange))] hover:bg-[hsl(var(--mcs-orange-hover))] text-white font-semibold px-7 py-3.5 rounded-lg inline-flex items-center justify-center gap-2 shadow-sm"
                    >
                      Bestill befaring <ArrowRight className="h-4 w-4" />
                    </Link>
                    <Link
                      to="/tjenester/salg"
                      className="bg-white border border-[hsl(var(--mcs-navy))]/20 text-[hsl(var(--mcs-navy))] font-semibold px-7 py-3.5 rounded-lg text-center hover:border-[hsl(var(--mcs-navy))]"
                    >
                      Se løsninger
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Trust strip — overlaps hero bottom */}
          <div className="relative -mt-10 lg:-mt-12 px-4 sm:px-8 lg:px-12">
            <div className="mx-auto max-w-6xl bg-white rounded-2xl shadow-xl border border-[hsl(var(--warm-beige))] px-6 sm:px-10 py-5">

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-3">
                {TRUST.map((t) => (
                  <div key={t.title} className="flex items-center gap-3 text-[hsl(var(--mcs-navy))]">
                    <div className="h-9 w-9 rounded-full bg-[hsl(var(--mcs-navy))] text-white flex items-center justify-center shrink-0">
                      <t.icon className="h-4 w-4" />
                    </div>
                    <span className="text-[13px] font-semibold leading-tight">{t.title}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* FOR BOLIG OG NÆRING */}
      <section className="bg-[hsl(var(--warm-cream))] pb-16">
        <div className="mx-auto max-w-[1440px] px-5 sm:px-10 lg:px-14 xl:px-16 grid lg:grid-cols-2 gap-6">
          {/* Bolig */}
          <div className="bg-white rounded-2xl overflow-hidden border border-[hsl(var(--warm-beige))] shadow-sm grid sm:grid-cols-[220px_1fr]">
            <img src={homeImg} alt="Koselig stue med varmepumpe" loading="lazy" width={1280} height={960} className="h-full w-full object-cover min-h-[280px]" />
            <div className="p-6 lg:p-7 flex flex-col">
              <h3 className="text-xl font-bold text-[hsl(var(--mcs-navy))] mb-2">For deg hjemme</h3>
              <div className="h-0.5 w-10 bg-[hsl(var(--mcs-orange))] mb-3" />
              <p className="text-sm text-[hsl(var(--mcs-muted))] mb-4 leading-relaxed">
                Et bedre inneklima, jevn varme og lavere strømforbruk gjør hverdagen mer behagelig.
              </p>
              <ul className="space-y-1.5 mb-5 text-sm text-[hsl(var(--mcs-navy))]">
                {["Komfortabel varme hele året", "Lavere strømforbruk", "Stillegående drift", "Bedre inneklima"].map((x) => (
                  <li key={x} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-[hsl(var(--mcs-orange))]" /> {x}
                  </li>
                ))}
              </ul>
              <Link
                to="/for-bolig"
                className="mt-auto inline-flex items-center justify-center gap-2 bg-[hsl(var(--mcs-orange))] hover:bg-[hsl(var(--mcs-orange-hover))] text-white font-semibold px-5 py-2.5 rounded-md self-start"
              >
                Se løsninger for bolig <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
          {/* Næring */}
          <div className="bg-white rounded-2xl overflow-hidden border border-[hsl(var(--warm-beige))] shadow-sm grid sm:grid-cols-[1fr_220px]">
            <div className="p-6 lg:p-7 flex flex-col order-2 sm:order-1">
              <h3 className="text-xl font-bold text-[hsl(var(--mcs-navy))] mb-2">For næringslokaler</h3>
              <div className="h-0.5 w-10 bg-[hsl(var(--mcs-orange))] mb-3" />
              <p className="text-sm text-[hsl(var(--mcs-muted))] mb-4 leading-relaxed">
                Effektiv oppvarming og stabil temperatur gir bedre arbeidsmiljø og lavere driftskostnader.
              </p>
              <ul className="space-y-1.5 mb-5 text-sm text-[hsl(var(--mcs-navy))]">
                {["Energibesparelse", "Jevn temperatur", "Driftssikkerhet", "Serviceavtale for bedrift"].map((x) => (
                  <li key={x} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-[hsl(var(--mcs-orange))]" /> {x}
                  </li>
                ))}
              </ul>
              <Link
                to="/for-naering"
                className="mt-auto inline-flex items-center justify-center gap-2 bg-[hsl(var(--mcs-orange))] hover:bg-[hsl(var(--mcs-orange-hover))] text-white font-semibold px-5 py-2.5 rounded-md self-start"
              >
                Se løsninger for næring <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <img src={commercialImg} alt="Moderne kontorlokale med varmepumpe" loading="lazy" width={1280} height={960} className="h-full w-full object-cover min-h-[280px] order-1 sm:order-2" />
          </div>
        </div>
      </section>

      {/* EKSEMPLER PÅ BESPARELSE */}
      <section className="bg-[hsl(var(--warm-cream))] pb-16">
        <div className="mx-auto max-w-[1440px] px-5 sm:px-10 lg:px-14 xl:px-16">
          <h2 className="text-2xl lg:text-3xl font-bold text-[hsl(var(--mcs-navy))] text-center mb-8">
            Eksempler på besparelse
          </h2>
          <div className="grid lg:grid-cols-2 gap-6">
            <SavingsCard
              icon={HomeIcon}
              title="Enebolig i Lier"
              desc="Typisk enebolig på 150 m² med eldre elektrisk oppvarming."
              before="24 000 kr / år"
              after="12 000 kr / år"
              savings="12 000 kr"
            />
            <SavingsCard
              icon={Building2}
              title="Kontor / næringslokaler"
              desc="Kontorlokale på 500 m² med varierende oppvarming."
              before="48 000 kr / år"
              after="24 000 kr / år"
              savings="24 000 kr"
            />
          </div>
          <p className="text-center text-xs text-[hsl(var(--mcs-muted))] mt-6 max-w-3xl mx-auto">
            Beregninger er estimater basert på strømpris, bruksmønster og byggets behov. Faktiske besparelser vil variere.
          </p>
        </div>
      </section>

      {/* VARMEPUMPER VI ANBEFALER */}
      <section className="bg-[hsl(var(--warm-cream))] pb-16">
        <div className="mx-auto max-w-[1440px] px-5 sm:px-10 lg:px-14 xl:px-16 grid lg:grid-cols-[280px_1fr] gap-8 items-start">
          <div>
            <h2 className="text-2xl lg:text-3xl font-bold text-[hsl(var(--mcs-navy))] mb-3 leading-tight">
              Varmepumper vi anbefaler
            </h2>
            <div className="h-0.5 w-10 bg-[hsl(var(--mcs-orange))] mb-4" />
            <p className="text-sm text-[hsl(var(--mcs-muted))] leading-relaxed mb-5">
              Vi velger kvalitetsmerker som er tilpasset norske forhold. Pålitelig teknologi, høy ytelse
              og god tilgjengelighet på reservedeler og service.
            </p>
            <Link
              to="/tjenester/salg"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[hsl(var(--mcs-navy))] border border-[hsl(var(--mcs-navy))]/20 hover:border-[hsl(var(--mcs-navy))] bg-white px-4 py-2 rounded-md"
            >
              Se alle modeller <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            {BRANDS.map((b) => (
              <div key={b.name} className="bg-white rounded-xl border border-[hsl(var(--warm-beige))] p-5 flex flex-col">
                <div className="text-center text-[13px] font-bold text-[hsl(var(--mcs-navy))] tracking-wide mb-3 min-h-[36px] flex items-center justify-center">
                  {b.name}
                </div>
                <div className="aspect-[4/3] rounded-lg bg-[hsl(var(--warm-sand))] flex items-center justify-center mb-4">
                  {/* Neutral placeholder — approved product imagery can replace this */}
                  <div className="h-10 w-24 rounded-md bg-white border border-[hsl(var(--warm-beige))] shadow-sm" aria-hidden />
                </div>
                <p className="text-xs text-[hsl(var(--mcs-muted))] leading-relaxed mb-4 flex-1 text-center">{b.text}</p>
                <Link
                  to="/bestill-service"
                  className="bg-[hsl(var(--mcs-orange))] hover:bg-[hsl(var(--mcs-orange-hover))] text-white text-sm font-semibold px-4 py-2 rounded-md text-center"
                >
                  Be om anbefaling
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* VÅRE TJENESTER */}
      <section className="bg-[hsl(var(--warm-cream))] pb-16">
        <div className="mx-auto max-w-[1440px] px-5 sm:px-10 lg:px-14 xl:px-16 grid lg:grid-cols-[220px_1fr] gap-8 items-start">
          <div>
            <h2 className="text-2xl lg:text-3xl font-bold text-[hsl(var(--mcs-navy))] leading-tight">Våre tjenester</h2>
            <div className="h-0.5 w-10 bg-[hsl(var(--mcs-orange))] mt-3" />
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {SERVICES.map((s) => (
              <div key={s.title} className="bg-white rounded-xl border border-[hsl(var(--warm-beige))] p-5 flex gap-3">
                <div className="h-10 w-10 rounded-full bg-[hsl(var(--mcs-navy))] text-white flex items-center justify-center shrink-0">
                  <s.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-[hsl(var(--mcs-navy))] mb-1">{s.title}</h3>
                  <p className="text-xs text-[hsl(var(--mcs-muted))] leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DERFOR VELGER KUNDENE OSS */}
      <section className="bg-[hsl(var(--warm-cream))] pb-16">
        <div className="mx-auto max-w-[1440px] px-5 sm:px-10 lg:px-14 xl:px-16">
          <div className="bg-[hsl(var(--warm-sand))] rounded-2xl overflow-hidden grid lg:grid-cols-[420px_1fr]">
            <img src={technicianImg} alt="Tekniker fra Lier VPS utfører service på innedel" loading="lazy" width={1280} height={960} className="h-full w-full object-cover min-h-[280px]" />
            <div className="p-7 lg:p-10">
              <h2 className="text-2xl font-bold text-[hsl(var(--mcs-navy))] mb-5">Derfor velger kundene oss</h2>
              <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
                {WHY.map((w) => (
                  <li key={w} className="flex items-start gap-2 text-sm text-[hsl(var(--mcs-navy))]">
                    <Check className="h-4 w-4 text-[hsl(var(--mcs-orange))] mt-0.5 shrink-0" /> {w}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* SERVICEAVTALE */}
      <section className="bg-[hsl(var(--warm-cream))] pb-16">
        <div className="mx-auto max-w-[1440px] px-5 sm:px-10 lg:px-14 xl:px-16">
          <div className="rounded-2xl bg-[hsl(var(--mcs-navy))] text-white p-7 lg:p-10 grid lg:grid-cols-[auto_1fr_1fr] gap-8 items-center">
            <div className="h-20 w-20 rounded-full border-2 border-[hsl(var(--mcs-orange))]/60 flex items-center justify-center shrink-0 mx-auto lg:mx-0">
              <ShieldCheck className="h-10 w-10 text-[hsl(var(--mcs-orange))]" />
            </div>
            <div>
              <p className="text-[hsl(var(--mcs-orange))] text-[11px] font-bold uppercase tracking-widest mb-2">Serviceavtale</p>
              <h2 className="text-xl lg:text-2xl font-bold mb-3 leading-tight">
                Årlig serviceavtale — trygghet hele året
              </h2>
              <p className="text-white/75 text-sm leading-relaxed mb-4">
                Med serviceavtale får du regelmessig kontroll, rengjøring og prioritet når du trenger
                hjelp. Perfekt for både boligeiere og bedrifter.
              </p>
              <Link
                to="/tjenester/serviceavtale"
                className="inline-flex items-center gap-2 bg-[hsl(var(--mcs-orange))] hover:bg-[hsl(var(--mcs-orange-hover))] text-white text-sm font-semibold px-5 py-2.5 rounded-md"
              >
                Les mer om serviceavtale
              </Link>
            </div>
            <ul className="grid sm:grid-cols-2 gap-2 text-sm">
              {AGREEMENT_BENEFITS.map((b) => (
                <li key={b} className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-[hsl(var(--mcs-orange))] mt-0.5 shrink-0" /> {b}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* SLIK GJØR VI DET */}
      <section className="bg-[hsl(var(--warm-cream))] pb-16">
        <div className="mx-auto max-w-[1440px] px-5 sm:px-10 lg:px-14 xl:px-16 grid lg:grid-cols-[220px_1fr] gap-8 items-start">
          <h2 className="text-2xl lg:text-3xl font-bold text-[hsl(var(--mcs-navy))] leading-tight">
            Slik gjør vi det
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
            {STEPS.map((s, i) => (
              <div key={s.n} className="relative">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-8 w-8 rounded-full bg-[hsl(var(--mcs-orange))] text-white font-bold text-sm flex items-center justify-center">
                    {s.n}
                  </div>
                  <h3 className="font-semibold text-[hsl(var(--mcs-navy))]">{s.title}</h3>
                </div>
                <p className="text-xs text-[hsl(var(--mcs-muted))] leading-relaxed pl-11">{s.desc}</p>
                {i < STEPS.length - 1 && (
                  <div className="hidden lg:block absolute top-4 -right-3 text-[hsl(var(--mcs-muted))]/40 text-xs">···</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* KUNDEPORTAL + FINAL CTA */}
      <section className="bg-[hsl(var(--warm-cream))] pb-16">
        <div className="mx-auto max-w-[1440px] px-5 sm:px-10 lg:px-14 xl:px-16 grid lg:grid-cols-2 gap-5">
          <div className="bg-white rounded-2xl border border-[hsl(var(--warm-beige))] p-6 lg:p-7 flex flex-col sm:flex-row gap-5 items-start">
            <div className="h-14 w-14 rounded-lg bg-[hsl(var(--mcs-navy))] text-white flex items-center justify-center shrink-0">
              <Monitor className="h-7 w-7" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-[hsl(var(--mcs-navy))] mb-1.5">Kundeportal</h3>
              <p className="text-sm text-[hsl(var(--mcs-muted))] mb-4 leading-relaxed">
                Logg inn i kundeportalen og få full oversikt over dine anlegg, servicebesøk og fakturaer.
              </p>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-sm font-semibold text-[hsl(var(--mcs-navy))] border border-[hsl(var(--mcs-navy))]/20 hover:border-[hsl(var(--mcs-navy))] px-4 py-2 rounded-md"
              >
                Logg inn i kundeportalen <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="rounded-2xl bg-[hsl(var(--mcs-orange))] text-white p-6 lg:p-7 flex flex-col justify-center">
            <h3 className="font-bold text-xl mb-2 text-center">
              Klar for varmepumpe eller trenger service?
            </h3>
            <p className="text-white/90 text-sm mb-5 text-center max-w-md mx-auto">
              Ta kontakt for uforpliktende befaring. Vi hjelper deg raskt og finner riktig løsning.
            </p>
            <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
              <Link
                to="/bestill-service"
                className="bg-[hsl(var(--mcs-navy))] hover:bg-[hsl(var(--mcs-navy))]/90 text-white font-semibold px-5 py-2.5 rounded-md inline-flex items-center justify-center gap-2"
              >
                <Phone className="h-4 w-4" /> Bestill befaring
              </Link>
              <a
                href="mailto:post@liervps.no"
                className="bg-white/10 border border-white/40 hover:bg-white/20 text-white font-semibold px-5 py-2.5 rounded-md inline-flex items-center justify-center gap-2"
              >
                <Mail className="h-4 w-4" /> post@liervps.no
              </a>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
