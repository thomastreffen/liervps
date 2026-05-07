import { useState, useMemo, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";
import { nb } from "date-fns/locale";
import {
  CheckCircle2, Clock, FileText, Loader2, AlertCircle,
  Send, Upload, Paperclip, MessageSquare, X, AlertTriangle,
  Sparkles, Shield, Calendar, Timer, Download, Check,
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

import mascotReceived from "@/assets/mascot/received.png";
import mascotProcessing from "@/assets/mascot/processing.png";
import mascotPlanned from "@/assets/mascot/planned.png";
import mascotInProgress from "@/assets/mascot/in_progress.png";
import mascotCompleted from "@/assets/mascot/completed.png";

/* ── Mascot mapping per external status ── */
const STATUS_MASCOT: Record<ExternalStatus, string> = {
  received: mascotReceived,
  processing: mascotProcessing,
  needs_info: mascotReceived,
  planned: mascotPlanned,
  in_progress: mascotInProgress,
  completed: mascotCompleted,
  closed: mascotCompleted,
};

/* ── Friendly "what's happening now" copy per status ── */
const STATUS_HUMAN_COPY: Record<ExternalStatus, { headline: string; body: string }> = {
  received: {
    headline: "Vi har mottatt bestillingen din",
    body: "Takk! Bestillingen ligger trygt hos oss og blir gjennomgått av vårt team. Du trenger ikke gjøre noe mer akkurat nå.",
  },
  processing: {
    headline: "Vi ser nå gjennom bestillingen",
    body: "Vi vurderer hva som trengs og planlegger neste steg. Du får oppdatering så snart vi har en plan klar.",
  },
  needs_info: {
    headline: "Vi trenger litt mer fra deg",
    body: "For å gå videre trenger vi en kjapp avklaring. Se meldingen lenger ned og svar når det passer.",
  },
  planned: {
    headline: "Oppdraget er planlagt",
    body: "Ansvarlig montør er varslet og oppdraget er satt opp. Vi gir beskjed når vi er på vei.",
  },
  in_progress: {
    headline: "Vi er i gang",
    body: "Arbeidet er nå under utførelse. Du får beskjed så snart vi er ferdige.",
  },
  completed: {
    headline: "Oppdraget er fullført",
    body: "Alt arbeid er ferdigstilt. Tusen takk for at du valgte MCS Service – ta kontakt om du lurer på noe.",
  },
  closed: {
    headline: "Saken er avsluttet",
    body: "Denne bestillingen er avsluttet. Du kan fortsatt se historikken her.",
  },
};

/* ── Journey stepper – numbered circles + connecting lines ── */
function JourneyStepper({ status }: { status: ExternalStatus }) {
  const cfg = EXTERNAL_STATUS_CONFIG[status] || EXTERNAL_STATUS_CONFIG.received;
  const steps = EXTERNAL_STATUS_STEPS;
  const currentStep = cfg.step;
  const isNeedsInfo = status === "needs_info";

  return (
    <div className="w-full">
      <div className="flex items-start justify-between gap-1 sm:gap-2">
        {steps.map((s, idx) => {
          const sCfg = EXTERNAL_STATUS_CONFIG[s];
          const isDone = sCfg.step < currentStep;
          const isCurrent = s === status || (isNeedsInfo && s === "processing");
          const nextDone = idx < steps.length - 1 && EXTERNAL_STATUS_CONFIG[steps[idx + 1]].step <= currentStep;
          return (
            <div key={s} className="flex-1 flex flex-col items-center min-w-0">
              <div className="w-full flex items-center">
                <div className={cn("h-[2px] flex-1", idx === 0 ? "opacity-0" : isDone || isCurrent ? "bg-primary" : "bg-border")} />
                <div
                  className={cn(
                    "h-7 w-7 sm:h-8 sm:w-8 rounded-full flex items-center justify-center shrink-0 transition-all",
                    isDone
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : isCurrent
                      ? "bg-primary text-primary-foreground ring-4 ring-primary/20 shadow-md scale-110"
                      : "bg-background border-2 border-border text-muted-foreground/60",
                  )}
                >
                  {isDone ? (
                    <Check className="h-4 w-4" strokeWidth={3} />
                  ) : isCurrent ? (
                    <span className="h-2 w-2 rounded-full bg-primary-foreground" />
                  ) : (
                    <span className="text-[11px] font-semibold">{idx + 1}</span>
                  )}
                </div>
                <div className={cn("h-[2px] flex-1", idx === steps.length - 1 ? "opacity-0" : nextDone ? "bg-primary" : "bg-border")} />
              </div>
              <span
                className={cn(
                  "mt-2 text-[9px] sm:text-[10px] leading-tight text-center font-bold tracking-wider uppercase px-0.5",
                  isCurrent ? "text-primary" : isDone ? "text-foreground/80" : "text-muted-foreground/60",
                )}
              >
                {sCfg.label}
              </span>
            </div>
          );
        })}
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
        "task_created", "task_rescheduled",
      ].includes(e.event_type));
    },
  });

  const timelineLabels: Record<string, string> = {
    submitted: "Bestilling mottatt",
    missing_info_requested: "Vi ba om mer informasjon",
    customer_reply: "Du sendte svar",
    converted_to_order: "Oppgave opprettet i ressursplan",
    notification_sent: "Oppdatering sendt",
    task_rescheduled: "Oppgaven er flyttet til ny tid",
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
  }).slice(0, 12);

  if (visibleEvents.length <= 1) return null;

  return (
    <Card className="border-0 shadow-[0_4px_16px_-6px_rgba(0,0,0,0.08)] rounded-3xl">
      <CardContent className="pt-7 pb-6 px-6 sm:px-8">
        <h3 className="text-base font-bold text-foreground mb-5 flex items-center gap-2.5">
          <span className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Clock className="h-4 w-4" />
          </span>
          Hendelseslogg
        </h3>
        <div className="relative pl-5">
          {/* vertical line */}
          <div className="absolute left-[7px] top-1.5 bottom-1.5 w-px bg-border" />
          <div className="space-y-4">
            {visibleEvents.map((e: any, i: number) => {
              const label = e.event_type === "status_changed"
                ? statusChangeLabel(e.payload)
                : timelineLabels[e.event_type];
              const isCustomer = e.event_type === "customer_reply";
              const isFirst = i === 0;
              return (
                <div key={e.id} className="relative">
                  <div
                    className={cn(
                      "absolute -left-5 top-1 h-3.5 w-3.5 rounded-full border-2 border-background",
                      isCustomer
                        ? "bg-primary"
                        : isFirst
                        ? "bg-primary/80 ring-2 ring-primary/20"
                        : "bg-muted-foreground/30",
                    )}
                  />
                  <p className={cn("text-sm leading-snug", isCustomer ? "font-semibold text-foreground" : "text-foreground")}>
                    {label}
                  </p>
                  {e.payload?.summary && (
                    <p className="text-xs text-muted-foreground mt-0.5">{e.payload.summary}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                    {format(new Date(e.created_at), "d. MMM yyyy 'kl.' HH:mm", { locale: nb })}
                  </p>
                </div>
              );
            })}
          </div>
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

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [token]);

  const { data: submission, isLoading, error } = useQuery({
    queryKey: ["tracking", token],
    enabled: !!token,
    queryFn: async () => {
      const { data: rpcData, error: rpcErr } = await (supabase as any)
        .rpc("get_submission_by_tracking_token", { _token: token! });
      if (rpcErr) throw rpcErr;
      const sub = Array.isArray(rpcData) ? rpcData[0] : rpcData;
      if (!sub) return null;
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

  const { data: messages = [] } = useQuery({
    queryKey: ["tracking-messages", token],
    enabled: !!token,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .rpc("get_submission_messages_by_token", { _token: token! });
      return data || [];
    },
  });

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

      await supabase.from("order_form_messages").insert({
        submission_id: submission.id,
        sender_type: "customer",
        sender_name: sub.submitter_name || sub.notification_recipient_name || "Bestiller",
        message_type: "message",
        body: replyText.trim() || "(Vedlegg sendt)",
        is_visible_to_customer: true,
        requires_reply: false,
      } as any);

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

      const wasOpenRequest = !!openRequest;
      if (openRequest) {
        await supabase.from("order_form_messages")
          .update({ replied_at: new Date().toISOString() } as any)
          .eq("id", openRequest.id);
      }

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

      const shouldAutoUpdateStatus = wasOpenRequest
        && !hasRemainingOpenRequests
        && ["missing_info", "waiting_customer"].includes(sub.status);

      await supabase.from("order_form_submissions")
        .update({
          customer_last_reply_at: new Date().toISOString(),
          last_activity_at: new Date().toISOString(),
          last_customer_message_at: new Date().toISOString(),
          ...(wasOpenRequest ? { awaiting_customer_reply: false, open_request_message_id: null } : {}),
          ...(shouldAutoUpdateStatus ? { status: "under_review" } : {}),
        } as any)
        .eq("id", submission.id);

      const logPayload: any = { has_text: !!replyText.trim(), file_count: replyFiles.length };
      if (shouldAutoUpdateStatus) {
        logPayload.auto_status_change = { from: sub.status, to: "under_review" };
      }
      await supabase.from("order_form_activity_log").insert({
        submission_id: submission.id,
        event_type: "customer_reply",
        payload: logPayload,
      } as any);

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
  const statusCfg = EXTERNAL_STATUS_CONFIG[externalStatus] || EXTERNAL_STATUS_CONFIG.received;
  const templateName = sub?.order_form_templates?.external_title || sub?.order_form_templates?.name || "Bestilling";
  const needsInfo = conversationState.hasOpenRequest;
  const lastUpdated = sub?.last_activity_at || sub?.updated_at || sub?.submitted_at;
  const human = STATUS_HUMAN_COPY[externalStatus] || STATUS_HUMAN_COPY.received;
  const mascot = STATUS_MASCOT[externalStatus] || mascotReceived;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
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

  // Split headline so the last word lands on its own line and gets the primary accent
  const headlineParts = (() => {
    const words = human.headline.trim().split(/\s+/);
    if (words.length < 2) return { lead: "", accent: human.headline };
    return { lead: words.slice(0, -1).join(" "), accent: words[words.length - 1] };
  })();

  return (
    <div className="min-h-screen bg-[hsl(30_40%_98%)] dark:bg-background">
      {/* Top brand bar */}
      <div className="bg-transparent">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-foreground text-background flex items-center justify-center font-black text-sm tracking-tighter">
              MCS
            </div>
            <div className="leading-tight">
              <div className="text-base font-bold text-foreground tracking-tight">Service</div>
              <div className="text-[10px] text-muted-foreground -mt-0.5">A part of <span className="text-primary font-semibold">Ernstrømgruppen</span></div>
            </div>
          </div>
          <span className="text-[11px] sm:text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
            <Shield className="h-3.5 w-3.5" />
            Sikker sporing
          </span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-10 space-y-5">
        {/* ── HERO ── */}
        <Card className="overflow-hidden border-0 shadow-[0_8px_30px_-8px_hsl(25_60%_50%/0.18)] rounded-[28px] bg-gradient-to-br from-[hsl(30_70%_94%)] via-[hsl(30_70%_96%)] to-[hsl(25_80%_92%)] dark:from-card dark:via-card dark:to-muted/40">
          <CardContent className="p-0">
            <div className="grid sm:grid-cols-[1.15fr_1fr] gap-0 items-stretch relative">
              {/* Decorative dots */}
              <div className="absolute top-6 right-8 h-3 w-3 rounded-full border-2 border-primary/30 hidden sm:block" />
              <div className="absolute top-12 right-20 text-primary/40 text-xl hidden sm:block">+</div>
              <div className="absolute bottom-10 right-6 text-primary/30 text-2xl hidden sm:block">+</div>

              {/* Left: text */}
              <div className="p-6 sm:p-10 space-y-6 order-2 sm:order-1 relative z-10">
                <div className="flex flex-wrap items-center gap-2.5">
                  <Badge
                    className={cn(
                      "text-white border-0 rounded-full px-3.5 py-1.5 text-xs font-semibold shadow-sm",
                      statusCfg.color,
                    )}
                  >
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-white/90 mr-1.5 animate-pulse" />
                    {statusCfg.label}
                  </Badge>
                  <span className="text-xs sm:text-sm text-foreground/70 font-medium">
                    {templateName}
                  </span>
                </div>

                <div className="space-y-3">
                  <h1 className="text-4xl sm:text-5xl font-black text-foreground tracking-tight leading-[1.05]">
                    {headlineParts.lead}{headlineParts.lead && " "}
                    <span className="text-primary block sm:inline">{headlineParts.accent}</span>
                  </h1>
                  <p className="text-sm sm:text-base text-foreground/70 leading-relaxed max-w-md">
                    {human.body}
                  </p>
                </div>

                <div className="flex flex-wrap gap-x-6 gap-y-3 pt-2">
                  <div className="flex items-start gap-2">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                        Bestilling
                      </span>
                      <span className="text-sm text-foreground font-bold">{sub.submission_no}</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                      <Calendar className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                        Sendt
                      </span>
                      <span className="text-sm text-foreground font-semibold">
                        {format(new Date(sub.submitted_at || sub.created_at), "d. MMM yyyy", { locale: nb })}
                      </span>
                    </div>
                  </div>
                  {lastUpdated && (
                    <div className="flex items-start gap-2">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                        <Timer className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                          Oppdatert
                        </span>
                        <span className="text-sm text-foreground font-semibold">
                          {formatDistanceToNow(new Date(lastUpdated), { addSuffix: true, locale: nb })}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {needsInfo && (
                  <Button
                    onClick={scrollToReplyAndFocus}
                    className="w-full sm:w-auto h-12 rounded-full shadow-md px-6 font-semibold"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Se hva vi trenger
                  </Button>
                )}
              </div>

              {/* Right: mascot */}
              <div className="relative order-1 sm:order-2 flex items-end justify-center pt-6 sm:pt-0">
                <img
                  src={mascot}
                  alt={statusCfg.label}
                  className="w-64 sm:w-full sm:max-w-[420px] h-auto object-contain object-bottom select-none pointer-events-none drop-shadow-[0_12px_24px_rgba(0,0,0,0.12)]"
                  draggable={false}
                />
              </div>
            </div>

            {/* Journey stepper */}
            <div className="px-6 sm:px-10 pb-7 pt-5 border-t border-primary/10 bg-white/40 dark:bg-background/40 backdrop-blur-sm">
              <JourneyStepper status={externalStatus} />
            </div>
          </CardContent>
        </Card>

        {/* Customer-fillable field requests from admin */}
        <CustomerFieldRequests
          token={token!}
          submitterName={sub.submitter_name || sub.notification_recipient_name}
        />

        {/* Summary */}
        {visibleSummary.length > 0 && (
          <Card className="border-border/60 shadow-sm">
            <CardContent className="pt-6 pb-5">
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Oppsummering
              </h3>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                {visibleSummary.map((f) => (
                  <div key={f.key}>
                    <dt className="text-[11px] uppercase tracking-wider text-muted-foreground/80 font-semibold">{f.label}</dt>
                    <dd className="text-sm text-foreground mt-0.5">{String(valuesMap[f.key])}</dd>
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
          <Card className="border-border/60 shadow-sm">
            <CardContent className="pt-6 pb-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  Meldinger
                </h3>
                {needsInfo && (
                  <Badge className="bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 rounded-full text-[10px]">
                    Venter på deg
                  </Badge>
                )}
              </div>

              {hasMessages ? (
                <div className="space-y-3 mb-5">
                  {allMessages.map((msg) => {
                    const isCustomer = msg.sender_type === "customer";
                    const isRequestInfo = msg.message_type === "request_info";
                    const isSystem = msg.sender_type === "system";

                    if (isSystem) {
                      return (
                        <div key={msg.id} className="text-center py-1">
                          <span className="text-[11px] text-muted-foreground bg-muted/60 px-3 py-1 rounded-full">
                            {msg.body}
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div key={msg.id} className={cn("flex gap-2.5", isCustomer ? "justify-end" : "justify-start")}>
                        {!isCustomer && (
                          <div className="h-8 w-8 rounded-full bg-foreground text-background flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                            MCS
                          </div>
                        )}
                        <div
                          className={cn(
                            "rounded-2xl p-3.5 text-sm max-w-[80%] shadow-sm",
                            isCustomer
                              ? "bg-primary text-primary-foreground rounded-br-sm"
                              : isRequestInfo
                              ? "bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800 rounded-bl-sm"
                              : "bg-muted/70 rounded-bl-sm",
                          )}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            {isRequestInfo && (
                              <AlertTriangle className="h-3 w-3 text-amber-600 shrink-0" />
                            )}
                            <span
                              className={cn(
                                "text-[11px] font-semibold",
                                isCustomer
                                  ? "text-primary-foreground/90"
                                  : isRequestInfo
                                  ? "text-amber-800 dark:text-amber-300"
                                  : "text-foreground/80",
                              )}
                            >
                              {isCustomer ? "Du" : (msg.sender_name || "MCS Service")}
                            </span>
                            {isRequestInfo && (
                              <Badge variant="outline" className="text-[9px] bg-amber-100 text-amber-700 border-amber-300">
                                Vi trenger info
                              </Badge>
                            )}
                            <span
                              className={cn(
                                "text-[10px] ml-auto",
                                isCustomer ? "text-primary-foreground/70" : "text-muted-foreground",
                              )}
                            >
                              {format(new Date(msg.created_at), "d. MMM HH:mm", { locale: nb })}
                            </span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.body}</p>
                          {isRequestInfo && msg.requires_reply && (
                            <div className="mt-2 pt-2 border-t border-amber-200/70 dark:border-amber-800/70">
                              {msg.replied_at ? (
                                <span className="text-[10px] text-green-700 dark:text-green-400 flex items-center gap-1 font-medium">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Besvart {format(new Date(msg.replied_at), "d. MMM HH:mm", { locale: nb })}
                                </span>
                              ) : (
                                <span className="text-[10px] text-amber-700 dark:text-amber-400 flex items-center gap-1 font-medium">
                                  <Clock className="h-3 w-3" />
                                  Venter på svar fra deg
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        {isCustomer && (
                          <div className="h-8 w-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                            Du
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mb-5 italic">
                  Ingen meldinger ennå. Skriv gjerne om du har spørsmål eller mer informasjon.
                </p>
              )}

              {/* Reply input */}
              {!isClosed && (
                <div className="space-y-3 pt-4 border-t border-border/60">
                  <Textarea
                    ref={replyInputRef}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={openRequest ? "Skriv svaret ditt her..." : "Skriv en melding til oss..."}
                    rows={3}
                    className="text-sm resize-none rounded-xl"
                  />

                  <div>
                    <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
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
                          <div key={i} className="flex items-center gap-2 text-xs bg-muted/40 rounded-lg px-2.5 py-1.5">
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
                    className="w-full sm:w-auto h-11 text-sm rounded-full px-6 shadow-sm"
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
          <Card className="border-0 shadow-[0_4px_16px_-6px_rgba(0,0,0,0.08)] rounded-3xl">
            <CardContent className="pt-7 pb-6 px-6 sm:px-8">
              <h3 className="text-base font-bold text-foreground mb-5 flex items-center gap-2.5">
                <span className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Paperclip className="h-4 w-4" />
                </span>
                Vedlegg ({attachments.length})
              </h3>
              <div className="space-y-2.5">
                {attachments.map((att: any) => (
                  <div
                    key={att.id}
                    className="flex items-center gap-3 p-3.5 rounded-2xl border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors group"
                  >
                    <div className="h-10 w-10 rounded-xl bg-background border border-border/60 flex items-center justify-center shrink-0">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate">{att.file_name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {att.file_size && (
                          <span className="text-[11px] text-muted-foreground">
                            {(att.file_size / 1024).toFixed(0)} KB
                          </span>
                        )}
                        {att.field_key === "customer_reply" && (
                          <Badge variant="outline" className="text-[9px]">Ettersendt</Badge>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="h-9 w-9 rounded-xl bg-background border border-border/60 text-muted-foreground hover:text-primary hover:border-primary/40 flex items-center justify-center shrink-0 transition-colors"
                      aria-label="Last ned"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center pt-4 pb-10 space-y-1">
          <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5">
            <Shield className="h-3 w-3" />
            Denne lenken er personlig og skal ikke deles med andre.
          </p>
          <p className="text-[11px] text-muted-foreground/70">
            En tjeneste fra <span className="font-semibold text-foreground/80">MCS Service</span>
          </p>
        </div>
      </div>
    </div>
  );
}
