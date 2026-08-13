import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface PublicLead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  segment: string;
  request_type: string;
  message: string | null;
  lead_source: string | null;
  selected_brand: string | null;
  selected_product_name: string | null;
  selected_solution_name: string | null;
  calculator_summary: any;
  lead_context: any;
  page_url: string | null;
  status: string;
  created_at: string;
}

const CALC_LABELS: Record<string, string> = {
  estimatedSavings: "Estimert besparelse",
  savingsLow: "Besparelse (lavt)",
  savingsExpected: "Besparelse (forventet)",
  savingsHigh: "Besparelse (høyt)",
  annualKwh: "Årlig strømforbruk",
  area: "Areal",
  electricityPrice: "Strømpris",
  pumpType: "Varmepumpetype",
  coverageSolution: "Dekningsløsning",
  standard: "Boligstandard",
  paybackYears: "Nedbetalingstid",
  installedPrice: "Installert pris",
};

function formatCalcValue(key: string, value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "number") {
    if (/price|savings|kr/i.test(key)) return `kr ${value.toLocaleString("nb-NO")}`;
    if (/kwh/i.test(key)) return `${value.toLocaleString("nb-NO")} kWh`;
    if (/area/i.test(key)) return `${value} m²`;
    return value.toLocaleString("nb-NO");
  }
  if (typeof value === "boolean") return value ? "Ja" : "Nei";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 border-b border-border/30 last:border-0">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm text-right break-words">{value}</span>
    </div>
  );
}

export function PublicLeadContextCard({ publicLeadId }: { publicLeadId: string }) {
  const [pl, setPl] = useState<PublicLead | null>(null);

  useEffect(() => {
    supabase.from("public_leads").select("*").eq("id", publicLeadId).maybeSingle()
      .then(({ data }) => setPl((data as any) || null));
  }, [publicLeadId]);

  if (!pl) return null;

  const calc = pl.calculator_summary && typeof pl.calculator_summary === "object" ? pl.calculator_summary : null;

  return (
    <Card className="rounded-2xl shadow-sm border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" /> Henvendelse fra nettsiden
          </CardTitle>
          <Badge variant="outline" className="text-[10px] rounded-lg">
            {pl.segment === "naering" ? "Næring" : "Bolig"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Row label="Navn" value={pl.name} />
          <Row label="E-post" value={pl.email} />
          <Row label="Telefon" value={pl.phone} />
          <Row label="Adresse" value={pl.address} />
          <Row label="Type henvendelse" value={pl.request_type} />
          <Row label="Kilde" value={pl.lead_source} />
          <Row label="Merke" value={pl.selected_brand} />
          <Row label="Modell" value={pl.selected_product_name} />
          <Row label="Løsning" value={pl.selected_solution_name} />
          <Row label="Side" value={pl.page_url} />
        </div>

        {pl.message && (
          <div className="rounded-xl bg-secondary/30 p-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Melding</p>
            <p className="text-sm whitespace-pre-wrap">{pl.message}</p>
          </div>
        )}

        {calc && (
          <div className="rounded-xl border border-border/40 p-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">Beregning</p>
            <div className="space-y-0.5">
              {Object.entries(calc).map(([k, v]) => (
                <Row key={k} label={CALC_LABELS[k] || k} value={formatCalcValue(k, v)} />
              ))}
            </div>
          </div>
        )}

        {pl.lead_context && (
          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
              <ChevronDown className="h-3.5 w-3.5" /> Teknisk kontekst
            </CollapsibleTrigger>
            <CollapsibleContent>
              <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-secondary/40 p-3 text-[10px] leading-relaxed">
                {JSON.stringify(pl.lead_context, null, 2)}
              </pre>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
