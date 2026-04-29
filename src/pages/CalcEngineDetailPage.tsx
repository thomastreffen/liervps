import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Loader2, Calculator, Trash2, FileText, FileCheck2, AlertTriangle } from "lucide-react";
import { getStatusBadge, formatDateTime } from "@/lib/calc-engine/status-labels";
import { DeleteCalcDialog, type DeleteTarget } from "@/components/calc-engine/DeleteCalcDialog";
import { useActiveOfferForSource } from "@/hooks/useActiveOfferForSource";
import { CommercialCaseHeaderBadge } from "@/components/commercial/CommercialCaseHeaderBadge";
import { CommercialCasePanel } from "@/components/commercial/CommercialCasePanel";
import { toast } from "@/hooks/use-toast";

// Felter som MÅ bekreftes (verdi > 0) før tilbud kan opprettes for v2-pakker
const V2_REQUIRED_KEYS: { key: string; label: string }[] = [
  { key: "tavletilkobling_el1", label: "Tavletilkobling EL1" },
  { key: "kontroll_moment_timer", label: "Kontroll og momenttrekking" },
  { key: "dokumentasjon_hms_timer", label: "Dokumentasjon / HMS" },
  { key: "rigg_oppstart_timer", label: "Rigg / oppstart" },
  { key: "smamateriell_belop", label: "Småmateriell" },
];

function formatNok(n: number): string {
  return new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 }).format(n ?? 0);
}

export default function CalcEngineDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [calc, setCalc] = useState<any>(null);
  const [lines, setLines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const [c, l] = await Promise.all([
        supabase.from("calculations")
          .select("*, calc_packages(name, slug, version), calc_rate_tables(name, version), calc_norm_tables(name, version), calc_cases(id, title)")
          .eq("id", id).maybeSingle(),
        supabase.from("calculation_lines").select("*").eq("calculation_id", id).order("sort_order"),
      ]);
      setCalc(c.data);
      setLines(l.data ?? []);
      setLoading(false);
    })();
  }, [id]);

  const { offerId: activeOfferId, exists: hasOffer } = useActiveOfferForSource("calculation", calc?.id);

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!calc) return <div className="p-8 text-center">Kalkyle ikke funnet.</div>;

  const totals = calc.totals_snapshot ?? {};
  const pkgSlug: string = calc.calc_packages?.slug ?? "";
  const isV2 = pkgSlug === "stromskinne-v2";
  const inputSnap = (calc.input_snapshot ?? {}) as Record<string, any>;
  const missingRequired = isV2
    ? V2_REQUIRED_KEYS.filter(({ key }) => {
        const v = inputSnap[key];
        const n = v == null ? 0 : Number(v);
        return !Number.isFinite(n) || n <= 0;
      })
    : [];
  const canCreateOffer = !isV2 || missingRequired.length === 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(calc.case_id ? `/sales/calc-engine/case/${calc.case_id}` : "/sales/calc-engine")} className="rounded-xl">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          {calc.calc_cases?.title && (
            <button
              type="button"
              onClick={() => navigate(`/sales/calc-engine/case/${calc.case_id}`)}
              className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wide text-primary hover:underline mb-0.5"
            >
              ← Del av kalkylesak: {calc.calc_cases.title}
            </button>
          )}
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight truncate">{calc.project_title}</h1>
          <p className="text-xs text-muted-foreground">
            {calc.customer_name} • Opprettet {formatDateTime(calc.created_at)} • Sist endret {formatDateTime(calc.updated_at)}
            {calc.case_system_key && <> • System <span className="font-mono">{calc.case_system_key}</span></>}
          </p>
        </div>
        <CommercialCaseHeaderBadge caseId={calc.commercial_case_id} />
        {(() => {
          const badge = getStatusBadge("calculation", calc.status);
          return <Badge variant="outline" className={`rounded-lg ${badge.className}`}>{badge.label}</Badge>;
        })()}
        {hasOffer ? (
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl gap-1.5"
            onClick={() => navigate(`/sales/offers/${activeOfferId}`)}
          >
            <FileCheck2 className="h-3.5 w-3.5" /> Åpne tilbud
          </Button>
        ) : (
          <Button
            size="sm"
            className="rounded-xl gap-1.5"
            onClick={() => navigate(`/sales/calc-engine/offer-from-calc?calc=${calc.id}`)}
          >
            <FileText className="h-3.5 w-3.5" /> Opprett tilbud
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
          onClick={() => setDeleteTarget({ kind: "calculation", id: calc.id, label: calc.project_title })}
        >
          <Trash2 className="h-3.5 w-3.5" /> Slett
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5">
        <div className="space-y-5">
          <Card className="p-5 rounded-2xl">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
              <Calculator className="h-4 w-4" /> Kalkylelinjer ({lines.length})
            </h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Beskrivelse</TableHead>
                  <TableHead className="text-right">Antall</TableHead>
                  <TableHead className="text-right">Norm</TableHead>
                  <TableHead className="text-right">Justert</TableHead>
                  <TableHead className="text-right">Salg</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      <div className="font-medium text-sm">{l.description}</div>
                      {l.source_ref && <div className="text-[10px] text-muted-foreground/60">{l.source_ref}</div>}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">{l.qty} {l.unit}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{l.norm_hours} t</TableCell>
                    <TableCell className="text-right font-mono text-xs">{l.adjusted_hours} t</TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold">{formatNok(l.sales_amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-5 rounded-2xl bg-gradient-to-br from-primary-soft/40 to-transparent">
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Salgspris</div>
            <div className="text-3xl font-semibold tracking-tight">kr {formatNok(totals.total_sales)}</div>
            <Separator className="my-4" />
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Normtid</dt><dd className="font-mono">{totals.total_norm_hours ?? 0} t</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Justert</dt><dd className="font-mono">{totals.total_adjusted_hours ?? 0} t</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Kost</dt><dd className="font-mono">kr {formatNok(totals.total_cost)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">DG</dt><dd className="font-mono font-semibold">{totals.margin_pct ?? 0}%</dd></div>
            </dl>
          </Card>

          <Card className="p-4 rounded-2xl text-xs space-y-2">
            <div className="font-semibold uppercase tracking-wide text-muted-foreground">Snapshot</div>
            <div>Pakke: <span className="font-medium">{calc.calc_packages?.name} v{calc.calc_packages?.version}</span></div>
            <div>Sats: <span className="font-medium">{calc.calc_rate_tables?.name} v{calc.calc_rate_tables?.version}</span></div>
            <div>Norm: <span className="font-medium">{calc.calc_norm_tables?.name} v{calc.calc_norm_tables?.version}</span></div>
          </Card>
        </div>
      </div>

      {calc.commercial_case_id && (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Kommersiell sak</h2>
          <CommercialCasePanel caseId={calc.commercial_case_id} />
        </div>
      )}

      <DeleteCalcDialog
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={() => navigate(calc.case_id ? `/sales/calc-engine/case/${calc.case_id}` : "/sales/calc-engine")}
      />

    </div>
  );
}
