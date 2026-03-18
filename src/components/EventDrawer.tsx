import { useState, useEffect, useCallback } from "react";
import { useProjectSuggestions, type ProjectSuggestion } from "@/hooks/useProjectSuggestions";
import { ProjectSuggestionList } from "./ProjectSuggestionList";
import { FileUpload } from "./FileUpload";
import { AttachmentList } from "./AttachmentList";
import type { Attachment } from "@/lib/mock-data";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TechnicianMultiSelect } from "./TechnicianMultiSelect";
import { JobStatusBadge } from "./JobStatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import {
  AlertTriangle,
  ExternalLink,
  Clock,
  MapPin,
  User,
  Loader2,
  Save,
  CalendarPlus,
  Link2,
  Search,
  Plus,
  Trash2,
  Paperclip,
  FolderKanban,
  ListChecks,
  Moon,
  ArrowRight,
  Users,
  Building,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import type { CalendarEvent } from "@/hooks/useCalendarEvents";
import type { JobStatus } from "@/lib/job-status";
import { useCalendarSync } from "@/hooks/useCalendarSync";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { TimeSelect } from "@/components/ui/time-select";
import { normalizeOvernightDates, isOvernightRange, autoAdjustEndDate } from "@/lib/overnight";

/* ── Types ── */
interface ExistingJob {
  id: string;
  title: string;
  customer: string | null;
  start_time: string;
  end_time: string;
  status: string;
  internal_number: string | null;
}

interface ConflictInfo {
  techName: string;
  jobTitle: string;
  start: string;
  end: string;
}

interface EventDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editEvent?: CalendarEvent | null;
  clickedTechId?: string | null;
  preselectedStart?: Date | null;
  preselectedEnd?: Date | null;
  preselectedTechId?: string | null;
  projectId?: string | null;
  projectTitle?: string | null;
  scheduleBlockId?: string | null;
  onSaved?: (eventId?: string) => void;
  /** When true, drawer opens in view-only mode (no editing) */
  readOnly?: boolean;
}

export function EventDrawer({
  open,
  onOpenChange,
  editEvent,
  clickedTechId,
  preselectedStart,
  preselectedEnd,
  preselectedTechId,
  projectId,
  projectTitle,
  scheduleBlockId,
  onSaved,
  readOnly = false,
}: EventDrawerProps) {
  const navigate = useNavigate();
  const { syncCreate, syncUpdate, syncDelete } = useCalendarSync();
  const { activeCompanyId, isAllCompanies, companies } = useCompanyContext();
  const isEditing = !!editEvent;

  // Form state
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [eventType, setEventType] = useState<"project" | "task">("project");
  const [title, setTitle] = useState("");
  const [customer, setCustomer] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [assignmentNotes, setAssignmentNotes] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("16:00");
  const [techIds, setTechIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [clientRequestId, setClientRequestId] = useState(() => crypto.randomUUID());
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  // Existing job search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ExistingJob[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  // Conflicts
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);

  // Delete state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Attachments
  const [files, setFiles] = useState<File[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<Attachment[]>([]);
  const [editCompanyName, setEditCompanyName] = useState<string | null>(null);

  // Populate form from props
  useEffect(() => {
    if (!open) return;

    if (editEvent) {
      setTitle(editEvent.title);
      setCustomer(editEvent.customer || "");
      setAddress(editEvent.address || "");
      setDescription(editEvent.description || "");
      setDate(format(editEvent.start, "yyyy-MM-dd"));
      setStartTime(format(editEvent.start, "HH:mm"));
      setEndDate(format(editEvent.end, "yyyy-MM-dd"));
      setEndTime(format(editEvent.end, "HH:mm"));
      setTechIds(editEvent.technicians.map((t) => t.id));
      setMode("new");
    } else {
      const nextDate = preselectedStart ? format(preselectedStart, "yyyy-MM-dd") : "";
      const nextStartTime = preselectedStart ? format(preselectedStart, "HH:mm") : "08:00";
      const nextEndTime = preselectedEnd ? format(preselectedEnd, "HH:mm") : "16:00";

      setTitle(projectTitle || "");
      setCustomer("");
      setAddress("");
      setDescription("");
      setAssignmentNotes("");
      setDate(nextDate);
      setStartTime(nextStartTime);
      setEndTime(nextEndTime);
      setEndDate(nextDate ? autoAdjustEndDate(nextDate, nextStartTime, nextEndTime) : "");
      setTechIds(preselectedTechId ? [preselectedTechId] : []);
      setMode(projectId ? "existing" : "new");
      setEventType("project");
      setSelectedJobId(projectId || null);
    }
    setConflicts([]);
    setSearchQuery("");
    setSearchResults([]);
    setSubmitted(false);
    setClientRequestId(crypto.randomUUID());
    setFiles([]);
    setExistingAttachments([]);
    setEditCompanyName(null);
    setSelectedCompanyId(isAllCompanies ? (companies.length === 1 ? companies[0].id : null) : activeCompanyId);

    // Load existing attachments for edit mode
    if (editEvent) {
      supabase.from("events").select("attachments, company_id, internal_companies(name)").eq("id", editEvent.id).single().then(({ data }) => {
        if (data?.attachments && Array.isArray(data.attachments)) {
          setExistingAttachments(data.attachments as unknown as Attachment[]);
        }
        const compName = (data as any)?.internal_companies?.name;
        if (compName) setEditCompanyName(compName);
      });
    }
  }, [open, editEvent, preselectedStart, preselectedEnd, preselectedTechId, projectId, projectTitle, isAllCompanies, activeCompanyId, companies]);

  // Search existing jobs
  useEffect(() => {
    if (mode !== "existing" || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      const { data } = await supabase
        .from("events")
        .select("id, title, customer, start_time, end_time, status, internal_number")
        .is("deleted_at", null)
        .or(`title.ilike.%${searchQuery}%,customer.ilike.%${searchQuery}%,internal_number.ilike.%${searchQuery}%`)
        .order("start_time", { ascending: false })
        .limit(10);
      setSearchResults(data || []);
      setSearchLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, mode]);

  // Conflict check
  const checkConflicts = useCallback(async (d: string, s: string, ed: string, e: string, techs: string[], excludeId?: string) => {
    if (!d || !ed || techs.length === 0) { setConflicts([]); return; }
    try {
      const { startISO, endISO } = normalizeOvernightDates(d, s, ed, e);

      let query = supabase
        .from("events")
        .select("id, title, start_time, end_time, event_technicians(technician_id, technicians(name))")
        .is("deleted_at", null)
        .lt("start_time", endISO)
        .gt("end_time", startISO);

      if (excludeId) query = query.neq("id", excludeId);

      const { data: overlaps } = await query;
      const found: ConflictInfo[] = [];
      for (const ev of overlaps || []) {
        for (const et of (ev as any).event_technicians || []) {
          if (techs.includes(et.technician_id)) {
            found.push({
              techName: et.technicians?.name || "Ukjent",
              jobTitle: (ev as any).title,
              start: format(new Date((ev as any).start_time), "HH:mm"),
              end: format(new Date((ev as any).end_time), "HH:mm"),
            });
          }
        }
      }
      setConflicts(found);
    } catch { setConflicts([]); }
  }, []);

  // Auto-check conflicts
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      checkConflicts(date, startTime, endDate || (date ? autoAdjustEndDate(date, startTime, endTime) : ""), endTime, techIds, editEvent?.id);
    }, 500);
    return () => clearTimeout(timer);
  }, [date, startTime, endDate, endTime, techIds, open, editEvent, checkConflicts]);

  const handleDateChange = (nextDate: string) => {
    setDate(nextDate);
    setEndDate(nextDate ? autoAdjustEndDate(nextDate, startTime, endTime) : "");
  };

  const handleStartTimeChange = (nextStartTime: string) => {
    setStartTime(nextStartTime);
    if (date) setEndDate(autoAdjustEndDate(date, nextStartTime, endTime));
  };

  const handleEndTimeChange = (nextEndTime: string) => {
    setEndTime(nextEndTime);
    if (date) setEndDate(autoAdjustEndDate(date, startTime, nextEndTime));
  };

  const resolvedEndDate = endDate || (date ? autoAdjustEndDate(date, startTime, endTime) : "");

  const overnight = date && startTime && resolvedEndDate && endTime
    ? isOvernightRange(date, startTime, resolvedEndDate, endTime)
    : false;

  const summaryLine = date && startTime && resolvedEndDate && endTime ? (() => {
    try {
      const start = new Date(`${date}T${startTime}`);
      const end = new Date(`${resolvedEndDate}T${endTime}`);
      return `${format(start, "dd.MM.yyyy HH:mm", { locale: nb })} → ${format(end, "dd.MM.yyyy HH:mm", { locale: nb })}`;
    } catch {
      return null;
    }
  })() : null;

  // Upload files to storage and return attachment metadata
  const uploadFiles = async (eventId: string, filesToUpload: File[]): Promise<Attachment[]> => {
    const uploaded: Attachment[] = [];
    for (const file of filesToUpload) {
      const filePath = `${eventId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from("job-attachments").upload(filePath, file);
      if (uploadError) {
        toast.error(`Kunne ikke laste opp ${file.name}`);
        continue;
      }
      const { data: urlData } = supabase.storage.from("job-attachments").getPublicUrl(filePath);
      uploaded.push({ name: file.name, url: urlData.publicUrl, size: file.size });
    }
    return uploaded;
  };

  // Save: create or update
  const handleSave = async () => {
    if (saving || submitted) return;
    setSaving(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;

      if (isEditing && editEvent) {
        const { startISO, endISO } = normalizeOvernightDates(date, startTime, endDate, endTime);

        await supabase.from("events")
          .update({ start_time: startISO, end_time: endISO, title, customer, address, description })
          .eq("id", editEvent.id);

        const { data: existing } = await supabase
          .from("event_technicians").select("id, technician_id").eq("event_id", editEvent.id);
        const existingIds = new Set((existing || []).map((e) => e.technician_id));
        const newIds = new Set(techIds);
        const toAdd = techIds.filter((id) => !existingIds.has(id));
        const toRemove = (existing || []).filter((e) => !newIds.has(e.technician_id));

        if (toRemove.length > 0) {
          await supabase.from("event_technicians").delete().in("id", toRemove.map((r) => r.id));
        }
        if (toAdd.length > 0) {
          await supabase.from("event_technicians").insert(
            toAdd.map((tid) => ({ event_id: editEvent.id, technician_id: tid }))
          );
          await supabase.functions.invoke("create-approval", { body: { job_id: editEvent.id } });
        }
        syncUpdate(editEvent.id);

        // Upload new attachments
        if (files.length > 0) {
          const newUploads = await uploadFiles(editEvent.id, files);
          const allAttachments = [...existingAttachments, ...newUploads];
          await supabase.from("events").update({ attachments: allAttachments as any }).eq("id", editEvent.id);
        }

        toast.success("Hendelse oppdatert", { description: "Tid og ressurser er lagret." });
        onSaved?.(editEvent.id);
      } else if (mode === "existing" && selectedJobId) {
        const updatePayload: Record<string, any> = {};
        if (date) {
          const { startISO, endISO } = normalizeOvernightDates(date, startTime, endDate, endTime);
          updatePayload.start_time = startISO;
          updatePayload.end_time = endISO;
        }
        if (assignmentNotes.trim()) {
          updatePayload.assignment_notes = assignmentNotes.trim();
        }
        if (Object.keys(updatePayload).length > 0) {
          await (supabase as any).from("events").update(updatePayload).eq("id", selectedJobId);
        }

        const { data: existing } = await supabase
          .from("event_technicians").select("technician_id").eq("event_id", selectedJobId);
        const existingIds = new Set((existing || []).map((e) => e.technician_id));
        const newTechs = techIds.filter((id) => !existingIds.has(id));

        if (newTechs.length > 0) {
          await supabase.from("event_technicians").insert(
            newTechs.map((tid) => ({ event_id: selectedJobId, technician_id: tid }))
          );
          await supabase.functions.invoke("create-approval", { body: { job_id: selectedJobId } });
        }

        // Upload attachments for existing job
        if (files.length > 0) {
          const { data: evtRow } = await supabase.from("events").select("attachments").eq("id", selectedJobId).single();
          const prevAtts = (evtRow?.attachments && Array.isArray(evtRow.attachments) ? evtRow.attachments : []) as unknown as Attachment[];
          const newUploads = await uploadFiles(selectedJobId, files);
          await supabase.from("events").update({ attachments: [...prevAtts, ...newUploads] as any }).eq("id", selectedJobId);
        }

        toast.success("Montør(er) tildelt");
        onSaved?.(selectedJobId);
      } else {
        const isTask = eventType === "task";
        // Resolve company_id: explicit selection > active company (non-global) > block
        const resolvedCompanyId = selectedCompanyId || (isAllCompanies ? null : activeCompanyId) || null;

        if (!resolvedCompanyId) {
          toast.error("Velg selskap før du oppretter oppdraget");
          setSaving(false);
          return;
        }

        if (!title.trim() || (!isTask && techIds.length === 0) || !date) {
          toast.error(isTask ? "Fyll inn tittel og dato" : "Fyll inn tittel, dato og minst én montør");
          setSaving(false);
          return;
        }
        const { startISO, endISO } = normalizeOvernightDates(date, startTime, endDate, endTime);

        const { data: existing } = await supabase
          .from("events")
          .select("id")
          .eq("client_request_id", clientRequestId)
          .maybeSingle();

        let createdId: string;

        if (existing) {
          createdId = existing.id;
        } else {
          const { data: created, error } = await supabase.from("events").insert({
            title: title.trim(),
            customer: customer || null,
            address: address || null,
            description: description || null,
            start_time: startISO,
            end_time: endISO,
            technician_id: techIds[0] || userId || "00000000-0000-0000-0000-000000000000",
            status: "requested" as any,
            created_by: userId || null,
            client_request_id: clientRequestId,
            project_type: isTask ? "task" : "project",
            company_id: resolvedCompanyId,
          } as any).select("id").single();

          if (error || !created) {
            toast.error("Kunne ikke opprette", { description: error?.message });
            setSaving(false);
            return;
          }
          createdId = created.id;

          if (techIds.length > 0) {
            await supabase.from("event_technicians").insert(
              techIds.map((tid) => ({ event_id: createdId, technician_id: tid }))
            );

            if (isTask) {
              await supabase.from("events").update({ status: "scheduled" } as any).eq("id", createdId);
              syncCreate(createdId);
            } else {
              await supabase.functions.invoke("create-approval", { body: { job_id: createdId } });
              syncCreate(createdId);
            }
          }
        }

        // Upload attachments for new event
        if (files.length > 0) {
          const newUploads = await uploadFiles(createdId, files);
          await supabase.from("events").update({ attachments: newUploads as any }).eq("id", createdId);
        }

        toast.success(isTask ? "Oppgave opprettet" : "Hendelse opprettet og planlagt", {
          description: isTask
            ? `${title} er lagt til som oppgave.`
            : `${title} er tildelt ${techIds.length} montør(er).`,
        });
        setSubmitted(true);
        onSaved?.(createdId);
      }
    } catch (err: any) {
      toast.error("Feil ved lagring", { description: err?.message });
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = isEditing && editEvent ? (
    date !== format(editEvent.start, "yyyy-MM-dd") ||
    startTime !== format(editEvent.start, "HH:mm") ||
    endDate !== format(editEvent.end, "yyyy-MM-dd") ||
    endTime !== format(editEvent.end, "HH:mm") ||
    title !== editEvent.title ||
    JSON.stringify([...techIds].sort()) !== JSON.stringify(editEvent.technicians.map((t) => t.id).sort())
  ) : true;

  const isMultiTech = isEditing && editEvent && editEvent.technicians.length > 1;
  const clickedTechName = isEditing && clickedTechId
    ? editEvent?.technicians.find((t) => t.id === clickedTechId)?.name ?? null
    : null;
  const otherTechNames = isMultiTech && clickedTechId
    ? editEvent!.technicians.filter((t) => t.id !== clickedTechId).map((t) => t.name)
    : [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[480px] flex flex-col overflow-y-auto">
        <SheetHeader className="space-y-1">
          <SheetTitle className="flex items-center gap-2 text-base">
            {isEditing ? (
              readOnly
                ? <><Clock className="h-4 w-4 text-muted-foreground" />Oppdragsdetaljer</>
                : <><Clock className="h-4 w-4 text-primary" />Rediger oppdrag</>
            ) : (
              <><CalendarPlus className="h-4 w-4 text-primary" />{projectId ? "Planlegg arbeid" : "Nytt oppdrag"}</>
            )}
          </SheetTitle>
          <SheetDescription className="text-xs">
            {isEditing
              ? readOnly
                ? "Viser detaljer for oppdraget (kun lesemodus)"
                : "Endre tid, ressurser eller detaljer"
              : projectId
              ? `Tildel tid og montører til ${projectTitle || "prosjektet"}`
              : "Opprett nytt oppdrag eller knytt til eksisterende prosjekt"}
          </SheetDescription>

          {/* Multi-tech context banner */}
          {isEditing && editEvent && (
            <div className="space-y-1.5 pt-1">
              {/* JOB-ID badge */}
              {editEvent.jobNumber && (
                <span className="inline-block font-mono text-[11px] font-semibold bg-primary/10 text-primary rounded-md px-2 py-0.5">
                  {editEvent.jobNumber}
                </span>
              )}
              {/* Clicked tech indicator */}
              {clickedTechName && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <User className="h-3 w-3 shrink-0" />
                  <span>Valgt montør: <span className="font-medium text-foreground">{clickedTechName}</span></span>
                </div>
              )}
              {/* Other assigned techs */}
              {isMultiTech && otherTechNames.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="h-3 w-3 shrink-0" />
                  <span>Tildelt også: {otherTechNames.join(", ")}</span>
                </div>
              )}
            </div>
          )}
        </SheetHeader>

        <div className="flex-1 mt-3 space-y-6">

          {/* ═══ SECTION: SELSKAP ═══ */}
          {!isEditing && isAllCompanies && companies.length > 1 && (
            <section className="space-y-2">
              <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Selskap</h3>
              <p className="text-[11px] text-muted-foreground">
                Du oppretter fra «Alle selskaper» – velg hvilket selskap oppdraget tilhører.
              </p>
              <select
                value={selectedCompanyId || ""}
                onChange={(e) => setSelectedCompanyId(e.target.value || null)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Velg selskap…</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </section>
          )}

          {/* Company badge (when known) */}
          {!isEditing && !isAllCompanies && activeCompanyId && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Building className="h-3 w-3 shrink-0" />
              <span>Selskap: <span className="font-medium text-foreground">{companies.find(c => c.id === activeCompanyId)?.name || "—"}</span></span>
            </div>
          )}

          {/* ═══ SECTION: TYPE ═══ */}
          {!isEditing && !projectId && (
            <section className="space-y-3">
              <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Type</h3>
              <div className="flex items-center gap-1 border border-border/40 rounded-lg p-0.5">
                <Button
                  type="button"
                  variant={eventType === "project" ? "default" : "ghost"}
                  size="sm"
                  className="h-9 text-xs rounded-md flex-1 gap-1.5"
                  onClick={() => { setEventType("project"); setMode("new"); }}
                >
                  <FolderKanban className="h-3.5 w-3.5" />
                  Prosjekt
                </Button>
                <Button
                  type="button"
                  variant={eventType === "task" ? "default" : "ghost"}
                  size="sm"
                  className="h-9 text-xs rounded-md flex-1 gap-1.5"
                  onClick={() => { setEventType("task"); setMode("new"); }}
                >
                  <ListChecks className="h-3.5 w-3.5" />
                  Oppgave
                </Button>
              </div>

              {eventType === "project" && (
                <Tabs value={mode} onValueChange={(v) => setMode(v as "new" | "existing")}>
                  <TabsList className="grid w-full grid-cols-2 h-8">
                    <TabsTrigger value="new" className="gap-1 text-[11px] h-7">
                      <Plus className="h-3 w-3" />Nytt prosjekt
                    </TabsTrigger>
                    <TabsTrigger value="existing" className="gap-1 text-[11px] h-7">
                      <Link2 className="h-3 w-3" />Eksisterende
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              )}
            </section>
          )}

          {/* ═══ SECTION: EXISTING JOB SEARCH ═══ */}
          {mode === "existing" && !isEditing && !projectId && (
            <section className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Søk prosjekt (tittel, kunde, nr)..."
                  className="pl-9"
                />
              </div>
              {searchLoading && (
                <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
              )}
              {searchResults.length > 0 && (
                <div className="max-h-40 overflow-y-auto space-y-1 rounded-lg border border-border p-1">
                  {searchResults.map((job) => (
                    <button key={job.id} type="button"
                      onClick={() => {
                        setSelectedJobId(job.id);
                        setTitle(job.title);
                      }}
                      className={cn(
                        "w-full text-left rounded-md px-3 py-2 text-sm transition-colors",
                        selectedJobId === job.id ? "bg-primary/10 border border-primary/30" : "hover:bg-muted"
                      )}>
                      <p className="font-medium truncate">{job.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {job.internal_number} · {job.customer || "Ingen kunde"}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Project info banner */}
          {projectId && !isEditing && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <p className="text-sm font-medium">{projectTitle}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Velg tid og montører</p>
            </div>
          )}

          {/* Edit mode: job info */}
          {isEditing && editEvent && (
            <div className="space-y-1.5">
              {(editEvent.internalNumber || editEvent.jobNumber) && (
                <span className="inline-block font-mono text-[11px] font-semibold bg-primary/10 text-primary rounded px-2 py-0.5">
                  {(() => {
                    const num = editEvent.internalNumber || editEvent.jobNumber || "";
                    return num.startsWith("JOB-") ? num : `JOB-${num}`;
                  })()}
                </span>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {editCompanyName && (
                  <span className="flex items-center gap-1.5"><Building className="h-3.5 w-3.5" />{editCompanyName}</span>
                )}
                {editEvent.customer && (
                  <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" />{editEvent.customer}</span>
                )}
                {editEvent.address && (
                  <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{editEvent.address}</span>
                )}
                <JobStatusBadge status={editEvent.status} />
              </div>
            </div>
          )}

          {/* ═══ SECTION: OPPDRAG (new event fields) ═══ */}
          {mode === "new" && !isEditing && !projectId && (
            <NewEventFields
              title={title}
              setTitle={setTitle}
              customer={customer}
              setCustomer={setCustomer}
              address={address}
              setAddress={setAddress}
              eventType={eventType}
              onLinkProject={(proj) => {
                setMode("existing");
                setSelectedJobId(proj.id);
                setTitle(proj.title);
                setCustomer(proj.customer || "");
              }}
            />
          )}

          {/* Edit mode: title editable */}
          {isEditing && (
            <section className="space-y-3">
              <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Oppdrag</h3>
              <div>
                <Label className="text-xs">Tittel</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" disabled={readOnly} />
              </div>
            </section>
          )}

          {/* ═══ SECTION: TIDSPUNKT ═══ */}
          <section className="space-y-3">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Tidspunkt</h3>

            {/* Fra */}
            <div className="rounded-lg border border-border/40 bg-card p-3 space-y-2">
              <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Fra</Label>
              <div className="flex gap-2">
                <Input type="date" value={date} onChange={(e) => handleDateChange(e.target.value)} className="flex-1 h-9" disabled={readOnly} />
                <TimeSelect value={startTime} onChange={handleStartTimeChange} className="w-[100px]" disabled={readOnly} />
              </div>
            </div>

            {/* Arrow indicator */}
            <div className="flex justify-center">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <div className="h-px w-6 bg-border" />
                <ArrowRight className="h-3.5 w-3.5" />
                <div className="h-px w-6 bg-border" />
              </div>
            </div>

            {/* Til */}
            <div className="rounded-lg border border-border/40 bg-card p-3 space-y-2">
              <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Til</Label>
              <div className="flex gap-2">
                <Input type="date" value={resolvedEndDate} onChange={(e) => setEndDate(e.target.value)} className="flex-1 h-9" disabled={readOnly} />
                <TimeSelect value={endTime} onChange={handleEndTimeChange} className="w-[100px]" disabled={readOnly} />
              </div>
            </div>

            {/* Overnight badge */}
            {overnight && (
              <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                <Moon className="h-4 w-4 text-primary shrink-0" />
                <span className="text-xs font-medium text-primary">Går over midnatt – slutter neste dag</span>
              </div>
            )}

            {/* Time summary */}
            {summaryLine && (
              <div className="rounded-lg bg-muted/50 px-3 py-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Tidsrom</p>
                <p className="text-sm font-semibold mt-0.5 flex items-center gap-1.5">
                  {summaryLine}
                  {overnight && <Moon className="h-3 w-3 text-primary" />}
                </p>
              </div>
            )}
          </section>

          {/* ═══ SECTION: RESSURSER ═══ */}
          <section className="space-y-3">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {eventType === "task" && !isEditing ? "Tildel montør (valgfritt)" : "Ressurser"}
            </h3>
            <TechnicianMultiSelect selectedIds={techIds} onChange={setTechIds} disabled={readOnly} />
          </section>

          {/* ═══ SECTION: BESKRIVELSE ═══ */}
          {(mode === "new" || isEditing) && (
            <section className="space-y-3">
              <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Beskrivelse</h3>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="Detaljer til montøren..." className="min-h-[60px] resize-none" rows={2} disabled={readOnly} />
            </section>
          )}

          {/* ═══ SECTION: OPPDRAGSINSTRUKS (existing project mode) ═══ */}
          {mode === "existing" && !isEditing && (
            <section className="space-y-3">
              <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Instruks for dette oppdraget</h3>
              <p className="text-[11px] text-muted-foreground">
                Prosjektet gir grunninfo. Feltet under gjelder denne konkrete tildelingen.
              </p>
              <Textarea
                value={assignmentNotes}
                onChange={(e) => setAssignmentNotes(e.target.value)}
                placeholder="Spesifikke instrukser for denne tildelingen…"
                className="min-h-[60px] resize-none"
                rows={2}
              />
            </section>
          )}

          {/* ═══ SECTION: VEDLEGG ═══ */}
          <section className="space-y-3">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Paperclip className="h-3 w-3" />
              Vedlegg
            </h3>
            {existingAttachments.length > 0 && (
              <AttachmentList
                attachments={existingAttachments}
                onRemove={(name) => {
                  const updated = existingAttachments.filter((a) => a.name !== name);
                  setExistingAttachments(updated);
                  if (isEditing && editEvent) {
                    supabase.from("events").update({ attachments: updated as any }).eq("id", editEvent.id);
                  }
                }}
              />
            )}
            <FileUpload files={files} onChange={setFiles} />
          </section>

          {/* ═══ CONFLICTS ═══ */}
          {conflicts.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 space-y-1.5">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <p className="text-sm font-semibold">Kalenderkonflikt</p>
              </div>
              {conflicts.map((c, i) => (
                <p key={i} className="text-xs text-amber-700/80 dark:text-amber-400/80 ml-6">
                  {c.techName}: «{c.jobTitle}» ({c.start}–{c.end})
                </p>
              ))}
              <p className="text-xs text-amber-600/70 dark:text-amber-500/70 ml-6">
                Du kan fortsatt lagre, men montøren er allerede booket.
              </p>
            </div>
          )}
        </div>

        <SheetFooter className="mt-4 flex-col gap-2 sm:flex-col">
          <div className="flex gap-2 w-full">
            {isEditing && editEvent && (
              <Button variant="outline" className="flex-1 gap-1.5"
                onClick={() => { onOpenChange(false); navigate(`/projects/${editEvent.id}`); }}>
                <ExternalLink className="h-3.5 w-3.5" />
                Åpne prosjekt
              </Button>
            )}
            {!readOnly && (
              <Button className="flex-1 gap-1.5" onClick={handleSave}
                disabled={saving || submitted || (isEditing && !hasChanges) || (eventType === "project" && !isEditing && techIds.length === 0)}>
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                {saving ? "Oppretter…" :
                 submitted ? "Opprettet ✓" :
                 isEditing ? (conflicts.length > 0 ? "Lagre likevel" : "Lagre endringer") :
                 eventType === "task" ? "Opprett oppgave" :
                 conflicts.length > 0 ? "Lagre likevel" : "Opprett og planlegg"}
              </Button>
            )}
          </div>

          {!readOnly && isEditing && editEvent && (
            <Button
              variant="ghost" size="sm"
              className="h-8 text-xs gap-1.5 w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Fjern fra plan
            </Button>
          )}
        </SheetFooter>

        {/* Delete confirmation */}
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Fjern fra ressursplan?</AlertDialogTitle>
              <AlertDialogDescription>
                {scheduleBlockId
                  ? "Blokken fjernes fra planoversikten. Hvis den er koblet til Outlook, forsøkes sletting der også."
                  : "Montørtildelingen og tidsplanen fjernes fra kalenderen. Prosjektet forblir intakt."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Avbryt</AlertDialogCancel>
              <AlertDialogAction
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={async () => {
                  setDeleting(true);
                  try {
                    if (scheduleBlockId) {
                      const { error } = await supabase.functions.invoke("delete-schedule-block", {
                        body: { schedule_block_id: scheduleBlockId },
                      });
                      if (error) {
                        toast.error("Kunne ikke slette", { description: error.message });
                        return;
                      }
                    } else if (editEvent) {
                      await syncDelete(editEvent.id);

                      const { data: linkedBlocks } = await supabase
                        .from("schedule_blocks")
                        .select("id")
                        .eq("project_id", editEvent.id)
                        .is("deleted_at", null)
                        .limit(50);

                      if (linkedBlocks && linkedBlocks.length > 0) {
                        for (const sb of linkedBlocks) {
                          await supabase.functions.invoke("delete-schedule-block", {
                            body: { schedule_block_id: sb.id },
                          });
                        }
                      }

                      await supabase
                        .from("event_technicians")
                        .delete()
                        .eq("event_id", editEvent.id);

                      const { data: eventRow } = await supabase
                        .from("events")
                        .select("project_type")
                        .eq("id", editEvent.id)
                        .single();

                      const isTaskEvent = (eventRow as any)?.project_type === "task";

                      if (isTaskEvent) {
                        await supabase
                          .from("events")
                          .update({ deleted_at: new Date().toISOString(), status: "cancelled" } as any)
                          .eq("id", editEvent.id);
                      } else {
                        await supabase
                          .from("events")
                          .update({ status: "requested" } as any)
                          .eq("id", editEvent.id);
                      }
                    }

                    toast.success("Slettet ✓");
                    onOpenChange(false);
                    onSaved?.();
                  } catch (err: any) {
                    toast.error("Feil", { description: err?.message });
                  } finally {
                    setDeleting(false);
                    setShowDeleteConfirm(false);
                  }
                }}
              >
                {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                Slett
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}

/* ── Extracted: New event fields with project suggestions ── */
function NewEventFields({
  title, setTitle, customer, setCustomer, address, setAddress, eventType, onLinkProject,
}: {
  title: string;
  setTitle: (v: string) => void;
  customer: string;
  setCustomer: (v: string) => void;
  address: string;
  setAddress: (v: string) => void;
  eventType: "project" | "task";
  onLinkProject: (proj: ProjectSuggestion) => void;
}) {
  const { suggestions, loading } = useProjectSuggestions(title, eventType === "project");

  return (
    <section className="space-y-4">
      <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Oppdrag</h3>
      <div>
        <Label className="text-xs">Tittel *</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={eventType === "task" ? "F.eks. Bestille materialer" : "F.eks. Kabellegging 3. etg"}
          className="mt-1"
        />
      </div>

      {/* Project suggestions */}
      {eventType === "project" && (
        <ProjectSuggestionList
          suggestions={suggestions}
          loading={loading}
          onSelect={onLinkProject}
        />
      )}

      {eventType === "project" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Kunde</Label>
            <Input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Kundenavn" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Adresse</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Adresse" className="mt-1" />
          </div>
        </div>
      )}
    </section>
  );
}
