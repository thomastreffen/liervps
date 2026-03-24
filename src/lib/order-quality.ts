// Quality score engine for order form submissions

export type QualityLevel = "green" | "yellow" | "red";

export interface QualityIssue {
  severity: "warning" | "error";
  message: string;
  field_key?: string;
}

export interface QualityResult {
  score: QualityLevel;
  issues: QualityIssue[];
}

const QUALITY_LABELS: Record<QualityLevel, { label: string; color: string; dotClass: string }> = {
  green: { label: "Komplett", color: "bg-green-100 text-green-800", dotClass: "bg-green-500" },
  yellow: { label: "Trenger oppfølging", color: "bg-amber-100 text-amber-800", dotClass: "bg-amber-500" },
  red: { label: "Mangler å avklare", color: "bg-orange-100 text-orange-800", dotClass: "bg-orange-500" },
};

export { QUALITY_LABELS };

/**
 * Compute quality score for a "Bestill service" submission.
 * values: Record<field_key, value>
 * attachments: { category?: string }[]
 */
export function computeQualityScore(
  values: Record<string, any>,
  attachments: { category?: string; file_name?: string }[] = []
): QualityResult {
  const issues: QualityIssue[] = [];

  // Required core fields
  const requiredCore: { key: string; label: string }[] = [
    { key: "kundenavn", label: "Kundenavn" },
    { key: "oppdragssted", label: "Oppdragssted" },
    { key: "anleggsadresse", label: "Anleggsadresse" },
    { key: "materialansvar", label: "Materialansvar" },
  ];

  for (const { key, label } of requiredCore) {
    if (!values[key]) {
      issues.push({ severity: "error", message: `${label} mangler`, field_key: key });
    }
  }

  // PO / reference
  const hasPO = !!values["referanse_po"];
  const poIkkeOpprettet = values["po_ikke_opprettet"] === true || values["po_ikke_opprettet"] === "true";
  const hasMidlertidigRef = !!values["midlertidig_referanse"];

  if (!hasPO && !poIkkeOpprettet && !hasMidlertidigRef) {
    issues.push({ severity: "error", message: "Mangler PO/referanse eller midlertidig referanse", field_key: "referanse_po" });
  } else if (poIkkeOpprettet && !hasMidlertidigRef) {
    issues.push({ severity: "warning", message: "PO ikke opprettet – midlertidig referanse bør oppgis", field_key: "midlertidig_referanse" });
  }

  // Technical documentation for complex work types
  const typeArbeid = values["type_arbeid"];
  const complexTypes = ["Ombygging tavle", "Utvidelse"];
  const isComplex = complexTypes.includes(typeArbeid);

  const hasTegninger = values["tegninger_vedlagt"] === true || values["tegninger_vedlagt"] === "true";
  const hasBilder = values["bilder_vedlagt"] === true || values["bilder_vedlagt"] === "true";
  const hasMaterialliste = values["materialliste_vedlagt"] === true || values["materialliste_vedlagt"] === "true";

  const hasAttTegning = attachments.some(a => a.category === "Tegning");
  const hasAttBilde = attachments.some(a => a.category === "Bilde");
  const hasAttMaterial = attachments.some(a => a.category === "Materialliste");

  if (isComplex) {
    if (!hasTegninger && !hasAttTegning) {
      issues.push({ severity: "error", message: "Ombygging/utvidelse uten vedlagte tegninger", field_key: "tegninger_vedlagt" });
    }
    if (!hasBilder && !hasAttBilde) {
      issues.push({ severity: "warning", message: "Ingen bilder vedlagt for ombygging/utvidelse", field_key: "bilder_vedlagt" });
    }
    if (!hasMaterialliste && !hasAttMaterial) {
      issues.push({ severity: "warning", message: "Materialliste mangler for ombygging/utvidelse", field_key: "materialliste_vedlagt" });
    }
  }

  // Internal orders should have stricter requirements
  const bestillingstype = values["bestillingstype"];
  if (bestillingstype === "intern" || bestillingstype === "Intern") {
    if (!values["intern_avdeling"]) {
      issues.push({ severity: "warning", message: "Intern avdeling ikke angitt", field_key: "intern_avdeling" });
    }
    // Check intern kontroll
    const kontrollKeys = [
      "kundeinfo_kontrollert", "anleggsadresse_kontrollert",
      "tegninger_vurdert", "bilder_vurdert", "materialbehov_avklart",
      "po_avklart", "klar_for_planlegging",
    ];
    const kontrollDone = kontrollKeys.filter(k => values[k] === true || values[k] === "true").length;
    if (kontrollDone < 4) {
      issues.push({ severity: "warning", message: "Intern kontroll er ufullstendig", field_key: "intern_kontroll" });
    }
  }

  // Urgency vs contact info
  const hastegrad = values["hastegrad"];
  if (hastegrad === "Kritisk stopp" || hastegrad === "Høy") {
    if (!values["bestiller_telefon"] && !values["telefon_kunde"]) {
      issues.push({ severity: "error", message: "Kritisk/høy hastegrad uten kontakttelefon", field_key: "bestiller_telefon" });
    }
  }

  // Material responsibility details
  const materialansvar = values["materialansvar"];
  if (materialansvar === "Bestiller / kunde leverer alt" || materialansvar === "Deles mellom partene") {
    if (!values["hva_leverer_bestiller"]) {
      issues.push({ severity: "warning", message: "Materialansvar deles, men hva bestiller leverer er ikke beskrevet", field_key: "hva_leverer_bestiller" });
    }
  }

  // No attachments at all
  if (attachments.length === 0) {
    issues.push({ severity: "warning", message: "Ingen vedlegg lagt ved bestillingen" });
  }

  // Compute score
  const errorCount = issues.filter(i => i.severity === "error").length;
  const warningCount = issues.filter(i => i.severity === "warning").length;

  let score: QualityLevel = "green";
  if (errorCount >= 2) score = "red";
  else if (errorCount >= 1) score = "yellow";
  else if (warningCount >= 3) score = "yellow";

  return { score, issues };
}

/** Standard missing info checklist items */
export const MISSING_INFO_OPTIONS = [
  "Mangler tegninger",
  "Mangler bilder",
  "Mangler materialliste",
  "Mangler PO/referanse",
  "Mangler kundeinformasjon",
  "Mangler fakturainformasjon",
  "Mangler beskrivelse av materialansvar",
  "Mangler informasjon om adgang / utkobling / HMS",
] as const;
