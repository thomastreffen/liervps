import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Mail,
  Phone,
  Info,
  ArrowRight,
  Paperclip,
  X,
  CheckCircle2,
  ShieldCheck,
  Clock,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import {
  useLead,
  leadContextLabel,
  leadPrefillMessage,
  type LeadInterest,
} from "./LeadContext";
import {
  submitPublicRequest,
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_BYTES,
  ACCEPTED_ATTACHMENT_TYPES,
} from "@/lib/public-request-submit";

/** Verdiene må matche dropdown-alternativene i bestillingsskjemaet. */
const REQUEST_TYPES = [
  "Pris på ny varmepumpe",
  "Befaring",
  "Anbefaling av modell/løsning",
  "Service og vedlikehold",
  "Feilsøking / reparasjon",
  "Serviceavtale",
  "Annet",
] as const;

const BUILDING_TYPES = [
  "Enebolig",
  "Rekkehus/tomannsbolig",
  "Leilighet",
  "Hytte",
  "Næringsbygg",
  "Borettslag/sameie",
  "Annet",
] as const;

const HEATING_TODAY = [
  "Panelovner / elektrisk",
  "Vedfyring",
  "Vannbåren varme",
  "Eksisterende varmepumpe",
  "Fjernvarme",
  "Annet / vet ikke",
] as const;

const TIMEFRAMES = [
  "Så raskt som mulig",
  "Innen 2-4 uker",
  "Innen 1-3 måneder",
  "Kun prisanslag nå",
] as const;

const INTEREST_TO_REQUEST: Record<LeadInterest, (typeof REQUEST_TYPES)[number]> = {
  befaring: "Befaring",
  "modell-anbefaling": "Anbefaling av modell/løsning",
  "losning-anbefaling": "Anbefaling av modell/løsning",
  beregning: "Pris på ny varmepumpe",
  service: "Service og vedlikehold",
  feilsoking: "Feilsøking / reparasjon",
};

const nb = (v: number) => new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 }).format(v);

const inputClass =
  "w-full h-11 rounded-md border border-[hsl(var(--warm-beige))] bg-white px-3 text-sm text-[hsl(var(--mcs-navy))] placeholder:text-[hsl(var(--mcs-muted))] focus:outline-none focus:border-[hsl(var(--mcs-navy))]";
const labelClass = "block text-[13px] font-semibold text-[hsl(var(--mcs-navy))] mb-1.5";
const legendClass =
  "text-[11px] font-bold uppercase tracking-wider text-[hsl(var(--mcs-orange))] mb-3";

export function ContactSection() {
  const { lead, clearLead } = useLead();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [segment, setSegment] = useState<"bolig" | "naering">("bolig");
  const [requestType, setRequestType] =
    useState<(typeof REQUEST_TYPES)[number]>("Pris på ny varmepumpe");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [place, setPlace] = useState("");
  const [buildingType, setBuildingType] = useState("");
  const [area, setArea] = useState("");
  const [heating, setHeating] = useState("");
  const [units, setUnits] = useState("");
  const [timeframe, setTimeframe] = useState("");
  const [existingUnit, setExistingUnit] = useState("");
  const [message, setMessage] = useState("");
  const [touchedMessage, setTouchedMessage] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [trackingToken, setTrackingToken] = useState<string | null>(null);

  const calc = lead?.calculatorSummary;
  const isService =
    requestType === "Service og vedlikehold" ||
    requestType === "Feilsøking / reparasjon" ||
    requestType === "Serviceavtale";

  // Prefill fra CTA-konteksten
  useEffect(() => {
    if (!lead) return;
    if (lead.segment) setSegment(lead.segment);
    if (lead.interestType) setRequestType(INTEREST_TO_REQUEST[lead.interestType]);
    if (calc?.areaM2) setArea(String(calc.areaM2));
    if (!touchedMessage) setMessage(leadPrefillMessage(lead));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead]);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const incoming = Array.from(list);
    const accepted: File[] = [];
    for (const f of incoming) {
      if (f.size > MAX_ATTACHMENT_BYTES) {
        toast.error(`${f.name} er større enn 10 MB.`);
        continue;
      }
      accepted.push(f);
    }
    setFiles((prev) => {
      const merged = [...prev, ...accepted];
      if (merged.length > MAX_ATTACHMENTS) {
        toast.error(`Maks ${MAX_ATTACHMENTS} vedlegg.`);
      }
      return merged.slice(0, MAX_ATTACHMENTS);
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function buildDescription(): string {
    const lines: string[] = [];
    if (message.trim()) lines.push(message.trim());
    if (calc) {
      const c: string[] = [];
      if (calc.estimatedSavingsNok !== undefined)
        c.push(
          `estimert årlig besparelse ${nb(calc.estimatedSavingsNok)} kr${
            calc.estimatedSavingsKwh !== undefined ? ` / ${nb(calc.estimatedSavingsKwh)} kWh` : ""
          }`,
        );
      if (calc.annualConsumptionKwh !== undefined)
        c.push(`årlig strømforbruk ${nb(calc.annualConsumptionKwh)} kWh`);
      if (calc.electricityPrice !== undefined)
        c.push(`strømpris ${calc.electricityPrice.toFixed(2).replace(".", ",")} kr/kWh`);
      if (calc.heatPumpType) c.push(`type ${calc.heatPumpType}`);
      if (calc.coverageSolution) c.push(`dekning ${calc.coverageSolution}`);
      if (c.length) lines.push(`Fra spareberegning på nettsiden: ${c.join(", ")}.`);
    }
    if (lead?.productName)
      lines.push(`Interessert i: ${[lead.brand, lead.productName].filter(Boolean).join(" ")}.`);
    if (lead?.solutionName) lines.push(`Ønsket løsning: ${lead.solutionName}.`);
    return lines.join("\n\n").slice(0, 4000);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!name.trim()) return toast.error("Fyll inn navn.");
    if (!email.trim() && !phone.trim())
      return toast.error("Fyll inn e-post eller telefon slik at vi får svart deg.");
    if (!consent)
      return toast.error("Du må godta at vi kan kontakte deg om denne henvendelsen.");

    setSubmitting(true);

    const publicLeadId = crypto.randomUUID();
    const description = buildDescription();

    // 1) Nettside-henvendelse (intern synlighet + Gmail-varsling)
    const { error: leadErr } = await supabase.from("public_leads").insert({
      id: publicLeadId,
      name: name.trim().slice(0, 100),
      email: email.trim().slice(0, 255) || null,
      phone: phone.trim().slice(0, 40) || null,
      address: [address.trim(), place.trim()].filter(Boolean).join(", ").slice(0, 200) || null,
      segment,
      request_type: lead?.interestType ?? "befaring",
      message: description.slice(0, 1500) || null,
      lead_source: lead?.source ?? "kontakt-skjema",
      selected_brand: lead?.brand ?? null,
      selected_product_name: lead?.productName ?? null,
      selected_solution_name: lead?.solutionName ?? null,
      calculator_summary: lead?.calculatorSummary ?? null,
      lead_context: { ...(lead ?? { source: "kontakt-skjema" }), requestType, company: company || null },
      page_url: typeof window !== "undefined" ? window.location.href.slice(0, 500) : null,
      status: "new",
    });

    if (leadErr) {
      // eslint-disable-next-line no-console
      console.error("[LeadFlow] public_leads insert failed", leadErr);
    } else {
      void supabase.functions
        .invoke("lead-notify-internal", {
          body: { public_lead_id: publicLeadId, origin: window.location.origin },
        })
        .catch(() => undefined);
    }

    // 2) Bestillingsmodulen — her behandles forespørselen med vedlegg
    try {
      const res = await submitPublicRequest({
        summaryTitle: `${requestType} – ${name.trim()}${company.trim() ? ` (${company.trim()})` : ""}`,
        leadContext: lead ?? null,
        files,
        values: {
          kundetype: segment === "bolig" ? "Privat (bolig)" : "Bedrift / næring",
          bestiller_navn: name.trim(),
          firmanavn: company.trim() || null,
          bestiller_epost: email.trim() || null,
          bestiller_telefon: phone.trim() || null,
          adresse: address.trim() || null,
          poststed: place.trim() || null,
          henvendelsestype: requestType,
          bygningstype: buildingType || null,
          oppvarmet_areal: area ? Number(area) : null,
          dagens_oppvarming: heating || null,
          antall_enheter: units ? Number(units) : null,
          onsket_tid: timeframe || null,
          eksisterende_anlegg: existingUnit.trim() || null,
          beskrivelse: description || null,
        },
      });

      if (res.failedAttachments.length > 0) {
        toast.warning(
          `Forespørselen er sendt, men disse vedleggene kom ikke med: ${res.failedAttachments.join(", ")}`,
        );
      }
      setTrackingToken(res.trackingToken);
      toast.success("Takk! Forespørselen er registrert og behandles av oss.");
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[LeadFlow] order submission failed", err);
      if (leadErr) {
        toast.error("Beklager — vi fikk ikke sendt forespørselen. Prøv igjen, eller ring oss.");
        setSubmitting(false);
        return;
      }
      toast.success("Takk! Vi har mottatt forespørselen og tar kontakt så snart som mulig.");
      setTrackingToken("");
    }

    setSubmitting(false);
    setName("");
    setCompany("");
    setEmail("");
    setPhone("");
    setAddress("");
    setPlace("");
    setBuildingType("");
    setArea("");
    setHeating("");
    setUnits("");
    setTimeframe("");
    setExistingUnit("");
    setMessage("");
    setTouchedMessage(false);
    setFiles([]);
    setConsent(false);
  }

  return (
    <section id="kontakt" className="bg-[hsl(var(--warm-cream))] pb-16 scroll-mt-28">
      <div className="mx-auto max-w-[1600px] px-6 sm:px-10 lg:px-12 xl:px-16 2xl:px-24">
        <div className="grid lg:grid-cols-[1fr_360px] gap-5">
          {/* Skjema */}
          <div className="bg-white rounded-2xl border border-[hsl(var(--warm-beige))] shadow-sm p-6 lg:p-8">
            <h2 className="text-2xl font-bold text-[hsl(var(--mcs-navy))]">
              Få pris eller book befaring
            </h2>
            <div className="h-0.5 w-10 bg-[hsl(var(--mcs-orange))] mt-3 mb-4" />
            <p className="text-sm text-[hsl(var(--mcs-muted))] mb-5 max-w-xl leading-relaxed">
              Fortell kort hva du trenger — legg gjerne ved bilder av rommet, veggen, utedelen eller
              en tegning. Da kan vi ofte gi pris uten befaring. Forespørselen registreres hos oss
              med saksnummer, og du kan følge status via en egen lenke.
            </p>

            {trackingToken !== null && (
              <div className="mb-5 rounded-xl border border-[hsl(var(--savings-green))]/30 bg-[hsl(var(--savings-green))]/10 px-4 py-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-[hsl(var(--mcs-navy))]">
                  <CheckCircle2 className="h-4 w-4 text-[hsl(var(--savings-green))]" />
                  Forespørselen er registrert og til behandling
                </p>
                <p className="mt-1 text-[13px] text-[hsl(var(--mcs-muted))]">
                  Du får en bekreftelse på e-post. Vi svarer normalt innen én arbeidsdag.
                </p>
                {trackingToken && (
                  <a
                    href={`/bestilling/status/${trackingToken}`}
                    className="mt-3 inline-flex items-center gap-2 rounded-md bg-[hsl(var(--mcs-navy))] px-4 py-2 text-sm font-semibold text-white"
                  >
                    Følg forespørselen <ArrowRight className="h-4 w-4" />
                  </a>
                )}
              </div>
            )}

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

            <form onSubmit={handleSubmit} className="space-y-7">
              {/* 1. Om henvendelsen */}
              <div>
                <p className={legendClass}>1 · Om henvendelsen</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <span className={labelClass}>Kundetype</span>
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
                          {s === "bolig" ? "Privat" : "Bedrift"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="req-type">
                      Hva ønsker du hjelp med?
                    </label>
                    <select
                      id="req-type"
                      className={inputClass}
                      value={requestType}
                      onChange={(e) =>
                        setRequestType(e.target.value as (typeof REQUEST_TYPES)[number])
                      }
                    >
                      {REQUEST_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* 2. Kontaktopplysninger */}
              <div>
                <p className={legendClass}>2 · Kontaktopplysninger</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass} htmlFor="lead-name">
                      Navn <span className="text-[hsl(var(--mcs-orange))]">*</span>
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
                  {segment === "naering" && (
                    <div>
                      <label className={labelClass} htmlFor="lead-company">
                        Firma
                      </label>
                      <input
                        id="lead-company"
                        className={inputClass}
                        value={company}
                        maxLength={120}
                        onChange={(e) => setCompany(e.target.value)}
                        placeholder="Firmanavn"
                        autoComplete="organization"
                      />
                    </div>
                  )}
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
                    <label className={labelClass} htmlFor="lead-address">
                      Adresse
                    </label>
                    <input
                      id="lead-address"
                      className={inputClass}
                      value={address}
                      maxLength={160}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Gateadresse"
                      autoComplete="street-address"
                    />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="lead-place">
                      Postnr. og sted
                    </label>
                    <input
                      id="lead-place"
                      className={inputClass}
                      value={place}
                      maxLength={120}
                      onChange={(e) => setPlace(e.target.value)}
                      placeholder="3400 Lier"
                      autoComplete="postal-code"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Om bygget */}
              <div>
                <p className={legendClass}>3 · Om bygget og behovet</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass} htmlFor="lead-building">
                      Type bygg
                    </label>
                    <select
                      id="lead-building"
                      className={inputClass}
                      value={buildingType}
                      onChange={(e) => setBuildingType(e.target.value)}
                    >
                      <option value="">Velg …</option>
                      {BUILDING_TYPES.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="lead-area">
                      Oppvarmet areal (m²)
                    </label>
                    <input
                      id="lead-area"
                      type="number"
                      min={0}
                      max={100000}
                      className={inputClass}
                      value={area}
                      onChange={(e) => setArea(e.target.value)}
                      placeholder="f.eks. 140"
                    />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="lead-heating">
                      Dagens oppvarming
                    </label>
                    <select
                      id="lead-heating"
                      className={inputClass}
                      value={heating}
                      onChange={(e) => setHeating(e.target.value)}
                    >
                      <option value="">Velg …</option>
                      {HEATING_TODAY.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="lead-units">
                      Antall enheter/rom som skal varmes
                    </label>
                    <input
                      id="lead-units"
                      type="number"
                      min={0}
                      max={500}
                      className={inputClass}
                      value={units}
                      onChange={(e) => setUnits(e.target.value)}
                      placeholder="f.eks. 2"
                    />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="lead-time">
                      Når passer det?
                    </label>
                    <select
                      id="lead-time"
                      className={inputClass}
                      value={timeframe}
                      onChange={(e) => setTimeframe(e.target.value)}
                    >
                      <option value="">Velg …</option>
                      {TIMEFRAMES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  {isService && (
                    <div>
                      <label className={labelClass} htmlFor="lead-existing">
                        Merke/modell på eksisterende anlegg
                      </label>
                      <input
                        id="lead-existing"
                        className={inputClass}
                        value={existingUnit}
                        maxLength={120}
                        onChange={(e) => setExistingUnit(e.target.value)}
                        placeholder="f.eks. Mitsubishi MSZ-FH"
                      />
                    </div>
                  )}
                </div>

                <div className="mt-4">
                  <label className={labelClass} htmlFor="lead-message">
                    Beskriv behovet
                  </label>
                  <textarea
                    id="lead-message"
                    rows={4}
                    maxLength={2000}
                    className="w-full rounded-md border border-[hsl(var(--warm-beige))] bg-white px-3 py-2.5 text-sm text-[hsl(var(--mcs-navy))] placeholder:text-[hsl(var(--mcs-muted))] focus:outline-none focus:border-[hsl(var(--mcs-navy))]"
                    value={message}
                    onChange={(e) => {
                      setTouchedMessage(true);
                      setMessage(e.target.value);
                    }}
                    placeholder="Fortell kort om boligen/bygget, ønsket plassering av innedel/utedel og eventuelle utfordringer."
                  />
                </div>
              </div>

              {/* 4. Vedlegg */}
              <div>
                <p className={legendClass}>4 · Vedlegg (valgfritt, men anbefalt)</p>
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    addFiles(e.dataTransfer.files);
                  }}
                  className="rounded-xl border border-dashed border-[hsl(var(--warm-beige))] bg-[hsl(var(--warm-cream))] px-4 py-5 text-center"
                >
                  <Paperclip className="mx-auto h-5 w-5 text-[hsl(var(--mcs-orange))]" />
                  <p className="mt-2 text-sm font-semibold text-[hsl(var(--mcs-navy))]">
                    Dra inn bilder eller tegninger — eller velg filer
                  </p>
                  <p className="mt-1 text-xs text-[hsl(var(--mcs-muted))]">
                    Bilder av rom, vegg, sikringsskap, utedel, plantegning eller tilbud fra andre.
                    Maks {MAX_ATTACHMENTS} filer, 10 MB per fil.
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-3 inline-flex items-center gap-2 rounded-md border border-[hsl(var(--mcs-navy))]/25 bg-white px-4 py-2 text-sm font-semibold text-[hsl(var(--mcs-navy))]"
                  >
                    Velg filer
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={ACCEPTED_ATTACHMENT_TYPES}
                    className="hidden"
                    onChange={(e) => addFiles(e.target.files)}
                  />
                </div>

                {files.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {files.map((f, i) => (
                      <li
                        key={`${f.name}-${i}`}
                        className="flex items-center justify-between gap-3 rounded-md border border-[hsl(var(--warm-beige))] bg-white px-3 py-2"
                      >
                        <span className="flex min-w-0 items-center gap-2 text-[13px] text-[hsl(var(--mcs-navy))]">
                          <FileText className="h-4 w-4 shrink-0 text-[hsl(var(--mcs-muted))]" />
                          <span className="truncate">{f.name}</span>
                          <span className="shrink-0 text-[hsl(var(--mcs-muted))]">
                            {Math.max(1, Math.round(f.size / 1024))} kB
                          </span>
                        </span>
                        <button
                          type="button"
                          aria-label={`Fjern ${f.name}`}
                          onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                          className="text-[hsl(var(--mcs-muted))] hover:text-[hsl(var(--mcs-navy))]"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <label className="flex items-start gap-2.5 text-[13px] text-[hsl(var(--mcs-muted))]">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[hsl(var(--mcs-orange))]"
                />
                <span>
                  Jeg samtykker til at Lier Varmepumpeservice kan kontakte meg om denne
                  henvendelsen. Opplysningene brukes kun til å behandle forespørselen.
                </span>
              </label>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 bg-[hsl(var(--mcs-orange))] hover:bg-[hsl(var(--mcs-orange-hover))] disabled:opacity-60 text-white font-semibold px-6 py-3 rounded-md"
                >
                  {submitting ? "Sender …" : "Send forespørsel"} <ArrowRight className="h-4 w-4" />
                </button>
                <p className="flex gap-2 text-xs text-[hsl(var(--mcs-muted))]">
                  <Info className="h-4 w-4 shrink-0 text-[hsl(var(--mcs-orange))]" />
                  Uforpliktende. Vi svarer normalt innen én arbeidsdag.
                </p>
              </div>
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
                href="mailto:post@liervarmepumpeservice.no"
                className="bg-white/10 border border-white/40 hover:bg-white/20 text-white font-semibold px-5 py-3 rounded-md inline-flex items-center justify-center gap-2"
              >
                <Mail className="h-4 w-4" /> post@liervarmepumpeservice.no
              </a>
            </div>

            <ul className="mt-6 space-y-3 border-t border-white/15 pt-5 text-[13px] text-white/80">
              <li className="flex gap-2.5">
                <Clock className="h-4 w-4 shrink-0 text-[hsl(var(--mcs-orange))]" />
                Svar normalt innen én arbeidsdag
              </li>
              <li className="flex gap-2.5">
                <ShieldCheck className="h-4 w-4 shrink-0 text-[hsl(var(--mcs-orange))]" />
                Sertifiserte montører og F-gass-godkjent service
              </li>
              <li className="flex gap-2.5">
                <FileText className="h-4 w-4 shrink-0 text-[hsl(var(--mcs-orange))]" />
                Alle forespørsler får saksnummer og statuslenke
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
