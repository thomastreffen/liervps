import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SignatureCanvas } from "./SignatureCanvas";
import { getFileTypeIcon } from "@/lib/file-icons";
import {
  ClipboardList, User, CalendarDays, FileImage, AlertTriangle,
  History, Loader2, CheckCircle2, Image as ImageIcon, FileText,
  Eye, EyeOff, PenLine, ChevronDown, ChevronUp,
  Download, Send, Link2, Clock, Users, Camera, TriangleAlert,
  FileDown, Share2, Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/* ── Types ── */

interface ScheduleBlock {
  id: string;
  start_at: string;
  end_at: string;
  title: string;
  match_state: string;
  technician_name?: string;
  technician_color?: string;
}

interface Deviation {
  id: string;
  title: string;
  status: string;
  created_at: string;
  severity?: string;
}

interface DocFile {
  id: string;
  title: string;
  mime_type: string | null;
  created_at: string;
  source_meta?: Record<string, any>;
  source_type?: string;
}

interface ActivityEntry {
  id: string;
  type: string;
  action: string;
  title: string | null;
  description: string | null;
  created_at: string;
}

interface ServiceJournalProps {
  projectId: string;
  projectTitle: string;
  customer: string;
  address?: string;
  technicianNames: string[];
  internalNumber?: string;
  companyLogoUrl?: string;
  companyName?: string;
}

type SectionKey = "oppdrag" | "utfort" | "arbeidsokter" | "dokumentasjon" | "merknader" | "signatur";

interface SectionVisibility {
  oppdrag: boolean;
  utfort: boolean;
  arbeidsokter: boolean;
  dokumentasjon: boolean;
  merknader: boolean;
  signatur: boolean;
}

type ReportStatus = "draft" | "final";

const SECTION_META: { key: SectionKey; label: string; customerDefault: boolean }[] = [
  { key: "oppdrag", label: "Oppdrag", customerDefault: true },
  { key: "utfort", label: "Utført arbeid", customerDefault: true },
  { key: "arbeidsokter", label: "Arbeidsøkter", customerDefault: true },
  { key: "dokumentasjon", label: "Dokumentasjon", customerDefault: true },
  { key: "merknader", label: "Merknader", customerDefault: true },
  { key: "signatur", label: "Signatur", customerDefault: true },
];

const MATCH_STATE_LABELS: Record<string, string> = {
  manual: "Manuell", confirmed: "Bekreftet", auto: "Auto",
  needs_confirmation: "Trenger bekreftelse", external: "Ekstern",
};

/* ── Main Component ── */

export function ServiceJournal({
  projectId, projectTitle, customer, address, technicianNames,
  internalNumber, companyLogoUrl, companyName,
}: ServiceJournalProps) {
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [deviations, setDeviations] = useState<Deviation[]>([]);
  const [docs, setDocs] = useState<DocFile[]>([]);
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [viewMode, setViewMode] = useState<"internal" | "customer">("internal");
  const [isPreview, setIsPreview] = useState(false);
  const [reportStatus, setReportStatus] = useState<ReportStatus>("draft");
  const [reportType, setReportType] = useState<"servicejournal" | "arbeidsrapport">("servicejournal");

  const [sections, setSections] = useState<SectionVisibility>({
    oppdrag: true, utfort: true, arbeidsokter: true, dokumentasjon: true, merknader: true, signatur: true,
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

  // Image lightbox
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);

  // Company info
  const [companyInfo, setCompanyInfo] = useState<{ logo_url?: string; company_name?: string } | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [blocksRes, devsRes, docsRes, actRes, companyRes] = await Promise.all([
      supabase
        .from("schedule_blocks")
        .select("id, start_at, end_at, title, match_state, technicians!inner(name, color)")
        .eq("project_id", projectId)
        .is("deleted_at", null)
        .order("start_at", { ascending: true })
        .limit(100),
      (supabase as any)
        .from("job_tasks")
        .select("id, title, status, created_at, priority")
        .eq("job_id", projectId)
        .eq("category", "avvik")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("docs_files")
        .select("id, title, mime_type, created_at, source_meta, source_type")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(50) as any,
      supabase
        .from("activity_log")
        .select("id, type, action, title, description, created_at")
        .eq("entity_id", projectId)
        .eq("entity_type", "job")
        .in("type", ["status_change", "note", "email", "meeting", "task"])
        .order("created_at", { ascending: false })
        .limit(30),
      supabase.from("company_settings").select("logo_url, company_name").limit(1).single(),
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
    setActivities((actRes.data || []).map((r: any) => ({
      id: r.id, type: r.type, action: r.action, title: r.title, description: r.description, created_at: r.created_at,
    })));
    if (companyRes.data) setCompanyInfo(companyRes.data);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleViewModeChange = (mode: "internal" | "customer") => {
    setViewMode(mode);
    if (mode === "customer") {
      setSections({ oppdrag: true, utfort: true, arbeidsokter: true, dokumentasjon: true, merknader: true, signatur: true });
    } else {
      setSections({ oppdrag: true, utfort: true, arbeidsokter: true, dokumentasjon: true, merknader: true, signatur: true });
    }
  };

  const toggleSection = (key: SectionKey) => setSections(prev => ({ ...prev, [key]: !prev[key] }));

  const isCustomer = viewMode === "customer";
  const logoUrl = companyLogoUrl || companyInfo?.logo_url;
  const company = companyName || companyInfo?.company_name || "";

  // Derived data
  const sortedBlocks = [...blocks].sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  const periodStart = sortedBlocks[0] ? format(new Date(sortedBlocks[0].start_at), "d. MMM yyyy", { locale: nb }) : "—";
  const periodEnd = sortedBlocks.length > 0 ? format(new Date(sortedBlocks[sortedBlocks.length - 1].end_at), "d. MMM yyyy", { locale: nb }) : "—";
  const uniqueTechs = Array.from(
    new Map(blocks.filter(b => b.technician_name).map(b => [b.technician_name!, { name: b.technician_name!, color: b.technician_color }])).values()
  );
  const imageDocs = docs.filter(d => d.mime_type?.startsWith("image/"));
  const otherDocs = docs.filter(d => !d.mime_type?.startsWith("image/"));
  const completedBlocks = blocks.filter(b => new Date(b.end_at) < new Date());

  // Stats
  const totalMinutes = blocks.reduce((sum, b) => sum + Math.round((new Date(b.end_at).getTime() - new Date(b.start_at).getTime()) / 60000), 0);
  const totalHours = (totalMinutes / 60).toFixed(1);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleExportPdf = () => {
    toast.info("PDF-eksport klargjøres…", { description: "Funksjonen er under utvikling" });
  };

  const handleSendToCustomer = () => {
    toast.info("Sending til kunde…", { description: "Funksjonen er under utvikling" });
  };

  const handleShareLink = () => {
    toast.info("Delbar lenke…", { description: "Funksjonen er under utvikling" });
  };

  const previewBorder = isPreview ? "ring-1 ring-border/40 rounded-2xl bg-card shadow-sm" : "";

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* ── Toolbar ── */}
      {!isPreview && (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                <ClipboardList className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Servicejournal</h2>
                <p className="text-xs text-muted-foreground">Profesjonell leveranserapport</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Status badge */}
              <button
                onClick={() => setReportStatus(prev => prev === "draft" ? "final" : "draft")}
                className="cursor-pointer"
              >
                <Badge
                  variant={reportStatus === "final" ? "default" : "secondary"}
                  className={cn(
                    "text-xs h-6 gap-1",
                    reportStatus === "final" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}
                >
                  {reportStatus === "final" ? <CheckCircle2 className="h-3 w-3" /> : <PenLine className="h-3 w-3" />}
                  {reportStatus === "final" ? "Ferdig" : "Foreløpig"}
                </Badge>
              </button>
              <Button
                variant="outline" size="sm"
                className="gap-1.5 rounded-xl text-xs h-8"
                onClick={() => { setIsPreview(true); handleViewModeChange("customer"); }}
              >
                <Eye className="h-3.5 w-3.5" /> Forhåndsvis
              </Button>
            </div>
          </div>

          {/* Report type + view mode */}
          <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-muted/20 p-3">
            <div className="flex-1 flex gap-1">
              <button
                onClick={() => setReportType("servicejournal")}
                className={cn("flex-1 rounded-lg px-3 py-1.5 text-xs font-medium text-center transition-colors",
                  reportType === "servicejournal" ? "bg-card text-foreground shadow-sm border border-border/40" : "text-muted-foreground hover:text-foreground"
                )}
              >Servicejournal</button>
              <button
                onClick={() => setReportType("arbeidsrapport")}
                className={cn("flex-1 rounded-lg px-3 py-1.5 text-xs font-medium text-center transition-colors",
                  reportType === "arbeidsrapport" ? "bg-card text-foreground shadow-sm border border-border/40" : "text-muted-foreground hover:text-foreground"
                )}
              >Arbeidsrapport</button>
            </div>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex-1 flex gap-1">
              <button
                onClick={() => handleViewModeChange("internal")}
                className={cn("flex-1 rounded-lg px-3 py-1.5 text-xs font-medium text-center transition-colors",
                  !isCustomer ? "bg-card text-foreground shadow-sm border border-border/40" : "text-muted-foreground hover:text-foreground"
                )}
              >Intern</button>
              <button
                onClick={() => handleViewModeChange("customer")}
                className={cn("flex-1 rounded-lg px-3 py-1.5 text-xs font-medium text-center transition-colors",
                  isCustomer ? "bg-card text-foreground shadow-sm border border-border/40" : "text-muted-foreground hover:text-foreground"
                )}
              >Kunde</button>
            </div>
          </div>

          {/* Section controls */}
          <div className="space-y-2">
            <button onClick={() => setShowControls(!showControls)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              {showControls ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {showControls ? "Skjul seksjonskontroll" : "Vis seksjonskontroll"}
            </button>
            {showControls && (
              <div className="rounded-xl border border-border/40 bg-muted/10 p-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Vis/skjul seksjoner</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {SECTION_META.map(s => (
                    <label key={s.key} className="flex items-center gap-2 cursor-pointer">
                      <Switch checked={sections[s.key]} onCheckedChange={() => toggleSection(s.key)} className="scale-90" />
                      <span className="text-sm">{s.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Export actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="default" size="sm" className="gap-1.5 rounded-xl text-xs h-8" onClick={handleExportPdf}>
              <FileDown className="h-3.5 w-3.5" /> Generer PDF
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 rounded-xl text-xs h-8" onClick={handleSendToCustomer}>
              <Send className="h-3.5 w-3.5" /> Send til kunde
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 rounded-xl text-xs h-8" onClick={handleShareLink}>
              <Share2 className="h-3.5 w-3.5" /> Del lenke
            </Button>
          </div>
        </div>
      )}

      {/* ── Preview header ── */}
      {isPreview && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-primary">Forhåndsvisning – kundevisning</p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 rounded-xl text-xs h-8" onClick={() => setIsPreview(false)}>
            <EyeOff className="h-3.5 w-3.5" /> Tilbake
          </Button>
        </div>
      )}

      {/* ── Journal content ── */}
      <div className={cn(previewBorder, isPreview && "p-8")}>
        <div className="space-y-8">

          {/* ═══ REPORT HEADER ═══ */}
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
              <div className="text-right space-y-0.5">
                <Badge
                  variant={reportStatus === "final" ? "default" : "secondary"}
                  className={cn("text-[10px] h-5",
                    reportStatus === "final" ? "bg-primary text-primary-foreground" : ""
                  )}
                >
                  {reportStatus === "final" ? "Ferdig" : "Foreløpig"}
                </Badge>
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

          {/* ═══ SUMMARY STATS BOX ═══ */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon={<Clock className="h-4 w-4" />} label="Timer totalt" value={totalHours} />
            <StatCard icon={<Users className="h-4 w-4" />} label="Montører" value={String(uniqueTechs.length || technicianNames.length)} />
            <StatCard icon={<Camera className="h-4 w-4" />} label="Bilder" value={String(imageDocs.length)} />
            <StatCard icon={<TriangleAlert className="h-4 w-4" />} label="Avvik" value={String(deviations.length)} />
          </div>

          {/* 1. Oppdrag */}
          {sections.oppdrag && (
            <Section title="Oppdrag" icon={<ClipboardList className="h-4 w-4" />}>
              {isPreview || isCustomer ? (
                <div className="text-sm text-foreground whitespace-pre-wrap">
                  {summaryText || <span className="text-muted-foreground italic">Ingen oppdragsbeskrivelse lagt til</span>}
                </div>
              ) : (
                <Textarea
                  value={summaryText}
                  onChange={e => setSummaryText(e.target.value)}
                  placeholder="Beskriv oppdraget – hva skulle utføres…"
                  rows={3}
                  className="resize-none text-sm"
                />
              )}
            </Section>
          )}

          {/* 2. Utført arbeid */}
          {sections.utfort && (
            <Section title="Utført arbeid" icon={<CheckCircle2 className="h-4 w-4" />}>
              {isPreview || isCustomer ? (
                <div className="text-sm text-foreground whitespace-pre-wrap">
                  {workDescription || <span className="text-muted-foreground italic">Ingen beskrivelse av utført arbeid</span>}
                </div>
              ) : (
                <Textarea
                  value={workDescription}
                  onChange={e => setWorkDescription(e.target.value)}
                  placeholder="Beskriv arbeidet som ble utført…"
                  rows={4}
                  className="resize-none text-sm"
                />
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
                    const durationLabel = durationMin >= 60
                      ? `${Math.floor(durationMin / 60)}t${durationMin % 60 > 0 ? ` ${durationMin % 60}m` : ""}`
                      : `${durationMin}m`;

                    return (
                      <div key={block.id} className={cn(
                        "flex items-center gap-3 rounded-xl border p-3",
                        isPast ? "border-border/30 bg-muted/20" : "border-border/40 bg-card"
                      )}>
                        {!isCustomer && (
                          <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: block.technician_color || "hsl(var(--primary))" }} />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold">{format(start, "EEE d. MMM", { locale: nb })}</p>
                            <span className="text-xs text-muted-foreground">
                              {format(start, "HH:mm")} – {format(end, "HH:mm")}
                            </span>
                            <span className="text-[10px] text-muted-foreground/70">({durationLabel})</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <User className="h-3 w-3" />
                            <span>{block.technician_name || "Ukjent"}</span>
                            {!isCustomer && <span className="text-[10px]">· {MATCH_STATE_LABELS[block.match_state] || block.match_state}</span>}
                          </div>
                        </div>
                        {isPast && (
                          <Badge variant="secondary" className="text-[10px] h-5 bg-primary/10 text-primary">Utført</Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>
          )}

          {/* 4. Dokumentasjon */}
          {sections.dokumentasjon && (
            <Section title="Dokumentasjon" icon={<FileImage className="h-4 w-4" />}
              count={imageDocs.length + otherDocs.length}
              subtitle={`${imageDocs.length} bilder / ${otherDocs.length} filer`}
            >
              {docs.length === 0 ? (
                <EmptyState text="Ingen dokumenter eller bilder" />
              ) : (
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
                            <button
                              key={img.id}
                              onClick={() => url && setLightboxImg(url)}
                              className="aspect-square rounded-lg border border-border/40 bg-muted/30 flex items-center justify-center overflow-hidden hover:ring-2 hover:ring-primary/30 transition-all cursor-pointer group"
                            >
                              {url ? (
                                <img src={url} alt={img.title} className="w-full h-full object-cover" />
                              ) : (
                                <div className="text-center p-2">
                                  <ImageIcon className="h-5 w-5 text-muted-foreground mx-auto" />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      {/* Captions */}
                      {imageDocs.some(i => i.title) && (
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                          {imageDocs.map((img, idx) => (
                            <p key={img.id} className="text-[10px] text-muted-foreground">
                              <span className="font-medium">{idx + 1}.</span> {img.title}
                            </p>
                          ))}
                        </div>
                      )}
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
                  {deviations.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Avvik</p>
                      {deviations.map(dev => (
                        <div key={dev.id} className="flex items-center gap-3 rounded-xl border border-border/40 bg-card p-3">
                          <AlertTriangle className={cn("h-4 w-4 shrink-0",
                            dev.severity === "high" ? "text-destructive" : "text-muted-foreground"
                          )} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{dev.title}</p>
                            <p className="text-[10px] text-muted-foreground">{format(new Date(dev.created_at), "d. MMM yyyy", { locale: nb })}</p>
                          </div>
                          <Badge variant="secondary" className={cn("text-[10px] h-5",
                            dev.status === "completed" && "bg-primary/10 text-primary"
                          )}>
                            {dev.status === "completed" ? "Lukket" : dev.status === "open" ? "Åpen" : dev.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                  {customerComment ? (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Kommentar</p>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{customerComment}</p>
                    </div>
                  ) : deviations.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">Ingen merknader</p>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-4">
                  {deviations.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Registrerte avvik ({deviations.length})</p>
                      {deviations.map(dev => (
                        <div key={dev.id} className="flex items-center gap-3 rounded-xl border border-border/40 bg-card p-3">
                          <AlertTriangle className={cn("h-4 w-4 shrink-0",
                            dev.severity === "high" ? "text-destructive" : "text-muted-foreground"
                          )} />
                          <p className="text-sm flex-1 truncate">{dev.title}</p>
                          <Badge variant="secondary" className="text-[10px] h-5">
                            {dev.status === "completed" ? "Lukket" : "Åpen"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                  <Textarea
                    value={customerComment}
                    onChange={e => setCustomerComment(e.target.value)}
                    placeholder="Eventuelle merknader til kunden…"
                    rows={2}
                    className="resize-none text-sm"
                  />
                </div>
              )}
            </Section>
          )}

          {/* 6. Signatur */}
          {sections.signatur && (
            <Section title="Signatur" icon={<PenLine className="h-4 w-4" />}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  {!isPreview && (
                    <input
                      type="text" value={sigResponsibleRole}
                      onChange={e => setSigResponsibleRole(e.target.value)}
                      className="flex h-7 w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] text-muted-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      placeholder="Rolle"
                    />
                  )}
                  {isPreview && <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{sigResponsibleRole}</p>}
                  <SignatureCanvas
                    value={sigResponsible}
                    onChange={setSigResponsible}
                    label={isPreview ? "" : "Tegn signatur"}
                    disabled={isPreview}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    {format(new Date(), "d. MMMM yyyy, HH:mm", { locale: nb })}
                  </p>
                </div>
                <div className="space-y-2">
                  {!isPreview && (
                    <input
                      type="text" value={sigCustomerRole}
                      onChange={e => setSigCustomerRole(e.target.value)}
                      className="flex h-7 w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] text-muted-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      placeholder="Rolle"
                    />
                  )}
                  {isPreview && <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{sigCustomerRole}</p>}
                  <SignatureCanvas
                    value={sigCustomer}
                    onChange={setSigCustomer}
                    label={isPreview ? "" : "Tegn signatur"}
                    disabled={isPreview}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    {format(new Date(), "d. MMMM yyyy, HH:mm", { locale: nb })}
                  </p>
                </div>
              </div>
            </Section>
          )}

          {/* ═══ FOOTER ═══ */}
          {isPreview && (
            <div className="pt-6 border-t border-border/30 text-center">
              <p className="text-[10px] text-muted-foreground">
                {company && `${company} · `}Generert {format(new Date(), "d. MMMM yyyy", { locale: nb })}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Image lightbox ── */}
      {lightboxImg && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setLightboxImg(null)}
        >
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
