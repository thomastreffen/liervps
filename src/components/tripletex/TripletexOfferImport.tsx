import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TripletexUploadZone } from "./TripletexUploadZone";
import { ImportStatusBadge } from "./ImportStatusBadge";
import { useTripletexImport, type ImportAction } from "@/hooks/useTripletexImport";
import { CheckCircle2, AlertTriangle, FileText, ArrowLeft, ArrowRight, Loader2, RotateCcw, ChevronDown } from "lucide-react";

export function TripletexOfferImport() {
  const {
    parsedData, detectedType, fileName, offerRows, step,
    importing, importResult, handleFile, reset,
    updateOfferAction, canConfirm, executeImport, setStep,
  } = useTripletexImport();

  if (step === "upload") {
    return <TripletexUploadZone onFile={handleFile} label="Last opp tilbudsfil fra Tripletex" />;
  }

  if (step === "result" && importResult) {
    return (
      <Card>
        <CardContent className="py-8 space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold">Import fullført</h3>
          </div>
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

  if (detectedType !== "quote") {
    return (
      <Card>
        <CardContent className="py-8 text-center space-y-3">
          <AlertTriangle className="h-8 w-8 text-yellow-500 mx-auto" />
          <p className="text-sm text-muted-foreground">
            Filen ble ikke gjenkjent som en tilbudsfil. Kontroller at kolonnene stemmer.
          </p>
          <Button variant="outline" onClick={reset}>Prøv igjen</Button>
        </CardContent>
      </Card>
    );
  }

  const totalRawRows = parsedData?.rawRowCount || 0;
  const groupedCount = offerRows.length;

  const summary = {
    match: offerRows.filter(r => r.matchStatus === "match").length,
    new: offerRows.filter(r => r.matchStatus === "new").length,
    needs_review: offerRows.filter(r => r.matchStatus === "needs_review").length,
    ignored: offerRows.filter(r => r.action === "ignore").length,
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
              <p className="text-xs text-muted-foreground">
                {totalRawRows} rå rader → {groupedCount} grupperte tilbud
              </p>
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
        {summary.ignored > 0 && <Badge variant="outline">{summary.ignored} ignoreres</Badge>}
      </div>

      {/* Offer cards */}
      <div className="space-y-3">
        {offerRows.map(row => (
          <Collapsible key={row.offer.number}>
            <Card className={row.matchStatus === "needs_review" ? "border-yellow-400/50" : ""}>
              <CardContent className="py-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <ImportStatusBadge status={row.action === "ignore" ? "ignored" : row.matchStatus} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">Tilbud #{row.offer.number}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {row.offer.customerName}{row.offer.orgNumber ? ` · ${row.offer.orgNumber}` : ""}
                        {" · "}{row.offer.lines.length} linjer
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {row.matchedCustomerName && (
                      <span className="text-xs text-primary hidden sm:inline">Kunde: {row.matchedCustomerName}</span>
                    )}
                    <Select
                      value={row.action}
                      onValueChange={(v) => updateOfferAction(row.offer.number, v as ImportAction)}
                    >
                      <SelectTrigger className="h-7 text-xs w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="create">Opprett ny</SelectItem>
                        <SelectItem value="update" disabled={!row.matchedOfferId}>Oppdater</SelectItem>
                        <SelectItem value="ignore">Ignorer</SelectItem>
                      </SelectContent>
                    </Select>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                </div>

                <CollapsibleContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Beskrivelse</TableHead>
                        <TableHead className="text-right">Antall</TableHead>
                        <TableHead className="text-right">Enhetspris</TableHead>
                        <TableHead className="text-right">Beløp</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {row.offer.lines.map((line, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs">{line.description || "—"}</TableCell>
                          <TableCell className="text-xs text-right">{line.quantity ?? "—"}</TableCell>
                          <TableCell className="text-xs text-right">{line.unitPrice?.toLocaleString("nb-NO") ?? "—"}</TableCell>
                          <TableCell className="text-xs text-right">{line.amount?.toLocaleString("nb-NO") ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CollapsibleContent>
              </CardContent>
            </Card>
          </Collapsible>
        ))}
      </div>

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
            <p className="text-sm font-medium">Bekreft tilbudsimport</p>
            <p className="text-xs text-muted-foreground">
              {offerRows.filter(r => r.action === "create").length} tilbud opprettes,{" "}
              {offerRows.filter(r => r.action === "update").length} oppdateres,{" "}
              {offerRows.filter(r => r.action === "ignore").length} ignoreres.
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
