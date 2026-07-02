import { Link, NavLink } from "react-router-dom";
import { useState } from "react";
import { Menu, X, LayoutDashboard, LogOut, Flame } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useActionCounts } from "@/hooks/useActionCounts";

const PUBLIC_NAV = [
  { to: "/tjenester/service-og-feilsoking", label: "Tjenester" },
  { to: "/om-mcs", label: "Om oss" },
  { to: "/referanser", label: "Referanser" },
  { to: "/kontakt", label: "Kontakt" },
];

const INTERNAL_NAV: { to: string; label: string; badgeKey?: "orders" }[] = [
  { to: "/projects", label: "Oppdrag" },
  { to: "/orders", label: "Bestillinger", badgeKey: "orders" },
  { to: "/projects/plan", label: "Kalender" },
  { to: "/portal/deliveries", label: "Dokumentasjon" },
];

function BrandMark() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[hsl(var(--mcs-orange))] text-white shadow-sm">
        <Flame className="h-5 w-5" strokeWidth={2.4} />
      </div>
      <div className="leading-tight">
        <div className="text-white font-bold text-[15px] tracking-tight">Lier Varmepumpeservice</div>
        <div className="text-white/60 text-[11px] font-medium tracking-wider uppercase">Lier VPS</div>
      </div>
    </div>
  );
}

export function Header() {
  const [open, setOpen] = useState(false);
  const { user, signOut } = useAuth();
  const { newOrders } = useActionCounts();
  const NAV = user ? INTERNAL_NAV : PUBLIC_NAV;
  return (
    <header className="sticky top-0 z-40 bg-[hsl(var(--mcs-navy))]/95 backdrop-blur border-b border-white/5">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-20 items-center justify-between gap-4">
          <Link to="/" className="flex items-center shrink-0" aria-label="Lier Varmepumpeservice — Hjem">
            <BrandMark />
          </Link>
          <nav className="hidden lg:flex items-center gap-8" aria-label="Hovedmeny">
            {NAV.map((n: any) => {
              const showBadge = n.badgeKey === "orders" && newOrders > 0;
              return (
                <NavLink
                  key={n.to}
                  to={n.to}
                  className={({ isActive }) =>
                    `text-sm font-medium transition-colors inline-flex items-center gap-1.5 ${isActive ? "text-white" : "text-white/70 hover:text-white"}`
                  }
                >
                  {n.label}
                  {showBadge && (
                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[hsl(var(--mcs-orange))] text-white text-[10px] font-bold tabular-nums">
                      {newOrders > 9 ? "9+" : newOrders}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>
          <div className="hidden lg:flex items-center gap-2">
            {user ? (
              <>
                <Link
                  to="/overview"
                  className="text-sm font-semibold text-white px-4 py-2 inline-flex items-center gap-2 border border-white/20 hover:border-white/50 rounded-md"
                >
                  <LayoutDashboard className="h-4 w-4" /> Kontrollsenter
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
                  Bestill befaring
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
            {NAV.map((n: any) => {
              const showBadge = n.badgeKey === "orders" && newOrders > 0;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between text-white/80 hover:text-white py-2"
                >
                  <span>{n.label}</span>
                  {showBadge && (
                    <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[hsl(var(--mcs-orange))] text-white text-[10px] font-bold tabular-nums">
                      {newOrders > 9 ? "9+" : newOrders}
                    </span>
                  )}
                </Link>
              );
            })}
            <div className="pt-3 mt-3 border-t border-white/10 space-y-2">
              {user ? (
                <Link to="/overview" onClick={() => setOpen(false)} className="block bg-white/10 border border-white/20 text-white text-center font-semibold py-3 rounded-md">
                  Kontrollsenter
                </Link>
              ) : (
                <>
                  <Link to="/login" onClick={() => setOpen(false)} className="block text-white/80 py-2">Logg inn</Link>
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
