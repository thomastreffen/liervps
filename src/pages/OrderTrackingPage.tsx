import { useState, useMemo, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";
import { nb } from "date-fns/locale";
import {
  CheckCircle2, Clock, FileText, Loader2, AlertCircle,
  Send, Upload, Paperclip, MessageSquare, X, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  EXTERNAL_STATUS_CONFIG,
  EXTERNAL_STATUS_STEPS,
  type ExternalStatus,
} from "@/types/order-forms";
import { deriveOrderConversationState } from "@/lib/order-request-state";
import { CustomerFieldRequests } from "@/components/orders/CustomerFieldRequests";

/* ── External status progress bar ── */
function StatusProgress({ status }: { status: ExternalStatus }) {
  const config = EXTERNAL_STATUS_CONFIG[status] || EXTERNAL_STATUS_CONFIG.received;
  const steps = EXTERNAL_STATUS_STEPS;
  const currentStep = config.step;
  const isNeedsInfo = status === "needs_info";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1">
        {steps.map((s) => {
          const stepConfig = EXTERNAL_STATUS_CONFIG[s];
          const isActive = stepConfig.step <= currentStep;
          const isCurrent = s === status || (isNeedsInfo && s === "processing");
          return (
            <div key={s} className="flex-1 flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "h-2 w-full rounded-full transition-colors",
                  isActive ? config.color : "bg-muted",
                  isCurrent && "ring-2 ring-offset-1 ring-primary/30",
                )}
              />
              <span className={cn(
                "text-[10px] leading-tight text-center hidden sm:block",
                isCurrent ? "font-semibold text-foreground" : "text-muted-foreground",
              )}>
                {stepConfig.label}
              </span>
            </div>
          );
        })}
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div className={cn("h-3 w-3 rounded-full", config.color)} />
          <span className="text-base font-semibold text-foreground">{config.label}</span>
        </div>
        <p className="text-sm text-muted-foreground">{config.longDescription}</p>
      </div>
    </div>
  );
}

/* ── Customer timeline ── */
function CustomerTimeline({ token }: { token: string }) {
  const { data: events = [] } = useQuery({
    queryKey: ["tracking-timeline", token],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .rpc("get_submission_activity_by_token", { _token: token });
      const all = (data || []) as any[];
      return all.filter((e: any) => [
        "submitted", "status_changed", "missing_info_requested",
        "customer_reply", "converted_to_order", "notification_sent",
        "task_created",
      ].includes(e.event_type));
    },
  });

  const timelineLabels: Record<string, string> = {
    submitted: "Bestilling mottatt",
    missing_info_requested: "Vi ba om mer informasjon",
    customer_reply: "Du sendte svar",
    converted_to_order: "Oppgave opprettet i ressursplan",
    notification_sent: "Oppdatering sendt",
  };

  const statusChangeLabel = (payload: any): string | null => {
    const statusLabels: Record<string, string> = {
      task_created: "Oppgaven er planlagt",
      in_progress: "Arbeidet er startet",
      closed: "Bestillingen er ferdig behandlet",
      ready_for_planning: "Klar for planlegging",
    };
    return statusLabels[payload?.to] || null;
  };

  const visibleEvents = events.filter((e: any) => {
    if (e.event_type === "status_changed") return !!statusChangeLabel(e.payload);
    if (e.event_type === "notification_sent" && e.payload?.type === "new_order") return false;
    return !!timelineLabels[e.event_type];
  }).slice(0, 8);

  if (visibleEvents.length <= 1) return null;

  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">
          <Clock className="h-3.5 w-3.5 inline mr-1.5" />
          Hendelseslogg
        </h3>
        <div className="space-y-3">
          {visibleEvents.map((e: any) => {
            const label = e.event_type === "status_changed"
              ? statusChangeLabel(e.payload)
              : timelineLabels[e.event_type];
            const isCustomer = e.event_type === "customer_reply";
            return (
              <div key={e.id} className="flex gap-3 items-start">
                <div className={cn(
                  "h-2 w-2 rounded-full mt-1.5 shrink-0",
                  isCustomer ? "bg-primary" : "bg-muted-foreground/40",
                )} />
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-sm",
                    isCustomer ? "font-medium text-foreground" : "text-foreground",
                  )}>
                    {label}
                  </p>
                  {e.payload?.summary && (
                    <p className="text-xs text-foreground/70">{e.payload.summary}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    {format(new Date(e.created_at), "d. MMM yyyy 'kl.' HH:mm", { locale: nb })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Main page ── */
export default function OrderTrackingPage() {
  const { token } = useParams<{ token: string }>();
  const qc = useQueryClient();
  const [replyText, setReplyText] = useState("");
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const replyInputRef = useRef<HTMLTextAreaElement>(null);
  const messagesSectionRef = useRef<HTMLDivElement>(null);

  // Always land at the top when opening the tracking page (e.g. from confirmation page)
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [token]);

  const { data: submission, isLoading, error } = useQuery({
    queryKey: ["tracking", token],
    enabled: !!token,
    queryFn: async () => {
      // Use RPC for token-scoped access (no broad anon SELECT policy)
      const { data: rpcData, error: rpcErr } = await (supabase as any)
        .rpc("get_submission_by_tracking_token", { _token: token! });
      if (rpcErr) throw rpcErr;
      const sub = Array.isArray(rpcData) ? rpcData[0] : rpcData;
      if (!sub) return null;
      // Fetch template info separately
      const { data: tmpl } = await supabase
        .from("order_form_templates")
        .select("name, external_title")
        .eq("id", sub.template_id)
        .maybeSingle();
      return { ...sub, order_form_templates: tmpl };
    },
  });

  const { data: values = [] } = useQuery({
    queryKey: ["tracking-values", submission?.id],
    enabled: !!token,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .rpc("get_submission_values_by_token", { _token: token! });
      return data || [];
    },
  });

  // Fetch messages from new order_form_messages table
  const { data: messages = [] } = useQuery({
    queryKey: ["tracking-messages", token],
    enabled: !!token,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .rpc("get_submission_messages_by_token", { _token: token! });
      return data || [];
    },
  });

  // Fallback: also fetch old comments for backward compat
  const { data: legacyComments = [] } = useQuery({
    queryKey: ["tracking-comments-legacy", token],
    enabled: !!token,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .rpc("get_submission_comments_by_token", { _token: token! });
      return data || [];
    },
  });

  const { data: attachments = [] } = useQuery({
    queryKey: ["tracking-attachments", token],
    enabled: !!token,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .rpc("get_submission_attachments_by_token", { _token: token! });
      return data || [];
    },
  });

  useEffect(() => {
    if (submission?.id) {
      supabase.from("order_form_submissions")
        .update({ customer_last_viewed_at: new Date().toISOString() } as any)
        .eq("id", submission.id)
        .then();
    }
  }, [submission?.id]);

  const conversationState = useMemo(
    () => deriveOrderConversationState(submission?.status, messages as any[], legacyComments as any[]),
    [submission?.status, messages, legacyComments],
  );

  const allMessages = useMemo(
    () => conversationState.conversation.filter((message) => message.is_visible_to_customer),
    [conversationState.conversation],
  );

  const openRequest = useMemo(
    () => [...allMessages].reverse().find((message) => message.message_type === "request_info" && message.requires_reply && !message.replied_at),
    [allMessages],
  );

  const scrollToReplyAndFocus = () => {
    messagesSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => {
      replyInputRef.current?.focus();
    }, 400);
  };

  const submitReply = useMutation({
    mutationFn: async () => {
      if (!replyText.trim() && replyFiles.length === 0) return;
      if (!submission) return;
      const sub = submission as any;

      // Insert message into new table
      await supabase.from("order_form_messages").insert({
        submission_id: submission.id,
        sender_type: "customer",
        sender_name: sub.submitter_name || sub.notification_recipient_name || "Bestiller",
        message_type: "message",
        body: replyText.trim() || "(Vedlegg sendt)",
        is_visible_to_customer: true,
        requires_reply: false,
      } as any);

      // Also insert legacy comment for backward compat
      if (replyText.trim()) {
        await supabase.from("order_form_comments").insert({
          submission_id: submission.id,
          body: replyText.trim(),
          comment_type: "customer_reply",
          visibility: "shared",
          is_customer_reply: true,
          author_name: sub.submitter_name || "Bestiller",
        } as any);
      }

      // Upload files
      for (const file of replyFiles) {
        const path = `${sub.company_id}/${submission.id}/reply_${Date.now()}_${file.name}`;
        await supabase.storage.from("order-form-attachments").upload(path, file);
        await supabase.from("order_form_submission_attachments").insert({
          submission_id: submission.id,
          field_key: "customer_reply",
          file_name: file.name,
          file_path: path,
          mime_type: file.type,
          file_size: file.size,
        } as any);
      }

      // Mark open request as replied
      const wasOpenRequest = !!openRequest;
      if (openRequest) {
        await supabase.from("order_form_messages")
          .update({ replied_at: new Date().toISOString() } as any)
          .eq("id", openRequest.id);
      }

      // Check if there are remaining open requests (besides the one we just closed)
      let hasRemainingOpenRequests = false;
      if (wasOpenRequest) {
        const { data: remaining } = await supabase
          .from("order_form_messages")
          .select("id")
          .eq("submission_id", submission.id)
          .eq("message_type", "request_info")
          .eq("requires_reply", true)
          .is("replied_at", null)
          .neq("id", openRequest!.id);
        hasRemainingOpenRequests = (remaining?.length ?? 0) > 0;
      }

      // Determine if we should auto-change status
      const shouldAutoUpdateStatus = wasOpenRequest 
        && !hasRemainingOpenRequests
        && ["missing_info", "waiting_customer"].includes(sub.status);

      // Update submission flags
      await supabase.from("order_form_submissions")
        .update({
          customer_last_reply_at: new Date().toISOString(),
          last_activity_at: new Date().toISOString(),
          last_customer_message_at: new Date().toISOString(),
          ...(wasOpenRequest ? { awaiting_customer_reply: false, open_request_message_id: null } : {}),
          ...(shouldAutoUpdateStatus ? { status: "under_review" } : {}),
        } as any)
        .eq("id", submission.id);

      // Log activity
      const logPayload: any = { has_text: !!replyText.trim(), file_count: replyFiles.length };
      if (shouldAutoUpdateStatus) {
        logPayload.auto_status_change = { from: sub.status, to: "under_review" };
      }
      await supabase.from("order_form_activity_log").insert({
        submission_id: submission.id,
        event_type: "customer_reply",
        payload: logPayload,
      } as any);

      // Log system event for auto status change
      if (shouldAutoUpdateStatus) {
        await supabase.from("order_form_activity_log").insert({
          submission_id: submission.id,
          event_type: "auto_status_change",
          payload: {
            from: sub.status,
            to: "under_review",
            reason: "Kundesvar mottatt på åpen forespørsel. Status endret automatisk fra Mangler info til Til vurdering.",
          },
        } as any);
      }
    },
    onSuccess: () => {
      setReplyText("");
      setReplyFiles([]);
      qc.invalidateQueries({ queryKey: ["tracking-messages", token] });
      qc.invalidateQueries({ queryKey: ["tracking-comments-legacy", token] });
      qc.invalidateQueries({ queryKey: ["tracking-attachments", token] });
      qc.invalidateQueries({ queryKey: ["tracking-timeline", token] });
      qc.invalidateQueries({ queryKey: ["tracking", token] });
      toast.success("Svaret ditt er sendt!");
    },
    onError: () => {
      toast.error("Kunne ikke sende svaret. Prøv igjen.");
    },
  });

  const valuesMap = useMemo(() => {
    const m: Record<string, any> = {};
    values.forEach((v: any) => { m[v.field_key] = v.value; });
    return m;
  }, [values]);

  const sub = submission as any;
  const externalStatus: ExternalStatus = conversationState.effectiveExternalStatus;
  const templateName = sub?.order_form_templates?.external_title || sub?.order_form_templates?.name || "Bestilling";
  const needsInfo = conversationState.hasOpenRequest;
  const lastUpdated = sub?.last_activity_at || sub?.updated_at || sub?.submitted_at;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-3 max-w-sm">
          <AlertCircle className="h-12 w-12 text-muted-foreground/40 mx-auto" />
          <h2 className="text-lg font-semibold text-foreground">Bestilling ikke funnet</h2>
          <p className="text-sm text-muted-foreground">
            Sporingslenken er ugyldig eller bestillingen finnes ikke lenger.
          </p>
        </div>
      </div>
    );
  }

  const summaryFields = [
    { key: "kundenavn", label: "Kunde" },
    { key: "firmanavn", label: "Firma" },
    { key: "bestiller_navn", label: "Bestiller" },
    { key: "kontaktperson_kunde", label: "Kontaktperson" },
    { key: "anleggsadresse", label: "Oppdragssted" },
    { key: "oensket_dato", label: "Ønsket dato" },
    { key: "oensket_tid", label: "Ønsket tid" },
    { key: "referanse_po", label: "Referanse/PO" },
    { key: "oppdragstittel", label: "Oppdrag" },
  ];

  const visibleSummary = summaryFields.filter((f) => valuesMap[f.key]);
  const hasMessages = allMessages.length > 0;
  const isClosed = externalStatus === "completed" || externalStatus === "closed";

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10 space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <FileText className="h-4 w-4" />
            <span className="text-xs font-medium">{templateName}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">
            Bestilling {sub.submission_no}
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span>Sendt {format(new Date(sub.submitted_at || sub.created_at), "d. MMMM yyyy", { locale: nb })}</span>
            {lastUpdated && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Oppdatert {formatDistanceToNow(new Date(lastUpdated), { addSuffix: true, locale: nb })}
              </span>
            )}
          </div>
        </div>

        {/* Status progress */}
        <Card>
          <CardContent className="pt-6 pb-5">
            <StatusProgress status={externalStatus} />
          </CardContent>
        </Card>

        {/* Needs info alert */}
        {needsInfo && (
          <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
            <CardContent className="pt-5 pb-4 space-y-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                    Vi trenger litt mer informasjon
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                    Se meldingen nedenfor og svar med det vi etterspør, så behandler vi bestillingen videre.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                className="w-full sm:w-auto"
                onClick={scrollToReplyAndFocus}
              >
                <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                Se melding og svar
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Customer-fillable field requests from admin */}
        <CustomerFieldRequests
          token={token!}
          submitterName={sub.submitter_name || sub.notification_recipient_name}
        />

        {/* Summary */}
        {visibleSummary.length > 0 && (
          <Card>
            <CardContent className="pt-5 pb-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Oppsummering</h3>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                {visibleSummary.map((f) => (
                  <div key={f.key}>
                    <dt className="text-xs text-muted-foreground">{f.label}</dt>
                    <dd className="text-sm text-foreground">{String(valuesMap[f.key])}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        )}

        {/* Customer timeline */}
        <CustomerTimeline token={token!} />

        {/* Messages - the primary conversation section */}
        <div ref={messagesSectionRef}>
          <Card>
            <CardContent className="pt-5 pb-4">
              <h3 className="text-sm font-semibold text-foreground mb-4">
                <MessageSquare className="h-3.5 w-3.5 inline mr-1.5" />
                Meldinger
              </h3>

              {/* Message thread */}
              {hasMessages ? (
                <div className="space-y-3 mb-4">
                  {allMessages.map((msg) => {
                    const isCustomer = msg.sender_type === "customer";
                    const isRequestInfo = msg.message_type === "request_info";
                    const isSystem = msg.sender_type === "system";

                    if (isSystem) {
                      return (
                        <div key={msg.id} className="text-center">
                          <span className="text-[11px] text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
                            {msg.body}
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={msg.id}
                        className={cn(
                          "rounded-xl p-3.5 text-sm max-w-[85%]",
                          isCustomer
                            ? "bg-primary/5 border border-primary/20 ml-auto"
                            : isRequestInfo
                            ? "bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800 mr-auto"
                            : "bg-muted/50 mr-auto",
                        )}
                      >
                        {/* Header */}
                        <div className="flex items-center gap-2 mb-1.5">
                          {isRequestInfo && (
                            <AlertTriangle className="h-3 w-3 text-amber-600 shrink-0" />
                          )}
                          <span className={cn(
                            "text-xs font-medium",
                            isRequestInfo ? "text-amber-800 dark:text-amber-300" : "text-foreground",
                          )}>
                            {isCustomer ? "Du" : (msg.sender_name || "Saksbehandler")}
                          </span>
                          {isRequestInfo && (
                            <Badge variant="outline" className="text-[9px] bg-amber-100 text-amber-700 border-amber-300">
                              Forespørsel
                            </Badge>
                          )}
                          <span className="text-[10px] text-muted-foreground ml-auto">
                            {format(new Date(msg.created_at), "d. MMM HH:mm", { locale: nb })}
                          </span>
                        </div>

                        {/* Body */}
                        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{msg.body}</p>

                        {/* Reply status for requests */}
                        {isRequestInfo && msg.requires_reply && (
                          <div className="mt-2 pt-2 border-t border-amber-200 dark:border-amber-800">
                            {msg.replied_at ? (
                              <span className="text-[10px] text-green-600 flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                Besvart {format(new Date(msg.replied_at), "d. MMM HH:mm", { locale: nb })}
                              </span>
                            ) : (
                              <span className="text-[10px] text-amber-600 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Venter på svar fra deg
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mb-4">
                  Ingen meldinger ennå. Du kan sende melding eller mer informasjon nedenfor.
                </p>
              )}

              {/* Reply input */}
              {!isClosed && (
                <div className="space-y-3 pt-3 border-t">
                  <Textarea
                    ref={replyInputRef}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={openRequest ? "Skriv svaret ditt her..." : "Skriv en melding..."}
                    rows={3}
                    className="text-sm"
                  />

                  <div>
                    <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
                      <Upload className="h-4 w-4" />
                      <span>Legg ved filer</span>
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          setReplyFiles((prev) => [...prev, ...files]);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    {replyFiles.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {replyFiles.map((f, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <Paperclip className="h-3 w-3 text-muted-foreground" />
                            <span className="truncate flex-1">{f.name}</span>
                            <button onClick={() => setReplyFiles((prev) => prev.filter((_, j) => j !== i))}>
                              <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <Button
                    onClick={() => submitReply.mutate()}
                    disabled={submitReply.isPending || (!replyText.trim() && replyFiles.length === 0)}
                    className="w-full sm:w-auto h-11 text-sm"
                  >
                    {submitReply.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                    ) : (
                      <Send className="h-4 w-4 mr-1.5" />
                    )}
                    Send svar
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Attachments */}
        {attachments.length > 0 && (
          <Card>
            <CardContent className="pt-5 pb-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">
                <Paperclip className="h-3.5 w-3.5 inline mr-1.5" />
                Vedlegg ({attachments.length})
              </h3>
              <div className="space-y-2">
                {attachments.map((att: any) => (
                  <div key={att.id} className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="flex-1 truncate text-foreground">{att.file_name}</span>
                    {att.file_size && (
                      <span className="text-xs text-muted-foreground">
                        {(att.file_size / 1024).toFixed(0)} KB
                      </span>
                    )}
                    {att.field_key === "customer_reply" && (
                      <Badge variant="outline" className="text-[9px]">Ettersendt</Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center pt-4 pb-8">
          <p className="text-xs text-muted-foreground">
            Denne lenken er personlig og skal ikke deles med andre.
          </p>
        </div>
      </div>
    </div>
  );
}