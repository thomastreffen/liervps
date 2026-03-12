import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ArrowUpRight, ChevronDown, Database, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { useState } from "react";

interface SourceMetadataProps {
  /** "tripletex" | "local" | null */
  source: "tripletex" | "local" | null;
  /** External ID from source system */
  externalId?: string | null;
  /** Company name */
  companyName?: string | null;
  /** Last synced/imported timestamp */
  lastSynced?: string | null;
  /** Additional metadata key-value pairs */
  extra?: { label: string; value: string }[];
}

export function SourceMetadataBadge({ source, externalId, companyName }: Pick<SourceMetadataProps, "source" | "externalId" | "companyName">) {
  if (!source || source === "local") {
    return companyName ? (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Database className="h-3 w-3" />
        {companyName}
      </span>
    ) : null;
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <Badge variant="outline" className="h-5 text-[10px] font-normal gap-1 border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400">
        <ArrowUpRight className="h-2.5 w-2.5" />
        Tripletex
      </Badge>
      {externalId && <span className="font-mono text-[10px]">#{externalId}</span>}
      {companyName && (
        <>
          <span className="text-muted-foreground/40">·</span>
          <span>{companyName}</span>
        </>
      )}
    </span>
  );
}

export function SourceMetadataSection({ source, externalId, companyName, lastSynced, extra }: SourceMetadataProps) {
  const [open, setOpen] = useState(false);

  if (!source && !companyName && !externalId) return null;

  const hasDetails = externalId || lastSynced || (extra && extra.length > 0);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full py-1.5">
        <Database className="h-3.5 w-3.5 shrink-0" />
        <span className="font-medium">Integrasjon & kilde</span>
        {source === "tripletex" && (
          <Badge variant="outline" className="h-4 text-[9px] font-normal border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400 ml-1">
            Tripletex
          </Badge>
        )}
        {hasDetails && <ChevronDown className={`h-3 w-3 ml-auto transition-transform ${open ? "rotate-180" : ""}`} />}
      </CollapsibleTrigger>
      {hasDetails && (
        <CollapsibleContent className="pt-1 pb-2">
          <div className="rounded-md border bg-muted/30 p-3 space-y-1.5 text-xs">
            {source && (
              <Row label="Kilde" value={source === "tripletex" ? "Tripletex" : "Lokalt opprettet"} />
            )}
            {externalId && (
              <Row label={source === "tripletex" ? "Tripletex-ID" : "Ekstern ID"} value={externalId} mono />
            )}
            {companyName && <Row label="Selskap" value={companyName} />}
            {lastSynced && (
              <Row
                label="Sist synket"
                value={format(new Date(lastSynced), "d. MMM yyyy HH:mm", { locale: nb })}
                icon={<RefreshCw className="h-3 w-3 text-muted-foreground/60" />}
              />
            )}
            {extra?.map((e, i) => <Row key={i} label={e.label} value={e.value} />)}
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}

function Row({ label, value, mono, icon }: { label: string; value: string; mono?: boolean; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground flex items-center gap-1">{icon}{label}</span>
      <span className={`text-foreground ${mono ? "font-mono text-[11px]" : ""}`}>{value}</span>
    </div>
  );
}
