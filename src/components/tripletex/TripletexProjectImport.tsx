import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TripletexUploadZone } from "./TripletexUploadZone";
import { ImportStatusBadge } from "./ImportStatusBadge";
import { useTripletexImport, type ImportAction } from "@/hooks/useTripletexImport";
import { CheckCircle2, AlertTriangle, XCircle, FileText, ArrowLeft, ArrowRight, Loader2, RotateCcw } from "lucide-react";

export function TripletexProjectImport() {
  const {
    parsedData, detectedType, fileName, projectRows, step,
    importing, importResult, handleFile, reset,
    updateProjectAction, canConfirm, executeImport, setStep,
  } = useTripletexImport();

  if (step === "upload") {
    return <TripletexUploadZone onFile={handleFile} label="Last opp prosjektfil fra Tripletex" />;
  }

  if (step === "result" && importResult) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Import fullført
          </CardTitle>
          <CardDescription>{fileName}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Opprettet" value={importResult.created} color="text-green-600" />
            <StatCard label="Oppdatert" value={importResult.updated} color="text-blue-600" />
            <StatCard label="Ignorert" value={importResult.ignored} color="text-muted-foreground" />
            <StatCard label="Feilet" value={importResult.failed} color="text-destructive" />
          </div>
          <Button variant="outline" onClick={reset} className="gap-1.5">
            <RotateCcw className="h-4 w-4" /> Ny import
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (detectedType !== "project") {
    return (
      <Card>
        <CardContent className="py-8 text-center space-y-3">
          <AlertTriangle className="h-8 w-8 text-yellow-500 mx-auto" />
          <p className="text-sm text-muted-foreground">
            Filen ble ikke gjenkjent som en prosjektfil. Kontroller at kolonnene stemmer.
          </p>
          <Button variant="outline" onClick={reset}>Prøv igjen</Button>
        </CardContent>
      </Card>
    );
  }

  const summary = {
    match: projectRows.filter(r => r.matchStatus === "match").length,
    new: projectRows.filter(r => r.matchStatus === "new").length,
    needs_review: projectRows.filter(r => r.matchStatus === "needs_review").length,
    error: projectRows.filter(r => r.matchStatus === "error").length,
    ignored: projectRows.filter(r => r.action === "ignore").length,
  };

  return (
    <div className="space-y-4">
      {/* File info */}
      <Card>
        <CardContent className="py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{fileName}</p>
              <p className="text-xs text-muted-foreground">{projectRows.length} rader · Prosjektfil gjenkjent</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={reset}>Bytt fil</Button>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="default">{summary.match} matcher</Badge>
        <Badge variant="secondary">{summary.new} nye</Badge>
        {summary.needs_review > 0 && <Badge variant="outline" className="border-yellow-500 text-yellow-700">{summary.needs_review} trenger avklaring</Badge>}
        {summary.error > 0 && <Badge variant="destructive">{summary.error} feil</Badge>}
        {summary.ignored > 0 && <Badge variant="outline">{summary.ignored} ignoreres</Badge>}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Prosjektnr.</TableHead>
                  <TableHead>Prosjektnavn</TableHead>
                  <TableHead>Kunde</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>Slutt</TableHead>
                  <TableHead>Match</TableHead>
                  <TableHead>Handling</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projectRows.map(row => (
                  <TableRow key={row.idx} className={row.matchStatus === "error" ? "bg-destructive/5" : ""}>
                    <TableCell><ImportStatusBadge status={row.action === "ignore" ? "ignored" : row.matchStatus} /></TableCell>
                    <TableCell className="font-mono text-xs">{row.projectNumber || "—"}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{row.projectName}</TableCell>
                    <TableCell className="text-xs">{row.customerName}</TableCell>
                    <TableCell className="text-xs">{row.startDate || "—"}</TableCell>
                    <TableCell className="text-xs">{row.endDate || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.matchedEntityTitle ? (
                        <span className="text-primary">{row.matchedEntityTitle}</span>
                      ) : row.error ? (
                        <span className="text-destructive">{row.error}</span>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      {row.matchStatus !== "error" && (
                        <Select
                          value={row.action}
                          onValueChange={(v) => updateProjectAction(row.idx, v as ImportAction)}
                        >
                          <SelectTrigger className="h-7 text-xs w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="create">Opprett ny</SelectItem>
                            <SelectItem value="update" disabled={!row.matchedEntityId}>Oppdater</SelectItem>
                            <SelectItem value="ignore">Ignorer</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={reset} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Tilbake
        </Button>
        <div className="flex items-center gap-2">
          {!canConfirm() && (
            <p className="text-xs text-yellow-600">Det finnes poster som trenger avklaring</p>
          )}
          <Button
            onClick={() => step === "preview" ? setStep("confirm") : executeImport()}
            disabled={step === "preview" ? false : importing}
            className="gap-1.5"
          >
            {step === "confirm" && importing ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Importerer...</>
            ) : step === "confirm" ? (
              <><CheckCircle2 className="h-4 w-4" /> Bekreft import</>
            ) : (
              <><ArrowRight className="h-4 w-4" /> Gå videre</>
            )}
          </Button>
        </div>
      </div>

      {step === "confirm" && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-4 space-y-3">
            <p className="text-sm font-medium">Bekreft import</p>
            <p className="text-xs text-muted-foreground">
              {projectRows.filter(r => r.action === "create").length} prosjekter opprettes,{" "}
              {projectRows.filter(r => r.action === "update").length} oppdateres,{" "}
              {projectRows.filter(r => r.action === "ignore").length + projectRows.filter(r => r.matchStatus === "error").length} ignoreres.
            </p>
            <div className="flex gap-2">
              <Button onClick={executeImport} disabled={importing || !canConfirm()} className="gap-1.5">
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {importing ? "Importerer..." : "Kjør import"}
              </Button>
              <Button variant="outline" onClick={() => setStep("preview")} disabled={importing}>Avbryt</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border bg-card p-3 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
