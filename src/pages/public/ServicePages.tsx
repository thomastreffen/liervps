import { PublicLayout } from "@/components/public/PublicLayout";
import { ServicePageTemplate } from "@/components/public/ServicePageTemplate";
import { Clock, ShieldCheck, FileCheck, Users } from "lucide-react";
import switchboard from "@/assets/mcs/switchboard.jpg";
import busbar from "@/assets/mcs/busbar.jpg";
import team from "@/assets/mcs/team.jpg";
import hero from "@/assets/mcs/hero.jpg";

const COMMON_BENEFITS = [
  { icon: <Users className="h-6 w-6" />, title: "Høy kompetanse", desc: "Våre elektrikere har lang erfaring og fagkompetanse." },
  { icon: <ShieldCheck className="h-6 w-6" />, title: "Kvalitet og sikkerhet", desc: "Vi følger gjeldende forskrifter og leverer kvalitet i alle ledd." },
  { icon: <Clock className="h-6 w-6" />, title: "Effektive prosesser", desc: "Moderne prosesser gir forutsigbarhet og god fremdrift." },
  { icon: <FileCheck className="h-6 w-6" />, title: "Full dokumentasjon", desc: "Du får komplett dokumentasjon og samsvarserklæring." },
];

const RELATED_ALL = [
  { to: "/tjenester/service-og-feilsoking", label: "Service og feilsøking" },
  { to: "/tjenester/elektrotavler", label: "Elektrotavler" },
  { to: "/tjenester/stromskinner", label: "Strømskinner" },
  { to: "/tjenester/hasteoppdrag", label: "Hasteoppdrag" },
];

const related = (exclude: string) => RELATED_ALL.filter((r) => !r.to.endsWith(exclude));

export function ServiceFeilsoking() {
  return (
    <PublicLayout>
      <ServicePageTemplate
        slug="service-og-feilsoking"
        title="Service og feilsøking"
        intro="Vi sikrer driftssikre løsninger fra planlegging til ferdig dokumentasjon — i eksisterende anlegg uten unødvendig nedetid."
        description="MCS Service utfører feilsøking, vedlikehold og service på elektriske tavler og strømskinnesystemer. Vi jobber i eksisterende anlegg hvor strøm ikke kan stå stille, og leverer raske og trygge løsninger for næring, industri og offentlige aktører."
        image={hero}
        imageAlt="Elektrikere fra MCS Service utfører service på elektrisk tavle"
        deliveries={[
          "Service, feilsøking og vedlikehold",
          "Installasjon og oppgradering",
          "Strømskinner og kraftfordeling",
          "Dokumentasjon og samsvarserklæring",
        ]}
        benefits={COMMON_BENEFITS}
        related={related("service-og-feilsoking")}
      />
    </PublicLayout>
  );
}

export function Elektrotavler() {
  return (
    <PublicLayout>
      <ServicePageTemplate
        slug="elektrotavler"
        title="Elektrotavler"
        intro="Ferdig levert, oppgradering og vedlikehold av elektriske tavler for fordelingsanlegg i næring og industri."
        description="Vi leverer elektrotavler tilpasset ditt anlegg — fra prosjektering og produksjonsoppfølging til montasje, idriftsettelse og service. MCS Service har bred erfaring med både nyinstallasjoner og oppgradering av eksisterende fordelinger."
        image={switchboard}
        imageAlt="Industriell elektrotavle med rader av sikringer og kobberskinner"
        deliveries={[
          "Prosjektering og produksjon",
          "Montasje og idriftsettelse",
          "Oppgradering av eksisterende tavler",
          "FDV-dokumentasjon og merking",
        ]}
        benefits={COMMON_BENEFITS}
        related={related("elektrotavler")}
      />
    </PublicLayout>
  );
}

export function Stromskinner() {
  return (
    <PublicLayout>
      <ServicePageTemplate
        slug="stromskinner"
        title="Montasje av strømskinner"
        intro="Prosjektering og montasje av strømskinner for trygg og effektiv kraftfordeling i moderne bygg, industri og datasenter."
        description="Strømskinnesystemer gir fleksibel kraftfordeling med høy kapasitet og enkel fremtidig utvidelse. MCS Service prosjekterer, monterer og dokumenterer hele leveransen — inkludert oppheng, tilkobling, vinkler og avgreninger."
        image={busbar}
        imageAlt="Tekniker monterer strømskinner med oransje koblingsklemmer"
        deliveries={[
          "Prosjektering og dimensjonering",
          "Komplett montasje av strømskinner",
          "Oppheng, vinkler og avgreninger",
          "Termografering og kontroll",
        ]}
        benefits={COMMON_BENEFITS}
        related={related("stromskinner")}
      />
    </PublicLayout>
  );
}

export function Hasteoppdrag() {
  return (
    <PublicLayout>
      <ServicePageTemplate
        slug="hasteoppdrag"
        title="Hasteoppdrag"
        intro="Akutt behov? Vi rykker ut 24/7 og løser problemer raskt og effektivt — også utenom åpningstid."
        description="Når strøm ikke kan stå stille er vår vakttelefon bemannet 24/7. MCS Service har beredskap for hasteoppdrag på tavleanlegg, strømskinner og fordelingsanlegg over hele Østlandet."
        image={team}
        imageAlt="MCS Service beredskap og hasteoppdrag"
        deliveries={[
          "Vakttelefon 24/7",
          "Rask responstid",
          "Akutt feilsøking og reparasjon",
          "Midlertidige løsninger ved nedetid",
        ]}
        benefits={COMMON_BENEFITS}
        related={related("hasteoppdrag")}
      />
    </PublicLayout>
  );
}
