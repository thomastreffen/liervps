import { Link } from "react-router-dom";
import {
  LayoutDashboard, FileText, FolderOpen, AlertTriangle, Upload, Phone, Settings,
  ListTodo, Briefcase, Calendar, Users, ShieldAlert, ArrowRight
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCompanyContext } from "@/hooks/useCompanyContext";

const EXTERNAL_SHORTCUTS = [
  { to: "/bestilling", icon: FileText, label: "Ny bestilling" },
  { to: "/portal/projects", icon: ListTodo, label: "Mine saker" },
  { to: "/portal/projects", icon: Briefcase, label: "Aktive oppdrag" },
  { to: "/portal/deliveries", icon: FolderOpen, label: "Dokumentasjon" },
  { to: "/portal/messages", icon: AlertTriangle, label: "Avvik" },
  { to: "/kontakt", icon: Phone, label: "Kontakt MCS" },
];

const INTERNAL_SHORTCUTS = [
  { to: "/projects/plan", icon: Calendar, label: "Ressursplan" },
  { to: "/projects", icon: Briefcase, label: "Prosjekter" },
  { to: "/bestilling", icon: FileText, label: "Bestillinger" },
  { to: "/hms/incidents", icon: ShieldAlert, label: "HMS / avvik" },
  { to: "/customers", icon: Users, label: "Kunder" },
  { to: "/my-day", icon: ListTodo, label: "Min dag" },
];

export function PortalHero() {
  const { user, isAdmin } = useAuth();
  const { activeCompany } = useCompanyContext();
  if (!user) return null;

  const firstName = user.name?.split(" ")[0] || "der";
  const shortcuts = isAdmin || user.role === "montør" ? INTERNAL_SHORTCUTS : EXTERNAL_SHORTCUTS;

  return (
    <section className="bg-[hsl(var(--mcs-navy))] text-white border-b border-white/5">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 lg:py-7">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5">
          <div className="min-w-0">
            <p className="text-[hsl(var(--mcs-orange))] text-[11px] font-semibold tracking-wider uppercase mb-0.5">
              Innlogget portal
            </p>
            <h1 className="text-xl lg:text-2xl font-bold leading-tight truncate">
              Hei, {firstName}!
            </h1>
            <p className="text-white/60 text-xs lg:text-sm mt-0.5 truncate">
              {activeCompany ? <>Tilknyttet <span className="text-white/90 font-medium">{activeCompany.name}</span></> : "Microsoft-kontoen din er aktiv"}
            </p>
          </div>
          <div className="flex flex-row gap-2 shrink-0">
            <Link
              to="/overview"
              className="bg-[hsl(var(--mcs-orange))] hover:bg-[hsl(var(--mcs-orange-hover))] text-white font-semibold px-4 lg:px-5 py-2.5 rounded-md inline-flex items-center justify-center gap-2 text-sm"
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Åpne MCS Kontrollsenter</span>
              <ArrowRight className="h-4 w-4 hidden lg:inline" />
            </Link>
            <Link
              to="/overview"
              className="hidden sm:inline-flex border border-white/20 hover:border-white/40 text-white/90 font-medium px-4 py-2.5 rounded-md items-center justify-center text-sm"
            >
              Åpne dashboard
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {shortcuts.map((s) => (
            <Link
              key={s.label}
              to={s.to}
              className="group bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 text-white rounded-md px-3 py-2.5 transition-all flex items-center gap-2"
            >
              <div className="h-7 w-7 rounded-md bg-white/5 flex items-center justify-center text-[hsl(var(--mcs-orange))] shrink-0">
                <s.icon className="h-3.5 w-3.5" />
              </div>
              <span className="text-xs font-medium truncate">{s.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
