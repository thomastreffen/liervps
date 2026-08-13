import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from "react";

export type LeadSource =
  | "hero"
  | "bolig"
  | "naering"
  | "product"
  | "solution"
  | "calculator"
  | "service";

export type LeadInterest =
  | "befaring"
  | "modell-anbefaling"
  | "losning-anbefaling"
  | "beregning"
  | "service"
  | "feilsoking";

export type CalculatorSummary = {
  areaM2?: number;
  annualConsumptionKwh?: number;
  electricityPrice?: number;
  estimatedSavingsNok?: number;
  estimatedSavingsKwh?: number;
  heatPumpType?: string;
  coverageSolution?: string;
};

export type LeadContext = {
  source: LeadSource;
  segment?: "bolig" | "naering";
  interestType?: LeadInterest;
  productName?: string;
  brand?: string;
  solutionName?: string;
  calculatorSummary?: CalculatorSummary;
};

export const INTEREST_LABEL: Record<LeadInterest, string> = {
  befaring: "Befaring",
  "modell-anbefaling": "Få anbefalt riktig modell",
  "losning-anbefaling": "Få anbefalt riktig løsning",
  service: "Service",
  feilsoking: "Feilsøking",
  beregning: "Send meg beregningen",
};

/** Kort, kundevennlig oppsummering: "Du tar kontakt om: …" */
export function leadContextLabel(ctx: LeadContext): string {
  const parts: string[] = [];
  if (ctx.interestType) parts.push(INTEREST_LABEL[ctx.interestType]);
  if (ctx.productName) parts.push([ctx.brand, ctx.productName].filter(Boolean).join(" "));
  else if (ctx.solutionName) parts.push(ctx.solutionName);
  if (ctx.segment) parts.push(ctx.segment === "bolig" ? "bolig" : "næring");
  return parts.join(" · ");
}

export function leadPrefillMessage(ctx: LeadContext): string {
  if (ctx.interestType === "modell-anbefaling" && ctx.productName)
    return `Jeg ønsker anbefaling knyttet til ${[ctx.brand, ctx.productName].filter(Boolean).join(" ")}.`;
  if (ctx.interestType === "losning-anbefaling" && ctx.solutionName)
    return `Jeg ønsker anbefaling om ${ctx.solutionName}.`;
  if (ctx.interestType === "beregning")
    return "Jeg ønsker å få tilsendt beregningen og vurdering av riktig varmepumpe.";
  if (ctx.interestType === "service") return "Jeg ønsker service på varmepumpen min.";
  if (ctx.interestType === "feilsoking") return "Varmepumpen min fungerer ikke som den skal.";
  return "Jeg ønsker en uforpliktende befaring.";
}

type LeadStore = {
  lead: LeadContext | null;
  /** Setter kontekst og ruller mykt til kontaktseksjonen. */
  startLead: (ctx: LeadContext) => void;
  clearLead: () => void;
};

const Ctx = createContext<LeadStore | null>(null);

export function LeadProvider({ children }: { children: ReactNode }) {
  const [lead, setLead] = useState<LeadContext | null>(null);

  const startLead = useCallback((ctx: LeadContext) => {
    setLead(ctx);
    // eslint-disable-next-line no-console
    console.info("[LeadFlow] context", ctx);
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        document.getElementById("kontakt")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, []);

  const value = useMemo(
    () => ({ lead, startLead, clearLead: () => setLead(null) }),
    [lead, startLead]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Trygg å bruke også utenfor provider (returnerer no-op). */
export function useLead(): LeadStore {
  const ctx = useContext(Ctx);
  if (ctx) return ctx;
  return {
    lead: null,
    startLead: () => {
      document.getElementById("kontakt")?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    clearLead: () => {},
  };
}
