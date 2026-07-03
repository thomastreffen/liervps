/**
 * Company / module accent helper
 *
 * Lier VPS Signal er masterbrand (primary). Selskapsspesifikke aksenter brukes
 * KUN i kontekst der innholdet faktisk tilhører selskapet/modulen:
 *   - Lier VPS       → brand-service (oransje)
 *   - Lier VPS Elektrotavler → brand-tavler (blå)
 *   - Ukjent / felles   → primary (Lier VPS Signal)
 *
 * Ikke bruk disse globalt – kun for selskapsbadges, modulhint, segmenterte
 * dashboards og lignende kontekstuelle markører.
 */

export type CompanyKind = "service" | "tavler" | "unknown";

/**
 * Detekter selskap fra et selskapsnavn eller slug. Tolerant for varianter
 * som "Lier Varmepumpeservice AS", "mcs-service", "Lier VPS Elektrotavler" osv.
 */
export function detectCompanyKind(input?: string | null): CompanyKind {
  if (!input) return "unknown";
  const s = input.toLowerCase();
  if (s.includes("tavler") || s.includes("elektrotavler")) return "tavler";
  if (s.includes("service")) return "service";
  return "unknown";
}

type AccentClasses = {
  /** Solid bakgrunn (CTA, fylte badges) */
  bg: string;
  /** Tekst på solid bakgrunn */
  bgForeground: string;
  /** Tekstfarge på nøytral bakgrunn */
  text: string;
  /** Border */
  border: string;
  /** Soft fill (10% opacity) for badges/chips */
  soft: string;
  /** Tekst på soft fill */
  softText: string;
  /** Ring/focus */
  ring: string;
  /** Kort menneskelig label */
  label: string;
};

const SERVICE: AccentClasses = {
  bg: "bg-brand-service",
  bgForeground: "text-brand-service-foreground",
  text: "text-brand-service",
  border: "border-brand-service",
  soft: "bg-brand-service/10",
  softText: "text-brand-service",
  ring: "ring-brand-service",
  label: "Lier VPS",
};

const TAVLER: AccentClasses = {
  bg: "bg-brand-tavler",
  bgForeground: "text-brand-tavler-foreground",
  text: "text-brand-tavler",
  border: "border-brand-tavler",
  soft: "bg-brand-tavler/10",
  softText: "text-brand-tavler",
  ring: "ring-brand-tavler",
  label: "Lier VPS Elektrotavler",
};

const PRIMARY: AccentClasses = {
  bg: "bg-primary",
  bgForeground: "text-primary-foreground",
  text: "text-primary",
  border: "border-primary",
  soft: "bg-primary-soft",
  softText: "text-primary-soft-foreground",
  ring: "ring-primary",
  label: "Lier VPS",
};

export function companyAccent(input?: string | null): AccentClasses {
  switch (detectCompanyKind(input)) {
    case "service":
      return SERVICE;
    case "tavler":
      return TAVLER;
    default:
      return PRIMARY;
  }
}
