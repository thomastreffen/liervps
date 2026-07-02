import { PublicLayout } from "@/components/public/PublicLayout";
import { PublicSeo, breadcrumbSchema } from "@/components/public/PublicSeo";
import { Link } from "react-router-dom";
import { Phone, Mail, MapPin, Clock, ArrowRight } from "lucide-react";
import { useState } from "react";

export function Kontakt() {
  return (
    <PublicLayout>
      <PublicSeo
        title="Kontakt Lier VPS"
        description="Ta kontakt med Lier Varmepumpeservice AS for befaring, tilbud eller service på varmepumpe."
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
                Ta kontakt for uforpliktende befaring, tilbud eller service — vi svarer raskt.
              </p>
              <ul className="space-y-5">
                <li className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-[hsl(var(--mcs-orange))] mt-1" />
                  <div>
                    <p className="text-sm text-[hsl(var(--mcs-muted))]">E-post</p>
                    <a href="mailto:post@liervps.no" className="text-lg font-semibold text-[hsl(var(--mcs-charcoal))]">post@liervps.no</a>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-[hsl(var(--mcs-orange))] mt-1" />
                  <div>
                    <p className="text-sm text-[hsl(var(--mcs-muted))]">Adresse</p>
                    <p className="text-lg font-semibold text-[hsl(var(--mcs-charcoal))]">Lier, Viken</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-[hsl(var(--mcs-orange))] mt-1" />
                  <div>
                    <p className="text-sm text-[hsl(var(--mcs-muted))]">Åpningstider</p>
                    <p className="text-base font-medium text-[hsl(var(--mcs-charcoal))]">Man–fre 08:00–16:00</p>
                  </div>
                </li>
              </ul>
            </div>
            <ContactForm />
          </div>
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
        window.location.href = `mailto:post@liervps.no?subject=${subject}&body=${body}`;
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
          <option>Befaring / tilbud</option>
          <option>Ny varmepumpe</option>
          <option>Service eller årskontroll</option>
          <option>Feilsøking</option>
          <option>Serviceavtale</option>
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
      {sent && <p className="text-sm text-[hsl(var(--mcs-muted))] text-center">Åpner e-postklienten din.</p>}
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
        title="Bestill befaring — Lier VPS"
        description="Bestill uforpliktende befaring eller service hos Lier Varmepumpeservice AS."
        path="/bestill-service"
        jsonLd={breadcrumbSchema([{ name: "Hjem", path: "/" }, { name: "Bestill befaring", path: "/bestill-service" }])}
      />
      <section className="bg-white py-12 lg:py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-3xl lg:text-5xl font-bold text-[hsl(var(--mcs-charcoal))] mb-4">Bestill befaring eller service</h1>
          <p className="text-[hsl(var(--mcs-muted))] mb-10 text-lg">
            Fortell oss kort hva du trenger — vi kontakter deg raskt for avtale.
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
        title="Om Lier Varmepumpeservice AS"
        description="Lier VPS er et lokalt varmepumpefirma i Lier — vi leverer befaring, salg, montering og service."
        path="/om-mcs"
        jsonLd={breadcrumbSchema([{ name: "Hjem", path: "/" }, { name: "Om oss", path: "/om-mcs" }])}
      />
      <section className="bg-white py-16 lg:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <p className="text-[hsl(var(--mcs-orange))] text-sm font-semibold uppercase tracking-wider mb-2">Om oss</p>
          <h1 className="text-3xl lg:text-5xl font-bold text-[hsl(var(--mcs-charcoal))] mb-6">Lokal varmepumpespesialist i Lier</h1>
          <div className="prose prose-slate text-[hsl(var(--mcs-charcoal))] space-y-5">
            <p>Lier Varmepumpeservice AS er et lokalt firma som leverer varmepumper og oppfølging til boliger og næring i Lier og omegn.</p>
            <p>Vi følger deg gjennom hele reisen — fra befaring og valg av modell, via fagmessig montering, til årlig service som holder anlegget effektivt og trygt i mange år.</p>
            <p>Vi tror på ærlig rådgivning, faste priser og god oppfølging etter installasjon.</p>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

export function Referanser() {
  const refs = [
    { name: "Enebolig, Lier", desc: "Luft-til-luft varmepumpe med årlig serviceavtale." },
    { name: "Rekkehus, Drammen", desc: "Luft-til-vann-anlegg tilkoblet vannbåren varme." },
    { name: "Hytte, Vestfold", desc: "Energieffektiv luft-til-luft med fjernstyring." },
    { name: "Næringsbygg, Lier", desc: "Utskifting av eldre anlegg med moderne varmepumpe." },
  ];
  return (
    <PublicLayout>
      <PublicSeo
        title="Referanser — Lier VPS"
        description="Utvalg av leveranser fra Lier Varmepumpeservice AS."
        path="/referanser"
        jsonLd={breadcrumbSchema([{ name: "Hjem", path: "/" }, { name: "Referanser", path: "/referanser" }])}
      />
      <section className="bg-white py-16 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-[hsl(var(--mcs-orange))] text-sm font-semibold uppercase tracking-wider mb-2">Utvalgte leveranser</p>
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
