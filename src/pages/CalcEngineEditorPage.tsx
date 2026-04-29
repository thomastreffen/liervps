import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCalcPackageBundle } from "@/hooks/useCalcPackages";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { useAuth } from "@/hooks/useAuth";
import { getEvaluator } from "@/lib/calc-engine/registry";
import type { CalcResult, PackageField } from "@/lib/calc-engine/types";
import { suggestProjectTitle } from "@/lib/calc-engine/display";

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
import { ArrowLeft, Loader2, Calculator, Cloud, CloudOff, Check, ExternalLink } from "lucide-react";
import { toast } from "@/hooks/use-toast";

function formatNok(n: number): string {
  return new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 }).format(n);
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" });
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

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

const AUTOSAVE_DEBOUNCE_MS = 1200;
const PLACEHOLDER_TITLE = "Uten navn (utkast)";
const PLACEHOLDER_CUSTOMER = "Ikke angitt";

export default function CalcEngineEditorPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const packageId = params.get("package");
  const fromDraftId = params.get("from_draft");
  const editCalculationId = params.get("calculation");
  const systemIndex = Number(params.get("system") ?? "0");
  const { user } = useAuth();
  const { activeCompanyId } = useCompanyContext();
  const { pkg, fields, rateTables, normTables, baselineProfiles, loading } = useCalcPackageBundle(packageId);

  const [inputState, setInputState] = useState<Record<string, any>>({});
  const [title, setTitle] = useState("");
  const [customer, setCustomer] = useState("");
  const [selectedRateId, setSelectedRateId] = useState<string | null>(null);
  const [selectedNormId, setSelectedNormId] = useState<string | null>(null);
  const [aiPrefilledKeys, setAiPrefilledKeys] = useState<Set<string>>(new Set());

  // Persistens-state
  const [calculationId, setCalculationId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const initRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef<Promise<void> | null>(null);

  // ==== INIT: hent eksisterende kalkyle hvis draft.applied_calculation_id finnes,
  // ellers init defaults og evt. AI-prefill ====
  useEffect(() => {
    if (!fields.length || initRef.current) return;
    initRef.current = true;

    (async () => {
      // 0) Direkte redigering av eksisterende kalkyle (?calculation=<id>)
      if (editCalculationId) {
        const { data: calc } = await supabase
          .from("calculations")
          .select("id, project_title, customer_name, input_snapshot, rate_table_id, norm_table_id, deleted_at")
          .eq("id", editCalculationId)
          .maybeSingle();

        if (calc && !calc.deleted_at) {
          setCalculationId(calc.id);
          setTitle(calc.project_title === PLACEHOLDER_TITLE ? "" : (calc.project_title ?? ""));
          setCustomer(calc.customer_name === PLACEHOLDER_CUSTOMER ? "" : (calc.customer_name ?? ""));
          const init: Record<string, any> = {};
          for (const f of fields) init[f.field_key] = f.default_value;
          setInputState({ ...init, ...((calc.input_snapshot as any) ?? {}) });
          if (calc.rate_table_id) setSelectedRateId(calc.rate_table_id);
          if (calc.norm_table_id) setSelectedNormId(calc.norm_table_id);
          setLastSavedAt(new Date());
          setSaveState("saved");
          setHydrated(true);
          return;
        }
        // Hvis kalkylen ikke finnes / er slettet, fall through til defaults
      }

      // 1) Hvis draft har en allerede koblet kalkyle for DETTE systemet, gjenopprett den
      if (fromDraftId) {
        const { data: draft } = await supabase
          .from("calc_ai_drafts")
          .select("ai_proposed_input, ai_proposed_lines, initial_description, applied_calculation_id, system_calculation_map")
          .eq("id", fromDraftId)
          .maybeSingle();

        const sysMap = (draft?.system_calculation_map ?? {}) as Record<string, string>;
        const existingForSystem = sysMap[String(systemIndex)]
          ?? (systemIndex === 0 ? draft?.applied_calculation_id ?? null : null);

        if (existingForSystem) {
          const { data: calc } = await supabase
            .from("calculations")
            .select("id, project_title, customer_name, input_snapshot, rate_table_id, norm_table_id, deleted_at")
            .eq("id", existingForSystem)
            .maybeSingle();

          if (calc && !calc.deleted_at) {
            setCalculationId(calc.id);
            setTitle(calc.project_title === PLACEHOLDER_TITLE ? "" : calc.project_title);
            setCustomer(calc.customer_name === PLACEHOLDER_CUSTOMER ? "" : calc.customer_name);
            const init: Record<string, any> = {};
            for (const f of fields) init[f.field_key] = f.default_value;
            setInputState({ ...init, ...(calc.input_snapshot as any) });
            if (calc.rate_table_id) setSelectedRateId(calc.rate_table_id);
            if (calc.norm_table_id) setSelectedNormId(calc.norm_table_id);
            setLastSavedAt(new Date());
            setSaveState("saved");
            setHydrated(true);
            return;
          }
        }

        // 2) Ny editor-økt fra AI-review: bruk AI-forslag
        const init: Record<string, any> = {};
        for (const f of fields) init[f.field_key] = f.default_value;
        const systems = Array.isArray(draft?.ai_proposed_lines) ? (draft!.ai_proposed_lines as any[]) : [];
        const sys = systems[systemIndex];
        const proposed = (sys?.proposed_input ?? draft?.ai_proposed_input ?? {}) as Record<string, { value: any }>;
        const prefilled = new Set<string>();
        for (const [k, v] of Object.entries(proposed)) {
          if (k in init && v?.value !== undefined && v.value !== null) {
            init[k] = v.value;
            prefilled.add(k);
          }
        }
        setInputState(init);
        setAiPrefilledKeys(prefilled);
        // Smart tittelforslag: Pakke — System (Leverandør, klasse, lengde)
        setTitle(suggestProjectTitle({
          packageName: pkg?.name,
          systemName: sys?.name,
          initialDescription: draft?.initial_description,
          inputs: init,
          fields,
        }));
        setHydrated(true);
        return;
      }

      // 3) Helt ny kalkyle uten draft
      const init: Record<string, any> = {};
      for (const f of fields) init[f.field_key] = f.default_value;
      setInputState(init);
      setHydrated(true);
    })();
  }, [fields, fromDraftId, systemIndex, editCalculationId]);

  // Default rate/norm = nyeste
  useEffect(() => {
    if (rateTables.length && !selectedRateId) setSelectedRateId(rateTables[0].id);
  }, [rateTables, selectedRateId]);
  useEffect(() => {
    if (normTables.length && !selectedNormId) {
      const klasse = inputState.stromklasse;
      const match = klasse
        ? normTables.find(t => (t.rows[0]?.context as any)?.stromklasse === klasse)
        : null;
      setSelectedNormId((match ?? normTables[0]).id);
    }
  }, [normTables, inputState.stromklasse, selectedNormId]);

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
      return evaluator({ input: inputState, rateTable: rate, normTable: norm, baselineProfiles });
    } catch (e) {
      console.error("Calc evaluator error", e);
      return null;
    }
  }, [pkg, selectedRateId, selectedNormId, rateTables, normTables, inputState, baselineProfiles]);

  // ==== AUTOSAVE ====
  const performSave = useCallback(async () => {
    if (!user || !pkg || !selectedRateId || !selectedNormId) return;
    setSaveState("saving");
    try {
      const totals = result?.totals;
      const lines = result?.lines ?? [];

      // Bestem case_id + system_key (kun ved AI-draft med 2+ systemer)
      let caseId: string | null = null;
      let systemKey: string | null = null;

      if (fromDraftId && !calculationId) {
        const { data: d0 } = await supabase
          .from("calc_ai_drafts")
          .select("ai_proposed_lines, initial_description, case_id")
          .eq("id", fromDraftId)
          .maybeSingle();
        const systems = Array.isArray(d0?.ai_proposed_lines) ? (d0!.ai_proposed_lines as any[]) : [];
        const totalSystems = systems.length;
        const sys = systems[systemIndex];
        systemKey = sys?.name ?? sys?.system_key ?? null;

        if (totalSystems >= 2) {
          // Gjenbruk eksisterende case eller opprett ny
          caseId = (d0 as any)?.case_id ?? null;
          if (!caseId) {
            const caseTitle = (d0?.initial_description ?? "").split(/[.\n]/)[0].slice(0, 80).trim()
              || pkg.name
              || "Kalkylesak";
            const { data: caseRow, error: caseErr } = await supabase
              .from("calc_cases")
              .insert({
                title: caseTitle,
                customer_name: customer.trim() || null,
                description: d0?.initial_description ?? null,
                source_draft_id: fromDraftId,
                company_id: activeCompanyId,
                created_by: user.id,
                status: "draft",
              })
              .select("id")
              .single();
            if (caseErr) throw caseErr;
            caseId = caseRow.id;
            await supabase.from("calc_ai_drafts").update({ case_id: caseId } as any).eq("id", fromDraftId);
          }
        }
      } else if (calculationId) {
        // Ved oppdatering: behold eksisterende case-kobling
        const { data: existing } = await supabase
          .from("calculations")
          .select("case_id, case_system_key")
          .eq("id", calculationId)
          .maybeSingle();
        caseId = (existing as any)?.case_id ?? null;
        systemKey = (existing as any)?.case_system_key ?? null;
      }

      const payload = {
        customer_name: customer.trim() || PLACEHOLDER_CUSTOMER,
        project_title: title.trim() || PLACEHOLDER_TITLE,
        status: "draft" as const,
        package_id: pkg.id,
        rate_table_id: selectedRateId,
        norm_table_id: selectedNormId,
        input_snapshot: inputState,
        totals_snapshot: (totals ?? {}) as any,
        total_labor: totals?.total_cost ?? 0,
        total_material: 0,
        total_price: totals?.total_sales ?? 0,
        case_id: caseId,
        case_system_key: systemKey,
        case_sort_order: systemIndex,
      };

      let calcId = calculationId;

      if (!calcId) {
        const { data, error } = await supabase
          .from("calculations")
          .insert({
            ...payload,
            created_by: user.id,
            company_id: activeCompanyId,
          })
          .select("id")
          .single();
        if (error) throw error;
        calcId = data.id;
        setCalculationId(calcId);

        if (fromDraftId) {
          // Hent gjeldende map + systems for å oppdatere uten å overskrive andre systemer
          const { data: d2 } = await supabase
            .from("calc_ai_drafts")
            .select("system_calculation_map, ai_proposed_lines")
            .eq("id", fromDraftId)
            .maybeSingle();
          const currentMap = ((d2?.system_calculation_map ?? {}) as Record<string, string>);
          const newMap = { ...currentMap, [String(systemIndex)]: calcId! };
          const totalSystems = Array.isArray(d2?.ai_proposed_lines) ? (d2!.ai_proposed_lines as any[]).length : 1;
          const allApplied = Object.keys(newMap).length >= Math.max(totalSystems, 1);

          await supabase.from("calc_ai_drafts")
            .update({
              system_calculation_map: newMap as any,
              // Behold første system som applied_calculation_id for bakoverkompatibilitet
              applied_calculation_id: newMap["0"] ?? calcId!,
              status: allApplied ? "applied" : "ready",
              applied_at: allApplied ? new Date().toISOString() : null,
            })
            .eq("id", fromDraftId);
        }
      } else {
        const { error } = await supabase
          .from("calculations")
          .update(payload)
          .eq("id", calcId);
        if (error) throw error;
      }

      // Erstatt linjer (delete + insert) — enkelt og deterministisk
      await supabase.from("calculation_lines").delete().eq("calculation_id", calcId);
      if (lines.length) {
        const lineRows = lines.map((l, i) => ({
          calculation_id: calcId!,
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
        const { error: lineErr } = await supabase.from("calculation_lines").insert(lineRows);
        if (lineErr) throw lineErr;
      }

      setLastSavedAt(new Date());
      setSaveState("saved");
    } catch (e: any) {
      console.error("[autosave] failed", e);
      setSaveState("error");
      toast({
        title: "Autosave feilet",
        description: e?.message ?? "Kunne ikke lagre utkast. Prøver igjen ved neste endring.",
        variant: "destructive",
      });
    }
  }, [user, pkg, selectedRateId, selectedNormId, result, customer, title, inputState, calculationId, activeCompanyId, fromDraftId]);

  // Avgjør om vi har "meningsfullt innhold" — ellers utsetter vi første INSERT
  const hasMeaningfulContent = useMemo(() => {
    if (calculationId) return true; // allerede lagret — fortsett autosave
    if (fromDraftId) return true; // AI-flow skal alltid spore til draft
    const sales = Number(result?.totals?.total_sales ?? 0);
    const cost = Number(result?.totals?.total_cost ?? 0);
    const hasLines = (result?.lines?.length ?? 0) > 0 && (sales > 0 || cost > 0);
    const hasTitle = title.trim().length > 0;
    const hasCustomer = customer.trim().length > 0;
    // Krever enten faktiske linjer med verdi, eller at bruker har skrevet tittel/kunde
    return hasLines || hasTitle || hasCustomer;
  }, [calculationId, fromDraftId, result, title, customer]);

  // Trigger debounced autosave når data endres (etter hydrering)
  useEffect(() => {
    if (!hydrated || !pkg || !selectedRateId || !selectedNormId) return;
    if (!hasMeaningfulContent) {
      setSaveState("idle");
      return;
    }
    setSaveState((s) => (s === "saving" ? s : "dirty"));
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      // Sekvensielt — vent på evt. pågående
      const run = async () => {
        if (inFlightRef.current) await inFlightRef.current;
        const p = performSave();
        inFlightRef.current = p.then(() => {});
        await inFlightRef.current;
        inFlightRef.current = null;
      };
      run();
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, title, customer, inputState, selectedRateId, selectedNormId, hasMeaningfulContent]);

  // Advarsel ved navigasjon vekk hvis dirty/saving
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (saveState === "dirty" || saveState === "saving") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [saveState]);

  // ==== Navigasjon ====
  const handleBack = () => {
    if (fromDraftId) {
      navigate(`/sales/calc-engine/ai-review/${fromDraftId}`);
    } else {
      navigate("/sales/calc-engine");
    }
  };

  const handleOpenSaved = async () => {
    // Tving en synkron save før åpning
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (inFlightRef.current) await inFlightRef.current;
    if (saveState !== "saved") {
      const p = performSave();
      inFlightRef.current = p.then(() => {});
      await inFlightRef.current;
      inFlightRef.current = null;
    }
    if (calculationId) {
      navigate(`/sales/calc-engine/${calculationId}`);
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

  const SaveStatus = () => {
    if (saveState === "saving") {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Lagrer…
        </span>
      );
    }
    if (saveState === "dirty") {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
          <Cloud className="h-3.5 w-3.5" /> Ulagrede endringer
        </span>
      );
    }
    if (saveState === "error") {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-destructive">
          <CloudOff className="h-3.5 w-3.5" /> Lagring feilet
        </span>
      );
    }
    if (saveState === "saved" && lastSavedAt) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
          <Check className="h-3.5 w-3.5" /> Utkast lagret kl {formatTime(lastSavedAt)}
        </span>
      );
    }
    return <span className="text-xs text-muted-foreground">Klar</span>;
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <Button variant="ghost" size="icon" onClick={handleBack} className="rounded-xl" title={fromDraftId ? "Tilbake til AI-review" : "Tilbake"}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight truncate">{pkg.name}</h1>
          <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
            <span>v{pkg.version} • Sats: {rateTables.find(r => r.id === selectedRateId)?.name ?? "—"} • Norm: {normTables.find(n => n.id === selectedNormId)?.name ?? "—"}</span>
            <span aria-hidden>·</span>
            <SaveStatus />
          </div>
        </div>
        <Button onClick={handleOpenSaved} disabled={!calculationId && saveState !== "saved"} variant="outline" className="gap-1.5 rounded-xl">
          <ExternalLink className="h-4 w-4" />
          Åpne kalkyle
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
        {/* VENSTRE: input */}
        <div className="space-y-5">
          <Card className="p-5 rounded-2xl space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Prosjekttittel</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} className="rounded-xl" placeholder="F.eks. Moss Industri – ny strømskinne" />
              </div>
              <div className="space-y-1.5">
                <Label>Kunde</Label>
                <Input value={customer} onChange={(e) => setCustomer(e.target.value)} className="rounded-xl" placeholder="Kundenavn" />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Utkastet lagres automatisk. Du kan fortsette senere uten å miste data.
            </p>
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
                      {aiPrefilledKeys.has(f.field_key) && (
                        <Badge variant="outline" className="rounded-md text-[9px] ml-1 px-1 py-0">AI</Badge>
                      )}
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
                    {result.lines.map((l, i) => {
                      const meta = (l.metadata ?? {}) as Record<string, any>;
                      const driverKey = meta.input_key ?? l.line_key;
                      let badge: { label: string; cls: string } | null = null;
                      if (l.source_type === "manual") {
                        badge = { label: "Manuelt", cls: "border-primary/40 text-primary" };
                      } else if (l.source_type === "adjustment") {
                        badge = { label: "Justering", cls: "border-amber-500/40 text-amber-600 dark:text-amber-400" };
                      } else if (driverKey && aiPrefilledKeys.has(driverKey)) {
                        badge = { label: "AI", cls: "border-violet-500/40 text-violet-600 dark:text-violet-400" };
                      } else {
                        badge = { label: "Beregnet", cls: "border-border text-muted-foreground" };
                      }
                      return (
                        <TableRow key={i}>
                          <TableCell>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{l.description}</span>
                              {badge && (
                                <Badge variant="outline" className={`rounded-md text-[9px] px-1.5 py-0 ${badge.cls}`}>
                                  {badge.label}
                                </Badge>
                              )}
                            </div>
                            {l.source_ref && <div className="text-[10px] text-muted-foreground/60">{l.source_ref}</div>}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">{l.qty} {l.unit}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{l.norm_hours} t</TableCell>
                          <TableCell className="text-right font-mono text-xs">{l.adjusted_hours} t</TableCell>
                          <TableCell className="text-right font-mono text-xs">{formatNok(l.cost_amount)}</TableCell>
                          <TableCell className="text-right font-mono text-sm font-semibold">{formatNok(l.sales_amount)}</TableCell>
                        </TableRow>
                      );
                    })}
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
