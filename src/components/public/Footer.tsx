import { Link } from "react-router-dom";
import { Phone, Mail, MapPin, Flame } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-[hsl(var(--mcs-navy))] text-white/70 border-t border-white/5">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[hsl(var(--mcs-orange))] text-white">
                <Flame className="h-5 w-5" />
              </div>
              <div className="text-white font-bold text-sm">Lier Varmepumpeservice AS</div>
            </div>
            <p className="text-sm leading-relaxed">
              Befaring, salg, montering og service av varmepumper. Lokal fagkompetanse for boliger og næring i Lier og omegn.
            </p>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Tjenester</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/tjenester/befaring" className="hover:text-white">Befaring og rådgivning</Link></li>
              <li><Link to="/tjenester/salg" className="hover:text-white">Salg av varmepumpe</Link></li>
              <li><Link to="/tjenester/montering" className="hover:text-white">Montering</Link></li>
              <li><Link to="/tjenester/service" className="hover:text-white">Service og vedlikehold</Link></li>
              <li><Link to="/tjenester/feilsoking" className="hover:text-white">Feilsøking</Link></li>
              <li><Link to="/tjenester/serviceavtale" className="hover:text-white">Årlig serviceavtale</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Kontakt</h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2"><MapPin className="h-4 w-4 mt-0.5 shrink-0" /><span>Lier, Viken</span></li>
              <li className="flex items-center gap-2"><Phone className="h-4 w-4" /><a href="tel:+4700000000" className="hover:text-white">Telefon: kommer</a></li>
              <li className="flex items-center gap-2"><Mail className="h-4 w-4" /><a href="mailto:post@liervps.no" className="hover:text-white">post@liervps.no</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Selskap</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/om-mcs" className="hover:text-white">Om Lier VPS</Link></li>
              <li><Link to="/referanser" className="hover:text-white">Referanser</Link></li>
              <li><Link to="/bestill-service" className="hover:text-white">Bestill befaring</Link></li>
              <li><Link to="/login" className="hover:text-white">Logg inn</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-12 pt-6 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-white/50">
          <p>© {new Date().getFullYear()} Lier Varmepumpeservice AS. Alle rettigheter reservert.</p>
          <p>Org.nr. kommer</p>
        </div>
      </div>
    </footer>
  );
}
