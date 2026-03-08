import { AlertTriangle, PlusCircle, RefreshCw, Clipboard } from "lucide-react";

export type WorkPackageType = "deviation" | "additional_work" | "change" | "internal_task";

export const WP_TYPE_CONFIG: Record<WorkPackageType, {
  label: string;
  description: string;
  icon: typeof AlertTriangle;
  color: string;
  bgColor: string;
  portalLabel: string;
}> = {
  deviation: {
    label: "Avvik",
    description: "Noe som ikke er iht. plan",
    icon: AlertTriangle,
    color: "text-destructive",
    bgColor: "bg-destructive/10",
    portalLabel: "Avvik",
  },
  additional_work: {
    label: "Tilleggsarbeid",
    description: "Ekstra arbeid utenfor avtale",
    icon: PlusCircle,
    color: "text-warning",
    bgColor: "bg-warning/10",
    portalLabel: "Tilleggsarbeid",
  },
  change: {
    label: "Endring",
    description: "Endring i løsning eller omfang",
    icon: RefreshCw,
    color: "text-info",
    bgColor: "bg-info/10",
    portalLabel: "Endring",
  },
  internal_task: {
    label: "Intern oppgave",
    description: "Kun synlig internt",
    icon: Clipboard,
    color: "text-muted-foreground",
    bgColor: "bg-muted",
    portalLabel: "Oppgave",
  },
};

export const ALL_WP_TYPES = Object.keys(WP_TYPE_CONFIG) as WorkPackageType[];

export const DOC_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: "Mangler dokumentasjon", color: "bg-warning/10 text-warning" },
  partial: { label: "Delvis dokumentert", color: "bg-info/10 text-info" },
  complete: { label: "Ferdig dokumentert", color: "bg-success/10 text-success" },
};
