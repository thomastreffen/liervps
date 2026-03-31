import { useState, useMemo, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import {
  CheckCircle2, Clock, FileText, Loader2, AlertCircle,
  Send, Upload, Paperclip, ChevronRight, MessageSquare, X,
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

/* ── External status progress bar ── */
function StatusProgress({ status }: { status: ExternalStatus }) {
  const config = EXTERNAL_STATUS_CONFIG[status] || EXTERNAL_STATUS_CONFIG.received;
  const steps = EXTERNAL_STATUS_STEPS;
  const currentStep = config.step;
  const isNeedsInfo = status === "needs_info";

  return (
    <div className="space-y-3">
      {/* Step bar */}
      <div className="flex items-center gap-1">
        {steps.map((s, i) => {
          const stepConfig = EXTERNAL_STATUS_CONFIG[s];
          const isActive = stepConfig.step <= currentStep;
          const isCurrent = s === status || (isNeedsInfo && s === "processing");
          return (
            <div key={s} className="flex-1 flex flex-col items-center gap-1">
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

      {/* Current status badge */}
      <div className="flex items-center gap-2">
        <div className={cn("h-3 w-3 rounded-full", config.color)} />
        <span className="text-sm font-semibold text-foreground">{config.label}</span>
      </div>
      <p className="text-sm text-muted-foreground">{config.description}</p>
    </div>
  );
}

/* ── Main page ── */
export default function OrderTrackingPage() {
  const { token } = useParams<{ token: string }>();
  const qc = useQueryClient();
  const [replyText, setReplyText] = useState("");
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [showReplyForm, setShowReplyForm] = useState(false);

  // Fetch submission by tracking token
  const { data: submission, isLoading, error } = useQuery({
    queryKey: ["tracking", token],
    enabled: !!token,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_form_submissions")
        .select("*, order_form_templates(name, external_title)")
        .eq("public_tracking_token", token!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fetch form values
  const { data: values = [] } = useQuery({
    queryKey: ["tracking-values", submission?.id],
    enabled: !!submission?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("order_form_submission_values")
        .select("*")
        .eq("submission_id", submission!.id);
      return data || [];
    },
  });

  // Fetch shared comments
  const { data: comments = [] } = useQuery({
    queryKey: ["tracking-comments", submission?.id],
    enabled: !!submission?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("order_form_comments")
        .select("*")
        .eq("submission_id", submission!.id)
        .eq("visibility", "shared")
        .order("created_at", { ascending: true });
      return data || [];
    },
  });

  // Fetch attachments
  const { data: attachments = [] } = useQuery({
    queryKey: ["tracking-attachments", submission?.id],
    enabled: !!submission?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("order_form_submission_attachments")
        .select("*")
        .eq("submission_id", submission!.id)
        .order("uploaded_at", { ascending: true });
      return data || [];
    },
  });

  // Update last viewed
  useEffect(() => {
    if (submission?.id) {
      supabase.from("order_form_submissions")
        .update({ customer_last_viewed_at: new Date().toISOString() } as any)
        .eq("id", submission.id)
        .then();
    }
  }, [submission?.id]);

  // Submit customer reply
  const submitReply = useMutation({
    mutationFn: async () => {
      if (!replyText.trim() && replyFiles.length === 0) return;
      if (!submission) return;

      // Insert comment
      if (replyText.trim()) {
        await supabase.from("order_form_comments").insert({
          submission_id: submission.id,
          body: replyText.trim(),
          comment_type: "customer_reply",
          visibility: "shared",
          is_customer_reply: true,
          author_name: (submission as any).submitter_name || "Bestiller",
        } as any);
      }

      // Upload files
      for (const file of replyFiles) {
        const path = `${(submission as any).company_id}/${submission.id}/reply_${Date.now()}_${file.name}`;
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

      // Update last reply timestamp
      await supabase.from("order_form_submissions")
        .update({ customer_last_reply_at: new Date().toISOString(), last_activity_at: new Date().toISOString() } as any)
        .eq("id", submission.id);

      // Log activity
      await supabase.from("order_form_activity_log").insert({
        submission_id: submission.id,
        event_type: "customer_reply",
        payload: { has_text: !!replyText.trim(), file_count: replyFiles.length },
      } as any);
    },
    onSuccess: () => {
      setReplyText("");
      setReplyFiles([]);
      setShowReplyForm(false);
      qc.invalidateQueries({ queryKey: ["tracking-comments", submission?.id] });
      qc.invalidateQueries({ queryKey: ["tracking-attachments", submission?.id] });
      toast.success("Svaret ditt er sendt!");
    },
    onError: () => {
      toast.error("Kunne ikke sende svaret. Prøv igjen.");
    },
  });

  // Build summary
  const valuesMap = useMemo(() => {
    const m: Record<string, any> = {};
    values.forEach((v: any) => { m[v.field_key] = v.value; });
    return m;
  }, [values]);

  const sub = submission as any;
  const externalStatus: ExternalStatus = sub?.external_status || "received";
  const statusConfig = EXTERNAL_STATUS_CONFIG[externalStatus] || EXTERNAL_STATUS_CONFIG.received;
  const templateName = sub?.order_form_templates?.external_title || sub?.order_form_templates?.name || "Bestilling";
  const needsInfo = externalStatus === "needs_info";

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

  // Relevant summary fields
  const summaryFields = [
    { key: "kundenavn", label: "Kunde" },
    { key: "firmanavn", label: "Firma" },
    { key: "bestiller_navn", label: "Bestiller" },
    { key: "kontaktperson_kunde", label: "Kontaktperson" },
    { key: "anleggsadresse", label: "Oppdragssted" },
    { key: "firmanavn_adresse", label: "Adresse" },
    { key: "oensket_dato", label: "Ønsket dato" },
    { key: "oensket_tid", label: "Ønsket tid" },
    { key: "referanse_po", label: "Referanse/PO" },
    { key: "midlertidig_referanse", label: "Referanse" },
    { key: "oppdragstittel", label: "Oppdrag" },
  ];

  const visibleSummary = summaryFields.filter((f) => valuesMap[f.key]);

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
          <p className="text-sm text-muted-foreground">
            Sendt {format(new Date(sub.submitted_at || sub.created_at), "d. MMMM yyyy 'kl.' HH:mm", { locale: nb })}
          </p>
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
                <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                    Vi trenger litt mer informasjon
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                    Se meldingene nedenfor og svar med det vi etterspør, så behandler vi bestillingen videre.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => setShowReplyForm(true)}
              >
                <Send className="h-3.5 w-3.5 mr-1.5" />
                Svar nå
              </Button>
            </CardContent>
          </Card>
        )}

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

        {/* Messages / timeline */}
        {comments.length > 0 && (
          <Card>
            <CardContent className="pt-5 pb-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">
                <MessageSquare className="h-3.5 w-3.5 inline mr-1.5" />
                Meldinger
              </h3>
              <div className="space-y-4">
                {comments.map((c: any) => (
                  <div
                    key={c.id}
                    className={cn(
                      "rounded-xl p-3 text-sm",
                      c.is_customer_reply
                        ? "bg-primary/5 border border-primary/20 ml-4 sm:ml-8"
                        : "bg-muted/50 mr-4 sm:mr-8",
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-foreground">
                        {c.is_customer_reply ? (c.author_name || "Du") : "Saksbehandler"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(c.created_at), "d. MMM HH:mm", { locale: nb })}
                      </span>
                    </div>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{c.body}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Reply form */}
        {(showReplyForm || needsInfo) && (
          <Card>
            <CardContent className="pt-5 pb-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">
                Send svar eller mer informasjon
              </h3>
              <Textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Skriv ditt svar her..."
                rows={3}
                className="text-sm"
              />

              {/* File upload */}
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
            </CardContent>
          </Card>
        )}

        {/* Show reply button if not already showing */}
        {!showReplyForm && !needsInfo && externalStatus !== "completed" && externalStatus !== "closed" && (
          <Button
            variant="outline"
            className="w-full h-11"
            onClick={() => setShowReplyForm(true)}
          >
            <MessageSquare className="h-4 w-4 mr-1.5" />
            Send melding eller mer informasjon
          </Button>
        )}

        {/* Footer */}
        <div className="text-center pt-4 pb-8">
          <p className="text-xs text-muted-foreground">
            Denne siden er kun tilgjengelig via din personlige sporingslenke.
          </p>
        </div>
      </div>
    </div>
  );
}
