import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, FileSpreadsheet, ArrowLeft, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TripletexUploadZone } from "@/components/tripletex/TripletexUploadZone";
import { toast } from "@/hooks/use-toast";
import {
  WorktimeMapping,
  WorktimeRow,
  applyMapping,
  autoMapHeaders,
  buildSourceHash,
  readWorktimeFile,
} from "@/lib/hms/worktimeImport";

const FIELD_LABELS: Record<keyof WorktimeMapping, string> = {
  employee_name: "Ansattnavn *",
  employee_number: "Ansattnummer",
  employee_email: "E-post",
  date: "Dato *",
  start_time: "Starttid",
  end_time: "Sluttid",
  break_minutes: "Pause (min)",
  ordinary_hours: "Ordinære timer",
  overtime_hours: "Overtidstimer",
  total_hours: "Totaltimer",
  project: "Prosjekt",
  project_number: "Prosjektnummer",
  time_type: "Timeart",
  external_id: "Ekstern linje-ID",
};

export default function HmsWorktimeImportPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { activeCompanyId } = useCompanyContext();
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<WorktimeMapping>({});
  const [step, setStep] = useState<"upload" | "map" | "preview" | "done">("upload");
  const [result, setResult] = useState<any>(null);

  const { data: people } = useQuery({
    queryKey: ["company-people", activeCompanyId],
    enabled: !!activeCompanyId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("user_accounts")
        .select("id, full_name, email")
        .eq("is_active", true);
      return (data ?? []) as { id: string; full_name: string | null; email: string | null }[];
    },
  });

  const parsedRows = useMemo<WorktimeRow[]>(() => {
    if (!mapping.employee_name || !mapping.date) return [];
    return applyMapping(rawRows, mapping);
  }, [rawRows, mapping]);

  const matched = useMemo(() => {
    if (!people) return parsedRows.map((r) => ({ row: r, user_id: null as string | null }));
    return parsedRows.map((r) => {
      const nameLower = r.employee_name.toLowerCase().trim();
      const emailLower = r.employee_email?.toLowerCase().trim();
      const found = people.find(
        (p) =>
          (emailLower && p.email?.toLowerCase() === emailLower) ||
          (p.full_name && p.full_name.toLowerCase().trim() === nameLower)
      );
      return { row: r, user_id: found?.id ?? null };
    });
  }, [parsedRows, people]);

  const unmatched = matched.filter((m) => !m.user_id);

  async function handleFile(f: File) {
    setFile(f);
    try {
      const { headers, rows } = await readWorktimeFile(f);
      setHeaders(headers);
      setRawRows(rows);
      setMapping(autoMapHeaders(headers));
      setStep("map");
    } catch (e) {
      toast({ title: "Feil ved lesing", description: String(e), variant: "destructive" });
    }
  }

  const importMut = useMutation({
    mutationFn: async () => {
      if (!activeCompanyId) throw new Error("Ingen aktivt selskap");
      const sb = supabase as any;
      const { data: batch, error: bErr } = await sb
        .from("worktime_import_batches")
        .insert({
          company_id: activeCompanyId,
          source_system: "tripletex",
          filename: file?.name ?? null,
          status: "processing",
          total_rows: parsedRows.length,
          mapping,
        })
        .select("id")
        .single();
      if (bErr) throw bErr;

      let inserted = 0;
      let updated = 0;
      let skipped = 0;
      let unmatchedCount = 0;

      for (const m of matched) {
        const r = m.row;
        if (!m.user_id) {
          unmatchedCount++;
          continue;
        }
        const hash = await buildSourceHash([
          activeCompanyId,
          m.user_id,
          r.work_date,
          r.start_at,
          r.end_at,
          r.ordinary_hours,
          r.hours_overtime,
          r.total_hours,
          r.project_number_raw,
          r.time_type,
        ]);

        const payload: any = {
          company_id: activeCompanyId,
          user_id: m.user_id,
          external_employee_id: r.employee_number ?? null,
          employee_name: r.employee_name,
          work_date: r.work_date,
          start_at: r.start_at ?? null,
          end_at: r.end_at ?? null,
          break_minutes: Math.round(r.break_minutes),
          ordinary_hours: r.ordinary_hours,
          hours_overtime: r.hours_overtime,
          total_hours: r.total_hours,
          hours: r.total_hours,
          project_number_raw: r.project_number_raw ?? null,
          time_type: r.time_type ?? null,
          source_system: "tripletex",
          source_external_id: r.source_external_id || null,
          source_hash: hash,
          batch_id: batch.id,
          raw_payload: r.raw,
          status: "imported",
        };

        // Try by external id first, else hash
        let existing: any = null;
        if (r.source_external_id) {
          const { data } = await sb
            .from("worktime_entries")
            .select("id")
            .eq("source_system", "tripletex")
            .eq("source_external_id", r.source_external_id)
            .maybeSingle();
          existing = data;
        }
        if (!existing) {
          const { data } = await sb
            .from("worktime_entries")
            .select("id")
            .eq("company_id", activeCompanyId)
            .eq("source_hash", hash)
            .maybeSingle();
          existing = data;
        }

        if (existing) {
          const { error } = await sb.from("worktime_entries").update(payload).eq("id", existing.id);
          if (error) skipped++;
          else updated++;
        } else {
          const { error } = await sb.from("worktime_entries").insert(payload);
          if (error) skipped++;
          else inserted++;
        }
      }

      await sb
        .from("worktime_import_batches")
        .update({
          status: "done",
          new_rows: inserted,
          updated_rows: updated,
          skipped_rows: skipped + unmatchedCount,
          finished_at: new Date().toISOString(),
        })
        .eq("id", batch.id);

      const { data: aml } = await sb.functions.invoke("worktime-aml-evaluate", {
        body: { company_id: activeCompanyId, batch_id: batch.id },
      });

      return { batch_id: batch.id, inserted, updated, skipped, unmatched: unmatchedCount, aml };
    },
    onSuccess: (r) => {
      setResult(r);
      setStep("done");
      qc.invalidateQueries({ queryKey: ["hms-aml"] });
      toast({ title: "Import fullført", description: `${r.inserted} nye, ${r.updated} oppdatert` });
    },
    onError: (e: any) => {
      toast({ title: "Import feilet", description: String(e.message || e), variant: "destructive" });
    },
  });

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/hms")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Importer arbeidstid</h1>
          <p className="text-sm text-muted-foreground">
            Tripletex Excel/CSV → matching → AML-motor
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs">
        {(["upload", "map", "preview", "done"] as const).map((s, i) => (
          <Badge key={s} variant={step === s ? "default" : "outline"}>
            {i + 1}. {s === "upload" ? "Last opp" : s === "map" ? "Mapping" : s === "preview" ? "Forhåndsvis" : "Ferdig"}
          </Badge>
        ))}
      </div>

      {step === "upload" && (
        <TripletexUploadZone onFile={handleFile} label="Slipp Tripletex timefil her" />
      )}

      {step === "map" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" /> Kolonnemapping ({rawRows.length} rader)
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(Object.keys(FIELD_LABELS) as (keyof WorktimeMapping)[]).map((f) => (
              <div key={f} className="space-y-1">
                <Label className="text-xs">{FIELD_LABELS[f]}</Label>
                <Select
                  value={mapping[f] ?? "__none__"}
                  onValueChange={(v) =>
                    setMapping((m) => ({ ...m, [f]: v === "__none__" ? undefined : v }))
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Velg kolonne" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— ingen —</SelectItem>
                    {headers.map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
            <div className="col-span-full flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setStep("upload")}>
                Tilbake
              </Button>
              <Button
                disabled={!mapping.employee_name || !mapping.date}
                onClick={() => setStep("preview")}
              >
                Forhåndsvis
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "preview" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Forhåndsvisning – {matched.length} linjer ({unmatched.length} ikke matchet)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Ansatt</TableHead>
                    <TableHead>Dato</TableHead>
                    <TableHead className="text-right">Ord</TableHead>
                    <TableHead className="text-right">OT</TableHead>
                    <TableHead className="text-right">Sum</TableHead>
                    <TableHead>Prosjekt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matched.slice(0, 100).map((m, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        {m.user_id ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-amber-500" />
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{m.row.employee_name}</TableCell>
                      <TableCell className="text-xs">{m.row.work_date}</TableCell>
                      <TableCell className="text-right text-xs">{m.row.ordinary_hours}</TableCell>
                      <TableCell className="text-right text-xs">{m.row.hours_overtime}</TableCell>
                      <TableCell className="text-right text-xs font-medium">
                        {m.row.total_hours}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {m.row.project_label || m.row.project_number_raw || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {matched.length > 100 && (
                <p className="text-xs text-muted-foreground mt-2">
                  Viser første 100 av {matched.length} linjer.
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="ghost" onClick={() => setStep("map")}>
                Tilbake
              </Button>
              <Button onClick={() => importMut.mutate()} disabled={importMut.isPending}>
                {importMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Importer & kjør AML
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "done" && result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" /> Import fullført
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>Nye linjer: <strong>{result.inserted}</strong></div>
            <div>Oppdaterte linjer: <strong>{result.updated}</strong></div>
            <div>Hoppet over: <strong>{result.skipped}</strong></div>
            <div>Ikke matchet ansatt: <strong>{result.unmatched}</strong></div>
            {result.aml && (
              <div className="pt-2 border-t mt-2">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                  AML-motor
                </div>
                <div>Ansatte evaluert: <strong>{result.aml.users_evaluated}</strong></div>
                <div>Nye varsler: <strong>{result.aml.new_alerts}</strong></div>
                <div>Auto-løste varsler: <strong>{result.aml.resolved_alerts}</strong></div>
              </div>
            )}
            <div className="flex gap-2 pt-3">
              <Button variant="outline" onClick={() => { setStep("upload"); setFile(null); setRawRows([]); setHeaders([]); setMapping({}); }}>
                Ny import
              </Button>
              <Button onClick={() => navigate("/hms/aml")}>Gå til AML-status</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
