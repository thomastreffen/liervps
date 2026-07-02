import { PublicLayout } from "@/components/public/PublicLayout";
import { ServicePageTemplate } from "@/components/public/ServicePageTemplate";
import { Clock, ShieldCheck, FileCheck, Users } from "lucide-react";
import hero from "@/assets/lier/hero.jpg";
import service from "@/assets/lier/service.jpg";

const COMMON_BENEFITS = [
  { icon: <Users className="h-6 w-6" />, title: "Sertifiserte teknikere", desc: "F-gassertifisert personell med lang erfaring." },
  { icon: <ShieldCheck className="h-6 w-6" />, title: "Trygg garanti", desc: "Full garantioppfølging på montering og produkter." },
  { icon: <Clock className="h-6 w-6" />, title: "Rask respons", desc: "Vi svarer raskt og planlegger effektivt." },
  { icon: <FileCheck className="h-6 w-6" />, title: "Full dokumentasjon", desc: "Digital servicehistorikk og FDV." },
];

const RELATED_ALL = [
  { to: "/tjenester/befaring", label: "Befaring og rådgivning" },
  { to: "/tjenester/salg", label: "Salg av varmepumpe" },
  { to: "/tjenester/montering", label: "Montering" },
  { to: "/tjenester/service", label: "Service og vedlikehold" },
  { to: "/tjenester/feilsoking", label: "Feilsøking" },
  { to: "/tjenester/serviceavtale", label: "Årlig serviceavtale" },
];

const related = (exclude: string) => RELATED_ALL.filter((r) => !r.to.endsWith(exclude)).slice(0, 4);

function Page({ slug, title, intro, description, image, imageAlt, deliveries }: {
  slug: string; title: string; intro: string; description: string; image: string; imageAlt: string; deliveries: string[];
}) {
  return (
    <PublicLayout>
      <ServicePageTemplate
        slug={slug}
        title={title}
        intro={intro}
        description={description}
        image={image}
        imageAlt={imageAlt}
        deliveries={deliveries}
        benefits={COMMON_BENEFITS}
        related={related(slug)}
      />
    </PublicLayout>
  );
}

export function Befaring() {
  return <Page
    slug="befaring"
    title="Befaring og rådgivning"
    intro="Vi kommer hjem til deg, ser på boligen og anbefaler riktig varmepumpe for ditt behov."
    description="En god befaring er starten på et anlegg som fungerer i mange år. Vi vurderer boligens størrelse, plassering av innedel og utedel, elektrisk kapasitet og forventet varmebehov før vi anbefaler løsning."
    image={service} imageAlt="Tekniker gjør befaring i bolig"
    deliveries={["Vurdering av varmebehov", "Plassering av inne- og utedel", "Elektrisk kapasitet", "Uforpliktende tilbud"]}
  />;
}

export function Salg() {
  return <Page
    slug="salg"
    title="Salg av varmepumpe"
    intro="Kvalitetsmerker og modeller tilpasset norsk klima. Trygge priser uten skjulte kostnader."
    description="Vi selger varmepumper fra ledende produsenter — luft-til-luft, luft-til-vann og væske-til-vann. Riktig modell for boligen din, med garanti og lokal serviceoppfølging."
    image={hero} imageAlt="Utendørs varmepumpe"
    deliveries={["Luft-til-luft", "Luft-til-vann", "Væske-til-vann", "Garanti og serviceavtale"]}
  />;
}

export function Montering() {
  return <Page
    slug="montering"
    title="Montering"
    intro="Fagmessig og ryddig montering av varmepumper — vi rydder etter oss."
    description="Montering utføres av sertifiserte teknikere. Vi håndterer rørføring, elektrisk tilkobling, veggmontering og idriftsettelse — og gir deg full opplæring i bruk før vi drar."
    image={service} imageAlt="Montering av innedel"
    deliveries={["Rør- og elektrikertjenester", "Veggmontering og oppheng", "Idriftsettelse og lekkasjetest", "Opplæring av bruker"]}
  />;
}

export function Service() {
  return <Page
    slug="service"
    title="Service og vedlikehold"
    intro="Regelmessig service holder anlegget effektivt og forlenger levetiden."
    description="Vi rengjør, kontrollerer og finjusterer varmepumpen slik at den bruker minst mulig strøm og varer lengst mulig. Anbefalt intervall er årlig service."
    image={service} imageAlt="Service på varmepumpe"
    deliveries={["Rengjøring av innedel og utedel", "Filterbytte", "Trykk- og tetthetskontroll", "Ytelsesmåling"]}
  />;
}

export function Feilsoking() {
  return <Page
    slug="feilsoking"
    title="Feilsøking"
    intro="Anlegget virker ikke som det skal? Vi finner feilen og retter opp raskt."
    description="Feilsøking utføres systematisk — vi går gjennom kuldemedie, elektronikk, sensorer og programvare, og gir deg klar tilbakemelding før reparasjon starter."
    image={service} imageAlt="Feilsøking av varmepumpe"
    deliveries={["Feilkoder og elektronikk", "Kuldemedie og tetthet", "Sensorer og styring", "Reservedeler og reparasjon"]}
  />;
}

export function Serviceavtale() {
  return <Page
    slug="serviceavtale"
    title="Årlig serviceavtale"
    intro="Fastpris på årskontroll, rask respons ved feil og full oversikt over anlegget ditt."
    description="Med serviceavtale hos Lier VPS får du årlig fysisk kontroll, prioritert responstid ved feil, rabatt på reservedeler og digital servicehistorikk på ett sted."
    image={hero} imageAlt="Varmepumpe med serviceavtale"
    deliveries={["Årlig kontroll og rengjøring", "Prioritert responstid", "Rabatt på reservedeler", "Digital servicehistorikk"]}
  />;
}

// Backwards-compat re-exports for existing routes
export const ServiceFeilsoking = Feilsoking;
export const Elektrotavler = Salg;
export const Stromskinner = Montering;
export const Hasteoppdrag = Service;
