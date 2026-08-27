import { ArrowRight, Phone } from "lucide-react";
import { useLead, type LeadContext } from "./LeadContext";

type Props = {
  title: string;
  text: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  primaryLead: LeadContext;
  secondaryLead?: LeadContext;
  tone?: "navy" | "sand";
};

/** Gjennomgående handlingsblokk mellom seksjonene på forsiden. */
export function CtaBand({
  title,
  text,
  primaryLabel = "Bestill befaring",
  secondaryLabel = "Trenger service?",
  primaryLead,
  secondaryLead,
  tone = "navy",
}: Props) {
  const { startLead } = useLead();
  const navy = tone === "navy";

  return (
    <section className="bg-[hsl(var(--warm-cream))] pb-16">
      <div className="mx-auto max-w-[1600px] px-6 sm:px-10 lg:px-12 xl:px-16 2xl:px-24">
        <div
          className={`rounded-2xl p-7 lg:p-9 flex flex-col lg:flex-row lg:items-center gap-6 justify-between ${
            navy
              ? "bg-[hsl(var(--mcs-navy))] text-white"
              : "bg-[hsl(var(--warm-sand))] text-[hsl(var(--mcs-navy))] border border-[hsl(var(--warm-beige))]"
          }`}
        >
          <div className="max-w-2xl">
            <h2 className="text-xl lg:text-2xl font-bold leading-tight mb-2">{title}</h2>
            <p className={`text-sm leading-relaxed ${navy ? "text-white/75" : "text-[hsl(var(--mcs-navy))]/75"}`}>
              {text}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            <button
              type="button"
              onClick={() => startLead(primaryLead)}
              className="bg-[hsl(var(--mcs-orange))] hover:bg-[hsl(var(--mcs-orange-hover))] text-white font-semibold px-6 py-3 rounded-md inline-flex items-center justify-center gap-2"
            >
              {primaryLabel} <ArrowRight className="h-4 w-4" />
            </button>
            {secondaryLead && (
              <button
                type="button"
                onClick={() => startLead(secondaryLead)}
                className={`font-semibold px-6 py-3 rounded-md inline-flex items-center justify-center gap-2 border ${
                  navy
                    ? "border-white/30 hover:border-white text-white"
                    : "bg-white border-[hsl(var(--mcs-navy))]/25 hover:border-[hsl(var(--mcs-navy))]"
                }`}
              >
                <Phone className="h-4 w-4" /> {secondaryLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
