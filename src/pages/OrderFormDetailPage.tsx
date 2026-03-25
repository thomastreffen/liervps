import { useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft, MessageSquare, Clock, Paperclip, AlertTriangle,
  ArrowRight, FileText, Download, Mail, MailCheck, MailX, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ORDER_STATUS_CONFIG,
  ORDER_PRIORITY_CONFIG,
  type OrderFormSubmissionStatus,
} from "@/types/order-forms";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { computeQualityScore, type QualityResult } from "@/lib/order-quality";
import { QualityBadge } from "@/components/orders/QualityBadge";
import { QualityIssuesPanel } from "@/components/orders/QualityIssuesPanel";
import { RequestInfoDialog } from "@/components/orders/RequestInfoDialog";
import { ConvertDialog } from "@/components/orders/ConvertDialog";
import { TripletexExportPanel } from "@/components/orders/TripletexExportPanel";
import { AttachmentPreviewDrawer } from "@/components/orders/AttachmentPreviewDrawer";
import { AssignResourceTaskDialog } from "@/components/orders/AssignResourceTaskDialog";

export default function OrderFormDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [comment, setComment] = useState("");
  const [requestInfoOpen, setRequestInfoOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [tripletexOpen, setTripletexOpen] = useState(false);
  const [assignTaskOpen, setAssignTaskOpen] = useState(false);
  const [previewAttIdx, setPreviewAttIdx] = useState<number | null>(null);

  const { data: submission, isLoading } = useQuery({
    queryKey: ["order-form-submission", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_form_submissions")
        .select("*, order_form_templates(name, slug)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: values = [] } = useQuery({
    queryKey: ["order-form-values", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase
        .from("order_form_submission_values")
        .select("*")
        .eq("submission_id", id!);
      return data || [];
    },
  });

  const { data: attachments = [] } = useQuery({
    queryKey: ["order-form-attachments", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase
        .from("order_form_submission_attachments")
        .select("*")
        .eq("submission_id", id!);
      return data || [];
    },
  });

  const { data: comments = [] } = useQuery({
    queryKey: ["order-form-comments", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase
        .from("order_form_comments")
        .select("*")
        .eq("submission_id", id!)
        .order("created_at", { ascending: true });
      return data || [];
    },
  });

  const { data: activity = [] } = useQuery({
    queryKey: ["order-form-activity", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase
        .from("order_form_activity_log")
        .select("*")
        .eq("submission_id", id!)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: sections = [] } = useQuery({
    queryKey: ["order-form-template-structure", submission?.template_id],
    enabled: !!submission?.template_id,
    queryFn: async () => {
      const { data: secs } = await supabase
        .from("order_form_template_sections")
        .select("*")
        .eq("template_id", submission!.template_id)
        .order("sort_order");
      if (!secs) return [];

      const { data: fields } = await supabase
        .from("order_form_template_fields")
        .select("*")
        .eq("template_id", submission!.template_id)
        .eq("is_active", true)
        .order("sort_order");

      return secs.map((s: any) => ({
        ...s,
        fields: (fields || []).filter((f: any) => f.section_id === s.id),
      }));
    },
  });

  const valuesMap: Record<string, any> = useMemo(() => {
    const map: Record<string, any> = {};
    values.forEach((v: any) => { map[v.field_key] = v.value; });
    return map;
  }, [values]);

  // Helper to find value by prefix (handles suffixed keys like "epost_kunde_abc123")
  const findVal = useCallback((...prefixes: string[]): string => {
    for (const prefix of prefixes) {
      if (valuesMap[prefix]) return String(valuesMap[prefix]);
      const key = Object.keys(valuesMap).find(k => k.startsWith(prefix));
      if (key && valuesMap[key]) return String(valuesMap[key]);
    }
    return "";
  }, [valuesMap]);

  const bestillerEpost = useMemo(() =>
    findVal("bestiller_epost", "epost_kunde", "epost", "kontakt_epost"),
    [findVal]
  );

  // Collect all template fields for dynamic quality assessment
  const allTemplateFields = useMemo(() => {
    return sections.flatMap((s: any) => (s.fields || []).map((f: any) => ({
      field_key: f.field_key,
      label: f.label,
      field_type: f.field_type,
      is_required: f.is_required,
    })));
  }, [sections]);

  const qualityResult: QualityResult = useMemo(() => {
    return computeQualityScore(valuesMap, attachments as any, allTemplateFields);
  }, [valuesMap, attachments, allTemplateFields]);

  const updateStatus = useMutation({
    mutationFn: async (newStatus: string) => {
      const { error } = await supabase
        .from("order_form_submissions")
        .update({ status: newStatus })
        .eq("id", id!);
      if (error) throw error;

      await supabase.from("order_form_activity_log").insert({
        submission_id: id!,
        event_type: "status_changed",
        payload: { from: submission?.status, to: newStatus },
        created_by: user?.id,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order-form-submission", id] });
      qc.invalidateQueries({ queryKey: ["order-form-activity", id] });
      toast.success("Status oppdatert");
    },
  });

  const addComment = useMutation({
    mutationFn: async () => {
      if (!comment.trim()) return;
      const { error } = await supabase.from("order_form_comments").insert({
        submission_id: id!,
        body: comment.trim(),
        comment_type: "internal",
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setComment("");
      qc.invalidateQueries({ queryKey: ["order-form-comments", id] });
      toast.success("Kommentar lagt til");
    },
  });

  const sendNotification = useMutation({
    mutationFn: async (type: string) => {
      const { data, error } = await supabase.functions.invoke("order-form-notify", {
        body: { submission_id: id, notification_type: type },
      });
      if (error) throw error;
      if (data && !data.success) throw new Error(data.error || data.reason || "Sending feilet");
      return data;
    },
    onSuccess: (_, type) => {
      qc.invalidateQueries({ queryKey: ["order-form-submission", id] });
      qc.invalidateQueries({ queryKey: ["order-form-activity", id] });
      const labels: Record<string, string> = {
        new_order: "Varsling sendt til postkontor",
        confirmation: "Bekreftelse sendt til bestiller",
      };
      toast.success(labels[type] || "E-post sendt");
    },
    onError: (err: any) => {
      toast.error("E-postsending feilet: " + (err.message || "Ukjent feil"));
    },
  });

  if (isLoading) return <div className="p-6 text-center text-muted-foreground">Laster...</div>;
  if (!submission) return <div className="p-6 text-center text-muted-foreground">Ikke funnet</div>;

  const statusConfig = ORDER_STATUS_CONFIG[submission.status as OrderFormSubmissionStatus];
  const priorityConfig = ORDER_PRIORITY_CONFIG[submission.priority];
  const sub = submission as any;

  const eventTypeLabels: Record<string, string> = {
    submitted: "Bestilling innsendt",
    status_changed: "Status endret",
    missing_info_requested: "Forespørsel om mer info",
    comment_added: "Kommentar lagt til",
    converted_to_case: "Konvertert til sak",
    converted_to_order: "Konvertert til oppdrag",
    notification_sent: "E-postvarsling sendt",
    notification_failed: "E-postsending feilet",
    exported_to_tripletex: "Eksportert til Tripletex",
  };

  // Group attachments by category
  const attByCategory: Record<string, any[]> = {};
  attachments.forEach((a: any) => {
    const cat = a.category || "Annet";
    if (!attByCategory[cat]) attByCategory[cat] = [];
    attByCategory[cat].push(a);
  });

  const hasNotification = !!sub.notification_sent_at;
  const hasConfirmation = !!sub.confirmation_sent_at;
  const hasError = !!sub.notification_error;

  return (
    <div className="space-y-6 p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/orders")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-foreground">{submission.submission_no}</h1>
            <Badge className={statusConfig?.color || ""}>{statusConfig?.label || submission.status}</Badge>
            {submission.priority !== "normal" && priorityConfig && (
              <Badge className={priorityConfig.color}>{priorityConfig.label}</Badge>
            )}
            <QualityBadge score={qualityResult.score} />
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {sub.order_form_templates?.name} ·{" "}
            {format(new Date(submission.submitted_at), "d. MMMM yyyy HH:mm", { locale: nb })}
            {submission.requester_type === "internal" && " · Intern bestilling"}
          </p>
        </div>
      </div>

      {/* Top summary bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          { label: "Kunde", value: (submission.summary as any)?.kundenavn },
          { label: "Oppdrag", value: (submission.summary as any)?.oppdragstittel },
          { label: "Hastegrad", value: (submission.summary as any)?.hastegrad },
          { label: "Type", value: submission.requester_type === "internal" ? "Intern" : "Ekstern" },
          { label: "Status", value: statusConfig?.label },
          { label: "Bestiller", value: (submission.summary as any)?.bestiller_navn },
        ].map(({ label, value }) => (
          <div key={label} className="text-sm">
            <span className="text-muted-foreground text-xs">{label}</span>
            <p className="font-medium truncate">{value || "–"}</p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        <Select value={submission.status} onValueChange={(v) => updateStatus.mutate(v)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(ORDER_STATUS_CONFIG).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => setRequestInfoOpen(true)}>
          <AlertTriangle className="h-3.5 w-3.5 mr-1" />
          Be om mer info
        </Button>
        <Button variant="outline" size="sm" onClick={() => setConvertOpen(true)} disabled={!!sub.converted_to_id}>
          <ArrowRight className="h-3.5 w-3.5 mr-1" />
          Konverter
        </Button>
        <Button variant="outline" size="sm" onClick={() => setTripletexOpen(true)}>
          <Download className="h-3.5 w-3.5 mr-1" />
          Tripletex
        </Button>
        <Button variant="outline" size="sm" onClick={() => setAssignTaskOpen(true)}>
          <UserPlus className="h-3.5 w-3.5 mr-1" />
          Tildel ressursoppgave
        </Button>
        <Button
          variant="outline" size="sm"
          onClick={() => sendNotification.mutate("new_order")}
          disabled={sendNotification.isPending}
        >
          <Mail className="h-3.5 w-3.5 mr-1" />
          {hasNotification ? "Send varsling på nytt" : "Send varsling manuelt"}
        </Button>
        {bestillerEpost && !hasConfirmation && (
          <Button
            variant="outline" size="sm"
            onClick={() => sendNotification.mutate("confirmation")}
            disabled={sendNotification.isPending}
          >
            <MailCheck className="h-3.5 w-3.5 mr-1" />
            Send bekreftelse
          </Button>
        )}
      </div>

      {/* Email & conversion status indicators */}
      <div className="flex flex-wrap gap-2">
        {hasNotification && (
          <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">
            <MailCheck className="h-3 w-3 mr-1" />
            Varsling sendt {format(new Date(sub.notification_sent_at), "d. MMM HH:mm", { locale: nb })}
          </Badge>
        )}
        {hasConfirmation && (
          <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
            <MailCheck className="h-3 w-3 mr-1" />
            Bekreftelse sendt {format(new Date(sub.confirmation_sent_at), "d. MMM HH:mm", { locale: nb })}
          </Badge>
        )}
        {hasError && (
          <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200">
            <MailX className="h-3 w-3 mr-1" />
            E-postfeil: {sub.notification_error?.substring(0, 60)}
          </Badge>
        )}
        {sub.converted_to_type && (
          <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">
            <ArrowRight className="h-3 w-3 mr-1" />
            Konvertert til {sub.converted_to_type === "case" ? "sak" : "oppdrag"}
            {sub.converted_to_id && (
              <button
                className="ml-1 underline"
                onClick={() => {
                  const url = sub.converted_to_type === "case"
                    ? `/cases/${sub.converted_to_id}`
                    : `/projects/plan?openTask=${sub.converted_to_id}`;
                  navigate(url);
                }}
              >
                <ExternalLink className="h-3 w-3 inline" />
              </button>
            )}
          </Badge>
        )}
      </div>

      {/* Quality issues panel - only show if there are issues */}
      {qualityResult.score !== "green" && <QualityIssuesPanel result={qualityResult} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content: Sections with field values */}
        <div className="lg:col-span-2 space-y-4">
          {sections.map((section: any) => {
            const sectionFields = section.fields || [];
            const hasValues = sectionFields.some((f: any) => valuesMap[f.field_key] != null);
            if (!hasValues && sectionFields.length > 0) return null;

            return (
              <Card key={section.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{section.title}</CardTitle>
                  {section.description && (
                    <p className="text-xs text-muted-foreground">{section.description}</p>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {sectionFields.map((field: any) => {
                      const val = valuesMap[field.field_key];
                      if (val == null && !field.is_required) return null;
                      return (
                        <div key={field.id} className="flex flex-col">
                          <span className="text-xs text-muted-foreground">{field.label}</span>
                          <span className="text-sm font-medium">
                            {renderFieldValue(val, field.field_type)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Attachments grouped by category */}
          {attachments.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Paperclip className="h-4 w-4" />
                  Vedlegg ({attachments.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(attByCategory).map(([cat, files]) => (
                    <div key={cat}>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{cat}</p>
                      <div className="space-y-1.5">
                        {files.map((att: any) => {
                          const globalIdx = attachments.findIndex((a: any) => a.id === att.id);
                          return (
                            <AttachmentRow
                              key={att.id}
                              attachment={att}
                              onPreview={() => setPreviewAttIdx(globalIdx)}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar: Comments & Activity */}
        <div className="space-y-4">
          {/* Comments */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Kommentarer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 mb-3 max-h-64 overflow-y-auto">
                {comments.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Ingen kommentarer ennå</p>
                ) : (
                  comments.map((c: any) => (
                    <div key={c.id} className={`text-sm border-l-2 pl-3 ${
                      c.comment_type === "missing_info_request" ? "border-amber-400" : "border-border"
                    }`}>
                      {c.comment_type === "missing_info_request" && (
                        <Badge variant="outline" className="text-[9px] mb-1 bg-amber-50 text-amber-700 border-amber-200">
                          Forespørsel
                        </Badge>
                      )}
                      <p className="whitespace-pre-wrap">{c.body}</p>
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(c.created_at), "d. MMM HH:mm", { locale: nb })}
                      </span>
                    </div>
                  ))
                )}
              </div>
              <div className="flex gap-2">
                <Textarea
                  placeholder="Skriv kommentar..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="min-h-[60px] text-sm"
                />
              </div>
              <Button
                size="sm"
                className="mt-2"
                disabled={!comment.trim()}
                onClick={() => addComment.mutate()}
              >
                Legg til
              </Button>
            </CardContent>
          </Card>

          {/* Activity */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Aktivitetslogg
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {activity.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Ingen aktivitet</p>
                ) : (
                  activity.map((a: any) => (
                    <div key={a.id} className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {eventTypeLabels[a.event_type] || a.event_type}
                      </span>
                      {a.payload?.from && a.payload?.to && (
                        <> · {ORDER_STATUS_CONFIG[a.payload.from as OrderFormSubmissionStatus]?.label || a.payload.from} → {ORDER_STATUS_CONFIG[a.payload.to as OrderFormSubmissionStatus]?.label || a.payload.to}</>
                      )}
                      {a.payload?.recipients && (
                        <> · {(a.payload.recipients as string[]).join(", ")}</>
                      )}
                      <br />
                      {format(new Date(a.created_at), "d. MMM HH:mm", { locale: nb })}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialogs */}
      <RequestInfoDialog
        open={requestInfoOpen}
        onOpenChange={setRequestInfoOpen}
        submissionId={id!}
        submissionNo={submission.submission_no}
        bestillerEpost={bestillerEpost}
      />
      <ConvertDialog
        open={convertOpen}
        onOpenChange={setConvertOpen}
        submissionId={id!}
        summary={submission.summary as Record<string, any> | null}
        values={valuesMap}
        submissionNo={submission.submission_no}
      />
      <TripletexExportPanel
        open={tripletexOpen}
        onOpenChange={setTripletexOpen}
        submissionId={id!}
        values={valuesMap}
        summary={submission.summary as Record<string, any> | null}
        submissionNo={submission.submission_no}
      />
      <AttachmentPreviewDrawer
        open={previewAttIdx !== null}
        onClose={() => setPreviewAttIdx(null)}
        attachments={attachments as any[]}
        initialIndex={previewAttIdx ?? 0}
      />
    </div>
  );
}

function AttachmentRow({ attachment, onPreview }: { attachment: any; onPreview?: () => void }) {
  return (
    <button
      type="button"
      onClick={() => onPreview?.()}
      className="flex items-center gap-2 text-sm p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors w-full text-left cursor-pointer"
    >
      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="truncate flex-1 font-medium">{attachment.file_name}</span>
      <span className="text-[10px] text-muted-foreground">
        {attachment.file_size ? (attachment.file_size < 1024 * 1024 ? `${Math.round(attachment.file_size / 1024)} KB` : `${(attachment.file_size / 1024 / 1024).toFixed(1)} MB`) : ""}
      </span>
      <Download className="h-3.5 w-3.5 text-primary shrink-0" />
    </button>
  );
}

function renderFieldValue(val: any, type: string): string {
  if (val == null) return "–";
  if (typeof val === "boolean") return val ? "Ja" : "Nei";
  if (Array.isArray(val)) return val.join(", ");
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}
