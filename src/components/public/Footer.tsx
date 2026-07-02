import { Link } from "react-router-dom";
import { Phone, Mail, MapPin } from "lucide-react";
import logoAsset from "@/assets/lier/logo.png.asset.json";
const logo = logoAsset.url;


export function Footer() {
  return (
    <footer className="bg-[hsl(var(--mcs-navy))] text-white/70 border-t border-white/5">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid gap-10 md:grid-cols-5">
          <div className="md:col-span-2">
            <div className="bg-white rounded-xl inline-block px-5 py-4 mb-5 shadow-sm">
              <img src={logo} alt="Lier Varmepumpeservice" className="h-16 md:h-[72px] w-auto" width={1152} height={576} />
            </div>

            <p className="text-white font-semibold text-sm mb-2">Lier Varmepumpeservice AS</p>
            <p className="text-sm leading-relaxed max-w-sm">
              Lokal fagkompetanse på service og varmepumper til bolig og næring i hele Lier og omegn.
            </p>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4 text-xs uppercase tracking-wider">Tjenester</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/tjenester/befaring" className="hover:text-white">Befaring og rådgivning</Link></li>
              <li><Link to="/tjenester/salg" className="hover:text-white">Salg av varmepumpe</Link></li>
              <li><Link to="/tjenester/montering" className="hover:text-white">Montering</Link></li>
              <li><Link to="/tjenester/service" className="hover:text-white">Service og vedlikehold</Link></li>
              <li><Link to="/tjenester/feilsoking" className="hover:text-white">Feilsøking</Link></li>
              <li><Link to="/tjenester/serviceavtale" className="hover:text-white">Serviceavtale</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4 text-xs uppercase tracking-wider">For deg</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/for-bolig" className="hover:text-white">For bolig</Link></li>
              <li><Link to="/for-naering" className="hover:text-white">For næring</Link></li>
              <li><Link to="/tjenester/salg" className="hover:text-white">Varmepumper</Link></li>
              <li><Link to="/login" className="hover:text-white">Kundeportal</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4 text-xs uppercase tracking-wider">Kontakt</h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2"><MapPin className="h-4 w-4 mt-0.5 shrink-0" /><span>Lier, Viken</span></li>
              <li className="flex items-center gap-2"><Phone className="h-4 w-4" /><a href="tel:+4732000000" className="hover:text-white">Telefon: 32 00 00 00</a></li>
              <li className="flex items-center gap-2"><Mail className="h-4 w-4" /><a href="mailto:post@liervps.no" className="hover:text-white">post@liervps.no</a></li>
            </ul>
            <h4 className="text-white font-semibold mt-6 mb-3 text-xs uppercase tracking-wider">Selskap</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/om-mcs" className="hover:text-white">Om Lier VPS</Link></li>
              <li><Link to="/personvern" className="hover:text-white">Personvern</Link></li>
              <li><Link to="/betingelser" className="hover:text-white">Betingelser</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-12 pt-6 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-white/50">
          <p>© {new Date().getFullYear()} Lier Varmepumpeservice AS. Alle rettigheter reservert.</p>
          <p>Org.nr. 999 999 999</p>
        </div>
      </div>
    </footer>
  );
}
