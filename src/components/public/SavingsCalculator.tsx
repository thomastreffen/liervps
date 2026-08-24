import { useMemo, useState } from "react";
import { useLead } from "./LeadContext";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronDown, Info, Leaf, Calculator } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

/* ---------------- Beregningsmodell (konservativ, transparent) ---------------- */

type Scenario = { coverage: number; scop: number };

const SCENARIOS: Record<"low" | "expected" | "high", Scenario> = {
  low: { coverage: 0.45, scop: 2.6 },
  expected: { coverage: 0.65, scop: 3.4 },
  high: { coverage: 0.78, scop: 4.0 },
};

// Luft-vann dekker vannbåren varme og gir høyere dekningsgrad
const AIR_WATER_COVERAGE: Record<"low" | "expected" | "high", number> = {
  low: 0.6,
  expected: 0.8,
  high: 0.9,
};

const BOLIG_HEAT_SHARE = { low: 0.45, normal: 0.575, high: 0.675 };

// Konservative kWh/m² for varmebehov når forbruk ikke oppgis
const BOLIG_KWH_PER_M2: Record<string, number> = {
  enebolig: 95,
  rekkehus: 80,
  leilighet: 60,
  hytte: 55,
};

const NAERING_KWH_PER_M2: Record<string, number> = {
  kontor: 70,
  butikk: 80,
  verksted: 95,
  lager: 60,
  annet: 75,
};

// Andel av strømforbruk som går til oppvarming i næringslokaler
const NAERING_HEAT_SHARE: Record<string, number> = {
  kontor: 0.45,
  butikk: 0.4,
  verksted: 0.55,
  lager: 0.6,
  annet: 0.5,
};

// Hvor godt varmepumpen kan dekke behovet ut fra dagens oppvarming
const HEATING_SOURCE_FACTOR: Record<string, number> = {
  panel: 1,
  ved: 0.85,
  vannbaren_el: 0.95,
  fjernvarme: 0.6,
  annet: 0.85,
};

const ENVELOPE_FACTOR: Record<string, number> = {
  normalt: 1,
  hoyt: 1.15,
  isolert: 0.85,
};

// Boligens standard påvirker varmebehovet
const STANDARD_FACTOR: Record<string, number> = {
  eldre: 1.2,
  normal: 1,
  nyere: 0.82,
};

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

type CalcRow = {
  key: "low" | "expected" | "high";
  savedKwh: number;
  savedNok: number;
  coverage: number;
  scop: number;
};

type CoverageSolution = "en_innedel" | "to_innedeler" | "flere_soner";

const PUMP_TYPE_LABEL: Record<"luft_luft" | "luft_vann" | "usikker", string> = {
  luft_luft: "Luft-luft",
  luft_vann: "Luft-vann",
  usikker: "Ikke bestemt",
};

const COVERAGE_SOLUTION_LABEL: Record<CoverageSolution, string> = {
  en_innedel: "Én innedel",
  to_innedeler: "To innedeler",
  flere_soner: "Flere soner / vurderes på befaring",
};

type CalcResult = {
  heatNeed: number;
  rows: CalcRow[];
  rough: boolean;
  area: number;
  basis: string;
  solutionLabel?: string;
  coverageReduced: boolean;
  airAirLargeArea: boolean;
};

/**
 * Arealet og valgt dekningsløsning påvirker hvor stor del av varmebehovet
 * varmepumpen realistisk kan dekke. Luft-luft med én innedel distribuerer
 * varme dårligere i store boliger, luft-vann skalerer bedre.
 */
function areaCoverageFactor(
  area: number,
  pumpType: "luft_luft" | "luft_vann" | "usikker",
  refArea: number,
  solution: CoverageSolution,
) {
  const decay = (start: number, perM2: number, min: number, boost = 1) =>
    clamp(boost - (Math.max(0, area - start) / 100) * perM2, min, boost);

  const airAir =
    solution === "to_innedeler"
      ? decay(refArea * 1.4, 0.1, 0.8, 1.15)
      : solution === "flere_soner"
        ? decay(refArea * 1.9, 0.06, 1, 1.25)
        : decay(refArea * 0.8, 0.17, 0.62);

  const airWater = decay(refArea * 1.5, 0.05, 0.88);

  if (pumpType === "luft_vann") return airWater;
  if (pumpType === "usikker") return (airAir + airWater) / 2;
  return airAir;
}

function computeResult(opts: {
  heatNeed: number;
  rough: boolean;
  price: number;
  pumpType: "luft_luft" | "luft_vann" | "usikker";
  sourceFactor: number;
  area: number;
  refArea: number;
  basis: string;
  solution?: CoverageSolution;
  showSolution?: boolean;
}): CalcResult {
  const solution: CoverageSolution = opts.solution ?? "en_innedel";
  const areaFactor = areaCoverageFactor(opts.area, opts.pumpType, opts.refArea, solution);
  const rows = (["low", "expected", "high"] as const).map((key) => {
    const base = SCENARIOS[key];
    let coverage = base.coverage;
    if (opts.pumpType === "luft_vann") coverage = AIR_WATER_COVERAGE[key];
    if (opts.pumpType === "usikker") coverage = (base.coverage + AIR_WATER_COVERAGE[key]) / 2;
    coverage = clamp(coverage * opts.sourceFactor * areaFactor, 0.12, 0.92);

    const replaced = opts.heatNeed * coverage;
    const pumpUse = replaced / base.scop;
    const savedKwh = Math.max(0, replaced - pumpUse);
    return { key, savedKwh, savedNok: savedKwh * opts.price, coverage, scop: base.scop };
  });
  return {
    heatNeed: opts.heatNeed,
    rows,
    rough: opts.rough,
    area: opts.area,
    basis: opts.basis,
    solutionLabel: opts.showSolution
      ? opts.pumpType === "luft_vann"
        ? "Full bolig (luft-vann)"
        : COVERAGE_SOLUTION_LABEL[solution]
      : undefined,
    coverageReduced: areaFactor < 0.99,
    airAirLargeArea:
      opts.pumpType !== "luft_vann" && solution === "en_innedel" && opts.area > refLarge(opts.refArea),
  };
}

function refLarge(refArea: number) {
  return refArea * 1.05;
}




/* ---------------- Presentasjonshjelpere ---------------- */

const nok = (v: number) =>
  new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 }).format(Math.round(v / 100) * 100);
const num = (v: number) => new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 }).format(Math.round(v));

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <label className="text-[13px] font-semibold text-[hsl(var(--mcs-navy))]">{label}</label>
        {hint && <span className="text-[13px] font-semibold text-[hsl(var(--mcs-orange))]">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Field label={label}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="bg-white border-[hsl(var(--warm-beige))] h-10">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function SliderField({
  label,
  hint,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
}) {
  return (
    <Field label={label} hint={hint}>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(v[0])}
        className="py-2"
      />
    </Field>
  );
}

/* ---------------- Resultat ---------------- */

function ResultPanel({
  result,
  installedPrice,
  onInstalledPrice,
  segment,
  leadInputs,
}: {
  result: CalcResult;
  installedPrice: string;
  onInstalledPrice: (v: string) => void;
  segment: "bolig" | "naering";
  leadInputs: { annualConsumptionKwh?: number; electricityPrice: number; heatPumpType: string };
}) {
  const { startLead } = useLead();
  const expected = result.rows.find((r) => r.key === "expected")!;
  const low = result.rows.find((r) => r.key === "low")!;
  const high = result.rows.find((r) => r.key === "high")!;
  const priceNum = Number(installedPrice.replace(/\s/g, ""));
  const payback = priceNum > 0 && expected.savedNok > 0 ? priceNum / expected.savedNok : null;
  const paybackFast = priceNum > 0 && high.savedNok > 0 ? priceNum / high.savedNok : null;
  const paybackSlow = priceNum > 0 && low.savedNok > 0 ? priceNum / low.savedNok : null;
  const yr = (v: number) => v.toFixed(1).replace(".", ",");

  return (
    <div className="bg-white rounded-2xl border border-[hsl(var(--warm-beige))] shadow-sm p-6 lg:p-7 lg:sticky lg:top-28">
      <div className="rounded-xl bg-[hsl(var(--savings-green-soft))] px-5 py-5 text-center">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--savings-green))]">
          Estimert årlig besparelse — forventet
        </div>
        <div className="text-3xl lg:text-4xl font-bold text-[hsl(var(--savings-green))] mt-1">
          {nok(expected.savedNok)} kr
        </div>
        <div className="text-xs text-[hsl(var(--savings-green))] mt-1 inline-flex items-center gap-1">
          ca. {num(expected.savedKwh)} kWh spart i året <Leaf className="h-3 w-3" />
        </div>
        {result.rough && (
          <div className="mt-2 inline-block rounded-full bg-white/70 px-3 py-1 text-[11px] font-semibold text-[hsl(var(--mcs-navy))]">
            Grovere estimat basert på areal
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 mt-4">
        {[
          { t: "Lavt anslag", r: low },
          { t: "Forventet", r: expected },
          { t: "Høyt anslag", r: high },
        ].map(({ t, r }) => (
          <div
            key={t}
            className="rounded-lg border border-[hsl(var(--warm-beige))] bg-[hsl(var(--warm-cream))] px-2.5 py-3 text-center"
          >
            <div className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--mcs-muted))]">{t}</div>
            <div className="text-base font-bold text-[hsl(var(--mcs-navy))] mt-1 leading-tight">
              {nok(r.savedNok)} kr
            </div>
            <div className="text-[11px] text-[hsl(var(--mcs-muted))]">{num(r.savedKwh)} kWh</div>
          </div>
        ))}
      </div>

      {/* Slik ser regnestykket ut (forventet) */}
      <dl className="mt-4 rounded-xl border border-[hsl(var(--warm-beige))] bg-[hsl(var(--warm-cream))] px-4 py-3 text-[13px] space-y-1.5">
        {[
          ["Antatt varmebehov", `${num(result.heatNeed)} kWh/år`],
          ["Oppvarmet areal", `${num(result.area)} m²`],
          ...(result.solutionLabel ? [["Dekningsløsning", result.solutionLabel]] : []),
          ["Beregningsgrunnlag", result.basis],
          ["Varmepumpen dekker", `ca. ${Math.round(expected.coverage * 100)} %`],
          ["Årsvarmefaktor brukt", expected.scop.toFixed(1).replace(".", ",")],
          ["Estimert spart strøm", `${num(expected.savedKwh)} kWh/år`],
        ].map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-3">
            <dt className="text-[hsl(var(--mcs-muted))]">{k}</dt>
            <dd className="font-semibold text-[hsl(var(--mcs-navy))]">{v}</dd>
          </div>
        ))}
        {result.coverageReduced && (
          <p className="pt-1 text-xs text-[hsl(var(--mcs-muted))]">
            Dekningsgrad justert ned på grunn av stort areal og valgt løsning.
          </p>
        )}
      </dl>


      <div className="mt-5">
        <label className="block text-[13px] font-semibold text-[hsl(var(--mcs-navy))] mb-1.5">
          Forventet pris ferdig montert (valgfritt)
        </label>
        <div className="flex items-center gap-2">
          <input
            inputMode="numeric"
            value={installedPrice}
            onChange={(e) => onInstalledPrice(e.target.value.replace(/[^\d\s]/g, ""))}
            placeholder="f.eks. 35 000"
            className="w-full h-10 rounded-md border border-[hsl(var(--warm-beige))] px-3 text-sm bg-white"
          />
          <span className="text-sm text-[hsl(var(--mcs-muted))]">kr</span>
        </div>
        {payback !== null && (
          <div className="mt-2 text-sm text-[hsl(var(--mcs-navy))]">
            <p>
              Estimert tilbakebetalingstid: <strong>ca. {yr(payback)} år</strong>
            </p>
            {paybackFast !== null && paybackSlow !== null && (
              <p className="text-xs text-[hsl(var(--mcs-muted))] mt-0.5">
                Typisk intervall: {Math.round(paybackFast)}–{Math.round(paybackSlow)} år
              </p>
            )}
          </div>
        )}
      </div>

      {result.rough && (
        <p className="mt-4 flex gap-2 text-xs text-[hsl(var(--mcs-muted))]">
          <Info className="h-4 w-4 shrink-0 text-[hsl(var(--mcs-orange))]" />
          Du har ikke oppgitt årlig strømforbruk, så varmebehovet er anslått ut fra areal, byggtype og
          standard. Dette gir et grovere estimat.
        </p>
      )}

      {segment === "naering" && (
        <p className="mt-3 flex gap-2 text-xs text-[hsl(var(--mcs-muted))]">
          <Info className="h-4 w-4 shrink-0 text-[hsl(var(--mcs-orange))]" />
          Næringslokaler varierer mye. Resultatet bør brukes som indikasjon før befaring.
        </p>
      )}


      <div className="mt-5 flex flex-col sm:flex-row gap-2.5">
        <button
          type="button"
          onClick={() => startLead({ source: "calculator", segment, interestType: "befaring" })}
          className="flex-1 inline-flex items-center justify-center gap-2 bg-[hsl(var(--mcs-orange))] hover:bg-[hsl(var(--mcs-orange-hover))] text-white font-semibold px-5 py-3 rounded-md text-sm"
        >
          Bestill befaring <ArrowRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() =>
            startLead({
              source: "calculator",
              segment,
              interestType: "beregning",
              calculatorSummary: {
                areaM2: result.area,
                annualConsumptionKwh: leadInputs.annualConsumptionKwh,
                electricityPrice: leadInputs.electricityPrice,
                estimatedSavingsNok: Math.round(expected.savedNok / 100) * 100,
                estimatedSavingsKwh: Math.round(expected.savedKwh),
                heatPumpType: leadInputs.heatPumpType,
                coverageSolution: result.solutionLabel,
              },
            })
          }
          className="flex-1 inline-flex items-center justify-center gap-2 bg-white border border-[hsl(var(--mcs-navy))]/20 hover:border-[hsl(var(--mcs-navy))] text-[hsl(var(--mcs-navy))] font-semibold px-5 py-3 rounded-md text-sm"
        >
          Send meg denne beregningen
        </button>
      </div>
      <p className="mt-3 text-center text-xs text-[hsl(var(--mcs-muted))]">
        Bestill befaring for nøyaktig vurdering av ditt bygg.
      </p>

      <p className="mt-4 text-[11px] leading-relaxed text-[hsl(var(--mcs-muted))]">
        Beregningen er et estimat basert på oppgitte verdier og standard forutsetninger. Faktisk
        besparelse avhenger av bolig, klima, plassering, bruksmønster, strømpris og valgt varmepumpe.
        Endelig anbefaling gis etter befaring.
      </p>
    </div>
  );
}

function AssumptionsPanel({ rough }: { rough: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full flex items-center justify-between gap-2 rounded-xl border border-[hsl(var(--warm-beige))] bg-white px-4 py-3 text-sm font-semibold text-[hsl(var(--mcs-navy))]">
        <span className="inline-flex items-center gap-2">
          <Calculator className="h-4 w-4 text-[hsl(var(--mcs-orange))]" /> Slik beregner vi
        </span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="rounded-xl border border-t-0 border-[hsl(var(--warm-beige))] bg-white px-4 py-4 text-[13px] leading-relaxed text-[hsl(var(--mcs-muted))] space-y-3">
          <ol className="list-decimal pl-5 space-y-1.5 text-[hsl(var(--mcs-navy))]">
            <li>Vi estimerer hvor mye av strømforbruket som går til oppvarming.</li>
            <li>Deretter beregner vi hvor stor del varmepumpen realistisk kan dekke.</li>
            <li>
              Besparelsen kommer av at varmepumpen leverer flere kWh varme per kWh strøm den bruker.
            </li>
          </ol>

          <div className="rounded-lg bg-[hsl(var(--warm-cream))] border border-[hsl(var(--warm-beige))] px-4 py-3 space-y-2">
            <p className="font-semibold text-[hsl(var(--mcs-navy))] text-[13px]">
              Hvorfor vårt anslag kan avvike fra enkle «opptil»-eksempler
            </p>
            <p>
              En del sparekalkulatorer bruker en enkel tommelfingerregel, for eksempel at en bolig
              bruker rundt 20 000 kWh i året, at ca. 60 % går til oppvarming, og at varmepumpen kan
              spare opptil 60 % av oppvarmingen.
            </p>
            <p>
              Vi bruker samme grunnidé, men gjør beregningen mer individuell. Derfor justerer vi for
              boligtype, areal, boligens standard, dagens oppvarming, valgt varmepumpeløsning,
              dekningsgrad og SCOP. Resultatet vises som lavt, forventet og høyt anslag, der
              forventet anslag er ment å være nøkternt og realistisk.
            </p>
          </div>

          <p>
            Hvis du oppgir årlig strømforbruk, bruker vi dette som hovedgrunnlag. Oppvarmet areal
            brukes likevel til å justere varmebehov og hvor mye en varmepumpe realistisk kan dekke.{" "}
            {rough
              ? "Uten forbrukstall anslår vi varmebehovet ut fra areal, byggtype og standard med konservative kWh/m²."
              : "Varmebehovet vektes 70 % fra forbruket ditt og 30 % fra areal, byggtype og standard."}
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Dekningsgrad luft-luft: 45 % (lavt), 65 % (forventet), 78 % (høyt).</li>
            <li>Dekningsgrad luft-vann: 60 / 80 / 90 %.</li>
            <li>Årsvarmefaktor (SCOP): 2,6 (lavt), 3,4 (forventet), 4,0 (høyt).</li>
            <li>
              Dekningsløsning påvirker resultatet: én innedel dekker normalt godt opp til ca.
              80–120 m², og dekningsgraden reduseres gradvis for større boliger. To innedeler gir
              høyere dekning i større boliger, og flere soner vurderes ut fra planløsning og
              plassering på befaring. Luft-vann er mindre arealsensitiv.
            </li>

            <li>Dagens oppvarmingskilde, standard og takhøyde/isolasjon justerer beregningen.</li>
          </ul>


          <p className="font-mono text-[12px] text-[hsl(var(--mcs-navy))]">
            erstattet strøm = varmebehov × dekningsgrad
            <br />
            forbruk varmepumpe = erstattet strøm ÷ SCOP
            <br />
            spart kWh = erstattet strøm − forbruk varmepumpe
            <br />
            spart kr = spart kWh × strømpris
          </p>
          <p>
            Tallene er bevisst konservative. Vi lover ingen garantert besparelse — endelig vurdering
            gjøres på befaring.
          </p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/* ---------------- Bolig ---------------- */

function UnknownKwhToggle({
  id,
  checked,
  onChange,
  label = "Jeg vet ikke årlig strømforbruk",
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <label
      htmlFor={id}
      className="mt-3 flex cursor-pointer items-center gap-2.5 rounded-lg border border-[hsl(var(--warm-beige))] bg-[hsl(var(--warm-cream))] px-3 py-2.5 text-[13px] text-[hsl(var(--mcs-navy))]"
    >
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      {label}
    </label>
  );
}

function BoligForm({ installedPrice, onInstalledPrice }: { installedPrice: string; onInstalledPrice: (v: string) => void }) {
  const [type, setType] = useState("enebolig");
  const [area, setArea] = useState(150);
  const [unknownKwh, setUnknownKwh] = useState(false);
  const [kwh, setKwh] = useState(20000);
  const [source, setSource] = useState("panel");
  const [price, setPrice] = useState(1.4);
  const [pattern, setPattern] = useState<"low" | "normal" | "high">("normal");
  const [standard, setStandard] = useState("normal");
  const [pumpType, setPumpType] = useState<"luft_luft" | "luft_vann" | "usikker">("luft_luft");
  const [solution, setSolution] = useState<CoverageSolution>("en_innedel");

  const result = useMemo(() => {
    const rough = unknownKwh;
    const std = STANDARD_FACTOR[standard] ?? 1;
    const patternFactor = pattern === "low" ? 0.85 : pattern === "high" ? 1.15 : 1;
    const heatNeedFromArea = area * (BOLIG_KWH_PER_M2[type] ?? 85) * patternFactor * std;
    const heatNeedFromConsumption = kwh * clamp(BOLIG_HEAT_SHARE[pattern] * std, 0.3, 0.78);
    // Kjent forbruk er hovedgrunnlag, men areal justerer varmebehovet (70/30)
    const heatNeed = rough
      ? heatNeedFromArea
      : 0.7 * heatNeedFromConsumption + 0.3 * heatNeedFromArea;
    return computeResult({
      heatNeed,
      rough,
      price,
      pumpType,
      sourceFactor: HEATING_SOURCE_FACTOR[source] ?? 0.85,
      area,
      refArea: 130,
      basis: rough ? "Arealbasert estimat" : "Strømforbruk + areal",
      solution,
      showSolution: true,
    });
  }, [type, area, unknownKwh, kwh, source, price, pattern, standard, pumpType, solution]);




  return (
    <div className="grid lg:grid-cols-[1fr_400px] gap-6">
      <div className="bg-white rounded-2xl border border-[hsl(var(--warm-beige))] shadow-sm p-6 lg:p-7 space-y-5">
        <div className="grid sm:grid-cols-2 gap-5">
          <SelectField
            label="Boligtype"
            value={type}
            onChange={setType}
            options={[
              { value: "enebolig", label: "Enebolig" },
              { value: "rekkehus", label: "Rekkehus / tomannsbolig" },
              { value: "leilighet", label: "Leilighet" },
              { value: "hytte", label: "Hytte" },
            ]}
          />
          <SelectField
            label="Dagens hovedoppvarming"
            value={source}
            onChange={setSource}
            options={[
              { value: "panel", label: "Panelovner / direkte strøm" },
              { value: "ved", label: "Ved + strøm" },
              { value: "vannbaren_el", label: "Vannbåren el" },
              { value: "fjernvarme", label: "Fjernvarme" },
              { value: "annet", label: "Annet / blandet" },
            ]}
          />
        </div>

        <SliderField
          label="Oppvarmet areal"
          hint={`${area} m²`}
          value={area}
          onChange={setArea}
          min={30}
          max={400}
          step={5}
        />

        <div>
          <div className="flex items-baseline justify-between gap-3 mb-1.5">
            <label className="text-[13px] font-semibold text-[hsl(var(--mcs-navy))]">
              Årlig strømforbruk <span className="font-normal text-[hsl(var(--mcs-muted))]">(valgfritt)</span>
            </label>
            {!unknownKwh && (
              <span className="text-[13px] font-semibold text-[hsl(var(--mcs-orange))]">{num(kwh)} kWh</span>
            )}
          </div>
          {unknownKwh ? (
            <p className="text-xs text-[hsl(var(--mcs-muted))]">
              Vi anslår varmebehovet ut fra areal, boligtype og standard. Estimatet blir da grovere.
            </p>
          ) : (
            <Slider value={[kwh]} min={4000} max={60000} step={500} onValueChange={(v) => setKwh(v[0])} className="py-2" />
          )}
          <UnknownKwhToggle id="bolig-ukjent-kwh" checked={unknownKwh} onChange={setUnknownKwh} />
        </div>

        <SliderField
          label="Strømpris inkl. nettleie og avgifter"
          hint={`${price.toFixed(2).replace(".", ",")} kr/kWh`}
          value={price}
          onChange={setPrice}
          min={0.5}
          max={3}
          step={0.05}
        />

        <div className="grid sm:grid-cols-2 gap-5">
          <SelectField
            label="Boligens standard"
            value={standard}
            onChange={setStandard}
            options={[
              { value: "eldre", label: "Eldre / trekkfull" },
              { value: "normal", label: "Normal" },
              { value: "nyere", label: "Nyere / godt isolert" },
            ]}
          />
          <SelectField
            label="Bruksmønster"
            value={pattern}
            onChange={(v) => setPattern(v as typeof pattern)}
            options={[
              { value: "low", label: "Lavt" },
              { value: "normal", label: "Normalt" },
              { value: "high", label: "Høyt" },
            ]}
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          <SelectField
            label="Ønsket varmepumpetype"
            value={pumpType}
            onChange={(v) => setPumpType(v as typeof pumpType)}
            options={[
              { value: "luft_luft", label: "Luft-luft" },
              { value: "luft_vann", label: "Luft-vann" },
              { value: "usikker", label: "Usikker" },
            ]}
          />
          {pumpType === "luft_vann" ? (
            <Field label="Dekningsløsning">
              <div className="flex h-10 items-center rounded-md border border-[hsl(var(--warm-beige))] bg-[hsl(var(--warm-cream))] px-3 text-sm text-[hsl(var(--mcs-muted))]">
                Full bolig (vannbåren)
              </div>
            </Field>
          ) : (
            <SelectField
              label="Dekningsløsning"
              value={solution}
              onChange={(v) => setSolution(v as CoverageSolution)}
              options={[
                { value: "en_innedel", label: "Én innedel" },
                { value: "to_innedeler", label: "To innedeler" },
                { value: "flere_soner", label: "Flere soner / vurderes på befaring" },
              ]}
            />
          )}
        </div>

        {result.airAirLargeArea && (
          <p className="flex gap-2 rounded-lg border border-[hsl(var(--warm-beige))] bg-[hsl(var(--warm-cream))] px-3 py-2.5 text-xs text-[hsl(var(--mcs-muted))]">
            <Info className="h-4 w-4 shrink-0 text-[hsl(var(--mcs-orange))]" />
            For større boliger vil én luft-luft-varmepumpe ofte ikke dekke hele varmebehovet. Flere
            innedeler eller annen løsning kan gi høyere dekning.
          </p>
        )}


        <AssumptionsPanel rough={result.rough} />
      </div>
      <ResultPanel
        result={result}
        installedPrice={installedPrice}
        onInstalledPrice={onInstalledPrice}
        segment="bolig"
        leadInputs={{
          annualConsumptionKwh: unknownKwh ? undefined : kwh,
          electricityPrice: price,
          heatPumpType: PUMP_TYPE_LABEL[pumpType],
        }}
      />

    </div>
  );
}

/* ---------------- Næring ---------------- */

function NaeringForm({ installedPrice, onInstalledPrice }: { installedPrice: string; onInstalledPrice: (v: string) => void }) {
  const [type, setType] = useState("kontor");
  const [area, setArea] = useState(500);
  const [hours, setHours] = useState(50);
  const [unknownKwh, setUnknownKwh] = useState(false);
  const [kwh, setKwh] = useState(80000);
  const [source, setSource] = useState("panel");
  const [price, setPrice] = useState(1.3);
  const [envelope, setEnvelope] = useState("normalt");

  const result = useMemo(() => {
    const rough = unknownKwh;
    const hoursFactor = clamp(hours / 45, 0.7, 1.35);
    const envFactorNeed = envelope === "hoyt" ? 1.2 : envelope === "isolert" ? 0.85 : 1;
    const heatNeedFromArea = area * (NAERING_KWH_PER_M2[type] ?? 75) * hoursFactor * envFactorNeed;
    const heatNeedFromConsumption =
      kwh * clamp((NAERING_HEAT_SHARE[type] ?? 0.5) * hoursFactor * envFactorNeed, 0.25, 0.75);
    const heatNeed = rough
      ? heatNeedFromArea
      : 0.7 * heatNeedFromConsumption + 0.3 * heatNeedFromArea;

    return computeResult({
      heatNeed,
      rough,
      price,
      pumpType: "luft_luft",
      sourceFactor:
        (HEATING_SOURCE_FACTOR[source] ?? 0.85) * (ENVELOPE_FACTOR[envelope] ?? 1) * 0.95,
      area,
      refArea: 400,
      basis: rough ? "Arealbasert estimat" : "Strømforbruk + areal",
    });
  }, [type, area, hours, unknownKwh, kwh, source, price, envelope]);



  return (
    <div className="grid lg:grid-cols-[1fr_400px] gap-6">
      <div className="bg-white rounded-2xl border border-[hsl(var(--warm-beige))] shadow-sm p-6 lg:p-7 space-y-5">
        <div className="grid sm:grid-cols-2 gap-5">
          <SelectField
            label="Type lokale"
            value={type}
            onChange={setType}
            options={[
              { value: "kontor", label: "Kontor" },
              { value: "butikk", label: "Butikk" },
              { value: "verksted", label: "Verksted / lager" },
              { value: "lager", label: "Lager" },
              { value: "annet", label: "Annet næringslokale" },
            ]}
          />
          <SelectField
            label="Dagens oppvarming"
            value={source}
            onChange={setSource}
            options={[
              { value: "panel", label: "Panelovner / direkte strøm" },
              { value: "vannbaren_el", label: "Vannbåren el" },
              { value: "fjernvarme", label: "Fjernvarme" },
              { value: "annet", label: "Annet / blandet" },
            ]}
          />
        </div>

        <SliderField
          label="Oppvarmet areal"
          hint={`${num(area)} m²`}
          value={area}
          onChange={setArea}
          min={50}
          max={5000}
          step={50}
        />
        <SliderField
          label="Driftstid per uke"
          hint={`${hours} timer`}
          value={hours}
          onChange={setHours}
          min={10}
          max={168}
          step={1}
        />

        <div>
          <div className="flex items-baseline justify-between gap-3 mb-1.5">
            <label className="text-[13px] font-semibold text-[hsl(var(--mcs-navy))]">
              Årlig strømforbruk <span className="font-normal text-[hsl(var(--mcs-muted))]">(valgfritt)</span>
            </label>
            {!unknownKwh && (
              <span className="text-[13px] font-semibold text-[hsl(var(--mcs-orange))]">{num(kwh)} kWh</span>
            )}
          </div>
          {unknownKwh ? (
            <p className="text-xs text-[hsl(var(--mcs-muted))]">
              Vi anslår varmebehovet ut fra areal, lokaltype og driftstid. Estimatet blir da grovere.
            </p>
          ) : (
            <Slider value={[kwh]} min={10000} max={600000} step={5000} onValueChange={(v) => setKwh(v[0])} className="py-2" />
          )}
          <UnknownKwhToggle id="naering-ukjent-kwh" checked={unknownKwh} onChange={setUnknownKwh} />
        </div>


        <div className="grid sm:grid-cols-2 gap-5">
          <SliderField
            label="Strømpris inkl. nettleie og avgifter"
            hint={`${price.toFixed(2).replace(".", ",")} kr/kWh`}
            value={price}
            onChange={setPrice}
            min={0.5}
            max={3}
            step={0.05}
          />
          <SelectField
            label="Takhøyde / varmetap"
            value={envelope}
            onChange={setEnvelope}
            options={[
              { value: "normalt", label: "Normalt" },
              { value: "hoyt", label: "Høy takhøyde / porter" },
              { value: "isolert", label: "Godt isolert" },
            ]}
          />
        </div>

        <AssumptionsPanel rough={result.rough} />
      </div>
      <ResultPanel
        result={result}
        installedPrice={installedPrice}
        onInstalledPrice={onInstalledPrice}
        segment="naering"
        leadInputs={{
          annualConsumptionKwh: unknownKwh ? undefined : kwh,
          electricityPrice: price,
          heatPumpType: PUMP_TYPE_LABEL.luft_luft,
        }}
      />

    </div>
  );
}

/* ---------------- Seksjon ---------------- */

export function SavingsCalculator() {
  const [installedPrice, setInstalledPrice] = useState("");

  return (
    <section id="besparelse" className="bg-[hsl(var(--warm-cream))] pb-16 scroll-mt-28">
      <div className="mx-auto max-w-[1600px] px-6 sm:px-10 lg:px-12 xl:px-16 2xl:px-24">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <p className="text-[hsl(var(--mcs-orange))] text-xs font-semibold uppercase tracking-wider mb-2">
            Besparelseskalkulator
          </p>
          <h2 className="text-2xl lg:text-3xl font-bold text-[hsl(var(--mcs-navy))] mb-3">
            Hva kan du spare med varmepumpe?
          </h2>
          <p className="text-sm text-[hsl(var(--mcs-muted))] leading-relaxed">
            Legg inn noen enkle tall om bygget ditt og se et konservativt anslag på årlig besparelse.
            Vi bruker forsiktige forutsetninger — endelig vurdering gjør vi på befaring.
          </p>
        </div>

        <Tabs defaultValue="bolig">
          <TabsList className="mx-auto mb-6 flex w-full max-w-sm bg-white border border-[hsl(var(--warm-beige))] p-1 rounded-lg">
            <TabsTrigger value="bolig" className="flex-1">
              For bolig
            </TabsTrigger>
            <TabsTrigger value="naering" className="flex-1">
              For næring
            </TabsTrigger>
          </TabsList>
          <TabsContent value="bolig">
            <BoligForm installedPrice={installedPrice} onInstalledPrice={setInstalledPrice} />
          </TabsContent>
          <TabsContent value="naering">
            <NaeringForm installedPrice={installedPrice} onInstalledPrice={setInstalledPrice} />
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
}
