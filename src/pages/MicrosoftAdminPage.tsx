import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { triggerConversationEmailSend } from "@/lib/conversation-email";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  RefreshCw, ShieldOff, Plus, RotateCcw, CheckCircle2,
  AlertTriangle, XCircle, Clock, Mail, Info, Inbox, RotateCw, Ban, Send,
  Activity,
} from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";

type SubAction = "ensure" | "renew" | "recreate" | "disable";

export default function MicrosoftAdminPage() {
  const { activeCompanyId } = useCompanyContext();
  const queryClient = useQueryClient();
  const [actionLoading, setActionLoading] = useState<SubAction | null>(null);
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string; status_code?: number; mailbox?: string } | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  // ── Subscriptions ──
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

  // ── Email send monitor (last 50) ──
  const { data: emailLogs, refetch: refetchLogs } = useQuery({
    queryKey: ["email-send-monitor", activeCompanyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("conversation_email_messages")
        .select("id, direction, status, subject, from_email, to_emails, created_at, processed_at, error, processing_status, processing_duration_ms, thread_id, post_id")
        .eq("company_id", activeCompanyId!)
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: !!activeCompanyId,
  });

  // ── Dead letters ──
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
  const lastSent = (emailLogs || []).find((e: any) => e.status === "sent");
  const pendingDL = (deadLetters || []).filter((d: any) => d.status === "pending").length;
  const failedEmails = (emailLogs || []).filter((e: any) => e.status === "failed").length;

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
      queryClient.invalidateQueries({ queryKey: ["email-send-monitor"] });
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

  const sendTestEmail = async () => {
    if (!testEmail.trim()) return;
    setTestSending(true);
    setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("conversation-email-send", {
        body: { test_mode: true, test_recipient: testEmail.trim() },
      });
      if (error) throw error;
      setTestResult(data);
      if (data?.success) {
        toast.success("Testmail sendt!");
      } else {
        toast.error("Testmail feilet");
      }
    } catch (err: any) {
      setTestResult({ success: false, error: err.message });
      toast.error("Feil ved sending");
    } finally {
      setTestSending(false);
    }
  };

  const handleResend = async (log: any) => {
    setResendingId(log.id);
    try {
      const result = await triggerConversationEmailSend(
        log.thread_id,
        "resend",
        { post_id: log.post_id, recipient_email: log.to_emails?.[0] }
      );
      if (result.sent) {
        toast.success("E-post sendt på nytt");
      } else {
        toast.error(result.error || "Sending feilet");
      }
      refetchLogs();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setResendingId(null);
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

  const emailStatusVariant = (s: string): "default" | "secondary" | "destructive" | "outline" => {
    if (s === "sent") return "default";
    if (s === "attempted") return "secondary";
    if (s === "failed") return "destructive";
    if (s === "skipped") return "outline";
    return "outline";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Microsoft Graph – Webhooks & E-post</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Administrer Graph-subscriptions og overvåk all e-postutsending.
        </p>
      </div>

      {/* Health summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-muted-foreground">Aktive subscriptions</div>
            <div className="text-2xl font-semibold">{activeSubCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-muted-foreground">Siste sendt e-post</div>
            <div className="text-sm font-medium">
              {lastSent ? format(new Date(lastSent.created_at), "d. MMM HH:mm", { locale: nb }) : "—"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-muted-foreground">Feilede sendinger</div>
            <div className={`text-2xl font-semibold ${failedEmails > 0 ? "text-destructive" : ""}`}>{failedEmails}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-muted-foreground">Dead letters (ventende)</div>
            <div className={`text-2xl font-semibold ${pendingDL > 0 ? "text-amber-600" : ""}`}>{pendingDL}</div>
          </CardContent>
        </Card>
      </div>

      {/* Send testmail */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Send className="h-4 w-4" />
            Send testmail
          </CardTitle>
          <CardDescription>
            Verifiser at Graph-integrasjonen kan sende e-post fra <code className="text-xs bg-muted px-1 rounded">postkontoret@mcsservice.no</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="mottaker@example.com"
              value={testEmail}
              onChange={e => setTestEmail(e.target.value)}
              className="h-9 text-sm"
              onKeyDown={e => { if (e.key === "Enter") sendTestEmail(); }}
            />
            <Button size="sm" onClick={sendTestEmail} disabled={!testEmail.trim() || testSending} className="gap-1.5 shrink-0">
              {testSending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Send
            </Button>
          </div>
          {testResult && (
            <div className={`rounded-lg border p-3 text-sm ${testResult.success ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800" : "bg-destructive/5 border-destructive/20"}`}>
              {testResult.success ? (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <p className="font-medium text-emerald-700 dark:text-emerald-300">Testmail sendt via <code className="text-xs">/users/{testResult.mailbox}/sendMail</code></p>
                    <p className="text-xs text-muted-foreground mt-0.5">saveToSentItems=true — sjekk Sendte elementer i Outlook for {testResult.mailbox}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-destructive">Sending feilet{testResult.status_code ? ` (HTTP ${testResult.status_code})` : ""}</p>
                    <p className="text-xs text-destructive/80 mt-0.5 break-all">{testResult.error}</p>
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="text-xs text-muted-foreground space-y-1 border-t pt-2 mt-2">
            <p><strong>Endepunkt:</strong> <code>POST /users/postkontoret@mcsservice.no/sendMail</code></p>
            <p><strong>Nødvendige permissions:</strong> <code>Mail.Send</code> (Application)</p>
            <p>Hvis testmail ikke dukker opp i Sendte elementer, mangler appen <code>Mail.Send</code> permission i Azure AD.</p>
          </div>
        </CardContent>
      </Card>

      {/* ═══ EMAIL SEND MONITOR ═══ */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" />
              E-post sendingslogg
            </CardTitle>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => refetchLogs()}>
              <RefreshCw className="h-3 w-3 mr-1" /> Oppdater
            </Button>
          </div>
          <CardDescription>Siste 50 utgående e-postforsøk med full sporbarhet</CardDescription>
        </CardHeader>
        <CardContent>
          {!emailLogs || emailLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ingen e-postforsøk registrert ennå.</p>
          ) : (
            <div className="space-y-2">
              {emailLogs.map((log: any) => (
                <div key={log.id} className="rounded-lg border p-3 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={emailStatusVariant(log.status)} className="text-[10px]">
                      {log.status}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {log.processing_status || log.direction}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {format(new Date(log.created_at), "d. MMM HH:mm:ss", { locale: nb })}
                    </span>
                    {log.processing_duration_ms != null && (
                      <span className="text-[10px] text-muted-foreground">{log.processing_duration_ms}ms</span>
                    )}
                    <span className="flex-1" />
                    {(log.status === "failed" || log.status === "attempted") && log.thread_id && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-[10px] px-2"
                        disabled={resendingId === log.id}
                        onClick={() => handleResend(log)}
                      >
                        <RotateCw className="h-2.5 w-2.5 mr-1" />
                        {resendingId === log.id ? "Sender…" : "Resend"}
                      </Button>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {log.subject && <div className="truncate"><strong>Emne:</strong> {log.subject}</div>}
                    <div><strong>Fra:</strong> {log.from_email || "—"}</div>
                    <div><strong>Til:</strong> {(log.to_emails || []).join(", ") || "—"}</div>
                    {log.thread_id && <div className="font-mono text-[10px]">Thread: {log.thread_id.slice(0, 12)}…</div>}
                  </div>
                  {log.error && (
                    <p className="text-xs text-destructive line-clamp-2 mt-1">{log.error}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Webhook-handlinger</CardTitle>
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
            <p className="text-sm text-muted-foreground">Ingen dead letters.</p>
          ) : (
            <div className="space-y-2">
              {deadLetters.map((dl: any) => (
                <div key={dl.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={dlStatusVariant(dl.status)}>{dl.status}</Badge>
                      <span className="text-xs text-muted-foreground">Forsøk: {dl.attempt_count}</span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(dl.created_at), "d. MMM HH:mm", { locale: nb })}
                      </span>
                    </div>
                    {(dl.status === "pending" || dl.status === "failed") && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" className="h-7 text-xs" disabled={reprocessingId === dl.id} onClick={() => reprocessDeadLetter(dl.id)}>
                          <RotateCw className="mr-1 h-3 w-3" />
                          {reprocessingId === dl.id ? "Prosesserer…" : "Reprocess"}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => ignoreDeadLetter(dl.id)}>
                          <Ban className="mr-1 h-3 w-3" />
                          Ignorer
                        </Button>
                      </div>
                    )}
                  </div>
                  {dl.error && <p className="text-xs text-destructive line-clamp-2">{dl.error}</p>}
                  {dl.internet_message_id && (
                    <p className="text-xs text-muted-foreground font-mono truncate">{dl.internet_message_id}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
