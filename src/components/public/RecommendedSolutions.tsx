import { Link } from "react-router-dom";
import { ArrowRight, Home as HomeIcon, Flame, Sparkles, LayoutGrid, Building2 } from "lucide-react";
import { useLead } from "./LeadContext";

type Solution = {
  icon: typeof HomeIcon;
  badge: string;
  title: string;
  desc: string;
  models: string[];
  segment: "bolig" | "naering";
};

const SOLUTIONS: Solution[] = [
  {
    icon: HomeIcon,
    badge: "Best for vanlig bolig",
    title: "Ett stort oppholdsrom med åpen løsning",
    desc: "En veggmontert luft-til-luft varmepumpe dekker mesteparten av varmebehovet i en normal enebolig eller rekkehus.",
    models: ["Mitsubishi Electric Kirigamine", "Panasonic Etherea", "Toshiba Shorai/Signatur"],
    segment: "bolig",
  },
  {
    icon: Flame,
    badge: "Best ved høyt varmebehov",
    title: "Kaldt klima, eldre hus eller stort areal",
    desc: "Modeller med høy varmekapasitet ved lave utetemperaturer, eller luft-til-vann der du har vannbåren varme.",
    models: ["Mitsubishi Electric Zubadan", "Panasonic HZ / Aquarea", "Toshiba Polar"],
    segment: "bolig",
  },
  {
    icon: Sparkles,
    badge: "Best designmodell",
    title: "Diskré innedel som passer interiøret",
    desc: "Slanke innedeler og flere fargevalg for deg som vil at pumpen skal falle naturlig inn i rommet.",
    models: ["Mitsubishi Electric MSZ-LN", "Panasonic Etherea (flere farger)", "Toshiba Signatur"],
    segment: "bolig",
  },
  {
    icon: LayoutGrid,
    badge: "Best for flere rom",
    title: "Varme i flere soner fra én utedel",
    desc: "Multisplitt gir deg opptil flere innedeler koblet til én utedel — praktisk i hus over flere plan.",
    models: ["Multisplitt fra Mitsubishi Electric, Panasonic og Toshiba"],
    segment: "bolig",
  },
  {
    icon: Building2,
    badge: "Best for næring",
    title: "Driftssikker varme i næringsbygg",
    desc: "Kassett- og kanalmodeller, større kapasitet og serviceavtale med planlagt oppfølging.",
    models: ["Næringsløsninger fra Mitsubishi Electric, Panasonic og Toshiba"],
    segment: "naering",
  },
];

/** Behovsdrevet inngang til modellene — ikke produktkatalog. */
export function RecommendedSolutions() {
  const { startLead } = useLead();

  return (
    <section id="losninger" className="bg-[hsl(var(--warm-cream))] pb-16 scroll-mt-28">
      <div className="mx-auto max-w-[1600px] px-6 sm:px-10 lg:px-12 xl:px-16 2xl:px-24">
        <div className="max-w-2xl mb-7">
          <h2 className="text-2xl lg:text-3xl font-bold text-[hsl(var(--mcs-navy))] leading-tight">
            Anbefalte løsninger etter behov
          </h2>
          <div className="h-0.5 w-10 bg-[hsl(var(--mcs-orange))] mt-3 mb-4" />
          <p className="text-sm text-[hsl(var(--mcs-muted))] leading-relaxed">
            Start med situasjonen din — så anbefaler vi modellen som passer. Endelig valg gjør vi
            sammen etter befaring.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SOLUTIONS.map((s) => (
            <div
              key={s.badge}
              className="bg-white rounded-2xl border border-[hsl(var(--warm-beige))] p-6 flex flex-col"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-full bg-[hsl(var(--warm-sand))] text-[hsl(var(--mcs-navy))] flex items-center justify-center shrink-0">
                  <s.icon className="h-5 w-5" />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[hsl(var(--mcs-orange))]">
                  {s.badge}
                </span>
              </div>
              <h3 className="font-bold text-[hsl(var(--mcs-navy))] mb-2 leading-snug">{s.title}</h3>
              <p className="text-sm text-[hsl(var(--mcs-muted))] leading-relaxed mb-4">{s.desc}</p>
              <ul className="text-xs text-[hsl(var(--mcs-navy))]/75 space-y-1 mb-5">
                {s.models.map((m) => (
                  <li key={m}>· {m}</li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() =>
                  startLead({
                    source: "solution",
                    segment: s.segment,
                    interestType: "losning-anbefaling",
                    solutionName: s.badge,
                  })
                }
                className="mt-auto inline-flex items-center gap-2 text-sm font-semibold text-[hsl(var(--mcs-navy))] hover:text-[hsl(var(--mcs-orange))]"
              >
                Få anbefaling <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <Link
            to="/#varmepumper"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[hsl(var(--mcs-navy))] border border-[hsl(var(--mcs-navy))]/25 hover:border-[hsl(var(--mcs-navy))] bg-white px-5 py-2.5 rounded-md"
          >
            Se alle modeller / sammenlign tekniske data <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
