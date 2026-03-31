import { useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft, MessageSquare, Clock, Paperclip, AlertTriangle,
  ArrowRight, FileText, Download, Mail, MailCheck, MailX, ExternalLink, UserPlus,
  Tag, User, LinkIcon, X, MoreHorizontal, Eye, Send, Globe, UserCheck, Bell, BellRing,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ORDER_STATUS_CONFIG,
  ORDER_PRIORITY_CONFIG,
  CHANNEL_LABELS,
  EXTERNAL_STATUS_CONFIG,
  mapToExternalStatus,
  type OrderFormSubmissionStatus,
} from "@/types/order-forms";
import { format, formatDistanceToNow } from "date-fns";
import { nb } from "date-fns/locale";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuth } from "@/hooks/useAuth";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { computeQualityScore, type QualityResult } from "@/lib/order-quality";
import { QualityBadge } from "@/components/orders/QualityBadge";
import { QualityIssuesPanel } from "@/components/orders/QualityIssuesPanel";
import { RequestInfoDialog } from "@/components/orders/RequestInfoDialog";
import { ConvertDialog } from "@/components/orders/ConvertDialog";
import { TripletexExportPanel } from "@/components/orders/TripletexExportPanel";
import { AttachmentPreviewDrawer } from "@/components/orders/AttachmentPreviewDrawer";
import { AssignResourceTaskDialog } from "@/components/orders/AssignResourceTaskDialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

export default function OrderFormDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { activeCompanyId } = useCompanyContext();
  const [comment, setComment] = useState("");
  const [commentVisibility, setCommentVisibility] = useState<"internal" | "shared">("internal");
  const [requestInfoOpen, setRequestInfoOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [tripletexOpen, setTripletexOpen] = useState(false);
  const [assignTaskOpen, setAssignTaskOpen] = useState(false);
  const [previewAttIdx, setPreviewAttIdx] = useState<number | null>(null);
  const [assignPopoverOpen, setAssignPopoverOpen] = useState(false);
  const [assignSearch, setAssignSearch] = useState("");
  const [notifyOnStatusChange, setNotifyOnStatusChange] = useState(false);
  const [notifyOnAssign, setNotifyOnAssign] = useState(false);

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

  // Fetch available users for assignment
  const { data: companyUsers = [] } = useQuery({
    queryKey: ["company-users-for-assign", activeCompanyId],
    enabled: !!activeCompanyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_accounts")
        .select("auth_user_id, person:people(full_name)")
        .eq("is_active", true);
      if (!data) return [];
      return (data as any[])
        .filter(u => u.person?.full_name)
        .map(u => ({ id: u.auth_user_id, name: u.person.full_name }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
  });

  // Resolve current assignee name
  const { data: assigneeName } = useQuery({
    queryKey: ["assignee-name", submission?.assigned_to],
    enabled: !!submission?.assigned_to,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_accounts")
        .select("person:people(full_name)")
        .eq("auth_user_id", submission!.assigned_to!)
        .eq("is_active", true)
        .single();
      return (data as any)?.person?.full_name || null;
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
      // Send customer notification if toggle is on
      if (notifyOnStatusChange) {
        const eventKeyMap: Record<string, string> = {
          in_progress: "in_progress",
          closed: "completed",
          rejected: "rejected",
          task_created: "task_created",
          ready_for_planning: "task_created",
        };
        const eventKey = eventKeyMap[newStatus] || "status_changed";
        await supabase.functions.invoke("order-form-notify", {
          body: { submission_id: id, notification_type: "customer_update", event_key: eventKey },
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order-form-submission", id] });
      qc.invalidateQueries({ queryKey: ["order-form-activity", id] });
      setNotifyOnStatusChange(false);
      toast.success("Status oppdatert");
    },
  });

  const addComment = useMutation({
    mutationFn: async () => {
      if (!comment.trim()) return;
      const { error } = await supabase.from("order_form_comments").insert({
        submission_id: id!,
        body: comment.trim(),
        comment_type: commentVisibility === "shared" ? "shared_message" : "internal",
        visibility: commentVisibility,
        created_by: user?.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      setComment("");
      qc.invalidateQueries({ queryKey: ["order-form-comments", id] });
      toast.success(commentVisibility === "shared" ? "Melding delt med bestiller" : "Intern kommentar lagt til");
    },
  });

  const assignResponsible = useMutation({
    mutationFn: async (assigneeId: string | null) => {
      const { error } = await supabase
        .from("order_form_submissions")
        .update({ assigned_to: assigneeId })
        .eq("id", id!);
      if (error) throw error;
      // Log activity
      const assigneeName = companyUsers.find(u => u.id === assigneeId)?.name || "Ingen";
      await supabase.from("order_form_activity_log").insert({
        submission_id: id!,
        event_type: "assigned",
        payload: { assigned_to: assigneeId, assigned_to_name: assigneeName },
        created_by: user?.id,
      });
      // Create notification for assignee
      if (assigneeId && assigneeId !== user?.id) {
        await supabase.from("notifications").insert({
          user_id: assigneeId,
          company_id: submission?.company_id || activeCompanyId,
          type: "order_assigned",
          priority: "important",
          title: `Du er tildelt ansvar for bestilling ${submission?.submission_no}`,
          message: `${(submission?.summary as any)?.oppdragstittel || submission?.submission_no || "Bestilling"} er tildelt deg.`,
          link_url: `/orders/${id}`,
          entity_type: "order_form_submission",
          entity_id: id,
          actor_user_id: user?.id,
        });
      }
      // Send customer notification if toggle is on
      if (notifyOnAssign && assigneeId) {
        await supabase.functions.invoke("order-form-notify", {
          body: { submission_id: id, notification_type: "customer_update", event_key: "assigned" },
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order-form-submission", id] });
      qc.invalidateQueries({ queryKey: ["order-form-activity", id] });
      qc.invalidateQueries({ queryKey: ["assignee-name"] });
      setAssignPopoverOpen(false);
      setAssignSearch("");
      setNotifyOnAssign(false);
      toast.success("Ansvarlig oppdatert");
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

  const externalStatus = mapToExternalStatus(submission.status as OrderFormSubmissionStatus);
  const externalConfig = EXTERNAL_STATUS_CONFIG[externalStatus];

  const eventTypeLabels: Record<string, string> = {
    submitted: "Bestilling innsendt",
    status_changed: "Status endret",
    missing_info_requested: "Forespørsel om mer info sendt",
    comment_added: "Kommentar lagt til",
    customer_reply: "Svar mottatt fra bestiller",
    converted_to_case: "Konvertert til sak",
    converted_to_order: "Oppgave opprettet i ressursplan",
    notification_sent: "E-post sendt",
    notification_failed: "E-postsending feilet",
    exported_to_tripletex: "Eksportert til Tripletex",
    assigned: "Ansvarlig tildelt",
  };

  const trackingUrl = sub.public_tracking_token
    ? `${window.location.origin}/bestilling/status/${sub.public_tracking_token}`
    : null;

  const attByCategory: Record<string, any[]> = {};
  attachments.forEach((a: any) => {
    const cat = a.category || "Annet";
    if (!attByCategory[cat]) attByCategory[cat] = [];
    attByCategory[cat].push(a);
  });

  const hasNotification = !!sub.notification_sent_at;
  const hasConfirmation = !!sub.confirmation_sent_at;
  const hasError = !!sub.notification_error;
  const sharedCount = comments.filter((c: any) => c.visibility === "shared" || c.is_customer_reply).length;
  const customerReplies = comments.filter((c: any) => c.is_customer_reply);
  const lastCustomerReply = customerReplies.length > 0 ? customerReplies[customerReplies.length - 1] : null;
  const isWaitingOnCustomer = ["missing_info", "waiting_customer"].includes(submission.status);
  const isWaitingOnUs = ["new", "under_review", "waiting_internal"].includes(submission.status);
  const isClosed = submission.status === "closed" || submission.status === "rejected";

  return (
    <div className="space-y-5 p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/orders")} className="mt-1">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-foreground">{submission.submission_no}</h1>
            <Badge className={statusConfig?.color || ""}>{statusConfig?.label || submission.status}</Badge>
            {submission.priority !== "normal" && priorityConfig && (
              <Badge variant="outline" className="text-[10px] font-semibold border-orange-200 text-orange-700 bg-orange-50">
                {priorityConfig.label}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {(() => {
              const parts: string[] = [];
              const tmplName = sub.order_form_templates?.name;
              if (tmplName) parts.push(tmplName);
              const name = sub.submitter_name || (submission.summary as any)?.kundenavn || (submission.summary as any)?.bestiller_navn;
              if (name) parts.push(name);
              if ((submission.summary as any)?.oppdragstittel) parts.push((submission.summary as any).oppdragstittel);
              parts.push(format(new Date(submission.submitted_at), "d. MMMM yyyy HH:mm", { locale: nb }));
              return parts.join(" · ");
            })()}
          </p>
        </div>
        {/* Quality badge - subtle, separate from status */}
        <QualityBadge score={qualityResult.score} />
      </div>

      {/* Primary + secondary actions */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Primary: Status with notify toggle */}
        <div className="flex items-center gap-2">
          <Select value={submission.status} onValueChange={(v) => updateStatus.mutate(v)}>
            <SelectTrigger className="w-48 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ORDER_STATUS_CONFIG).map(([key, cfg]) => (
                <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {bestillerEpost && (
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none whitespace-nowrap">
              <Checkbox
                checked={notifyOnStatusChange}
                onCheckedChange={(c) => setNotifyOnStatusChange(!!c)}
                className="h-3.5 w-3.5"
              />
              <Bell className="h-3 w-3" />
              Varsle bestiller
            </label>
          )}
        </div>

        {/* Primary: Tildel ansvarlig */}
        <Popover open={assignPopoverOpen} onOpenChange={setAssignPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant={sub.assigned_to ? "outline" : "default"} size="sm">
              {sub.assigned_to ? (
                <>
                  <UserCheck className="h-3.5 w-3.5 mr-1.5" />
                  {assigneeName || "Tildelt"}
                </>
              ) : (
                <>
                  <User className="h-3.5 w-3.5 mr-1.5" />
                  Tildel ansvarlig
                </>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-2">
            <Input
              placeholder="Søk etter bruker..."
              value={assignSearch}
              onChange={(e) => setAssignSearch(e.target.value)}
              className="h-8 text-sm mb-2"
              autoFocus
            />
            <div className="max-h-48 overflow-y-auto space-y-0.5">
              {sub.assigned_to && (
                <button
                  onClick={() => assignResponsible.mutate(null)}
                  className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted text-destructive"
                >
                  <X className="h-3 w-3 inline mr-1.5" />
                  Fjern ansvarlig
                </button>
              )}
              {companyUsers
                .filter(u => !assignSearch || u.name.toLowerCase().includes(assignSearch.toLowerCase()))
                .map(u => (
                  <button
                    key={u.id}
                    onClick={() => assignResponsible.mutate(u.id)}
                    className={`w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted flex items-center gap-2 ${sub.assigned_to === u.id ? "bg-primary/10 font-medium" : ""}`}
                  >
                    <User className="h-3 w-3 shrink-0 text-muted-foreground" />
                    {u.name}
                    {sub.assigned_to === u.id && <UserCheck className="h-3 w-3 ml-auto text-primary" />}
                  </button>
                ))
              }
            </div>
            {bestillerEpost && (
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none mt-2 pt-2 border-t">
                <Checkbox
                  checked={notifyOnAssign}
                  onCheckedChange={(c) => setNotifyOnAssign(!!c)}
                  className="h-3.5 w-3.5"
                />
                <Bell className="h-3 w-3" />
                Varsle bestiller
              </label>
            )}
          </PopoverContent>
        </Popover>

        {/* Primary: Be om mer info */}
        <Button variant="outline" size="sm" onClick={() => setRequestInfoOpen(true)}>
          <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
          Be om mer info
        </Button>

        {/* Primary: Opprett oppgave */}
        <Button variant="outline" size="sm" onClick={() => setAssignTaskOpen(true)}>
          <UserPlus className="h-3.5 w-3.5 mr-1.5" />
          Opprett oppgave
        </Button>

        {/* Secondary: overflow menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="px-2">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={() => sendNotification.mutate("new_order")}>
              <Mail className="h-3.5 w-3.5 mr-2" />
              {hasNotification ? "Send varsling på nytt" : "Send varsling"}
            </DropdownMenuItem>
            {bestillerEpost && !hasConfirmation && (
              <DropdownMenuItem onClick={() => sendNotification.mutate("confirmation")}>
                <MailCheck className="h-3.5 w-3.5 mr-2" />
                Send bekreftelse
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setTripletexOpen(true)}>
              <Download className="h-3.5 w-3.5 mr-2" />
              Tripletex-eksport
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setConvertOpen(true)} disabled={!!sub.converted_to_id}>
              <ArrowRight className="h-3.5 w-3.5 mr-2" />
              Konverter til sak
            </DropdownMenuItem>
            {!isClosed && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => updateStatus.mutate("closed")}>
                  <X className="h-3.5 w-3.5 mr-2" />
                  Lukk bestilling
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => updateStatus.mutate("rejected")} className="text-destructive focus:text-destructive">
                  Avvis
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Ticket info bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 p-3 rounded-lg bg-muted/30 border">
        {[
          { label: "Innsender", value: sub.submitter_name || (submission.summary as any)?.bestiller_navn || "–" },
          { label: "E-post", value: sub.submitter_email || bestillerEpost || "–" },
          { label: "Kunde", value: (submission.summary as any)?.kundenavn || "–" },
          { label: "Oppdrag", value: (submission.summary as any)?.oppdragstittel || "–" },
          { label: "Kanal", value: CHANNEL_LABELS[sub.channel] || "–" },
        ].map(({ label, value }) => (
          <div key={label} className="text-sm">
            <span className="text-muted-foreground text-[10px] uppercase tracking-wider">{label}</span>
            <p className="font-medium truncate text-xs">{value}</p>
          </div>
        ))}
        {/* Ansvarlig - interactive */}
        <div className="text-sm">
          <span className="text-muted-foreground text-[10px] uppercase tracking-wider">Ansvarlig</span>
          {sub.assigned_to ? (
            <p className="font-medium truncate text-xs flex items-center gap-1">
              <UserCheck className="h-3 w-3 text-primary shrink-0" />
              {assigneeName || "Laster..."}
            </p>
          ) : (
            <p className="font-medium truncate text-xs text-muted-foreground">Ikke tildelt</p>
          )}
        </div>
      </div>

      {/* Linked entities + notification status */}
      <div className="flex flex-wrap gap-2">
        {sub.converted_to_id && (
          <Badge variant="outline" className="text-[10px] gap-1 cursor-pointer hover:bg-muted" onClick={() => {
            const url = sub.converted_to_type === "case"
              ? `/cases/${sub.converted_to_id}`
              : `/projects/plan?openTask=${sub.converted_to_id}`;
            navigate(url);
          }}>
            <LinkIcon className="h-2.5 w-2.5" />
            {sub.converted_to_type === "case" ? "Sak" : "Oppgave"} koblet
            <ExternalLink className="h-2.5 w-2.5" />
          </Badge>
        )}
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
            E-postfeil
          </Badge>
        )}
      </div>

      {/* Quality issues */}
      {qualityResult.score !== "green" && <QualityIssuesPanel result={qualityResult} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
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

          {/* Attachments */}
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

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Customer tracking section */}
          <Card className="border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" />
                Kundeside
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* External status */}
              <div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Bestiller ser</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`inline-block h-2 w-2 rounded-full ${externalConfig.color}`} />
                  <span className="text-sm font-medium">{externalConfig.label}</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">{externalConfig.description}</p>
              </div>

              {/* Tracking link */}
              {trackingUrl && (
                <div className="flex gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs h-8"
                    onClick={() => { navigator.clipboard.writeText(trackingUrl); toast.success("Sporingslenke kopiert"); }}
                  >
                    <LinkIcon className="h-3 w-3 mr-1" />
                    Kopiér lenke
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-8"
                    asChild
                  >
                    <a href={trackingUrl} target="_blank" rel="noopener noreferrer">
                      <Eye className="h-3 w-3 mr-1" />
                      Åpne
                    </a>
                  </Button>
                </div>
              )}

              {/* Customer activity summary */}
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Delte meldinger</span>
                  <span className="font-medium">{sharedCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bekreftelse sendt</span>
                  <span className="font-medium">{hasConfirmation ? "Ja" : "Nei"}</span>
                </div>
                {lastCustomerReply && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Siste svar fra bestiller</span>
                    <span className="font-medium">
                      {formatDistanceToNow(new Date(lastCustomerReply.created_at), { addSuffix: true, locale: nb })}
                    </span>
                  </div>
                )}
                {sub.customer_last_viewed_at && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sist åpnet</span>
                    <span className="font-medium">
                      {formatDistanceToNow(new Date(sub.customer_last_viewed_at), { addSuffix: true, locale: nb })}
                    </span>
                  </div>
                )}
              </div>

              {/* Waiting indicator */}
              {isWaitingOnCustomer && (
                <div className="flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                  <Clock className="h-3 w-3" />
                  Venter på svar fra bestiller
                </div>
              )}
              {isWaitingOnUs && !isClosed && (
                <div className="flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                  <Clock className="h-3 w-3" />
                  Bestiller venter på oss
                </div>
              )}
            </CardContent>
          </Card>

          {/* Comments */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Meldinger
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 mb-3 max-h-64 overflow-y-auto">
                {comments.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Ingen meldinger ennå</p>
                ) : (
                  comments.map((c: any) => (
                    <div key={c.id} className={`text-sm border-l-2 pl-3 ${
                      c.comment_type === "missing_info_request" ? "border-amber-400"
                      : c.visibility === "shared" || c.is_customer_reply ? "border-primary/60"
                      : "border-border"
                    }`}>
                      {c.comment_type === "missing_info_request" && (
                        <Badge variant="outline" className="text-[9px] mb-1 bg-amber-50 text-amber-700 border-amber-200">
                          Forespørsel sendt til bestiller
                        </Badge>
                      )}
                      {c.visibility === "shared" && !c.is_customer_reply && c.comment_type !== "missing_info_request" && (
                        <Badge variant="outline" className="text-[9px] mb-1 bg-primary/10 text-primary border-primary/20">
                          Synlig for bestiller
                        </Badge>
                      )}
                      {c.is_customer_reply && (
                        <Badge variant="outline" className="text-[9px] mb-1 bg-green-50 text-green-700 border-green-200">
                          Svar fra bestiller
                        </Badge>
                      )}
                      {!c.visibility || (c.visibility === "internal" && !c.is_customer_reply && c.comment_type !== "missing_info_request") ? (
                        <Badge variant="outline" className="text-[9px] mb-1 text-muted-foreground">
                          Intern
                        </Badge>
                      ) : null}
                      <p className="whitespace-pre-wrap">{c.body}</p>
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(c.created_at), "d. MMM HH:mm", { locale: nb })}
                      </span>
                    </div>
                  ))
                )}
              </div>
              <div className="space-y-2">
                <Textarea
                  placeholder="Skriv melding..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="min-h-[60px] text-sm"
                />
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={commentVisibility === "internal" ? "default" : "outline"}
                    className="text-xs h-7"
                    onClick={() => setCommentVisibility("internal")}
                  >
                    Intern
                  </Button>
                  <Button
                    size="sm"
                    variant={commentVisibility === "shared" ? "default" : "outline"}
                    className="text-xs h-7"
                    onClick={() => setCommentVisibility("shared")}
                    title="Meldingen blir synlig på bestillerens sporingsside"
                  >
                    <Send className="h-3 w-3 mr-1" />
                    Del med bestiller
                  </Button>
                  <div className="flex-1" />
                  <Button
                    size="sm"
                    disabled={!comment.trim()}
                    onClick={() => addComment.mutate()}
                  >
                    Legg til
                  </Button>
                </div>
                {commentVisibility === "shared" && (
                  <p className="text-[10px] text-muted-foreground">
                    Meldingen blir synlig på bestillerens sporingsside. E-postvarsling sendes ikke automatisk.
                  </p>
                )}
              </div>
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
                      {a.payload?.assigned_to_name && (
                        <> · {a.payload.assigned_to_name}</>
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
      <AssignResourceTaskDialog
        open={assignTaskOpen}
        onOpenChange={setAssignTaskOpen}
        submissionId={id!}
        submissionNo={submission.submission_no}
        summary={submission.summary as Record<string, any> | null}
        values={valuesMap}
        attachments={attachments as any[]}
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
