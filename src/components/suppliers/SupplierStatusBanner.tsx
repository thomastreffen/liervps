import type { SupplierIntegration } from "@/types/product-module";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, AlertTriangle, XCircle, Clock, Wifi } from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";

interface Props {
  integration: SupplierIntegration | null;
}

export function SupplierStatusBanner({ integration }: Props) {
  if (!integration) {
    return (
      <Card className="border-dashed border-muted-foreground/30">
        <CardContent className="py-4 flex items-center gap-3">
          <Clock className="h-5 w-5 text-muted-foreground/60" />
          <div>
            <p className="text-sm font-medium text-muted-foreground">Ingen integrasjon konfigurert</p>
            <p className="text-xs text-muted-foreground/60">Fyll ut tilkoblingsdetaljer nedenfor for å komme i gang</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const status = integration.last_connection_status;
  const statusConfig = {
    never_tested: { icon: Clock, color: "text-muted-foreground", bg: "bg-muted/50", label: "Aldri testet" },
    ok: { icon: CheckCircle2, color: "text-green-600", bg: "bg-green-500/10", label: "Tilkobling OK" },
    warning: { icon: AlertTriangle, color: "text-yellow-600", bg: "bg-yellow-500/10", label: "Advarsel" },
    error: { icon: XCircle, color: "text-destructive", bg: "bg-destructive/10", label: "Feil" },
  };

  const cfg = statusConfig[status];
  const Icon = cfg.icon;

  return (
    <Card className={cfg.bg}>
      <CardContent className="py-4">
        <div className="flex items-start gap-3">
          <Icon className={`h-5 w-5 ${cfg.color} shrink-0 mt-0.5`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className={`text-sm font-medium ${cfg.color}`}>{cfg.label}</p>
              {integration.sync_enabled && (
                <span className="flex items-center gap-1 text-[10px] text-primary">
                  <Wifi className="h-3 w-3" />
                  Synk aktiv ({integration.sync_frequency})
                </span>
              )}
            </div>
            {integration.last_connection_message && status !== "ok" && (
              <p className="text-xs text-muted-foreground mt-1">{integration.last_connection_message}</p>
            )}
            <div className="flex gap-4 mt-2 text-[10px] text-muted-foreground">
              {integration.last_connected_at && (
                <span>Sist testet: {format(new Date(integration.last_connected_at), "d. MMM HH:mm", { locale: nb })}</span>
              )}
              {integration.last_sync_at && (
                <span>Sist synk: {format(new Date(integration.last_sync_at), "d. MMM HH:mm", { locale: nb })}</span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
