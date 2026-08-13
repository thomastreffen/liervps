import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Phone, Info, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import {
  useLead,
  leadContextLabel,
  leadPrefillMessage,
  INTEREST_LABEL,
  type LeadInterest,
} from "./LeadContext";

const INTERESTS: LeadInterest[] = [
  "befaring",
  "modell-anbefaling",
  "losning-anbefaling",
  "service",
  "feilsoking",
  "beregning",
];

const nb = (v: number) => new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 }).format(v);

const inputClass =
  "w-full h-11 rounded-md border border-[hsl(var(--warm-beige))] bg-white px-3 text-sm text-[hsl(var(--mcs-navy))] placeholder:text-[hsl(var(--mcs-muted))] focus:outline-none focus:border-[hsl(var(--mcs-navy))]";
const labelClass = "block text-[13px] font-semibold text-[hsl(var(--mcs-navy))] mb-1.5";

export function ContactSection() {
  const { lead, clearLead } = useLead();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [place, setPlace] = useState("");
  const [segment, setSegment] = useState<"bolig" | "naering">("bolig");
  const [interest, setInterest] = useState<LeadInterest>("befaring");
  const [message, setMessage] = useState("");
  const [touchedMessage, setTouchedMessage] = useState(false);
  const [sent, setSent] = useState(false);

  // Prefill fra CTA-konteksten
  useEffect(() => {
    if (!lead) return;
    if (lead.segment) setSegment(lead.segment);
    if (lead.interestType) setInterest(lead.interestType);
    if (!touchedMessage) setMessage(leadPrefillMessage(lead));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead]);

  const calc = lead?.calculatorSummary;

  const [submitting, setSubmitting] = useState(false);

  // TODO (neste steg): bygg en enkel intern oversikt over public_leads
  // (f.eks. /sales/leads-innboks) og evt. konvertering til `leads`/commercial_cases.
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!name.trim() || (!email.trim() && !phone.trim())) {
      toast.error("Fyll inn navn og e-post eller telefon.");
      return;
    }
    setSubmitting(true);
    setSent(false);
    const publicLeadId = crypto.randomUUID();
    const row = {
      id: publicLeadId,
      name: name.trim().slice(0, 100),
      email: email.trim().slice(0, 255) || null,
      phone: phone.trim().slice(0, 40) || null,
      address: place.trim().slice(0, 120) || null,
      segment,
      request_type: interest,
      message: message.trim().slice(0, 1500) || null,
      lead_source: lead?.source ?? "kontakt-skjema",
      selected_brand: lead?.brand ?? null,
      selected_product_name: lead?.productName ?? null,
      selected_solution_name: lead?.solutionName ?? null,
      calculator_summary: lead?.calculatorSummary ?? null,
      lead_context: lead ?? { source: "kontakt-skjema" },
      page_url: typeof window !== "undefined" ? window.location.href.slice(0, 500) : null,
      status: "new",
    };

    const { error } = await supabase.from("public_leads").insert(row);
    setSubmitting(false);

    if (error) {
      // eslint-disable-next-line no-console
      console.error("[LeadFlow] insert failed", error);
      toast.error("Beklager — vi fikk ikke sendt forespørselen. Prøv igjen, eller ring oss.");
      return;
    }

    // Intern Gmail-varsling — må aldri påvirke besøkende (fire-and-forget).
    void supabase.functions
      .invoke("lead-notify-internal", {
        body: { public_lead_id: publicLeadId, origin: window.location.origin },
      })
      .catch(() => {
        /* stille: besøkende skal aldri se integrasjonsfeil */
      });

    setSent(true);
    toast.success("Takk! Vi har mottatt forespørselen og tar kontakt så snart som mulig.");

    // Tømmer kun feltene — leadContext beholdes bevisst.
    setName("");
    setEmail("");
    setPhone("");
    setPlace("");
    setMessage("");
    setTouchedMessage(false);
  }

  return (
    <section id="kontakt" className="bg-[hsl(var(--warm-cream))] pb-16 scroll-mt-28">
      <div className="mx-auto max-w-[1600px] px-6 sm:px-10 lg:px-12 xl:px-16 2xl:px-24">
        <div className="grid lg:grid-cols-[1fr_360px] gap-5">
          {/* Skjema */}
          <div className="bg-white rounded-2xl border border-[hsl(var(--warm-beige))] shadow-sm p-6 lg:p-8">
            <h2 className="text-2xl font-bold text-[hsl(var(--mcs-navy))]">Ta kontakt</h2>
            <div className="h-0.5 w-10 bg-[hsl(var(--mcs-orange))] mt-3 mb-4" />
            <p className="text-sm text-[hsl(var(--mcs-muted))] mb-5 max-w-xl leading-relaxed">
              Kort skjema — vi tar kontakt og finner riktig løsning sammen med deg.
            </p>

            {lead && (
              <div className="mb-5 rounded-xl border border-[hsl(var(--mcs-orange))]/30 bg-[hsl(var(--warm-sand))] px-4 py-3">
                <p className="text-sm font-semibold text-[hsl(var(--mcs-navy))]">
                  Du tar kontakt om: {leadContextLabel(lead) || "Befaring"}
                </p>
                {calc && (
                  <ul className="mt-1.5 space-y-0.5 text-[13px] text-[hsl(var(--mcs-muted))]">
                    {calc.estimatedSavingsNok !== undefined && (
                      <li>
                        Estimert årlig besparelse: {nb(calc.estimatedSavingsNok)} kr
                        {calc.estimatedSavingsKwh !== undefined
                          ? ` / ${nb(calc.estimatedSavingsKwh)} kWh`
                          : ""}
                      </li>
                    )}
                    {calc.areaM2 !== undefined && <li>Oppvarmet areal: {nb(calc.areaM2)} m²</li>}
                    {calc.annualConsumptionKwh !== undefined && (
                      <li>Årlig strømforbruk: {nb(calc.annualConsumptionKwh)} kWh</li>
                    )}
                    {calc.electricityPrice !== undefined && (
                      <li>
                        Strømpris: {calc.electricityPrice.toFixed(2).replace(".", ",")} kr/kWh
                      </li>
                    )}
                    {calc.heatPumpType && <li>Type varmepumpe: {calc.heatPumpType}</li>}
                    {calc.coverageSolution && <li>Dekningsløsning: {calc.coverageSolution}</li>}
                  </ul>
                )}
                <button
                  type="button"
                  onClick={clearLead}
                  className="mt-2 text-xs font-semibold text-[hsl(var(--mcs-navy))]/70 hover:text-[hsl(var(--mcs-navy))] underline"
                >
                  Nullstill
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass} htmlFor="lead-name">
                    Navn
                  </label>
                  <input
                    id="lead-name"
                    className={inputClass}
                    value={name}
                    maxLength={100}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Fornavn Etternavn"
                    autoComplete="name"
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="lead-email">
                    E-post
                  </label>
                  <input
                    id="lead-email"
                    type="email"
                    className={inputClass}
                    value={email}
                    maxLength={255}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="navn@epost.no"
                    autoComplete="email"
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="lead-phone">
                    Telefon
                  </label>
                  <input
                    id="lead-phone"
                    type="tel"
                    className={inputClass}
                    value={phone}
                    maxLength={40}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="900 00 000"
                    autoComplete="tel"
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="lead-place">
                    Adresse / poststed
                  </label>
                  <input
                    id="lead-place"
                    className={inputClass}
                    value={place}
                    maxLength={120}
                    onChange={(e) => setPlace(e.target.value)}
                    placeholder="Lierbyen"
                    autoComplete="address-level2"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <span className={labelClass}>Det gjelder</span>
                  <div className="inline-flex gap-1 bg-[hsl(var(--warm-cream))] border border-[hsl(var(--warm-beige))] rounded-full p-1">
                    {(["bolig", "naering"] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        aria-pressed={segment === s}
                        onClick={() => setSegment(s)}
                        className={`text-sm font-semibold px-4 py-1.5 rounded-full transition-colors ${
                          segment === s
                            ? "bg-[hsl(var(--mcs-navy))] text-white"
                            : "text-[hsl(var(--mcs-navy))]"
                        }`}
                      >
                        {s === "bolig" ? "Bolig" : "Næring"}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={labelClass} htmlFor="lead-interest">
                    Hva ønsker du hjelp med?
                  </label>
                  <select
                    id="lead-interest"
                    className={inputClass}
                    value={interest}
                    onChange={(e) => setInterest(e.target.value as LeadInterest)}
                  >
                    {INTERESTS.map((i) => (
                      <option key={i} value={i}>
                        {INTEREST_LABEL[i]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className={labelClass} htmlFor="lead-message">
                  Melding
                </label>
                <textarea
                  id="lead-message"
                  rows={4}
                  maxLength={1500}
                  className="w-full rounded-md border border-[hsl(var(--warm-beige))] bg-white px-3 py-2.5 text-sm text-[hsl(var(--mcs-navy))] placeholder:text-[hsl(var(--mcs-muted))] focus:outline-none focus:border-[hsl(var(--mcs-navy))]"
                  value={message}
                  onChange={(e) => {
                    setTouchedMessage(true);
                    setMessage(e.target.value);
                  }}
                  placeholder="Kort om bygget, ønsket løsning eller når det passer med befaring."
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 bg-[hsl(var(--mcs-orange))] hover:bg-[hsl(var(--mcs-orange-hover))] disabled:opacity-60 text-white font-semibold px-6 py-3 rounded-md"
                >
                  {submitting ? "Sender …" : "Send forespørsel"} <ArrowRight className="h-4 w-4" />
                </button>
                {sent && (
                  <p className="text-sm font-semibold text-[hsl(var(--savings-green))]">
                    Takk! Vi har mottatt forespørselen og tar kontakt så snart som mulig.
                  </p>
                )}
              </div>
              <p className="flex gap-2 text-xs text-[hsl(var(--mcs-muted))]">
                <Info className="h-4 w-4 shrink-0 text-[hsl(var(--mcs-orange))]" />
                Vi bruker opplysningene kun til å svare på henvendelsen din.
              </p>
            </form>
          </div>

          {/* Direkte kontakt */}
          <div className="rounded-2xl bg-[hsl(var(--mcs-navy))] text-white p-6 lg:p-7 flex flex-col justify-center">
            <h3 className="font-bold text-lg mb-2">Vil du snakke med oss?</h3>
            <p className="text-white/75 text-sm mb-5 leading-relaxed">
              Ring eller send e-post — vi svarer raskt og hjelper deg videre.
            </p>
            <div className="flex flex-col gap-2.5">
              <a
                href="tel:+4732000000"
                className="bg-[hsl(var(--mcs-orange))] hover:bg-[hsl(var(--mcs-orange-hover))] text-white font-semibold px-5 py-3 rounded-md inline-flex items-center justify-center gap-2"
              >
                <Phone className="h-4 w-4" /> Ring 32 00 00 00
              </a>
              <a
                href="mailto:post@liervps.no"
                className="bg-white/10 border border-white/40 hover:bg-white/20 text-white font-semibold px-5 py-3 rounded-md inline-flex items-center justify-center gap-2"
              >
                <Mail className="h-4 w-4" /> post@liervps.no
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
