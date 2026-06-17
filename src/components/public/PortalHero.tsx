import { Link } from "react-router-dom";
import {
  LayoutDashboard, FileText, FolderOpen, AlertTriangle, Upload, Phone, Settings,
  ListTodo, Briefcase, Calendar, Users, ShieldAlert
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCompanyContext } from "@/hooks/useCompanyContext";

const EXTERNAL_SHORTCUTS = [
  { to: "/bestilling", icon: FileText, label: "Ny bestilling", desc: "Bestill service eller registrer en ny sak." },
  { to: "/portal/projects", icon: ListTodo, label: "Mine saker", desc: "Se status og historikk på dine saker." },
  { to: "/portal/projects", icon: Briefcase, label: "Aktive oppdrag", desc: "Pågående arbeid i dine anlegg." },
  { to: "/portal/deliveries", icon: FolderOpen, label: "Dokumentasjon / FDV", desc: "Tilgang til FDV og annen dokumentasjon." },
  { to: "/portal/messages", icon: AlertTriangle, label: "Avvik / melding", desc: "Meld inn avvik eller feil på anlegg." },
  { to: "/bestilling", icon: Upload, label: "Last opp underlag", desc: "Send bilder, tegninger og dokumenter." },
  { to: "/kontakt", icon: Phone, label: "Kontakt MCS Service", desc: "Kom direkte i kontakt med oss." },
  { to: "/portal/settings", icon: Settings, label: "Innstillinger", desc: "Administrer dine brukerinnstillinger." },
];

const INTERNAL_SHORTCUTS = [
  { to: "/overview", icon: LayoutDashboard, label: "Dashboard", desc: "Oversikt over hverdagen." },
  { to: "/projects/plan", icon: Calendar, label: "Ressursplan", desc: "Planlegg oppdrag og montører." },
  { to: "/projects", icon: Briefcase, label: "Prosjekter", desc: "Aktive og avsluttede prosjekter." },
  { to: "/bestilling", icon: FileText, label: "Bestillinger", desc: "Bestillingsskjema og innboks." },
  { to: "/hms/incidents", icon: ShieldAlert, label: "HMS / avvik", desc: "Rapporter og oppfølging." },
  { to: "/projects", icon: FolderOpen, label: "Dokumentasjon", desc: "Vedlegg og prosjektdokumenter." },
  { to: "/customers", icon: Users, label: "Kunder", desc: "Kundebase og kontakter." },
  { to: "/my-day", icon: ListTodo, label: "Min dag", desc: "Dagens oppgaver og oppdrag." },
];

export function PortalHero() {
  const { user, isAdmin } = useAuth();
  const { activeCompany } = useCompanyContext();
  if (!user) return null;

  const firstName = user.name?.split(" ")[0] || "der";
  const shortcuts = isAdmin || user.role === "montør" ? INTERNAL_SHORTCUTS : EXTERNAL_SHORTCUTS;

  return (
    <section className="bg-[hsl(var(--mcs-navy))] text-white border-b border-white/5">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
          <div>
            <p className="text-[hsl(var(--mcs-orange))] text-sm font-semibold tracking-wide uppercase mb-2">
              Innlogget portal
            </p>
            <h1 className="text-3xl lg:text-4xl font-bold mb-2">Hei, {firstName}!</h1>
            <p className="text-white/70 max-w-2xl">
              Du er logget inn med Microsoft-kontoen din
              {activeCompany ? <> og tilknyttet <span className="text-white font-medium">{activeCompany.name}</span></> : null}.
              Bruk MCS Service til bestilling, oppfølging og dokumentasjon.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              to="/overview"
              className="bg-[hsl(var(--mcs-orange))] hover:bg-[hsl(var(--mcs-orange-hover))] text-white font-semibold px-6 py-3 rounded-md inline-flex items-center justify-center gap-2"
            >
              <LayoutDashboard className="h-5 w-5" /> Åpne dashboard
            </Link>
            <Link
              to="/overview"
              className="border border-white/20 hover:border-white/40 text-white font-medium px-6 py-3 rounded-md inline-flex items-center justify-center"
            >
              Gå til MCS Kontrollsenter
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {shortcuts.map((s) => (
            <Link
              key={s.label}
              to={s.to}
              className="group bg-white hover:bg-white/95 text-[hsl(var(--mcs-charcoal))] rounded-lg p-4 transition-all hover:-translate-y-0.5"
            >
              <div className="flex items-center gap-3 mb-1.5">
                <div className="h-9 w-9 rounded-md bg-[hsl(var(--mcs-light))] flex items-center justify-center text-[hsl(var(--mcs-navy))]">
                  <s.icon className="h-5 w-5" />
                </div>
                <span className="font-semibold text-sm">{s.label}</span>
              </div>
              <p className="text-xs text-[hsl(var(--mcs-muted))] leading-snug">{s.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
