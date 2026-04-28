import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCalcPackageBundle } from "@/hooks/useCalcPackages";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { useAuth } from "@/hooks/useAuth";
import { getEvaluator } from "@/lib/calc-engine/registry";
import type { CalcResult, PackageField } from "@/lib/calc-engine/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Loader2, Save, Calculator } from "lucide-react";
import { toast } from "@/hooks/use-toast";

function formatNok(n: number): string {
  return new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 }).format(n);
}

function FieldRenderer({
  field, value, onChange,
}: { field: PackageField; value: any; onChange: (v: any) => void }) {
  switch (field.field_type) {
    case "number":
    case "percent":
      return (
        <Input
          type="number"
          inputMode="decimal"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          className="rounded-xl"
          placeholder="0"
        />
      );
    case "boolean":
      return (
        <div className="flex items-center h-10">
          <Switch checked={!!value} onCheckedChange={onChange} />
        </div>
      );
    case "select":
      return (
        <Select value={String(value ?? "")} onValueChange={onChange}>
          <SelectTrigger className="rounded-xl"><SelectValue placeholder="Velg…" /></SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "date":
      return (
        <Input type="date" value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="rounded-xl" />
      );
    default:
      return (
        <Input
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="rounded-xl"
        />
      );
  }
}

export default function CalcEngineEditorPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const packageId = params.get("package");
  const { user } = useAuth();
  const { activeCompanyId } = useCompanyContext();
  const { pkg, fields, rateTables, normTables, loading } = useCalcPackageBundle(packageId);

  const [inputState, setInputState] = useState<Record<string, any>>({});
  const [title, setTitle] = useState("");
  const [customer, setCustomer] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedRateId, setSelectedRateId] = useState<string | null>(null);
  const [selectedNormId, setSelectedNormId] = useState<string | null>(null);

  // Init defaults når felter lastes
  useEffect(() => {
    if (!fields.length) return;
    const init: Record<string, any> = {};
    for (const f of fields) {
      init[f.field_key] = f.default_value;
    }
    setInputState(init);
  }, [fields.length]);

  // Default rate/norm = nyeste (allerede sortert desc i hooken)
  useEffect(() => {
    if (rateTables.length && !selectedRateId) setSelectedRateId(rateTables[0].id);
  }, [rateTables, selectedRateId]);
  useEffect(() => {
    if (normTables.length && !selectedNormId) {
      // Velg normtabell som matcher valgt strømklasse, om mulig
      const klasse = inputState.stromklasse;
      const match = klasse
        ? normTables.find(t => (t.rows[0]?.context as any)?.stromklasse === klasse)
        : null;
      setSelectedNormId((match ?? normTables[0]).id);
    }
  }, [normTables, inputState.stromklasse, selectedNormId]);

  // Auto-bytt normtabell når strømklasse endres
  useEffect(() => {
    const klasse = inputState.stromklasse;
    if (!klasse || !normTables.length) return;
    const match = normTables.find(t => (t.rows[0]?.context as any)?.stromklasse === klasse);
    if (match && match.id !== selectedNormId) setSelectedNormId(match.id);
  }, [inputState.stromklasse, normTables]);

  const sections = useMemo(() => {
    const map = new Map<string, PackageField[]>();
    for (const f of fields) {
      if (!map.has(f.section_key)) map.set(f.section_key, []);
      map.get(f.section_key)!.push(f);
    }
    return Array.from(map.entries()).map(([key, fs]) => {
      const def = pkg?.default_sections?.find((s) => s.key === key);
      return { key, label: def?.label ?? key, sort: def?.sort ?? 99, fields: fs };
    }).sort((a, b) => a.sort - b.sort);
  }, [fields, pkg]);

  const result: CalcResult | null = useMemo(() => {
    if (!pkg || !selectedRateId || !selectedNormId) return null;
    const evaluator = getEvaluator(pkg.slug);
    if (!evaluator) return null;
    const rate = rateTables.find(r => r.id === selectedRateId);
    const norm = normTables.find(n => n.id === selectedNormId);
    if (!rate || !norm) return null;
    try {
      return evaluator({ input: inputState, rateTable: rate, normTable: norm });
    } catch (e) {
      console.error("Calc evaluator error", e);
      return null;
    }
  }, [pkg, selectedRateId, selectedNormId, rateTables, normTables, inputState]);

  const handleSave = async () => {
    if (!user || !pkg || !result) return;
    if (!title.trim() || !customer.trim()) {
      toast({ title: "Mangler felt", description: "Fyll inn prosjekttittel og kunde.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const totals = result.totals;
      const { data: calc, error } = await supabase
        .from("calculations")
        .insert({
          customer_name: customer.trim(),
          project_title: title.trim(),
          status: "draft",
          created_by: user.id,
          company_id: activeCompanyId,
          package_id: pkg.id,
          rate_table_id: selectedRateId,
          norm_table_id: selectedNormId,
          input_snapshot: inputState,
          totals_snapshot: totals as any,
          total_labor: totals.total_cost,
          total_material: 0,
          total_price: totals.total_sales,
        })
        .select("id")
        .single();
      if (error) throw error;

      // Lag linjer
      const lineRows = result.lines.map((l, i) => ({
        calculation_id: calc.id,
        line_key: l.line_key ?? null,
        source_type: l.source_type,
        source_ref: l.source_ref ?? null,
        description: l.description,
        qty: l.qty,
        unit: l.unit ?? null,
        norm_hours: l.norm_hours,
        adjusted_hours: l.adjusted_hours,
        cost_amount: l.cost_amount,
        sales_amount: l.sales_amount,
        is_internal_only: l.is_internal_only,
        metadata: (l.metadata ?? {}) as any,
        sort_order: i,
      }));
      if (lineRows.length) {
        const { error: lineErr } = await supabase.from("calculation_lines").insert(lineRows);
        if (lineErr) throw lineErr;
      }

      toast({ title: "Kalkyle lagret", description: `${title} er lagret som utkast.` });
      navigate(`/sales/calc-engine/${calc.id}`);
    } catch (e: any) {
      console.error(e);
      toast({ title: "Feil ved lagring", description: e.message ?? String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!packageId) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Mangler pakke. <Button variant="link" onClick={() => navigate("/sales/calc-engine/new")}>Velg pakke</Button>
      </div>
    );
  }

  if (loading || !pkg) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <Button variant="ghost" size="icon" onClick={() => navigate("/sales/calc-engine/new")} className="rounded-xl">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight truncate">{pkg.name}</h1>
          <p className="text-xs text-muted-foreground">
            v{pkg.version} • Sats: {rateTables.find(r => r.id === selectedRateId)?.name ?? "—"} • Norm: {normTables.find(n => n.id === selectedNormId)?.name ?? "—"}
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving || !result} className="gap-1.5 rounded-xl">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Lagre kalkyle
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
        {/* VENSTRE: input */}
        <div className="space-y-5">
          <Card className="p-5 rounded-2xl space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Prosjekttittel *</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} className="rounded-xl" placeholder="F.eks. Moss Industri – ny strømskinne" />
              </div>
              <div className="space-y-1.5">
                <Label>Kunde *</Label>
                <Input value={customer} onChange={(e) => setCustomer(e.target.value)} className="rounded-xl" placeholder="Kundenavn" />
              </div>
            </div>
          </Card>

          {sections.map((sec) => (
            <Card key={sec.key} className="p-5 rounded-2xl">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
                {sec.label}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {sec.fields.map((f) => (
                  <div key={f.id} className="space-y-1.5">
                    <Label className="flex items-center gap-1">
                      {f.label}
                      {f.unit && <span className="text-xs text-muted-foreground">({f.unit})</span>}
                      {f.is_required && <span className="text-destructive">*</span>}
                    </Label>
                    <FieldRenderer
                      field={f}
                      value={inputState[f.field_key]}
                      onChange={(v) => setInputState(s => ({ ...s, [f.field_key]: v }))}
                    />
                    {f.help_text && <p className="text-[11px] text-muted-foreground/70">{f.help_text}</p>}
                  </div>
                ))}
              </div>
            </Card>
          ))}

          {/* Linjetabell */}
          <Card className="p-5 rounded-2xl">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
              <Calculator className="h-4 w-4" /> Kalkylelinjer
            </h3>
            {result?.lines.length ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Beskrivelse</TableHead>
                      <TableHead className="text-right">Antall</TableHead>
                      <TableHead className="text-right">Norm</TableHead>
                      <TableHead className="text-right">Justert</TableHead>
                      <TableHead className="text-right">Kost</TableHead>
                      <TableHead className="text-right">Salg</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.lines.map((l, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <div className="font-medium text-sm">{l.description}</div>
                          {l.source_ref && <div className="text-[10px] text-muted-foreground/60">{l.source_ref}</div>}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">{l.qty} {l.unit}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{l.norm_hours} t</TableCell>
                        <TableCell className="text-right font-mono text-xs">{l.adjusted_hours} t</TableCell>
                        <TableCell className="text-right font-mono text-xs">{formatNok(l.cost_amount)}</TableCell>
                        <TableCell className="text-right font-mono text-sm font-semibold">{formatNok(l.sales_amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                Fyll inn mengder for å generere kalkylelinjer.
              </p>
            )}
          </Card>
        </div>

        {/* HØYRE: live resultatpanel */}
        <div className="lg:sticky lg:top-4 lg:self-start space-y-4">
          <Card className="p-5 rounded-2xl bg-gradient-to-br from-primary-soft/40 to-transparent">
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Salgspris</div>
            <div className="text-3xl font-semibold tracking-tight">
              kr {formatNok(result?.totals.total_sales ?? 0)}
            </div>
            <Separator className="my-4" />
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Total normtid</dt><dd className="font-mono">{result?.totals.total_norm_hours ?? 0} t</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Justert tid</dt><dd className="font-mono">{result?.totals.total_adjusted_hours ?? 0} t</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Intern kost</dt><dd className="font-mono">kr {formatNok(result?.totals.total_cost ?? 0)}</dd></div>
              <Separator className="my-1" />
              <div className="flex justify-between"><dt className="text-muted-foreground">Dekningsbidrag</dt><dd className="font-mono font-semibold">kr {formatNok(result?.totals.margin_amount ?? 0)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Dekningsgrad</dt><dd className="font-mono font-semibold">{result?.totals.margin_pct ?? 0} %</dd></div>
            </dl>
          </Card>

          {result && result.totals.applied_factors.length > 0 && (
            <Card className="p-4 rounded-2xl">
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Aktive justeringer</div>
              <div className="flex flex-wrap gap-1.5">
                {result.totals.applied_factors.map((f) => (
                  <Badge key={f.key} variant="outline" className="rounded-lg text-[10px]">
                    {f.label} +{Math.round(f.value * 100)}%
                  </Badge>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
