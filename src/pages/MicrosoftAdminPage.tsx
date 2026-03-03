import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  RefreshCw, ShieldOff, Plus, RotateCcw, CheckCircle2,
  AlertTriangle, XCircle, Clock, Mail, Info, Inbox, RotateCw, Ban,
} from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";

type SubAction = "ensure" | "renew" | "recreate" | "disable";

export default function MicrosoftAdminPage() {
  const { activeCompanyId } = useCompanyContext();
  const queryClient = useQueryClient();
  const [actionLoading, setActionLoading] = useState<SubAction | null>(null);
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);

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
        .select("id, direction, status, subject, from_email, created_at, error, processing_status, processing_duration_ms")
        .eq("company_id", activeCompanyId!)
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!activeCompanyId,
  });

  const { data: deadLetters } = useQuery({
    queryKey: ["dead-letters", activeCompanyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("conversation_email_dead_letters")
        .select("*")
        .eq("company_id", activeCompanyId!)
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: !!activeCompanyId,
  });

  // Computed stats
  const activeSubCount = (subscriptions || []).filter((s: any) => s.health === "healthy").length;
  const lastInbound = recentEmails?.find((e: any) => e.direction === "inbound");
  const pendingDL = (deadLetters || []).filter((d: any) => d.status === "pending").length;
  const failedDL = (deadLetters || []).filter((d: any) => d.status === "failed").length;

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

  const reprocessDeadLetter = async (id: string) => {
    setReprocessingId(id);
    try {
      const { data, error } = await supabase.functions.invoke("conversation-email-reprocess", {
        body: { dead_letter_id: id },
      });
      if (error) throw error;
      if (data?.status === "reprocessed") {
        toast.success("Meldingen ble reprocessert og lagt i tråden");
      } else if (data?.status === "duplicate") {
        toast.info("Meldingen var allerede prosessert");
      } else {
        toast.warning("Reprocessering feilet", { description: data?.error });
      }
      queryClient.invalidateQueries({ queryKey: ["dead-letters"] });
      queryClient.invalidateQueries({ queryKey: ["recent-inbound-emails"] });
    } catch (err: any) {
      toast.error("Reprocessering feilet", { description: err.message });
    } finally {
      setReprocessingId(null);
    }
  };

  const ignoreDeadLetter = async (id: string) => {
    const { error } = await supabase
      .from("conversation_email_dead_letters")
      .update({ status: "ignored", updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error("Kunne ikke ignorere");
    } else {
      toast.success("Markert som ignorert");
      queryClient.invalidateQueries({ queryKey: ["dead-letters"] });
    }
  };

  const healthIcon = (health: string) => {
    switch (health) {
      case "healthy": return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case "expiring_soon": return <Clock className="h-4 w-4 text-amber-500" />;
      case "error": return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case "expired": return <XCircle className="h-4 w-4 text-destructive" />;
      case "disabled": return <ShieldOff className="h-4 w-4 text-muted-foreground" />;
      default: return <Info className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const healthLabel = (h: string) =>
    ({ healthy: "Aktiv", expiring_soon: "Utløper snart", error: "Feil", expired: "Utløpt", disabled: "Deaktivert" }[h] || h);

  const healthVariant = (h: string): "default" | "secondary" | "destructive" | "outline" => {
    if (h === "healthy") return "default";
    if (h === "expiring_soon") return "secondary";
    if (h === "error" || h === "expired") return "destructive";
    return "outline";
  };

  const dlStatusVariant = (s: string): "default" | "secondary" | "destructive" | "outline" => {
    if (s === "pending") return "secondary";
    if (s === "failed") return "destructive";
    if (s === "reprocessed") return "default";
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

      {/* Inbound health summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-muted-foreground">Aktive subscriptions</div>
            <div className="text-2xl font-semibold">{activeSubCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-muted-foreground">Siste inbound</div>
            <div className="text-sm font-medium">
              {lastInbound ? format(new Date(lastInbound.created_at), "d. MMM HH:mm", { locale: nb }) : "—"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-muted-foreground">Dead letters (ventende)</div>
            <div className={`text-2xl font-semibold ${pendingDL > 0 ? "text-amber-600" : ""}`}>{pendingDL}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-muted-foreground">Dead letters (feilet)</div>
            <div className={`text-2xl font-semibold ${failedDL > 0 ? "text-destructive" : ""}`}>{failedDL}</div>
          </CardContent>
        </Card>
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
                <div key={sub.id} className="flex items-start justify-between rounded-lg border p-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {healthIcon(sub.health)}
                      <Badge variant={healthVariant(sub.health)}>{healthLabel(sub.health)}</Badge>
                      <span className="text-xs text-muted-foreground font-mono">{sub.subscription_id?.slice(0, 12)}…</span>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <div>Resource: {sub.resource}</div>
                      <div>Utløper: {format(new Date(sub.expiration_at), "d. MMM yyyy HH:mm", { locale: nb })}</div>
                      {sub.last_renewed_at && (
                        <div>Sist fornyet: {format(new Date(sub.last_renewed_at), "d. MMM yyyy HH:mm", { locale: nb })}</div>
                      )}
                      {sub.last_error && <div className="text-destructive mt-1">{sub.last_error}</div>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dead letters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Inbox className="h-4 w-4" />
            Dead Letters
          </CardTitle>
          <CardDescription>Meldinger som feilet under webhook-prosessering</CardDescription>
        </CardHeader>
        <CardContent>
          {!deadLetters || deadLetters.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ingen dead letters. Alt fungerer som det skal.</p>
          ) : (
            <div className="space-y-2">
              {deadLetters.map((dl: any) => (
                <div key={dl.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={dlStatusVariant(dl.status)}>{dl.status}</Badge>
                      <span className="text-xs text-muted-foreground">
                        Forsøk: {dl.attempt_count}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(dl.created_at), "d. MMM HH:mm", { locale: nb })}
                      </span>
                    </div>
                    {(dl.status === "pending" || dl.status === "failed") && (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={reprocessingId === dl.id}
                          onClick={() => reprocessDeadLetter(dl.id)}
                        >
                          <RotateCw className="mr-1 h-3 w-3" />
                          {reprocessingId === dl.id ? "Prosesserer…" : "Reprocess"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => ignoreDeadLetter(dl.id)}
                        >
                          <Ban className="mr-1 h-3 w-3" />
                          Ignorer
                        </Button>
                      </div>
                    )}
                  </div>
                  {dl.error && (
                    <p className="text-xs text-destructive line-clamp-2">{dl.error}</p>
                  )}
                  {dl.internet_message_id && (
                    <p className="text-xs text-muted-foreground font-mono truncate">
                      {dl.internet_message_id}
                    </p>
                  )}
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
                        : msg.status === "failed" ? "destructive" : "outline"
                    }
                    className="text-xs shrink-0"
                  >
                    {msg.status}
                  </Badge>
                  <span className="truncate flex-1 text-muted-foreground">
                    {msg.subject || "(ingen emne)"}
                  </span>
                  {msg.processing_duration_ms != null && (
                    <span className="text-xs text-muted-foreground shrink-0">{msg.processing_duration_ms}ms</span>
                  )}
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
