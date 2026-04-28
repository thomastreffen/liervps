// Sentralt register for kalkylepakker (slug -> evaluator).
// Når regelmotoren generaliseres senere, kan denne erstattes av en JSON-driver
// som tolker calc_package_rules. For MVP er hardkoding per pakke renest.

import type { CalcEvaluator } from "./types";
import { calculateStromskinne } from "./stromskinne";
import { calculateStromskinneV2 } from "./stromskinne-v2";

const REGISTRY: Record<string, CalcEvaluator> = {
  "stromskinne-v1": calculateStromskinne,
  "stromskinne-v2": calculateStromskinneV2,
};

export function getEvaluator(slug: string): CalcEvaluator | null {
  return REGISTRY[slug] ?? null;
}

export function isPackageSupported(slug: string): boolean {
  return slug in REGISTRY;
}

export function listSupportedPackages(): string[] {
  return Object.keys(REGISTRY);
}
