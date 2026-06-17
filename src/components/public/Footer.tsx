import { Link } from "react-router-dom";
import { Phone, Mail, MapPin, Linkedin } from "lucide-react";
import logoAsset from "@/assets/mcs/logo.asset.json";

export function Footer() {
  return (
    <footer className="bg-[hsl(var(--mcs-navy))] text-white/70 border-t border-white/5">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <img src={logoAsset.url} alt="MCS Service" className="h-10 bg-white rounded px-2 py-1 mb-4 w-auto inline-block" />
            <p className="text-sm leading-relaxed">
              Service og installasjon av elektriske tavler og strømskinnesystemer. Spesialister på arbeid i eksisterende anlegg.
            </p>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Tjenester</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/tjenester/service-og-feilsoking" className="hover:text-white">Service og feilsøking</Link></li>
              <li><Link to="/tjenester/elektrotavler" className="hover:text-white">Elektrotavler</Link></li>
              <li><Link to="/tjenester/stromskinner" className="hover:text-white">Strømskinner</Link></li>
              <li><Link to="/tjenester/hasteoppdrag" className="hover:text-white">Hasteoppdrag</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Kontakt</h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2"><MapPin className="h-4 w-4 mt-0.5 shrink-0" /><span>Orkidèhøgda 2A<br />3050 Mjøndalen</span></li>
              <li className="flex items-center gap-2"><Phone className="h-4 w-4" /><a href="tel:+4745707073" className="hover:text-white">+47 45 70 70 73</a></li>
              <li className="flex items-center gap-2"><Mail className="h-4 w-4" /><a href="mailto:post@mcsservice.no" className="hover:text-white">post@mcsservice.no</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Selskap</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/om-mcs" className="hover:text-white">Om MCS Service</Link></li>
              <li><Link to="/referanser" className="hover:text-white">Referanser</Link></li>
              <li><Link to="/bestill-service" className="hover:text-white">Bestill service</Link></li>
              <li><Link to="/login" className="hover:text-white">Logg inn</Link></li>
            </ul>
            <a href="https://www.linkedin.com/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 mt-4 text-sm hover:text-white" aria-label="LinkedIn">
              <Linkedin className="h-4 w-4" /> LinkedIn
            </a>
          </div>
        </div>
        <div className="mt-12 pt-6 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-white/50">
          <p>© {new Date().getFullYear()} MCS Service — A part of Ernströmgruppen. Alle rettigheter reservert.</p>
          <p>Org.nr. 921 543 210 MVA</p>
        </div>
      </div>
    </footer>
  );
}
