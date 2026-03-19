import { useState, useEffect } from "react";
import type { Supplier, SupplierIntegration } from "@/types/product-module";
import { getSupplierDefaults } from "@/lib/supplier-defaults";
import { useSupplierActions } from "@/hooks/useSupplierActions";
import type { FileListFile } from "@/hooks/useSupplierActions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Save, TestTube, FolderSearch, Play, Loader2, Eye, EyeOff, Lightbulb,
  FileText, AlertTriangle, X, HardDrive, Folder,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  supplier: Supplier;
  integration: SupplierIntegration | null;
  onSave: (values: Partial<SupplierIntegration>) => Promise<any>;
  saving: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("nb-NO", { day: "2-digit", month: "2-digit", year: "2-digit" }) +
      " " + d.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
}

  export function SupplierIntegrationForm({ supplier, integration, onSave, saving }: Props) {
  const actions = useSupplierActions(supplier.id);

  const [protocol, setProtocol] = useState<string>(integration?.protocol ?? defaults?.protocol ?? "sftp");
  const [host, setHost] = useState(integration?.host ?? defaults?.host ?? "");
  const [port, setPort] = useState(integration?.port ?? defaults?.port ?? 22);
  const [username, setUsername] = useState(integration?.username ?? "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [basePath, setBasePath] = useState(integration?.remote_base_path ?? defaults?.remote_base_path ?? "/");
  const [catalogPattern, setCatalogPattern] = useState(integration?.catalog_file_pattern ?? defaults?.catalog_file_pattern ?? "");
  const [pricePattern, setPricePattern] = useState(integration?.price_file_pattern ?? defaults?.price_file_pattern ?? "");
  const [discountPattern, setDiscountPattern] = useState(integration?.discount_file_pattern ?? defaults?.discount_file_pattern ?? "");
  const [invoicePattern, setInvoicePattern] = useState(integration?.invoice_file_pattern ?? "");
  const [syncEnabled, setSyncEnabled] = useState(integration?.sync_enabled ?? false);
  const [syncFrequency, setSyncFrequency] = useState(integration?.sync_frequency ?? "manual");
  const [hasDefaultsSuggestion, setHasDefaultsSuggestion] = useState(!integration && !!defaults);

  useEffect(() => {
    if (integration) {
      setProtocol(integration.protocol);
      setHost(integration.host);
      setPort(integration.port);
      setUsername(integration.username);
      setBasePath(integration.remote_base_path ?? "/");
      setCatalogPattern(integration.catalog_file_pattern ?? "");
      setPricePattern(integration.price_file_pattern ?? "");
      setDiscountPattern(integration.discount_file_pattern ?? "");
      setInvoicePattern(integration.invoice_file_pattern ?? "");
      setSyncEnabled(integration.sync_enabled);
      setSyncFrequency(integration.sync_frequency);
      setHasDefaultsSuggestion(false);
    }
  }, [integration]);

  const applyDefaults = () => {
    if (!defaults) return;
    setProtocol(defaults.protocol);
    setHost(defaults.host);
    setPort(defaults.port);
    setBasePath(defaults.remote_base_path);
    setCatalogPattern(defaults.catalog_file_pattern ?? "");
    setPricePattern(defaults.price_file_pattern ?? "");
    setDiscountPattern(defaults.discount_file_pattern ?? "");
    setHasDefaultsSuggestion(false);
    toast.info("Standardverdier fylt ut – du kan overstyre alt");
  };

  const handleSave = async () => {
    if (!host.trim()) {
      toast.error("Vertsnavn er påkrevd");
      return;
    }

    try {
      const result = await onSave({
        protocol: protocol as any,
        host: host.trim(),
        port,
        username: username.trim(),
        remote_base_path: basePath.trim() || "/",
        catalog_file_pattern: catalogPattern.trim() || null,
        price_file_pattern: pricePattern.trim() || null,
        discount_file_pattern: discountPattern.trim() || null,
        invoice_file_pattern: invoicePattern.trim() || null,
        sync_enabled: syncEnabled,
        sync_frequency: syncFrequency as any,
      });

      // Save password securely via edge function if provided
      if (password.trim() && result?.id) {
        await actions.savePassword(result.id, password.trim());
        setPassword(""); // Clear after save
      }
    } catch {
      // Error already handled by onSave
    }
  };

  const isAnyActionRunning =
    actions.testingConnection || actions.listingFiles || !!actions.runningSyncType || saving;

  return (
    <div className="space-y-4">
      {/* Defaults suggestion */}
      {hasDefaultsSuggestion && defaults && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-3 flex items-center gap-3">
            <Lightbulb className="h-4 w-4 text-primary shrink-0" />
            <p className="text-xs text-foreground flex-1">
              Vi har standardverdier for <strong>{supplier.name}</strong> – vil du fylle dem ut?
            </p>
            <Button size="sm" variant="outline" onClick={applyDefaults} className="shrink-0 text-xs h-7">
              Bruk standardverdier
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setHasDefaultsSuggestion(false)} className="shrink-0 text-xs h-7">
              Avvis
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Connection settings */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Tilkoblingsinnstillinger</CardTitle>
          <CardDescription>FTP/sFTP konfigurasjon for {supplier.name}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Protokoll</Label>
              <Select value={protocol} onValueChange={setProtocol}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ftp">FTP</SelectItem>
                  <SelectItem value="ftps">FTPS</SelectItem>
                  <SelectItem value="sftp">SFTP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Vertsnavn</Label>
              <Input value={host} onChange={(e) => setHost(e.target.value)} placeholder="ftp.leverandor.no" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Port</Label>
              <Input type="number" value={port} onChange={(e) => setPort(parseInt(e.target.value) || 22)} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Brukernavn</Label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="brukernavn" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Passord</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={integration?.password_secret_ref ? "••••••••" : "Passord"}
                  className="pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              {integration?.password_secret_ref ? (
                <p className="text-[10px] text-muted-foreground">Passord er lagret. La stå tomt for å beholde.</p>
              ) : (
                <p className="text-[10px] text-muted-foreground">Passord lagres sikkert via backend</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Remote base path</Label>
            <Input value={basePath} onChange={(e) => setBasePath(e.target.value)} placeholder="/" />
          </div>
        </CardContent>
      </Card>

      {/* File patterns */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Filmønstre</CardTitle>
          <CardDescription>Glob-mønstre for å identifisere riktige filer på serveren</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Katalogfiler</Label>
              <Input value={catalogPattern} onChange={(e) => setCatalogPattern(e.target.value)} placeholder="*.csv" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Prisfiler</Label>
              <Input value={pricePattern} onChange={(e) => setPricePattern(e.target.value)} placeholder="*pris*.csv" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Rabattfiler</Label>
              <Input value={discountPattern} onChange={(e) => setDiscountPattern(e.target.value)} placeholder="*rabatt*.csv" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Faktura/Ordrefiler</Label>
              <Input value={invoicePattern} onChange={(e) => setInvoicePattern(e.target.value)} placeholder="*faktura*.csv" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sync settings */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Synkronisering</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Automatisk synkronisering</Label>
              <p className="text-xs text-muted-foreground">Hent data fra grossist automatisk</p>
            </div>
            <Switch checked={syncEnabled} onCheckedChange={setSyncEnabled} />
          </div>
          {syncEnabled && (
            <div className="space-y-1.5">
              <Label className="text-xs">Frekvens</Label>
              <Select value={syncFrequency} onValueChange={(v) => setSyncFrequency(v as any)}>
                <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manuell</SelectItem>
                  <SelectItem value="hourly">Hver time</SelectItem>
                  <SelectItem value="daily">Daglig</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-2">
        <Button onClick={handleSave} disabled={isAnyActionRunning} className="gap-1.5">
          {saving || actions.savingPassword ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          Lagre konfigurasjon
        </Button>
        <Button
          variant="outline"
          onClick={actions.testConnection}
          disabled={isAnyActionRunning || !integration}
          className="gap-1.5"
        >
          {actions.testingConnection ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <TestTube className="h-3.5 w-3.5" />
          )}
          Test tilkobling
        </Button>
        <Button
          variant="outline"
          onClick={actions.listFiles}
          disabled={isAnyActionRunning || !integration}
          className="gap-1.5"
        >
          {actions.listingFiles ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FolderSearch className="h-3.5 w-3.5" />
          )}
          Hent filliste
        </Button>
        <Button
          variant="outline"
          onClick={() => actions.runSync("full_sync")}
          disabled={isAnyActionRunning || !integration}
          className="gap-1.5"
        >
          {actions.runningSyncType ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          Kjør full synk
        </Button>
      </div>

      {!integration && (
        <p className="text-xs text-muted-foreground">
          Lagre konfigurasjon først for å aktivere test, filliste og synk.
        </p>
      )}

      {/* File list results */}
      {actions.fileListResult && (
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <HardDrive className="h-4 w-4" />
                Filer på server
              </CardTitle>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={actions.clearFileList}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            <CardDescription>
              {actions.fileListResult.all_files.length} filer funnet
              {(() => {
                const matchCount = Object.values(actions.fileListResult!.matched)
                  .reduce((sum, arr) => sum + arr.length, 0);
                return matchCount > 0
                  ? ` · ${matchCount} matcher konfigurerte mønstre`
                  : actions.fileListResult!.all_files.length > 0
                    ? " · ingen matcher konfigurerte mønstre"
                    : "";
              })()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Warnings */}
            {actions.fileListResult.warnings.length > 0 && (
              <div className="space-y-1 p-2.5 rounded-md bg-accent/50 border border-border/40">
                {actions.fileListResult.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <AlertTriangle className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Full file listing table */}
            {actions.fileListResult.all_files.length === 0 ? (
              <div className="text-center py-6">
                <Folder className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Ingen filer funnet på serveren</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Sjekk remote base path og tilkoblingen</p>
              </div>
            ) : (
              <div className="border border-border/60 rounded-md overflow-hidden">
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 px-3 py-1.5 bg-muted/50 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  <span>Filnavn</span>
                  <span className="text-right">Størrelse</span>
                  <span className="text-right">Endret</span>
                  <span className="text-right">Match</span>
                </div>
                <div className="divide-y divide-border/40 max-h-[400px] overflow-y-auto">
                  {actions.fileListResult.all_files.map((f: FileListFile, i: number) => {
                    const cats = f.categories ?? [];
                    const catLabels: Record<string, string> = { catalog: "Katalog", price: "Pris", discount: "Rabatt", invoice: "Faktura" };
                    const catColors: Record<string, string> = {
                      catalog: "bg-primary/10 text-primary border-primary/20",
                      price: "bg-accent text-accent-foreground border-accent",
                      discount: "bg-secondary text-secondary-foreground border-secondary",
                      invoice: "bg-muted text-muted-foreground border-border",
                    };
                    return (
                      <div
                        key={i}
                        className={`grid grid-cols-[1fr_auto_auto_auto] gap-x-3 px-3 py-2 text-xs items-center ${
                          cats.length > 0 ? "bg-primary/[0.03]" : ""
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="font-mono text-foreground truncate" title={f.name}>
                            {f.name}
                          </span>
                        </div>
                        <span className="text-muted-foreground text-right whitespace-nowrap">
                          {f.size > 0 ? formatFileSize(f.size) : "–"}
                        </span>
                        <span className="text-muted-foreground text-right whitespace-nowrap">
                          {f.modified_at ? formatDate(f.modified_at) : "–"}
                        </span>
                        <div className="flex gap-1 justify-end">
                          {cats.length > 0 ? (
                            cats.map((c) => (
                              <Badge key={c} variant="outline" className={`text-[9px] px-1.5 py-0 h-4 ${catColors[c] ?? ""}`}>
                                {catLabels[c] ?? c}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-muted-foreground/50">–</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
