import { PublicLayout } from "@/components/public/PublicLayout";
import { PublicSeo, breadcrumbSchema } from "@/components/public/PublicSeo";
import { Link } from "react-router-dom";
import { Phone, Mail, MapPin, Clock, ArrowRight } from "lucide-react";
import { useState } from "react";

export function Kontakt() {
  return (
    <PublicLayout>
      <PublicSeo
        title="Kontakt MCS Service"
        description="Ta kontakt med MCS Service for befaring, tilbud eller hjelp. Vi er klare til å bistå med service og installasjon av elektriske tavler og strømskinnesystemer."
        path="/kontakt"
        jsonLd={breadcrumbSchema([{ name: "Hjem", path: "/" }, { name: "Kontakt", path: "/kontakt" }])}
      />
      <section className="bg-[hsl(var(--mcs-light))]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3 text-xs text-[hsl(var(--mcs-muted))]">
          <Link to="/" className="hover:text-[hsl(var(--mcs-navy))]">Hjem</Link> › <span className="text-[hsl(var(--mcs-charcoal))]">Kontakt</span>
        </div>
      </section>
      <section className="bg-white py-12 lg:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12">
            <div>
              <h1 className="text-3xl lg:text-5xl font-bold text-[hsl(var(--mcs-charcoal))] mb-4">Kontakt oss</h1>
              <p className="text-[hsl(var(--mcs-muted))] mb-8 text-lg">
                Ta kontakt for befaring, tilbud eller hvis du trenger hjelp — vi er klare til å bistå.
              </p>
              <ul className="space-y-5">
                <li className="flex items-start gap-3">
                  <Phone className="h-5 w-5 text-[hsl(var(--mcs-orange))] mt-1" />
                  <div>
                    <p className="text-sm text-[hsl(var(--mcs-muted))]">Telefon</p>
                    <a href="tel:+4745707073" className="text-lg font-semibold text-[hsl(var(--mcs-charcoal))]">+47 45 70 70 73</a>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-[hsl(var(--mcs-orange))] mt-1" />
                  <div>
                    <p className="text-sm text-[hsl(var(--mcs-muted))]">E-post</p>
                    <a href="mailto:post@mcsservice.no" className="text-lg font-semibold text-[hsl(var(--mcs-charcoal))]">post@mcsservice.no</a>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-[hsl(var(--mcs-orange))] mt-1" />
                  <div>
                    <p className="text-sm text-[hsl(var(--mcs-muted))]">Adresse</p>
                    <p className="text-lg font-semibold text-[hsl(var(--mcs-charcoal))]">Orkidèhøgda 2A<br />3050 Mjøndalen</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-[hsl(var(--mcs-orange))] mt-1" />
                  <div>
                    <p className="text-sm text-[hsl(var(--mcs-muted))]">Åpningstider</p>
                    <p className="text-base font-medium text-[hsl(var(--mcs-charcoal))]">Man–fre 07:00–16:00<br /><span className="text-[hsl(var(--mcs-muted))] text-sm">Vakttelefon 24/7</span></p>
                  </div>
                </li>
              </ul>
            </div>
            <ContactForm />
          </div>
        </div>
      </section>
      <section className="bg-[hsl(var(--mcs-light))] py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-xl overflow-hidden border border-[hsl(var(--mcs-border))] shadow-sm">
            <iframe
              title="Kart over MCS Service"
              src="https://www.google.com/maps?q=Orkid%C3%A8h%C3%B8gda+2A,+3050+Mj%C3%B8ndalen&output=embed"
              className="w-full h-[380px]"
              loading="lazy"
            />
          </div>
        </div>
      </section>
      <section className="bg-[hsl(var(--mcs-navy))] text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-[hsl(var(--mcs-orange))] text-xs uppercase tracking-widest font-semibold mb-1">Vakttelefon — 24/7</p>
            <p className="text-lg font-semibold">Ved akutte hendelser utenfor åpningstid</p>
          </div>
          <a href="tel:+4745707073" className="bg-[hsl(var(--mcs-orange))] hover:bg-[hsl(var(--mcs-orange-hover))] text-white font-semibold px-6 py-3 rounded-md inline-flex items-center gap-2">
            <Phone className="h-5 w-5" /> +47 45 70 70 73
          </a>
        </div>
      </section>
    </PublicLayout>
  );
}

function ContactForm() {
  const [sent, setSent] = useState(false);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const subject = encodeURIComponent(`Henvendelse fra ${fd.get("name")}`);
        const body = encodeURIComponent(
          `Navn: ${fd.get("name")}\nE-post: ${fd.get("email")}\nTelefon: ${fd.get("phone")}\nHva gjelder henvendelsen: ${fd.get("topic")}\n\n${fd.get("message")}`
        );
        window.location.href = `mailto:post@mcsservice.no?subject=${subject}&body=${body}`;
        setSent(true);
      }}
      className="bg-white border border-[hsl(var(--mcs-border))] rounded-xl p-6 lg:p-8 shadow-sm space-y-4"
    >
      <h2 className="text-xl font-semibold text-[hsl(var(--mcs-charcoal))] mb-2">Send oss en melding</h2>
      <Field label="Navn" name="name" required />
      <Field label="E-post" name="email" type="email" required />
      <Field label="Telefon" name="phone" type="tel" />
      <div>
        <label className="block text-sm font-medium text-[hsl(var(--mcs-charcoal))] mb-1.5">Hva gjelder henvendelsen? *</label>
        <select name="topic" required className="w-full border border-[hsl(var(--mcs-border))] rounded-md px-3 py-2.5 bg-white text-sm">
          <option value="">Velg type</option>
          <option>Service og feilsøking</option>
          <option>Elektrotavler</option>
          <option>Strømskinner</option>
          <option>Hasteoppdrag</option>
          <option>Annet</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-[hsl(var(--mcs-charcoal))] mb-1.5">Din melding *</label>
        <textarea name="message" required rows={4} className="w-full border border-[hsl(var(--mcs-border))] rounded-md px-3 py-2.5 text-sm" />
      </div>
      <button type="submit" className="w-full bg-[hsl(var(--mcs-orange))] hover:bg-[hsl(var(--mcs-orange-hover))] text-white font-semibold py-3 rounded-md inline-flex items-center justify-center gap-2">
        Send melding <ArrowRight className="h-4 w-4" />
      </button>
      {sent && <p className="text-sm text-[hsl(var(--mcs-muted))] text-center">Åpner e-postklienten — eventuelt ring oss direkte på +47 45 70 70 73.</p>}
    </form>
  );
}

function Field({ label, name, type = "text", required }: { label: string; name: string; type?: string; required?: boolean }) {
  return (
    <div>
      <label className="block text-sm font-medium text-[hsl(var(--mcs-charcoal))] mb-1.5">{label}{required && " *"}</label>
      <input name={name} type={type} required={required} className="w-full border border-[hsl(var(--mcs-border))] rounded-md px-3 py-2.5 text-sm" />
    </div>
  );
}

export function BestillService() {
  return (
    <PublicLayout>
      <PublicSeo
        title="Bestill service — MCS Service"
        description="Bestill service eller registrer et nytt oppdrag hos MCS Service. Vi kontakter deg raskt for befaring eller utrykning."
        path="/bestill-service"
        jsonLd={breadcrumbSchema([{ name: "Hjem", path: "/" }, { name: "Bestill service", path: "/bestill-service" }])}
      />
      <section className="bg-white py-12 lg:py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-3xl lg:text-5xl font-bold text-[hsl(var(--mcs-charcoal))] mb-4">Bestill service</h1>
          <p className="text-[hsl(var(--mcs-muted))] mb-10 text-lg">
            Fortell oss kort hva du trenger hjelp med, så tar vi kontakt for befaring eller utrykning.
          </p>
        </div>
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <ContactForm />
        </div>
      </section>
    </PublicLayout>
  );
}

export function OmMcs() {
  return (
    <PublicLayout>
      <PublicSeo
        title="Om MCS Service"
        description="MCS Service er spesialister på service og installasjon av elektriske tavler og strømskinnesystemer. En del av Ernströmgruppen."
        path="/om-mcs"
        jsonLd={breadcrumbSchema([{ name: "Hjem", path: "/" }, { name: "Om oss", path: "/om-mcs" }])}
      />
      <section className="bg-white py-16 lg:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <p className="text-[hsl(var(--mcs-orange))] text-sm font-semibold uppercase tracking-wider mb-2">Om oss</p>
          <h1 className="text-3xl lg:text-5xl font-bold text-[hsl(var(--mcs-charcoal))] mb-6">En spesialist i Ernströmgruppen</h1>
          <div className="prose prose-slate text-[hsl(var(--mcs-charcoal))] space-y-5">
            <p>MCS Service AS er en spesialisert elektroentreprenør innen service, vedlikehold og installasjon av elektriske tavler, fordelingsanlegg og strømskinnesystemer.</p>
            <p>Vi jobber primært med eksisterende anlegg i næring, industri, datasenter og offentlig sektor — der driftssikkerhet og minst mulig nedetid er avgjørende.</p>
            <p>MCS Service er en del av Ernströmgruppen, et nordisk industrikonsern som samler ledende teknologi- og servicebedrifter innen energi og infrastruktur.</p>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

export function Referanser() {
  const refs = [
    { name: "Datasenter Østlandet", desc: "Service og oppgradering av tavler i kritisk infrastruktur." },
    { name: "Produksjonsbedrift", desc: "Komplett strømskinnesystem for fleksibel kraftfordeling." },
    { name: "Næringsbygg", desc: "Vedlikeholdsavtale med årlig termografering og kontroll." },
    { name: "Offentlig sektor", desc: "Oppgradering av fordelingsanlegg uten nedetid." },
  ];
  return (
    <PublicLayout>
      <PublicSeo
        title="Referanser — MCS Service"
        description="Utvalg av prosjekter MCS Service har levert innen elektrotavler, strømskinner og service."
        path="/referanser"
        jsonLd={breadcrumbSchema([{ name: "Hjem", path: "/" }, { name: "Referanser", path: "/referanser" }])}
      />
      <section className="bg-white py-16 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-[hsl(var(--mcs-orange))] text-sm font-semibold uppercase tracking-wider mb-2">Prosjekter og kunder</p>
          <h1 className="text-3xl lg:text-5xl font-bold text-[hsl(var(--mcs-charcoal))] mb-10">Referanser</h1>
          <div className="grid sm:grid-cols-2 gap-5">
            {refs.map((r) => (
              <div key={r.name} className="bg-[hsl(var(--mcs-light))] border border-[hsl(var(--mcs-border))] rounded-xl p-6">
                <h2 className="font-semibold text-[hsl(var(--mcs-charcoal))] mb-2">{r.name}</h2>
                <p className="text-sm text-[hsl(var(--mcs-muted))]">{r.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
