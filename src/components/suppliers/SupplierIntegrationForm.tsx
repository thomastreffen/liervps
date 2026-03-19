import { useState, useEffect } from "react";
import type { Supplier, SupplierIntegration } from "@/types/product-module";
import { getSupplierDefaults } from "@/lib/supplier-defaults";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Save, TestTube, FolderSearch, Play, Loader2, Eye, EyeOff, Lightbulb,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  supplier: Supplier;
  integration: SupplierIntegration | null;
  onSave: (values: Partial<SupplierIntegration>) => Promise<any>;
  saving: boolean;
}

export function SupplierIntegrationForm({ supplier, integration, onSave, saving }: Props) {
  const defaults = getSupplierDefaults(supplier.code);

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

  // Update from integration when loaded
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

  const handleSave = () => {
    if (!host.trim()) {
      toast.error("Vertsnavn er påkrevd");
      return;
    }
    onSave({
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
  };

  const handleTestConnection = () => {
    toast.info("Tilkoblingstest kommer i neste versjon");
  };

  const handleListFiles = () => {
    toast.info("Filhenting kommer i neste versjon");
  };

  const handleFullSync = () => {
    toast.info("Full synkronisering kommer i neste versjon");
  };

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
                  placeholder={integration ? "••••••••" : "Passord"}
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
              {integration && (
                <p className="text-[10px] text-muted-foreground">La stå tomt for å beholde eksisterende passord</p>
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
        <Button onClick={handleSave} disabled={saving} className="gap-1.5">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Lagre konfigurasjon
        </Button>
        <Button variant="outline" onClick={handleTestConnection} className="gap-1.5">
          <TestTube className="h-3.5 w-3.5" />
          Test tilkobling
        </Button>
        <Button variant="outline" onClick={handleListFiles} className="gap-1.5">
          <FolderSearch className="h-3.5 w-3.5" />
          Hent filliste
        </Button>
        <Button variant="outline" onClick={handleFullSync} className="gap-1.5">
          <Play className="h-3.5 w-3.5" />
          Kjør full synk
        </Button>
      </div>
    </div>
  );
}
