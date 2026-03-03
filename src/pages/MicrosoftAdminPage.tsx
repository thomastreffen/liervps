import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  RefreshCw, Shield, ShieldOff, Plus, RotateCcw, CheckCircle2,
  AlertTriangle, XCircle, Clock, Mail, ExternalLink, Info,
} from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";

type SubAction = "ensure" | "renew" | "recreate" | "disable";

export default function MicrosoftAdminPage() {
  const { activeCompanyId } = useCompanyContext();
  const queryClient = useQueryClient();
  const [actionLoading, setActionLoading] = useState<SubAction | null>(null);

  const { data: subscriptions, isLoading } = useQuery({
    queryKey: ["ms-graph-subscriptions", activeCompanyId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("graph-subscription-manage", {
        body: { action: "list", company_id: activeCompanyId },
      });
      if (error) throw error;
      return data?.subscriptions || [];
    },
    enabled: !!activeCompanyId,
  });

  const { data: recentEmails } = useQuery({
    queryKey: ["recent-inbound-emails", activeCompanyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("conversation_email_messages")
        .select("id, direction, status, subject, from_email, created_at, error")
        .eq("company_id", activeCompanyId!)
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!activeCompanyId,
  });

  const runAction = async (action: SubAction) => {
    setActionLoading(action);
    try {
      const { data, error } = await supabase.functions.invoke("graph-subscription-manage", {
        body: { action, company_id: activeCompanyId },
      });
      if (error) throw error;
      toast.success(`Handling "${action}" fullført`, { description: data?.status || "OK" });
      queryClient.invalidateQueries({ queryKey: ["ms-graph-subscriptions"] });
    } catch (err: any) {
      toast.error(`Feil ved "${action}"`, { description: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  const healthIcon = (health: string) => {
    switch (health) {
      case "healthy": return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case "expiring_soon": return <Clock className="h-4 w-4 text-amber-500" />;
      case "error": return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case "expired": return <XCircle className="h-4 w-4 text-red-500" />;
      case "disabled": return <ShieldOff className="h-4 w-4 text-muted-foreground" />;
      default: return <Info className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const healthLabel = (health: string) => {
    const map: Record<string, string> = {
      healthy: "Aktiv",
      expiring_soon: "Utløper snart",
      error: "Feil",
      expired: "Utløpt",
      disabled: "Deaktivert",
    };
    return map[health] || health;
  };

  const healthVariant = (health: string): "default" | "secondary" | "destructive" | "outline" => {
    if (health === "healthy") return "default";
    if (health === "expiring_soon") return "secondary";
    if (health === "error" || health === "expired") return "destructive";
    return "outline";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Microsoft Graph – Webhooks</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Administrer Graph-subscriptions for automatisk innhenting av e-postsvar i samtaler.
        </p>
      </div>

      {/* Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Handlinger</CardTitle>
          <CardDescription>Administrer webhook-subscription for dette selskapet</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => runAction("ensure")} disabled={!!actionLoading}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {actionLoading === "ensure" ? "Oppretter…" : "Aktiver / Ensure"}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => runAction("renew")} disabled={!!actionLoading}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            {actionLoading === "renew" ? "Fornyer…" : "Forny nå"}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => runAction("recreate")} disabled={!!actionLoading}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            {actionLoading === "recreate" ? "Gjenskaper…" : "Recreate"}
          </Button>
          <Button size="sm" variant="destructive" onClick={() => runAction("disable")} disabled={!!actionLoading}>
            <ShieldOff className="mr-1.5 h-3.5 w-3.5" />
            {actionLoading === "disable" ? "Deaktiverer…" : "Deaktiver"}
          </Button>
        </CardContent>
      </Card>

      {/* Subscription list */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Subscriptions</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Laster…</p>
          ) : !subscriptions || subscriptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ingen subscriptions funnet. Klikk «Aktiver» for å opprette en.
            </p>
          ) : (
            <div className="space-y-3">
              {subscriptions.map((sub: any) => (
                <div
                  key={sub.id}
                  className="flex items-start justify-between rounded-lg border p-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {healthIcon(sub.health)}
                      <Badge variant={healthVariant(sub.health)}>{healthLabel(sub.health)}</Badge>
                      <span className="text-xs text-muted-foreground font-mono">{sub.subscription_id?.slice(0, 12)}…</span>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <div>Resource: {sub.resource}</div>
                      <div>
                        Utløper: {format(new Date(sub.expiration_at), "d. MMM yyyy HH:mm", { locale: nb })}
                      </div>
                      {sub.last_renewed_at && (
                        <div>
                          Sist fornyet: {format(new Date(sub.last_renewed_at), "d. MMM yyyy HH:mm", { locale: nb })}
                        </div>
                      )}
                      {sub.last_error && (
                        <div className="text-red-600 mt-1">{sub.last_error}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test help */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Test innkommende e-post
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>For å teste inbound-flyten:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Opprett en samtaletråd i et prosjekt og legg til en ekstern deltaker.</li>
            <li>Post et innlegg – e-post sendes til deltakeren.</li>
            <li>Svar på e-posten i Outlook.</li>
            <li>Svaret dukker opp i samtalen automatisk (30–60 sek).</li>
          </ol>
          <p className="text-xs mt-2">
            Webhook-en må være aktiv (grønn status over). Graph sender notifikasjoner i nær sanntid.
          </p>
        </CardContent>
      </Card>

      {/* Recent email messages */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Siste e-postmeldinger</CardTitle>
          <CardDescription>De 20 nyeste utgående og innkommende meldingene</CardDescription>
        </CardHeader>
        <CardContent>
          {!recentEmails || recentEmails.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ingen e-postmeldinger ennå.</p>
          ) : (
            <div className="space-y-2">
              {recentEmails.map((msg: any) => (
                <div key={msg.id} className="flex items-center gap-3 text-sm border-b pb-2 last:border-0">
                  <Badge variant={msg.direction === "inbound" ? "secondary" : "outline"} className="text-xs shrink-0">
                    {msg.direction === "inbound" ? "Inn" : "Ut"}
                  </Badge>
                  <Badge
                    variant={
                      msg.status === "sent" || msg.status === "received" ? "default"
                        : msg.status === "failed" ? "destructive"
                        : "outline"
                    }
                    className="text-xs shrink-0"
                  >
                    {msg.status}
                  </Badge>
                  <span className="truncate flex-1 text-muted-foreground">
                    {msg.subject || "(ingen emne)"}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {msg.from_email?.split("@")[0] || "—"}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {format(new Date(msg.created_at), "d. MMM HH:mm", { locale: nb })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
