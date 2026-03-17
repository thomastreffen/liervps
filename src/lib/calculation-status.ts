export type CalculationStatus = "draft" | "generated" | "sent" | "in_dialogue" | "accepted" | "rejected" | "converted";

export interface CalculationStatusConfig {
  label: string;
  className: string;
  pipelineOrder: number;
}

export const CALCULATION_STATUS_CONFIG: Record<CalculationStatus, CalculationStatusConfig> = {
  draft: { label: "Utkast", className: "bg-muted text-muted-foreground", pipelineOrder: 0 },
  generated: { label: "Generert", className: "bg-primary/15 text-primary", pipelineOrder: 1 },
  sent: { label: "Sendt", className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", pipelineOrder: 2 },
  in_dialogue: { label: "I dialog", className: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200", pipelineOrder: 3 },
  accepted: { label: "Vunnet", className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", pipelineOrder: 4 },
  rejected: { label: "Tapt", className: "bg-destructive/15 text-destructive", pipelineOrder: 5 },
  converted: { label: "Konvertert", className: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200", pipelineOrder: 6 },
};

export const ALL_CALCULATION_STATUSES: CalculationStatus[] = [
  "draft", "generated", "sent", "in_dialogue", "accepted", "rejected", "converted",
];

/** Pipeline statuses for the visual step bar */
export const PIPELINE_STATUSES: CalculationStatus[] = [
  "draft", "sent", "in_dialogue", "accepted",
];
