import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { SignatureCanvas } from "./SignatureCanvas";
import { getFileTypeIcon } from "@/lib/file-icons";
import {
  ClipboardList, User, CalendarDays, FileImage, AlertTriangle,
  Loader2, CheckCircle2, Image as ImageIcon, FileText,
  Eye, EyeOff, PenLine, ChevronDown, ChevronUp,
  Send, Clock, Users, Camera, TriangleAlert,
  FileDown, Share2, Building2, Lock, ShieldCheck, Copy,
  RefreshCw, History,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { WP_TYPE_CONFIG, DOC_STATUS_CONFIG, type WorkPackageType } from "@/lib/work-package-types";

/* ── Types ── */

interface ScheduleBlock {
  id: string; start_at: string; end_at: string; title: string;
  match_state: string; technician_name?: string; technician_color?: string;
}
interface Deviation { id: string; title: string; status: string; created_at: string; severity?: string; }
interface DocFile { id: string; title: string; mime_type: string | null; created_at: string; source_meta?: Record<string, any>; source_type?: string; }
interface WorkPkg { id: string; title: string; work_package_type: string; status: string; customer_visible: boolean; documentation_status: string; assigned_techs: string[]; }

interface ServiceJournalProps {
  projectId: string; projectTitle: string; customer: string;
  address?: string; technicianNames: string[];
  internalNumber?: string; companyLogoUrl?: string; companyName?: string;
}

type SectionKey = "oppdrag" | "utfort" | "arbeidsokter" | "arbeidspakker" | "sjekklister" | "dokumentasjon" | "merknader" | "signatur";
type SectionVisibility = Record<SectionKey, boolean>;
type JournalStatus = "draft" | "review" | "approved" | "sent";

const STATUS_CONFIG: Record<JournalStatus, { label: string; color: string; icon: any }> = {
  draft: { label: "Utkast", color: "bg-muted text-muted-foreground", icon: PenLine },
  review: { label: "Til gjennomgang", color: "bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))]", icon: Eye },
  approved: { label: "Godkjent", color: "bg-primary/15 text-primary", icon: ShieldCheck },
  sent: { label: "Sendt", color: "bg-[hsl(var(--info))]/15 text-[hsl(var(--info))]", icon: Send },
};

const SECTION_META: { key: SectionKey; label: string }[] = [
  { key: "oppdrag", label: "Oppdrag" }, { key: "utfort", label: "Utført arbeid" },
  { key: "arbeidsokter", label: "Arbeidsøkter" }, { key: "arbeidspakker", label: "Arbeidspakker" },
  { key: "sjekklister", label: "Sjekklister" },
  { key: "dokumentasjon", label: "Dokumentasjon" },
  { key: "merknader", label: "Merknader" }, { key: "signatur", label: "Signatur" },
];

const MATCH_STATE_LABELS: Record<string, string> = {
  manual: "Manuell", confirmed: "Bekreftet", auto: "Auto",
  needs_confirmation: "Trenger bekreftelse", external: "Ekstern",
};

/* ── Main ── */

export function ServiceJournal({
  projectId, projectTitle, customer, address, technicianNames,
  internalNumber, companyLogoUrl, companyName,
}: ServiceJournalProps) {
  // Data
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [deviations, setDeviations] = useState<Deviation[]>([]);
  const [docs, setDocs] = useState<DocFile[]>([]);
  const [workPackages, setWorkPackages] = useState<WorkPkg[]>([]);
  const [formResults, setFormResults] = useState<{ id: string; title: string; form_type: string; status: string; filled_by: string | null; updated_at: string; has_signature: boolean; key_answers: string[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Journal persistence
  const [journalId, setJournalId] = useState<string | null>(null);
  const [journalStatus, setJournalStatus] = useState<JournalStatus>("draft");
  const [journalVersion, setJournalVersion] = useState(1);
  const [reportType, setReportType] = useState<"servicejournal" | "arbeidsrapport">("servicejournal");

  // View
  const [viewMode, setViewMode] = useState<"internal" | "customer">("internal");
  const [isPreview, setIsPreview] = useState(false);
  const [sections, setSections] = useState<SectionVisibility>({
    oppdrag: true, utfort: true, arbeidsokter: true, arbeidspakker: true, sjekklister: true, dokumentasjon: true, merknader: true, signatur: true,
  });
  const [showControls, setShowControls] = useState(false);

  // Manual fields
  const [summaryText, setSummaryText] = useState("");
  const [workDescription, setWorkDescription] = useState("");
  const [customerComment, setCustomerComment] = useState("");
  const [sigResponsible, setSigResponsible] = useState("");
  const [sigCustomer, setSigCustomer] = useState("");
  const [sigResponsibleRole, setSigResponsibleRole] = useState("Ansvarlig montør");
  const [sigCustomerRole, setSigCustomerRole] = useState("Kunde");

  // Dialogs
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [sendEmail, setSendEmail] = useState("");
  const [sendSubject, setSendSubject] = useState("");
  const [sendMessage, setSendMessage] = useState("");
  const [shareExpiry, setShareExpiry] = useState("30");
  const [shareUrl, setShareUrl] = useState("");
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [creatingShare, setCreatingShare] = useState(false);

  // Lightbox
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [companyInfo, setCompanyInfo] = useState<{ logo_url?: string; company_name?: string } | null>(null);

  /* ── Fetch data ── */
  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [blocksRes, devsRes, docsRes, companyRes, journalRes] = await Promise.all([
      supabase.from("schedule_blocks")
        .select("id, start_at, end_at, title, match_state, technicians!inner(name, color)")
        .eq("project_id", projectId).is("deleted_at", null)
        .order("start_at", { ascending: true }).limit(100),
      (supabase as any).from("job_tasks")
        .select("id, title, status, created_at, priority")
        .eq("job_id", projectId).eq("category", "avvik")
        .order("created_at", { ascending: false }).limit(20),
      supabase.from("docs_files")
        .select("id, title, mime_type, created_at, source_meta, source_type")
        .eq("project_id", projectId).order("created_at", { ascending: false }).limit(50) as any,
      supabase.from("company_settings").select("logo_url, company_name").limit(1).single(),
      supabase.from("service_journals" as any)
        .select("*").eq("project_id", projectId)
        .order("version", { ascending: false }).limit(1).single(),
    ]);

    setBlocks((blocksRes.data || []).map((r: any) => ({
      id: r.id, start_at: r.start_at, end_at: r.end_at, title: r.title,
      match_state: r.match_state, technician_name: r.technicians?.name, technician_color: r.technicians?.color,
    })));
    setDeviations((devsRes.data || []).map((r: any) => ({
      id: r.id, title: r.title, status: r.status, created_at: r.created_at, severity: r.priority,
    })));
    setDocs((docsRes.data || []).map((r: any) => ({
      id: r.id, title: r.title, mime_type: r.mime_type, created_at: r.created_at,
      source_meta: r.source_meta, source_type: r.source_type,
    })));
    if (companyRes.data) setCompanyInfo(companyRes.data);

    // Fetch work packages for this project
    try {
      const { data: wpData } = await supabase
        .from("events")
        .select(`id, title, status, work_package_type, customer_visible, documentation_status,
          event_technicians ( technician_id, technicians ( name ) )`)
        .eq("parent_project_id", projectId)
        .not("work_package_type", "is", null)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }) as any;
      setWorkPackages((wpData || []).map((d: any) => ({
        id: d.id, title: d.title, work_package_type: d.work_package_type,
        status: d.status, customer_visible: d.customer_visible ?? false,
        documentation_status: d.documentation_status ?? "pending",
        assigned_techs: (d.event_technicians || []).filter((et: any) => et.technicians).map((et: any) => et.technicians.name),
      })));
    } catch { setWorkPackages([]); }

    // Fetch form instances for this project
    try {
      const { data: instances } = await supabase
        .from("form_instances")
        .select("id, template_id, status, created_by, updated_at, answers")
        .eq("project_id", projectId)
        .in("status", ["completed", "signed", "in_progress"]);

      if (instances && instances.length > 0) {
        const tplIds = [...new Set((instances as any[]).map((i: any) => i.template_id))];
        const { data: tpls } = await (supabase as any)
          .from("form_templates")
          .select("id, title, form_type")
          .in("id", tplIds);
        const tplMap = new Map((tpls || []).map((t: any) => [t.id, t]));

        // Get user names for created_by
        const userIds = [...new Set((instances as any[]).filter((i: any) => i.created_by).map((i: any) => i.created_by))];
        let userMap = new Map<string, string>();
        if (userIds.length > 0) {
          const { data: accounts } = await supabase
            .from("user_accounts")
            .select("auth_user_id, people!inner(full_name)")
            .in("auth_user_id", userIds) as any;
          for (const a of accounts || []) {
            userMap.set(a.auth_user_id, a.people?.full_name || "Ukjent");
          }
        }

        setFormResults((instances as any[]).map((inst: any) => {
          const tpl: any = tplMap.get(inst.template_id);
          const answers = inst.answers || {};
          const keyAnswers: string[] = [];
          const answerEntries = Object.entries(answers);
          for (const [, val] of answerEntries.slice(0, 3)) {
            if (typeof val === "string" && val.length > 0) keyAnswers.push(val.slice(0, 60));
            else if (typeof val === "object" && val !== null && (val as any).status) keyAnswers.push(`${(val as any).status}`);
          }
          return {
            id: inst.id,
            title: tpl?.title || "Ukjent skjema",
            form_type: tpl?.form_type || "checklist",
            status: inst.status,
            filled_by: userMap.get(inst.created_by) || null,
            updated_at: inst.updated_at,
            has_signature: answerEntries.some(([, v]) => typeof v === "string" && (v as string).startsWith("data:image")),
            key_answers: keyAnswers,
          };
        }));
      } else {
        setFormResults([]);
      }
    } catch { setFormResults([]); }

    // Load saved journal
    if (journalRes.data && !journalRes.error) {
      const j = journalRes.data as any;
      setJournalId(j.id);
      setJournalStatus(j.status);
      setJournalVersion(j.version);
      setReportType(j.report_type || "servicejournal");
      const c = j.content || {};
      setSummaryText(c.summaryText || "");
      setWorkDescription(c.workDescription || "");
      setCustomerComment(c.customerComment || "");
      const sigs = j.signatures || {};
      setSigResponsible(sigs.responsible || "");
      setSigCustomer(sigs.customer || "");
      setSigResponsibleRole(sigs.responsibleRole || "Ansvarlig montør");
      setSigCustomerRole(sigs.customerRole || "Kunde");
      if (j.section_visibility) setSections(j.section_visibility);
    }

    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* ── Save journal ── */
  const saveJournal = useCallback(async (statusOverride?: JournalStatus, createNewVersion?: boolean) => {
    setSaving(true);
    try {
      const { data: ua } = await supabase.from("user_accounts")
        .select("id").eq("auth_user_id", (await supabase.auth.getUser()).data.user?.id ?? "")
        .eq("is_active", true).single();

      const content = { summaryText, workDescription, customerComment };
      const signatures = { responsible: sigResponsible, customer: sigCustomer, responsibleRole: sigResponsibleRole, customerRole: sigCustomerRole };
      const newStatus = statusOverride || journalStatus;

      if (journalId && !createNewVersion) {
        // Update existing
        const updateData: any = {
          content, signatures, section_visibility: sections,
          report_type: reportType, status: newStatus,
        };
        if (statusOverride === "approved") {
          updateData.approved_at = new Date().toISOString();
          updateData.approved_by = ua?.id;
        }
        await supabase.from("service_journals" as any).update(updateData).eq("id", journalId);
        setJournalStatus(newStatus);
      } else {
        // Create new (or new version)
        const newVersion = createNewVersion ? journalVersion + 1 : 1;
        const { data, error } = await supabase.from("service_journals" as any).insert({
          project_id: projectId,
          version: newVersion,
          status: newStatus,
          report_type: reportType,
          content, signatures, section_visibility: sections,
          created_by: ua?.id,
          ...(statusOverride === "approved" ? { approved_at: new Date().toISOString(), approved_by: ua?.id } : {}),
        }).select().single();
        if (error) throw error;
        if (data) {
          setJournalId((data as any).id);
          setJournalVersion(newVersion);
          setJournalStatus(newStatus);
        }
      }

      // Log status changes
      if (statusOverride && statusOverride !== journalStatus) {
        await supabase.from("activity_log").insert({
          entity_id: projectId, entity_type: "job",
          action: `service_journal_status_${statusOverride}`,
          type: "status_change",
          title: `Servicejournal ${STATUS_CONFIG[statusOverride].label.toLowerCase()} (v${createNewVersion ? journalVersion + 1 : journalVersion})`,
          performed_by: (await supabase.auth.getUser()).data.user?.id,
        });
      }

      toast.success(statusOverride ? `Status: ${STATUS_CONFIG[newStatus].label}` : "Lagret");
    } catch (err: any) {
      toast.error("Kunne ikke lagre: " + err.message);
    } finally {
      setSaving(false);
    }
  }, [journalId, journalStatus, journalVersion, projectId, reportType, summaryText, workDescription, customerComment, sigResponsible, sigCustomer, sigResponsibleRole, sigCustomerRole, sections]);

  /* ── Actions ── */
  const handleGeneratePdf = async () => {
    if (!journalId) {
      await saveJournal();
    }
    // Need to re-check journalId after save
    setPdfGenerating(true);
    try {
      // Save first to ensure latest content
      await saveJournal();
      const jRes = await (supabase.from("service_journals" as any)
        .select("id").eq("project_id", projectId)
        .order("version", { ascending: false }).limit(1).single() as any);
      const currentId = journalId || jRes.data?.id;

      if (!currentId) throw new Error("Ingen journal funnet");

      const { data, error } = await supabase.functions.invoke("service-journal-pdf", {
        body: { journal_id: currentId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.pdf_url) {
        window.open(data.pdf_url, "_blank");
        toast.success("PDF generert");
      }
    } catch (err: any) {
      toast.error("PDF-feil: " + err.message);
    } finally {
      setPdfGenerating(false);
    }
  };

  const handleSendToCustomer = async () => {
    setSendingEmail(true);
    try {
      await saveJournal("sent");
      // Log sending
      await supabase.from("activity_log").insert({
        entity_id: projectId, entity_type: "job",
        action: "service_journal_sent",
        type: "email",
        title: `Servicejournal sendt til ${sendEmail}`,
        description: `Emne: ${sendSubject}`,
        performed_by: (await supabase.auth.getUser()).data.user?.id,
      });
      // Update sent info
      if (journalId) {
        await supabase.from("service_journals" as any).update({
          sent_at: new Date().toISOString(),
          sent_to_email: sendEmail,
        }).eq("id", journalId);
      }
      toast.success("Servicejournal markert som sendt");
      setSendDialogOpen(false);
    } catch (err: any) {
      toast.error("Feil: " + err.message);
    } finally {
      setSendingEmail(false);
    }
  };

  const handleCreateShareLink = async () => {
    setCreatingShare(true);
    try {
      await saveJournal();
      const jRes2 = await (supabase.from("service_journals" as any)
        .select("id").eq("project_id", projectId)
        .order("version", { ascending: false }).limit(1).single() as any);
      const currentId = journalId || jRes2.data?.id;

      if (!currentId) throw new Error("Lagre journalen først");

      const { data, error } = await supabase.functions.invoke("service-journal-share", {
        body: { action: "create_share", journal_id: currentId, expires_days: parseInt(shareExpiry) || null },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setShareUrl(data.share_url);
      toast.success("Delingslenke opprettet");
    } catch (err: any) {
      toast.error("Feil: " + err.message);
    } finally {
      setCreatingShare(false);
    }
  };

  const handleApprove = async () => {
    const isEdited = journalStatus === "approved" || journalStatus === "sent";
    if (isEdited) {
      // Create new version
      await saveJournal("approved", true);
      toast.success(`Ny versjon v${journalVersion + 1} godkjent`);
    } else {
      await saveJournal("approved");
      toast.success("Servicejournal godkjent");
    }
  };

  const handleViewModeChange = (mode: "internal" | "customer") => setViewMode(mode);
  const toggleSection = (key: SectionKey) => setSections(prev => ({ ...prev, [key]: !prev[key] }));

  const isCustomer = viewMode === "customer";
  const isLocked = journalStatus === "approved" || journalStatus === "sent";
  const logoUrl = companyLogoUrl || companyInfo?.logo_url;
  const company = companyName || companyInfo?.company_name || "";

  // Derived
  const sortedBlocks = [...blocks].sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  const periodStart = sortedBlocks[0] ? format(new Date(sortedBlocks[0].start_at), "d. MMM yyyy", { locale: nb }) : "—";
  const periodEnd = sortedBlocks.length > 0 ? format(new Date(sortedBlocks[sortedBlocks.length - 1].end_at), "d. MMM yyyy", { locale: nb }) : "—";
  const uniqueTechs = Array.from(new Map(blocks.filter(b => b.technician_name).map(b => [b.technician_name!, { name: b.technician_name!, color: b.technician_color }])).values());
  const imageDocs = docs.filter(d => d.mime_type?.startsWith("image/"));
  const otherDocs = docs.filter(d => !d.mime_type?.startsWith("image/"));
  const completedBlocks = blocks.filter(b => new Date(b.end_at) < new Date());
  const totalMinutes = blocks.reduce((sum, b) => sum + Math.round((new Date(b.end_at).getTime() - new Date(b.start_at).getTime()) / 60000), 0);
  const totalHours = (totalMinutes / 60).toFixed(1);

  const StatusIcon = STATUS_CONFIG[journalStatus].icon;

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  // Prepare send dialog defaults
  const openSendDialog = () => {
    setSendSubject(`${reportType === "arbeidsrapport" ? "Arbeidsrapport" : "Servicejournal"} – ${projectTitle}`);
    setSendMessage(`Vedlagt finner du ${reportType === "arbeidsrapport" ? "arbeidsrapporten" : "servicejournalen"} for ${projectTitle}.\n\nMed vennlig hilsen\n${company}`);
    setSendDialogOpen(true);
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* ── Toolbar ── */}
      {!isPreview && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                <ClipboardList className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Servicejournal</h2>
                <p className="text-xs text-muted-foreground">v{journalVersion} · {STATUS_CONFIG[journalStatus].label}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={cn("text-xs h-6 gap-1 border-0", STATUS_CONFIG[journalStatus].color)}>
                <StatusIcon className="h-3 w-3" />
                {STATUS_CONFIG[journalStatus].label}
              </Badge>
              <Button variant="outline" size="sm" className="gap-1.5 rounded-xl text-xs h-8"
                onClick={() => { setIsPreview(true); setViewMode("customer"); }}>
                <Eye className="h-3.5 w-3.5" /> Forhåndsvis
              </Button>
            </div>
          </div>

          {/* Report type + view mode */}
          <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-muted/20 p-3">
            <div className="flex-1 flex gap-1">
              {(["servicejournal", "arbeidsrapport"] as const).map(t => (
                <button key={t} onClick={() => setReportType(t)} disabled={isLocked}
                  className={cn("flex-1 rounded-lg px-3 py-1.5 text-xs font-medium text-center transition-colors",
                    reportType === t ? "bg-card text-foreground shadow-sm border border-border/40" : "text-muted-foreground hover:text-foreground",
                    isLocked && "opacity-60 cursor-not-allowed"
                  )}
                >{t === "servicejournal" ? "Servicejournal" : "Arbeidsrapport"}</button>
              ))}
            </div>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex-1 flex gap-1">
              {(["internal", "customer"] as const).map(m => (
                <button key={m} onClick={() => handleViewModeChange(m)}
                  className={cn("flex-1 rounded-lg px-3 py-1.5 text-xs font-medium text-center transition-colors",
                    viewMode === m ? "bg-card text-foreground shadow-sm border border-border/40" : "text-muted-foreground hover:text-foreground"
                  )}
                >{m === "internal" ? "Intern" : "Kunde"}</button>
              ))}
            </div>
          </div>

          {/* Section controls */}
          <div className="space-y-2">
            <button onClick={() => setShowControls(!showControls)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              {showControls ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {showControls ? "Skjul seksjonskontroll" : "Vis seksjonskontroll"}
            </button>
            {showControls && (
              <div className="rounded-xl border border-border/40 bg-muted/10 p-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {SECTION_META.map(s => (
                    <label key={s.key} className="flex items-center gap-2 cursor-pointer">
                      <Switch checked={sections[s.key]} onCheckedChange={() => toggleSection(s.key)} className="scale-90" disabled={isLocked} />
                      <span className="text-sm">{s.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Status flow + actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status transitions */}
            {journalStatus === "draft" && (
              <Button variant="outline" size="sm" className="gap-1.5 rounded-xl text-xs h-8"
                onClick={() => saveJournal("review")} disabled={saving}>
                <Eye className="h-3.5 w-3.5" /> Klar til gjennomgang
              </Button>
            )}
            {(journalStatus === "draft" || journalStatus === "review") && (
              <Button variant="default" size="sm" className="gap-1.5 rounded-xl text-xs h-8"
                onClick={handleApprove} disabled={saving}>
                <ShieldCheck className="h-3.5 w-3.5" /> Godkjenn
              </Button>
            )}
            {isLocked && (
              <Button variant="outline" size="sm" className="gap-1.5 rounded-xl text-xs h-8"
                onClick={() => saveJournal("draft")} disabled={saving}>
                <RefreshCw className="h-3.5 w-3.5" /> Gjenåpne som utkast
              </Button>
            )}

            <Separator orientation="vertical" className="h-6 mx-1" />

            {/* Export actions */}
            <Button variant="outline" size="sm" className="gap-1.5 rounded-xl text-xs h-8"
              onClick={handleGeneratePdf} disabled={pdfGenerating}>
              {pdfGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
              Generer PDF
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 rounded-xl text-xs h-8" onClick={openSendDialog}>
              <Send className="h-3.5 w-3.5" /> Send til kunde
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 rounded-xl text-xs h-8"
              onClick={() => setShareDialogOpen(true)}>
              <Share2 className="h-3.5 w-3.5" /> Del lenke
            </Button>

            {/* Save */}
            <Button variant="ghost" size="sm" className="gap-1.5 rounded-xl text-xs h-8 ml-auto"
              onClick={() => saveJournal()} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Lagre
            </Button>
          </div>

          {/* Locked banner */}
          {isLocked && (
            <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-primary">
              <Lock className="h-3.5 w-3.5 shrink-0" />
              <span>Journalen er {journalStatus === "approved" ? "godkjent" : "sendt"}. Endringer oppretter en ny versjon.</span>
            </div>
          )}
        </div>
      )}

      {/* ── Preview bar ── */}
      {isPreview && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-primary">Forhåndsvisning</p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 rounded-xl text-xs h-8" onClick={() => setIsPreview(false)}>
            <EyeOff className="h-3.5 w-3.5" /> Tilbake
          </Button>
        </div>
      )}

      {/* ═══ JOURNAL CONTENT ═══ */}
      <div className={cn(isPreview && "ring-1 ring-border/40 rounded-2xl bg-card shadow-sm p-8")}>
        <div className="space-y-8">

          {/* REPORT HEADER */}
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="h-10 w-auto max-w-[120px] object-contain" />
                ) : company ? (
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                ) : null}
                {company && !logoUrl && <span className="text-sm font-semibold text-foreground">{company}</span>}
              </div>
              <div className="text-right space-y-1">
                <Badge className={cn("text-[10px] h-5 border-0", STATUS_CONFIG[journalStatus].color)}>
                  {STATUS_CONFIG[journalStatus].label}
                </Badge>
                <p className="text-[10px] text-muted-foreground">v{journalVersion}</p>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                {reportType === "servicejournal" ? "Servicejournal" : "Arbeidsrapport"}
              </p>
              <h1 className="text-xl font-bold text-foreground mt-0.5">{projectTitle}</h1>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-sm">
              <InfoRow label="Kunde" value={customer || "—"} />
              {address && <InfoRow label="Adresse" value={address} />}
              {internalNumber && <InfoRow label="Prosjektnr." value={internalNumber} />}
              <InfoRow label="Dato" value={format(new Date(), "d. MMMM yyyy", { locale: nb })} />
              <InfoRow label="Periode" value={sortedBlocks.length > 0 ? `${periodStart} – ${periodEnd}` : "—"} />
              <div className="space-y-0.5">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Ansvarlig</p>
                <p className="text-sm text-foreground">{uniqueTechs[0]?.name || technicianNames[0] || "—"}</p>
              </div>
            </div>
            <Separator className="bg-border/40" />
          </div>

          {/* STATS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon={<Clock className="h-4 w-4" />} label="Timer" value={totalHours} />
            <StatCard icon={<Users className="h-4 w-4" />} label="Montører" value={String(uniqueTechs.length || technicianNames.length)} />
            <StatCard icon={<Camera className="h-4 w-4" />} label="Bilder" value={String(imageDocs.length)} />
            <StatCard icon={<TriangleAlert className="h-4 w-4" />} label="Avvik" value={String(deviations.length)} />
          </div>

          {/* 1. Oppdrag */}
          {sections.oppdrag && (
            <Section title="Oppdrag" icon={<ClipboardList className="h-4 w-4" />}>
              {isPreview || isCustomer ? (
                <div className="text-sm text-foreground whitespace-pre-wrap">
                  {summaryText || <span className="text-muted-foreground italic">Ingen oppdragsbeskrivelse</span>}
                </div>
              ) : (
                <Textarea value={summaryText} onChange={e => setSummaryText(e.target.value)}
                  placeholder="Beskriv oppdraget…" rows={3} className="resize-none text-sm" disabled={isLocked} />
              )}
            </Section>
          )}

          {/* 2. Utført arbeid */}
          {sections.utfort && (
            <Section title="Utført arbeid" icon={<CheckCircle2 className="h-4 w-4" />}>
              {isPreview || isCustomer ? (
                <div className="text-sm text-foreground whitespace-pre-wrap">
                  {workDescription || <span className="text-muted-foreground italic">Ingen beskrivelse</span>}
                </div>
              ) : (
                <Textarea value={workDescription} onChange={e => setWorkDescription(e.target.value)}
                  placeholder="Beskriv utført arbeid…" rows={4} className="resize-none text-sm" disabled={isLocked} />
              )}
            </Section>
          )}

          {/* 3. Arbeidsøkter */}
          {sections.arbeidsokter && (
            <Section title="Arbeidsøkter" icon={<CalendarDays className="h-4 w-4" />} count={isCustomer ? completedBlocks.length : blocks.length}>
              {(isCustomer ? completedBlocks : blocks).length === 0 ? (
                <EmptyState text="Ingen arbeidsøkter" />
              ) : (
                <div className="space-y-2">
                  {(isCustomer ? completedBlocks : blocks).map(block => {
                    const start = new Date(block.start_at);
                    const end = new Date(block.end_at);
                    const isPast = end < new Date();
                    const durationMin = Math.round((end.getTime() - start.getTime()) / 60000);
                    const durationLabel = durationMin >= 60 ? `${Math.floor(durationMin / 60)}t${durationMin % 60 > 0 ? ` ${durationMin % 60}m` : ""}` : `${durationMin}m`;

                    return (
                      <div key={block.id} className={cn("flex items-center gap-3 rounded-xl border p-3",
                        isPast ? "border-border/30 bg-muted/20" : "border-border/40 bg-card"
                      )}>
                        {!isCustomer && <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: block.technician_color || "hsl(var(--primary))" }} />}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold">{format(start, "EEE d. MMM", { locale: nb })}</p>
                            <span className="text-xs text-muted-foreground">{format(start, "HH:mm")} – {format(end, "HH:mm")}</span>
                            <span className="text-[10px] text-muted-foreground/70">({durationLabel})</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <User className="h-3 w-3" />
                            <span>{block.technician_name || "Ukjent"}</span>
                            {!isCustomer && <span className="text-[10px]">· {MATCH_STATE_LABELS[block.match_state] || block.match_state}</span>}
                          </div>
                        </div>
                        {isPast && <Badge variant="secondary" className="text-[10px] h-5 bg-primary/10 text-primary">Utført</Badge>}
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>
          )}

          {/* 4. Sjekklister og kontrollskjema */}
          {sections.sjekklister && (
            <Section title="Sjekklister og kontrollskjema" icon={<ClipboardList className="h-4 w-4" />} count={formResults.length}>
              {formResults.length === 0 ? <EmptyState text="Ingen utfylte skjema" /> : (
                <div className="space-y-2">
                  {formResults.map(form => {
                    const typeLabel: Record<string, string> = { checklist: "Sjekkliste", control: "Kontroll", signature: "Signering", hms: "HMS", handover: "Overlevering" };
                    const isDone = form.status === "completed" || form.status === "signed";
                    return (
                      <div key={form.id} className="rounded-xl border border-border/40 bg-card p-3 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm font-semibold truncate">{form.title}</span>
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-0 bg-muted text-muted-foreground shrink-0">
                              {typeLabel[form.form_type] || form.form_type}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {form.has_signature && (
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-primary/20 text-primary gap-0.5">
                                <PenLine className="h-2.5 w-2.5" /> Signert
                              </Badge>
                            )}
                            <Badge variant={isDone ? "default" : "secondary"} className="text-[10px] h-5">
                              {form.status === "signed" ? "Signert" : isDone ? "Fullført" : "Pågår"}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {form.filled_by && <span className="flex items-center gap-1"><User className="h-3 w-3" />{form.filled_by}</span>}
                          <span>{format(new Date(form.updated_at), "d. MMM yyyy", { locale: nb })}</span>
                        </div>
                        {!isCustomer && form.key_answers.length > 0 && (
                          <div className="mt-1 text-xs text-muted-foreground/80 space-y-0.5">
                            {form.key_answers.map((a, i) => (
                              <p key={i} className="truncate">• {a}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>
          )}

          {/* 4b. Arbeidspakker */}
          {sections.arbeidspakker && (
            <Section title="Arbeidspakker" icon={<ClipboardList className="h-4 w-4" />} count={(isCustomer ? workPackages.filter(w => w.customer_visible) : workPackages).length}>
              {(() => {
                const visibleWps = isCustomer ? workPackages.filter(w => w.customer_visible && w.documentation_status === "complete") : workPackages;
                if (visibleWps.length === 0) return <EmptyState text="Ingen arbeidspakker" />;
                return (
                  <div className="space-y-2">
                    {visibleWps.map(wp => {
                      const cfg = WP_TYPE_CONFIG[wp.work_package_type as WorkPackageType];
                      const docCfg = DOC_STATUS_CONFIG[wp.documentation_status] || DOC_STATUS_CONFIG.pending;
                      if (!cfg) return null;
                      const WpIcon = cfg.icon;
                      const isDone = wp.status === "completed" || wp.status === "ready_for_invoicing";
                      return (
                        <div key={wp.id} className="rounded-xl border border-border/40 bg-card p-3">
                          <div className="flex items-center gap-2.5">
                            <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center shrink-0", cfg.bgColor)}>
                              <WpIcon className={cn("h-3.5 w-3.5", cfg.color)} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold truncate">{wp.title}</p>
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 border-0 rounded-md", cfg.bgColor, cfg.color)}>
                                  {isCustomer ? cfg.portalLabel : cfg.label}
                                </Badge>
                                <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 border-0 rounded-md", isDone ? "bg-success/10 text-success" : "bg-info/10 text-info")}>
                                  {isDone ? "Ferdig" : "Pågår"}
                                </Badge>
                                {!isCustomer && (
                                  <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 border-0 rounded-md", docCfg.color)}>
                                    {docCfg.label}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            {!isCustomer && wp.customer_visible && <Eye className="h-3 w-3 text-primary shrink-0" />}
                          </div>
                          {wp.assigned_techs.length > 0 && (
                            <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1.5 ml-9">
                              <User className="h-2.5 w-2.5" /> {wp.assigned_techs.join(", ")}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </Section>
          )}

          {/* 5. Dokumentasjon */}
          {sections.dokumentasjon && (
            <Section title="Dokumentasjon" icon={<FileImage className="h-4 w-4" />}
              count={imageDocs.length + otherDocs.length}
              subtitle={`${imageDocs.length} bilder / ${otherDocs.length} filer`}>
              {docs.length === 0 ? <EmptyState text="Ingen dokumenter" /> : (
                <div className="space-y-4">
                  {imageDocs.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <ImageIcon className="h-3 w-3" /> Bilder ({imageDocs.length})
                      </p>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {imageDocs.map(img => {
                          const url = img.source_meta?.public_url;
                          return (
                            <button key={img.id} onClick={() => url && setLightboxImg(url)}
                              className="aspect-square rounded-lg border border-border/40 bg-muted/30 flex items-center justify-center overflow-hidden hover:ring-2 hover:ring-primary/30 transition-all cursor-pointer">
                              {url ? <img src={url} alt={img.title} className="w-full h-full object-cover" />
                                : <ImageIcon className="h-5 w-5 text-muted-foreground" />}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                        {imageDocs.map((img, idx) => (
                          <p key={img.id} className="text-[10px] text-muted-foreground">
                            <span className="font-medium">{idx + 1}.</span> {img.title}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                  {otherDocs.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <FileText className="h-3 w-3" /> Dokumenter ({otherDocs.length})
                      </p>
                      <div className="space-y-1">
                        {otherDocs.map(doc => (
                          <div key={doc.id} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm border border-border/30 bg-card">
                            {getFileTypeIcon(doc.mime_type, doc.title, doc.source_type)}
                            <span className="truncate flex-1">{doc.title}</span>
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {format(new Date(doc.created_at), "d. MMM", { locale: nb })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Section>
          )}

          {/* 5. Merknader */}
          {sections.merknader && (
            <Section title="Eventuelle merknader" icon={<AlertTriangle className="h-4 w-4" />}>
              {isPreview || isCustomer ? (
                <div className="space-y-4">
                  {deviations.length > 0 && deviations.map(dev => (
                    <div key={dev.id} className="flex items-center gap-3 rounded-xl border border-border/40 bg-card p-3">
                      <AlertTriangle className={cn("h-4 w-4 shrink-0", dev.severity === "high" ? "text-destructive" : "text-muted-foreground")} />
                      <p className="text-sm flex-1 truncate">{dev.title}</p>
                      <Badge variant="secondary" className={cn("text-[10px] h-5", dev.status === "completed" && "bg-primary/10 text-primary")}>
                        {dev.status === "completed" ? "Lukket" : "Åpen"}
                      </Badge>
                    </div>
                  ))}
                  {customerComment && <p className="text-sm text-foreground whitespace-pre-wrap">{customerComment}</p>}
                  {!customerComment && deviations.length === 0 && <p className="text-sm text-muted-foreground italic">Ingen merknader</p>}
                </div>
              ) : (
                <div className="space-y-4">
                  {deviations.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Registrerte avvik ({deviations.length})</p>
                      {deviations.map(dev => (
                        <div key={dev.id} className="flex items-center gap-3 rounded-xl border border-border/40 bg-card p-3">
                          <AlertTriangle className={cn("h-4 w-4 shrink-0", dev.severity === "high" ? "text-destructive" : "text-muted-foreground")} />
                          <p className="text-sm flex-1 truncate">{dev.title}</p>
                          <Badge variant="secondary" className="text-[10px] h-5">{dev.status === "completed" ? "Lukket" : "Åpen"}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                  <Textarea value={customerComment} onChange={e => setCustomerComment(e.target.value)}
                    placeholder="Eventuelle merknader…" rows={2} className="resize-none text-sm" disabled={isLocked} />
                </div>
              )}
            </Section>
          )}

          {/* 6. Signatur */}
          {sections.signatur && (
            <Section title="Signatur" icon={<PenLine className="h-4 w-4" />}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  {!isPreview && !isLocked && (
                    <input type="text" value={sigResponsibleRole} onChange={e => setSigResponsibleRole(e.target.value)}
                      className="flex h-7 w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] text-muted-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      placeholder="Rolle" />
                  )}
                  {(isPreview || isLocked) && <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{sigResponsibleRole}</p>}
                  <SignatureCanvas value={sigResponsible} onChange={setSigResponsible} label={isPreview || isLocked ? "" : "Tegn signatur"} disabled={isPreview || isLocked} />
                  <p className="text-[10px] text-muted-foreground">{format(new Date(), "d. MMMM yyyy, HH:mm", { locale: nb })}</p>
                </div>
                <div className="space-y-2">
                  {!isPreview && !isLocked && (
                    <input type="text" value={sigCustomerRole} onChange={e => setSigCustomerRole(e.target.value)}
                      className="flex h-7 w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] text-muted-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      placeholder="Rolle" />
                  )}
                  {(isPreview || isLocked) && <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{sigCustomerRole}</p>}
                  <SignatureCanvas value={sigCustomer} onChange={setSigCustomer} label={isPreview || isLocked ? "" : "Tegn signatur"} disabled={isPreview || isLocked} />
                  <p className="text-[10px] text-muted-foreground">{format(new Date(), "d. MMMM yyyy, HH:mm", { locale: nb })}</p>
                </div>
              </div>
            </Section>
          )}

          {/* FOOTER */}
          {isPreview && (
            <div className="pt-6 border-t border-border/30 text-center">
              <p className="text-[10px] text-muted-foreground">{company && `${company} · `}Generert {format(new Date(), "d. MMMM yyyy", { locale: nb })}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── SEND DIALOG ── */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send servicejournal til kunde</DialogTitle>
            <DialogDescription>Journalen markeres som sendt og logges.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">E-postadresse</Label>
              <Input value={sendEmail} onChange={e => setSendEmail(e.target.value)} placeholder="kunde@eksempel.no" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Emne</Label>
              <Input value={sendSubject} onChange={e => setSendSubject(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Melding</Label>
              <Textarea value={sendMessage} onChange={e => setSendMessage(e.target.value)} rows={4} className="resize-none text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendDialogOpen(false)}>Avbryt</Button>
            <Button onClick={handleSendToCustomer} disabled={!sendEmail || sendingEmail} className="gap-1.5">
              {sendingEmail ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── SHARE DIALOG ── */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Del servicejournal</DialogTitle>
            <DialogDescription>Opprett en read-only lenke for deling.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Utløpstid</Label>
              <Select value={shareExpiry} onValueChange={setShareExpiry}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 dager</SelectItem>
                  <SelectItem value="30">30 dager</SelectItem>
                  <SelectItem value="90">90 dager</SelectItem>
                  <SelectItem value="0">Ingen utløp</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {shareUrl && (
              <div className="space-y-1.5">
                <Label className="text-xs">Delingslenke</Label>
                <div className="flex gap-2">
                  <Input value={shareUrl} readOnly className="text-xs" />
                  <Button variant="outline" size="icon" className="shrink-0"
                    onClick={() => { navigator.clipboard.writeText(shareUrl); toast.success("Kopiert!"); }}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShareDialogOpen(false); setShareUrl(""); }}>Lukk</Button>
            {!shareUrl && (
              <Button onClick={handleCreateShareLink} disabled={creatingShare} className="gap-1.5">
                {creatingShare ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />}
                Opprett lenke
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Image lightbox ── */}
      {lightboxImg && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setLightboxImg(null)}>
          <img src={lightboxImg} alt="" className="max-w-full max-h-[90vh] object-contain rounded-lg" />
        </div>
      )}
    </div>
  );
}

/* ── Subcomponents ── */

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-card p-3 space-y-1">
      <div className="flex items-center gap-1.5 text-muted-foreground">{icon}<span className="text-[10px] uppercase tracking-wider font-medium">{label}</span></div>
      <p className="text-lg font-bold text-foreground">{value}</p>
    </div>
  );
}

function Section({ title, icon, count, subtitle, children }: {
  title: string; icon: React.ReactNode; count?: number; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        {count !== undefined && count > 0 && <Badge variant="secondary" className="text-[10px] h-5">{count}</Badge>}
        {subtitle && <span className="text-[10px] text-muted-foreground ml-auto">{subtitle}</span>}
      </div>
      <Separator className="bg-border/40" />
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground py-4 text-center">{text}</p>;
}
