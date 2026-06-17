import { Link } from "react-router-dom";
import { Check, ChevronRight, ArrowRight } from "lucide-react";
import { ReactNode } from "react";
import { PublicSeo, breadcrumbSchema, serviceSchema } from "./PublicSeo";

interface Benefit { icon: ReactNode; title: string; desc: string }
interface Props {
  slug: string;
  title: string;
  intro: string;
  description: string;
  image: string;
  imageAlt: string;
  deliveries: string[];
  benefits: Benefit[];
  related: { to: string; label: string }[];
}

export function ServicePageTemplate(p: Props) {
  const path = `/tjenester/${p.slug}`;
  return (
    <>
      <PublicSeo
        title={p.title}
        description={p.description}
        path={path}
        jsonLd={[
          serviceSchema(p.title, p.description, path),
          breadcrumbSchema([
            { name: "Hjem", path: "/" },
            { name: "Tjenester", path: "/tjenester/service-og-feilsoking" },
            { name: p.title, path },
          ]),
        ]}
      />
      <article className="bg-white">
        <div className="bg-[hsl(var(--mcs-light))] border-b border-[hsl(var(--mcs-border))]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3">
            <nav className="text-xs text-[hsl(var(--mcs-muted))] flex items-center gap-1.5" aria-label="Brødsmuler">
              <Link to="/" className="hover:text-[hsl(var(--mcs-navy))]">Hjem</Link>
              <ChevronRight className="h-3 w-3" />
              <span>Tjenester</span>
              <ChevronRight className="h-3 w-3" />
              <span className="text-[hsl(var(--mcs-charcoal))]">{p.title}</span>
            </nav>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <div>
              <h1 className="text-3xl lg:text-5xl font-bold text-[hsl(var(--mcs-charcoal))] leading-tight mb-5">{p.title}</h1>
              <p className="text-lg text-[hsl(var(--mcs-muted))] mb-8 leading-relaxed">{p.intro}</p>
              <ul className="space-y-3 mb-8">
                {p.deliveries.map((d) => (
                  <li key={d} className="flex items-start gap-3">
                    <span className="h-6 w-6 rounded-full bg-[hsl(var(--mcs-orange))]/10 text-[hsl(var(--mcs-orange))] flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="h-4 w-4" />
                    </span>
                    <span className="text-[hsl(var(--mcs-charcoal))]">{d}</span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link to="/bestill-service" className="bg-[hsl(var(--mcs-orange))] hover:bg-[hsl(var(--mcs-orange-hover))] text-white font-semibold px-6 py-3 rounded-md text-center">Bestill service</Link>
                <Link to="/kontakt" className="border border-[hsl(var(--mcs-border))] hover:border-[hsl(var(--mcs-navy))] text-[hsl(var(--mcs-charcoal))] font-medium px-6 py-3 rounded-md text-center">Ta kontakt</Link>
              </div>
            </div>
            <div className="relative">
              <img src={p.image} alt={p.imageAlt} loading="lazy" width={1280} height={832} className="rounded-xl shadow-2xl w-full h-auto object-cover" />
            </div>
          </div>
        </div>

        <div className="bg-[hsl(var(--mcs-light))] border-y border-[hsl(var(--mcs-border))]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {p.benefits.map((b) => (
                <div key={b.title} className="text-center">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-white text-[hsl(var(--mcs-navy))] mb-3 shadow-sm">{b.icon}</div>
                  <h3 className="font-semibold text-[hsl(var(--mcs-charcoal))] mb-1.5">{b.title}</h3>
                  <p className="text-sm text-[hsl(var(--mcs-muted))]">{b.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 prose prose-slate max-w-3xl">
          <p className="text-[hsl(var(--mcs-charcoal))] text-lg leading-relaxed">{p.description}</p>
        </div>

        <section className="bg-[hsl(var(--mcs-navy))] text-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14 text-center">
            <h2 className="text-2xl lg:text-3xl font-bold mb-3">Trenger du hjelp med {p.title.toLowerCase()}?</h2>
            <p className="text-white/70 mb-7 max-w-2xl mx-auto">Ta kontakt — vi hjelper deg med en trygg og effektiv løsning.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/bestill-service" className="bg-[hsl(var(--mcs-orange))] hover:bg-[hsl(var(--mcs-orange-hover))] text-white font-semibold px-7 py-3 rounded-md">Bestill service</Link>
              <Link to="/kontakt" className="border border-white/30 hover:border-white text-white font-medium px-7 py-3 rounded-md">Ta kontakt</Link>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[hsl(var(--mcs-muted))] mb-4">Relaterte tjenester</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {p.related.map((r) => (
              <Link key={r.to} to={r.to} className="group p-5 rounded-lg border border-[hsl(var(--mcs-border))] hover:border-[hsl(var(--mcs-navy))] bg-white transition-colors">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-[hsl(var(--mcs-charcoal))]">{r.label}</span>
                  <ArrowRight className="h-4 w-4 text-[hsl(var(--mcs-orange))] group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </article>
    </>
  );
}
