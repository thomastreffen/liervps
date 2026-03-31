import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Copy, Check, ExternalLink, Globe, Lock, Eye, EyeOff,
  Code, Link2, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

interface ShareFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: {
    slug: string;
    name: string;
    audience_type: "internal" | "external" | "both";
    requires_login: boolean;
    show_in_catalog: boolean;
    is_active: boolean;
  };
}

export function ShareFormDialog({ open, onOpenChange, template }: ShareFormDialogProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const baseUrl = window.location.origin;
  const publicUrl = `${baseUrl}/bestilling/${template.slug}`;
  const embedUrl = `${baseUrl}/bestilling/${template.slug}?embed=1`;
  const isExternal = template.audience_type === "external" || template.audience_type === "both";
  const canEmbed = isExternal && !template.requires_login;

  const iframeCode = `<iframe
  src="${embedUrl}"
  width="100%"
  height="1400"
  style="border:0; border-radius:8px;"
  loading="lazy"
  allow="clipboard-write"
></iframe>`;

  const scriptCode = `<div id="mcs-order-form"></div>
<script src="${baseUrl}/embed-form.js" data-form="${template.slug}"></script>`;

  const copy = (text: string, field: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success(`${label} kopiert`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const CopyButton = ({ field, text, label }: { field: string; text: string; label: string }) => (
    <Button
      variant="outline"
      size="sm"
      className="shrink-0 h-8 text-xs gap-1.5"
      onClick={() => copy(text, field, label)}
    >
      {copiedField === field ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copiedField === field ? "Kopiert!" : "Kopier"}
    </Button>
  );

  // Status items
  const statusItems = [
    {
      ok: template.is_active,
      label: template.is_active ? "Skjemaet er aktivt" : "Skjemaet er deaktivert",
      icon: template.is_active ? CheckCircle2 : AlertTriangle,
    },
    {
      ok: isExternal,
      label: isExternal ? "Offentlig tilgjengelig" : "Kun internt (krever innlogging)",
      icon: isExternal ? Globe : Lock,
    },
    {
      ok: !template.requires_login,
      label: template.requires_login ? "Krever innlogging" : "Åpent uten innlogging",
      icon: template.requires_login ? Lock : CheckCircle2,
    },
    {
      ok: template.show_in_catalog,
      label: template.show_in_catalog ? "Vises på bestillingssiden" : "Kun via direkte lenke",
      icon: template.show_in_catalog ? Eye : EyeOff,
    },
    {
      ok: canEmbed,
      label: canEmbed ? "Kan bygges inn eksternt" : "Embedding ikke tilgjengelig",
      icon: canEmbed ? Code : AlertTriangle,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Del og publiser
          </DialogTitle>
        </DialogHeader>

        {/* Status overview */}
        <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Status</p>
          {statusItems.map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <item.icon className={`h-3.5 w-3.5 shrink-0 ${item.ok ? "text-green-600" : "text-amber-500"}`} />
              <span className={item.ok ? "text-foreground" : "text-muted-foreground"}>{item.label}</span>
            </div>
          ))}
        </div>

        <Tabs defaultValue="link" className="mt-1">
          <TabsList className="w-full">
            <TabsTrigger value="link" className="flex-1 text-xs gap-1.5">
              <Link2 className="h-3.5 w-3.5" /> Lenke
            </TabsTrigger>
            <TabsTrigger value="iframe" className="flex-1 text-xs gap-1.5" disabled={!canEmbed}>
              <Code className="h-3.5 w-3.5" /> Iframe
            </TabsTrigger>
            <TabsTrigger value="script" className="flex-1 text-xs gap-1.5" disabled={!canEmbed}>
              <Code className="h-3.5 w-3.5" /> Script
            </TabsTrigger>
          </TabsList>

          {/* Direct link */}
          <TabsContent value="link" className="space-y-3 mt-3">
            <div>
              <Label className="text-xs text-muted-foreground">Offentlig lenke</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input readOnly value={publicUrl} className="text-xs font-mono bg-muted/30" />
                <CopyButton field="link" text={publicUrl} label="Lenke" />
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs gap-1.5"
              onClick={() => window.open(publicUrl, "_blank")}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Åpne skjema i ny fane
            </Button>
          </TabsContent>

          {/* Iframe embed */}
          <TabsContent value="iframe" className="space-y-3 mt-3">
            <div>
              <Label className="text-xs text-muted-foreground">Iframe-kode for WordPress / HTML</Label>
              <div className="mt-1 relative">
                <pre className="text-[11px] font-mono bg-muted/30 border border-border rounded-md p-3 whitespace-pre-wrap break-all max-h-40 overflow-auto">
                  {iframeCode}
                </pre>
                <div className="absolute top-2 right-2">
                  <CopyButton field="iframe" text={iframeCode} label="Iframe-kode" />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                Lim inn i en HTML-blokk eller kodeblokk i WordPress.
                Skjemaet tilpasser seg bredden automatisk.
              </p>
            </div>
          </TabsContent>

          {/* Script embed */}
          <TabsContent value="script" className="space-y-3 mt-3">
            <div>
              <Label className="text-xs text-muted-foreground">Script-basert embedding</Label>
              <div className="mt-1 relative">
                <pre className="text-[11px] font-mono bg-muted/30 border border-border rounded-md p-3 whitespace-pre-wrap break-all max-h-40 overflow-auto">
                  {scriptCode}
                </pre>
                <div className="absolute top-2 right-2">
                  <CopyButton field="script" text={scriptCode} label="Script-kode" />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                Scriptet oppretter automatisk en iframe med riktig størrelse.
                Lim inn der du vil at skjemaet skal vises.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        {!canEmbed && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800/40 p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 dark:text-amber-300">
              <p className="font-medium">Embedding er ikke tilgjengelig</p>
              <p className="mt-0.5">
                {template.requires_login
                  ? "Skjemaet krever innlogging og kan ikke bygges inn på en ekstern nettside. Fjern innloggingskravet i innstillinger for å aktivere embedding."
                  : "Skjemaet er kun tilgjengelig internt. Endre målgruppe til ekstern eller begge i innstillinger."}
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
