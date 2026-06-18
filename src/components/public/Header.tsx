import { Link, NavLink } from "react-router-dom";
import { useState } from "react";
import { Menu, X, LayoutDashboard, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import logoLight from "@/assets/mcs/logo-light.asset.json";

const PUBLIC_NAV = [
  { to: "/tjenester/service-og-feilsoking", label: "Tjenester" },
  { to: "/om-mcs", label: "Om oss" },
  { to: "/referanser", label: "Referanser" },
  { to: "/kontakt", label: "Kontakt" },
];

const INTERNAL_NAV = [
  { to: "/projects", label: "Mine jobber" },
  { to: "/bestilling", label: "Bestill servicejobb" },
  { to: "/projects/plan", label: "Ressursplan" },
  { to: "/portal/deliveries", label: "Dokumentasjon" },
];

export function Header() {
  const [open, setOpen] = useState(false);
  const { user, signOut } = useAuth();
  const NAV = user ? INTERNAL_NAV : PUBLIC_NAV;
  return (
    <header className="sticky top-0 z-40 bg-[hsl(var(--mcs-navy))]/95 backdrop-blur border-b border-white/5">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-20 items-center justify-between gap-4">
          <Link to="/" className="flex items-center shrink-0" aria-label="MCS Service — Hjem">
            <img
              src={logoLight.url}
              alt="MCS Service"
              className="h-12 lg:h-14 w-auto"
              width={1920}
              height={698}
            />
          </Link>
          <nav className="hidden lg:flex items-center gap-8" aria-label="Hovedmeny">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  `text-sm font-medium transition-colors ${isActive ? "text-white" : "text-white/70 hover:text-white"}`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="hidden lg:flex items-center gap-2">
            {user ? (
              <>
                <Link
                  to="/overview"
                  className="text-sm font-semibold text-white px-4 py-2 inline-flex items-center gap-2 border border-white/20 hover:border-white/50 rounded-md"
                >
                  <LayoutDashboard className="h-4 w-4" /> MCS Kontrollsenter
                </Link>
                <button onClick={signOut} className="text-sm text-white/60 hover:text-white px-3 py-2 inline-flex items-center gap-2" aria-label="Logg ut">
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-sm text-white/80 hover:text-white px-3 py-2">
                  Logg inn
                </Link>
                <Link
                  to="/bestill-service"
                  className="bg-[hsl(var(--mcs-orange))] hover:bg-[hsl(var(--mcs-orange-hover))] text-white text-sm font-semibold px-5 py-2.5 rounded-md transition-colors"
                >
                  Bestill service
                </Link>
              </>
            )}
          </div>
          <button className="lg:hidden text-white" onClick={() => setOpen(!open)} aria-label="Meny" aria-expanded={open}>
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
        {open && (
          <div className="lg:hidden border-t border-white/10 py-4 space-y-2">
            {NAV.map((n) => (
              <Link key={n.to} to={n.to} onClick={() => setOpen(false)} className="block text-white/80 hover:text-white py-2">
                {n.label}
              </Link>
            ))}
            <div className="pt-3 mt-3 border-t border-white/10 space-y-2">
              {user ? (
                <Link to="/overview" onClick={() => setOpen(false)} className="block bg-white/10 border border-white/20 text-white text-center font-semibold py-3 rounded-md">
                  MCS Kontrollsenter
                </Link>
              ) : (
                <>
                  <Link to="/login" onClick={() => setOpen(false)} className="block text-white/80 py-2">Logg inn</Link>
                  <Link
                    to="/bestill-service"
                    onClick={() => setOpen(false)}
                    className="block bg-[hsl(var(--mcs-orange))] text-white text-center font-semibold py-3 rounded-md"
                  >
                    Bestill service
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
