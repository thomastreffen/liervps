import { Link } from "react-router-dom";
import {
  LayoutDashboard, Calendar, Briefcase, FileText, FolderOpen, AlertTriangle,
  Upload, Phone, ArrowRight, ClipboardList, Clock, CheckCircle2, HelpCircle,
  Lock, ShoppingBag, Bell,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { useActionCounts } from "@/hooks/useActionCounts";

const STATUS_CARDS = [
  { key: "active",   label: "Aktive jobber",        icon: Briefcase,     accent: "text-[hsl(var(--mcs-orange))]" },
  { key: "pending",  label: "Venter på avklaring",  icon: HelpCircle,    accent: "text-amber-600" },
  { key: "planned",  label: "Planlagt / tildelt",    icon: Clock,         accent: "text-blue-600" },
  { key: "done",     label: "Ferdig / dokumentert", icon: CheckCircle2,  accent: "text-emerald-600" },
];

const DOC_SHORTCUTS = [
  { to: "/portal/deliveries", icon: Upload,         label: "Last opp underlag" },
  { to: "/portal/deliveries", icon: FolderOpen,     label: "Dokumentasjon / FDV" },
  { to: "/portal/messages",   icon: AlertTriangle,  label: "Avvik / melding" },
  { to: "/kontakt",           icon: Phone,          label: "Kontakt MCS Service" },
];

export function InternalWorkspace() {
  const { user, isAdmin } = useAuth();
  const { activeCompany } = useCompanyContext();
  if (!user) return null;

  const firstName = user.name?.split(" ")[0] || "der";
  const isInternal = isAdmin || user.role === "montør";
  const myJobsLink = isInternal ? "/projects" : "/portal/projects";

  return (
    <section className="bg-[hsl(var(--mcs-navy))] text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
        {/* Welcome */}
        <div className="mb-6 lg:mb-7">
          <p className="text-[hsl(var(--mcs-orange))] text-[11px] font-semibold tracking-wider uppercase mb-1">
            Din arbeidsflate
          </p>
          <h1 className="text-2xl lg:text-3xl font-bold leading-tight">
            Hei, {firstName}
          </h1>
          <p className="text-white/70 text-sm lg:text-base mt-1">
            {activeCompany ? <>Tilknyttet <span className="text-white/95 font-medium">{activeCompany.name}</span>. </> : null}
            Her finner du dine servicejobber, bestillinger og snarveier inn i MCS Kontrollsenter.
          </p>
        </div>

        {/* Primary actions */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-6">
          <Link
            to="/bestilling"
            className="bg-[hsl(var(--mcs-orange))] hover:bg-[hsl(var(--mcs-orange-hover))] text-white font-semibold px-4 py-3 rounded-md inline-flex items-center justify-center gap-2 text-sm"
          >
            <FileText className="h-4 w-4" />
            Bestill servicejobb
          </Link>
          <Link
            to={myJobsLink}
            className="bg-white text-[hsl(var(--mcs-navy))] hover:bg-white/90 font-semibold px-4 py-3 rounded-md inline-flex items-center justify-center gap-2 text-sm"
          >
            <ClipboardList className="h-4 w-4" />
            Mine bestillinger
          </Link>
          <Link
            to="/overview"
            className="border border-white/25 hover:border-white/60 text-white font-semibold px-4 py-3 rounded-md inline-flex items-center justify-center gap-2 text-sm"
          >
            <LayoutDashboard className="h-4 w-4" />
            MCS Kontrollsenter
          </Link>
          {isInternal ? (
            <Link
              to="/projects/plan"
              className="border border-white/25 hover:border-white/60 text-white font-semibold px-4 py-3 rounded-md inline-flex items-center justify-center gap-2 text-sm"
            >
              <Calendar className="h-4 w-4" />
              Ressursplan
            </Link>
          ) : (
            <span
              aria-disabled
              title="Krever tilgang"
              className="border border-white/10 text-white/40 font-semibold px-4 py-3 rounded-md inline-flex items-center justify-center gap-2 text-sm cursor-not-allowed"
            >
              <Lock className="h-4 w-4" />
              Ressursplan
            </span>
          )}
        </div>

        {/* Status overview */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-8">
          {STATUS_CARDS.map((s) => (
            <div
              key={s.key}
              className="bg-white text-[hsl(var(--mcs-charcoal))] rounded-md px-4 py-3 border border-white/0 shadow-sm"
              data-status-key={s.key}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[hsl(var(--mcs-muted))]">{s.label}</span>
                <s.icon className={`h-4 w-4 ${s.accent}`} />
              </div>
              <div className="mt-1 text-2xl font-bold tabular-nums">—</div>
            </div>
          ))}
        </div>

        {/* My jobs + Resource plan */}
        <div className="grid lg:grid-cols-3 gap-4 mb-7">
          <div className="lg:col-span-2 bg-white text-[hsl(var(--mcs-charcoal))] rounded-lg p-5 border border-white/0 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-base">Mine bestillinger og jobber</h2>
              <Link to={myJobsLink} className="text-xs font-medium text-[hsl(var(--mcs-orange))] inline-flex items-center gap-1">
                Se alle <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            {/* Empty state — wired up to real data later */}
            <div className="border border-dashed border-[hsl(var(--mcs-border))] rounded-md py-8 px-4 text-center">
              <p className="text-sm text-[hsl(var(--mcs-muted))] mb-3">
                Du har ingen aktive servicejobber akkurat nå.
              </p>
              <Link
                to="/bestilling"
                className="inline-flex items-center gap-2 bg-[hsl(var(--mcs-orange))] hover:bg-[hsl(var(--mcs-orange-hover))] text-white font-semibold px-4 py-2 rounded-md text-sm"
              >
                <FileText className="h-4 w-4" />
                Bestill servicejobb
              </Link>
            </div>
          </div>

          {isInternal && (
            <div className="bg-white text-[hsl(var(--mcs-charcoal))] rounded-lg p-5 border border-white/0 shadow-sm flex flex-col">
              <h2 className="font-semibold text-base mb-1">Ressursplan</h2>
              <p className="text-sm text-[hsl(var(--mcs-muted))] mb-4 flex-1">
                Se tilgjengelig kapasitet og planlagte oppdrag.
              </p>
              <Link
                to="/projects/plan"
                className="inline-flex items-center justify-center gap-2 bg-[hsl(var(--mcs-navy))] text-white font-semibold px-4 py-2.5 rounded-md text-sm hover:opacity-90"
              >
                <Calendar className="h-4 w-4" />
                Åpne ressursplan
              </Link>
            </div>
          )}
        </div>

        {/* Doc / support shortcuts */}
        <div>
          <h2 className="text-[11px] font-semibold tracking-wider uppercase text-white/60 mb-2">
            Dokumentasjon og underlag
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {DOC_SHORTCUTS.map((s) => (
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
      </div>
    </section>
  );
}
