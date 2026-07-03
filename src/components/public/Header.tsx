import { Link, NavLink } from "react-router-dom";
import { useState } from "react";
import { Menu, X, LayoutDashboard, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import logoAsset from "@/assets/lier/logo.png.asset.json";
const logo = logoAsset.url;


const PUBLIC_NAV = [
  { to: "/#tjenester", label: "Tjenester" },
  { to: "/#varmepumper", label: "Varmepumper" },
  { to: "/#for-bolig", label: "For bolig" },
  { to: "/#for-naering", label: "For næring" },
  { to: "/#serviceavtale", label: "Serviceavtale" },
  { to: "/#kontakt", label: "Kontakt" },
];

const INTERNAL_NAV = [
  { to: "/projects", label: "Oppdrag" },
  { to: "/orders", label: "Bestillinger" },
  { to: "/projects/plan", label: "Kalender" },
  { to: "/portal/deliveries", label: "Dokumentasjon" },
];

export function Header() {
  const [open, setOpen] = useState(false);
  const { user, signOut } = useAuth();
  const NAV = user ? INTERNAL_NAV : PUBLIC_NAV;
  return (
    <header className="sticky top-0 z-40 bg-[hsl(var(--warm-cream))]/95 backdrop-blur border-b border-[hsl(var(--warm-beige))]/70">
      <div className="mx-auto max-w-[1600px] px-6 sm:px-10 lg:px-12 xl:px-16 2xl:px-24">
        <div className="flex h-[88px] lg:h-[96px] items-center justify-between gap-6">
          <Link to="/" className="flex items-center shrink-0 h-full" aria-label="Lier Varmepumpeservice — Hjem">
            <img
              src={logo}
              alt="Lier Varmepumpeservice"
              className="w-[170px] md:w-[200px] lg:w-[220px] max-h-[62px] object-contain block"
              width={1108}
              height={531}
            />
          </Link>


          <nav className="hidden lg:flex items-center gap-7" aria-label="Hovedmeny">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  `text-[13px] font-semibold tracking-wide transition-colors ${
                    isActive
                      ? "text-[hsl(var(--mcs-navy))]"
                      : "text-[hsl(var(--mcs-navy))]/70 hover:text-[hsl(var(--mcs-navy))]"
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="hidden lg:flex items-center gap-3">
            {user ? (
              <>
                <Link
                  to="/overview"
                  className="text-sm font-semibold text-[hsl(var(--mcs-navy))] px-4 py-2 inline-flex items-center gap-2 border border-[hsl(var(--mcs-navy))]/20 hover:border-[hsl(var(--mcs-navy))] rounded-md"
                >
                  <LayoutDashboard className="h-4 w-4" /> Kontrollsenter
                </Link>
                <button
                  onClick={signOut}
                  className="text-sm text-[hsl(var(--mcs-navy))]/60 hover:text-[hsl(var(--mcs-navy))] px-3 py-2 inline-flex items-center gap-2"
                  aria-label="Logg ut"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm font-medium text-[hsl(var(--mcs-navy))]/80 hover:text-[hsl(var(--mcs-navy))] px-3 py-2 inline-flex items-center gap-1.5"
                >
                  <span className="i-user" /> Logg inn
                </Link>
                <Link
                  to="/bestill-service"
                  className="bg-[hsl(var(--mcs-orange))] hover:bg-[hsl(var(--mcs-orange-hover))] text-white text-sm font-semibold px-5 py-2.5 rounded-md transition-colors shadow-sm"
                >
                  Bestill befaring
                </Link>
              </>
            )}
          </div>
          <button
            className="lg:hidden text-[hsl(var(--mcs-navy))]"
            onClick={() => setOpen(!open)}
            aria-label="Meny"
            aria-expanded={open}
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
        {open && (
          <div className="lg:hidden border-t border-[hsl(var(--warm-beige))] py-4 space-y-1">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className="block text-[hsl(var(--mcs-navy))]/80 hover:text-[hsl(var(--mcs-navy))] py-2 font-medium"
              >
                {n.label}
              </Link>
            ))}
            <div className="pt-3 mt-3 border-t border-[hsl(var(--warm-beige))] space-y-2">
              {user ? (
                <Link
                  to="/overview"
                  onClick={() => setOpen(false)}
                  className="block bg-[hsl(var(--mcs-navy))] text-white text-center font-semibold py-3 rounded-md"
                >
                  Kontrollsenter
                </Link>
              ) : (
                <>
                  <Link to="/login" onClick={() => setOpen(false)} className="block text-[hsl(var(--mcs-navy))]/80 py-2">
                    Logg inn
                  </Link>
                  <Link
                    to="/bestill-service"
                    onClick={() => setOpen(false)}
                    className="block bg-[hsl(var(--mcs-orange))] text-white text-center font-semibold py-3 rounded-md"
                  >
                    Bestill befaring
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
