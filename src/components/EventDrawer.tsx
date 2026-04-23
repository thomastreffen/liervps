import { useState, useEffect, useCallback, useMemo } from "react";
import { useProjectSuggestions, type ProjectSuggestion } from "@/hooks/useProjectSuggestions";
import { ProjectSuggestionList } from "./ProjectSuggestionList";
import { FileUpload } from "./FileUpload";
import { AttachmentList } from "./AttachmentList";
import type { Attachment } from "@/lib/mock-data";
import { TaskThreadPanel } from "@/components/task-thread";
import { EventHistoryTab } from "@/components/EventHistoryTab";
import { ReminderProfileSelect, type ReminderConfig } from "@/components/ReminderProfileSelect";
import { ApprovalCockpit } from "@/components/ApprovalCockpit";
import { TechReplacementSuggestion } from "@/components/TechReplacementSuggestion";
import { useTechnicianInsights } from "@/hooks/useTechnicianInsights";
import { useTechnicians } from "@/hooks/useTechnicians";
import { useTaskThreadReads } from "@/hooks/useTaskThreadReads";
import { useReminderSettings } from "@/hooks/useReminderSettings";
import { useApprovalSummaries, getNextReminderInfo } from "@/hooks/useApprovalSummaries";
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
import { AddressAutocomplete } from "@/components/ui/address-autocomplete";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TechnicianMultiSelect } from "./TechnicianMultiSelect";
import { JobStatusBadge, JobStatusGroup } from "./JobStatusBadge";
import { useJobApprovals } from "@/hooks/useJobApprovals";
import { getExecutionStatus, BILLING_STATUSES, ACCEPTANCE_STATUSES } from "@/lib/job-status";
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
  MessageSquare,
  Bell,
  Zap,
  BellOff,
  Check,
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

interface ChangeDescriptor {
  key: string;
  label: string;
  severity: "critical" | "minor";
  oldValue: string | null;
  newValue: string | null;
  actionType: string;
  summary: string;
  metadata?: Record<string, any>;
}

interface PendingSaveState {
  criticalChanges: ChangeDescriptor[];
  allChanges: ChangeDescriptor[];
  impactedTechIds: string[];
  sendNotifications: boolean;
  updateOutlook: boolean;
}

interface DeliveryStatusSummary {
  notifiedAt: string | null;
  notifiedNames: string[];
  syncedAt: string | null;
  syncedCount: number;
  failedCount: number;
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
  /** Initial tab to open (e.g. "thread" from deep link) */
  initialTab?: "details" | "thread";
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
  initialTab,
}: EventDrawerProps) {
  const navigate = useNavigate();
  const { syncCreate, syncUpdate, syncDelete } = useCalendarSync();
  const { activeCompanyId, isAllCompanies, companies } = useCompanyContext();
  const { settings: reminderSettings } = useReminderSettings();
  const isEditing = !!editEvent;

  // Form state
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [eventType, setEventType] = useState<"project" | "task">("project");
  const [title, setTitle] = useState("");
  const [customer, setCustomer] = useState("");
  const [address, setAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [locationDetails, setLocationDetails] = useState("");
  const [siteContactName, setSiteContactName] = useState("");
  const [siteContactPhone, setSiteContactPhone] = useState("");
  const [accessNotes, setAccessNotes] = useState("");
  const [mapLink, setMapLink] = useState("");
  const [description, setDescription] = useState("");
  const [assignmentNotes, setAssignmentNotes] = useState("");
  const [customerPracticalInfo, setCustomerPracticalInfo] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("16:00");
  const [techIds, setTechIds] = useState<string[]>([]);
  // Multi-day repeat (only for new projects/tasks)
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [repeatDates, setRepeatDates] = useState<Date[]>([]);
  const [repeatPickerOpen, setRepeatPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [clientRequestId, setClientRequestId] = useState(() => crypto.randomUUID());
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [reminderConfig, setReminderConfig] = useState<ReminderConfig>({
    responseRequired: true,
    profile: "company_default",
  });

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
  const [originalAttachments, setOriginalAttachments] = useState<Attachment[]>([]);
  const [editCompanyName, setEditCompanyName] = useState<string | null>(null);
  const [editCompanyId, setEditCompanyId] = useState<string | null>(null);
  const [originalSnapshot, setOriginalSnapshot] = useState<Record<string, any> | null>(null);
  const [pendingSave, setPendingSave] = useState<PendingSaveState | null>(null);
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatusSummary>({
    notifiedAt: null,
    notifiedNames: [],
    syncedAt: null,
    syncedCount: 0,
    failedCount: 0,
  });

  // Drawer tab state (detaljer vs tråd)
  const [drawerTab, setDrawerTab] = useState<"details" | "thread" | "history">(initialTab || "details");

  // Sync initialTab when it changes (e.g. deep link opens drawer)
  useEffect(() => {
    if (initialTab && open) {
      setDrawerTab(initialTab);
    }
  }, [initialTab, open]);

  // Thread unread tracking
  const { unreadCount: threadUnreadCount } = useTaskThreadReads(editEvent?.id);

  // Per-technician approval statuses
  const { approvals: techApprovals, refetch: refetchApprovals } = useJobApprovals(editEvent?.id);
  const { summaries: approvalSummaryMap, refetch: refetchSummaries } = useApprovalSummaries(editEvent ? [editEvent.id] : []);
  const approvalSummary = editEvent ? approvalSummaryMap.get(editEvent.id) : undefined;
  const refreshApprovalData = useCallback(() => { refetchApprovals(); refetchSummaries(); }, [refetchApprovals, refetchSummaries]);

  // Available technicians for replacement suggestions
  const { technicians: allTechnicians } = useTechnicians(editEvent ? (editEvent as any).companyId || activeCompanyId : activeCompanyId);
  const techInsightUserIds = useMemo(() => {
    const ids = techApprovals.map(a => a.technicianUserId);
    // Also include available techs for replacement scoring
    for (const t of allTechnicians) {
      if (t.id && !ids.includes(t.id)) ids.push(t.id);
    }
    return ids;
  }, [techApprovals, allTechnicians]);
  const { insights: techInsights } = useTechnicianInsights(techInsightUserIds);

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
    setEditCompanyId(null);
    setDrawerTab("details");
    setReminderConfig({ responseRequired: true, profile: "company_default" });
    setSelectedCompanyId(isAllCompanies ? (companies.length === 1 ? companies[0].id : null) : activeCompanyId);
    setRepeatEnabled(false);
    setRepeatDates([]);

    // Load existing attachments for edit mode
    if (editEvent) {
      supabase.from("events").select("attachments, company_id, internal_companies(name)").eq("id", editEvent.id).single().then(({ data }) => {
        if (data?.attachments && Array.isArray(data.attachments)) {
          setExistingAttachments(data.attachments as unknown as Attachment[]);
        }
        const compName = (data as any)?.internal_companies?.name;
        if (compName) setEditCompanyName(compName);
        if (data?.company_id) setEditCompanyId(data.company_id as string);
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

      const { data: overlaps } = await supabase
        .from("event_technicians")
        .select("technician_id, start_at, end_at, technicians(name), events:event_id(id, title, start_time, end_time, deleted_at)")
        .in("technician_id", techs);

      const found: ConflictInfo[] = [];
      for (const row of (overlaps || []) as any[]) {
        const ev = row.events;
        if (!ev || ev.deleted_at || (excludeId && ev.id === excludeId)) continue;

        const effectiveStart = row.start_at || ev.start_time;
        const effectiveEnd = row.end_at || ev.end_time;

        if (effectiveStart < endISO && effectiveEnd > startISO) {
          found.push({
            techName: row.technicians?.name || "Ukjent",
            jobTitle: ev.title,
            start: format(new Date(effectiveStart), "HH:mm"),
            end: format(new Date(effectiveEnd), "HH:mm"),
          });
        }
      }
      setConflicts(found);
    } catch { setConflicts([]); }
  }, []);

  // Auto-check conflicts
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      checkConflicts(
        date,
        startTime,
        endDate || (date ? autoAdjustEndDate(date, startTime, endTime) : ""),
        endTime,
        techIds,
        editEvent?.id || (mode === "existing" ? selectedJobId || undefined : undefined),
      );
    }, 500);
    return () => clearTimeout(timer);
  }, [date, startTime, endDate, endTime, techIds, open, editEvent, mode, selectedJobId, checkConflicts]);

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
    if (saving || submitted || readOnly) return;
    setSaving(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      const userName = session?.session?.user?.user_metadata?.full_name || session?.session?.user?.email || "Ukjent";
      const techNameMap = new Map(allTechnicians.map((t: any) => [t.id, t.name]));

      // Backend permission validation
      if (userId) {
        const { data: canPlan } = await supabase.rpc("check_permission_v2", {
          _auth_user_id: userId,
          _perm: "resource_plan.plan_resources",
        });
        const { data: canPlanLegacy } = await supabase.rpc("check_permission_v2", {
          _auth_user_id: userId,
          _perm: "resourceplan.schedule",
        });
        if (!canPlan && !canPlanLegacy) {
          toast.error("Mangler rettighet", { description: "Du har ikke tillatelse til å planlegge ressurser." });
          setSaving(false);
          return;
        }
      }

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
          const removedTechIds = toRemove.map((r) => r.technician_id);
          console.log("[EventDrawer] Removing technicians:", removedTechIds, "from event:", editEvent.id);

          // 1. Delete event_technicians
          await supabase.from("event_technicians").delete().in("id", toRemove.map((r) => r.id));

          // 2. Soft-delete schedule_blocks for removed technicians on this event
          const { data: removedBlocks } = await (supabase as any)
            .from("schedule_blocks")
            .update({ deleted_at: new Date().toISOString() })
            .eq("project_id", editEvent.id)
            .in("technician_id", removedTechIds)
            .is("deleted_at", null)
            .select("id, technician_id");
          console.log("[EventDrawer] Soft-deleted schedule_blocks:", removedBlocks);

          // 3. Clean up orphaned job_approvals for removed technicians
          const { data: removedTechs } = await supabase
            .from("technicians")
            .select("user_id")
            .in("id", removedTechIds);
          const removedUserIds = (removedTechs || []).map((t: any) => t.user_id).filter(Boolean);
          if (removedUserIds.length > 0) {
            await supabase
              .from("job_approvals")
              .delete()
              .eq("job_id", editEvent.id)
              .in("technician_user_id", removedUserIds);
          }
        }
        if (toAdd.length > 0) {
          await supabase.from("event_technicians").insert(
            toAdd.map((tid) => ({ event_id: editEvent.id, technician_id: tid }))
          );
          await supabase.functions.invoke("create-approval", {
            body: {
              job_id: editEvent.id,
              reminder_profile: reminderConfig.profile,
              reminder_config: reminderConfig.profile === "custom" ? reminderConfig.custom : null,
              response_required: reminderConfig.responseRequired,
            },
          });
        }

        // Detect time change → reset existing approvals so technicians must re-confirm
        const timeChanged =
          editEvent.start.getTime() !== new Date(startISO).getTime() ||
          editEvent.end.getTime() !== new Date(endISO).getTime();
        const remainingTechIds = techIds.filter((id) => existingIds.has(id));
        if (timeChanged && remainingTechIds.length > 0) {
          // Get user_ids for remaining technicians
          const { data: remainTechs } = await supabase
            .from("technicians")
            .select("user_id")
            .in("id", remainingTechIds);
          const remainUserIds = (remainTechs || []).map((t: any) => t.user_id).filter(Boolean);
          if (remainUserIds.length > 0) {
            // Reset approvals to pending
            await supabase
              .from("job_approvals")
              .update({
                status: "pending",
                responded_at: null,
                comment: null,
                proposed_start: null,
                proposed_end: null,
                reminder_count: 0,
                last_reminded_at: null,
                response_required: true,
              } as any)
              .eq("job_id", editEvent.id)
              .in("technician_user_id", remainUserIds);

            // Re-trigger approval notifications (sends new emails)
            await supabase.functions.invoke("create-approval", {
              body: {
                job_id: editEvent.id,
                reminder_profile: reminderConfig.profile,
                reminder_config: reminderConfig.profile === "custom" ? reminderConfig.custom : null,
                response_required: reminderConfig.responseRequired,
                time_change: true,
              },
            });
          }
          toast.info("Tidsendring", { description: "Montør(er) er varslet om ny tid og må bekrefte på nytt." });
        }

        // ── Audit logging ──
        const logEntries: any[] = [];

        // Time change (reuse timeChanged from above)
        if (timeChanged) {
          logEntries.push({
            event_id: editEvent.id, action_type: "time_changed", performed_by: userId, performer_name: userName,
            change_summary: `endret tid`,
            metadata: {
              old_time: `${format(editEvent.start, "d. MMM HH:mm", { locale: nb })}–${format(editEvent.end, "HH:mm", { locale: nb })}`,
              new_time: `${format(new Date(startISO), "d. MMM HH:mm", { locale: nb })}–${format(new Date(endISO), "HH:mm", { locale: nb })}`,
            },
          });
        }

        // Title change
        if (title !== editEvent.title) {
          logEntries.push({
            event_id: editEvent.id, action_type: "title_changed", performed_by: userId, performer_name: userName,
            change_summary: `endret tittel`,
            metadata: { old_title: editEvent.title, new_title: title },
          });
        }

        // Technician changes
        if (toRemove.length > 0) {
          const removedNames = toRemove.map(r => techNameMap.get(r.technician_id) || "Ukjent");
          logEntries.push({
            event_id: editEvent.id, action_type: "technician_removed", performed_by: userId, performer_name: userName,
            change_summary: `fjernet ${removedNames.join(", ")} fra oppdraget`,
            metadata: { removed_names: removedNames },
          });
        }
        if (toAdd.length > 0) {
          const addedNames = toAdd.map(id => techNameMap.get(id) || "Ukjent");
          logEntries.push({
            event_id: editEvent.id, action_type: "technician_added", performed_by: userId, performer_name: userName,
            change_summary: `la til ${addedNames.join(", ")} på oppdraget`,
            metadata: { added_names: addedNames },
          });
        }

        if (logEntries.length > 0) {
          await supabase.from("event_logs").insert(logEntries);
        }

        syncUpdate(editEvent.id);

        // Upload new attachments
        if (files.length > 0) {
          const newUploads = await uploadFiles(editEvent.id, files);
          const allAttachments = [...existingAttachments, ...newUploads];
          await supabase.from("events").update({ attachments: allAttachments as any }).eq("id", editEvent.id);
          await supabase.from("event_logs").insert({
            event_id: editEvent.id, action_type: "attachment_added", performed_by: userId, performer_name: userName,
            change_summary: `la til ${files.length} vedlegg`,
          });
        }

        toast.success("Hendelse oppdatert", { description: "Tid og ressurser er lagret." });
        onSaved?.(editEvent.id);
      } else if (mode === "existing" && selectedJobId) {
        // Link technicians to existing project + create per-tech time entries
        // Do NOT overwrite the project's own start_time/end_time
        const { startISO, endISO } = date
          ? normalizeOvernightDates(date, startTime, endDate, endTime)
          : { startISO: null, endISO: null };

        if (assignmentNotes.trim()) {
          await (supabase as any).from("events")
            .update({ assignment_notes: assignmentNotes.trim() })
            .eq("id", selectedJobId);
        }

        // Get company_id from the existing event
        const { data: evtData } = await supabase.from("events")
          .select("company_id")
          .eq("id", selectedJobId)
          .single();
        const evtCompanyId = (evtData as any)?.company_id;

        const { data: existing } = await supabase
          .from("event_technicians").select("technician_id").eq("event_id", selectedJobId);
        const existingIds = new Set((existing || []).map((e) => e.technician_id));
        const newTechs = techIds.filter((id) => !existingIds.has(id));
        const assignmentLogEntries: any[] = [];
        const assignmentSummary = startISO && endISO
          ? `${format(new Date(startISO), "d. MMM yyyy 'kl.' HH:mm", { locale: nb })}–${format(new Date(endISO), "HH:mm", { locale: nb })}`
          : null;

        if (newTechs.length > 0) {
          // Insert event_technicians with per-tech time overrides
          await supabase.from("event_technicians").insert(
            newTechs.map((tid) => ({
              event_id: selectedJobId,
              technician_id: tid,
              ...(startISO ? { start_at: startISO } : {}),
              ...(endISO ? { end_at: endISO } : {}),
            } as any))
          );

          // Create schedule_blocks for each new tech on this date
          if (startISO && endISO && evtCompanyId) {
            for (const tid of newTechs) {
              await (supabase as any).from("schedule_blocks").insert({
                company_id: evtCompanyId,
                technician_id: tid,
                project_id: selectedJobId,
                source: "manual",
                start_at: startISO,
                end_at: endISO,
                title: title || "Prosjektarbeid",
                match_state: "manual",
                match_confidence: 100,
                match_reason: "Montør tildelt via planlegger",
              });
            }
          }

          const addedNames = newTechs.map((id) => techNameMap.get(id) || "Montør");
          assignmentLogEntries.push({
            event_id: selectedJobId,
            action_type: "technician_assigned",
            performed_by: userId,
            performer_name: userName,
            change_summary: assignmentSummary
              ? `planla ${addedNames.join(", ")} på ${assignmentSummary}`
              : `tildelte ${addedNames.join(", ")} til oppdraget`,
            metadata: { added_names: addedNames },
          });

          await supabase.functions.invoke("create-approval", {
            body: {
              job_id: selectedJobId,
              reminder_profile: reminderConfig.profile,
              reminder_config: reminderConfig.profile === "custom" ? reminderConfig.custom : null,
              response_required: reminderConfig.responseRequired,
            },
          });
        } else if (startISO && endISO && evtCompanyId) {
          // Existing techs but new date: create additional schedule_blocks
          for (const tid of techIds) {
            await (supabase as any).from("schedule_blocks").insert({
              company_id: evtCompanyId,
              technician_id: tid,
              project_id: selectedJobId,
              source: "manual",
              start_at: startISO,
              end_at: endISO,
              title: title || "Prosjektarbeid",
              match_state: "manual",
              match_confidence: 100,
              match_reason: "Ekstra dag lagt til via planlegger",
            });
          }

          const assignedNames = techIds.map((id) => techNameMap.get(id) || "Montør");
          assignmentLogEntries.push({
            event_id: selectedJobId,
            action_type: "technician_assigned",
            performed_by: userId,
            performer_name: userName,
            change_summary: assignmentSummary
              ? `la til planlagt dag for ${assignedNames.join(", ")} på ${assignmentSummary}`
              : `la til ny planlagt dag for ${assignedNames.join(", ")}`,
            metadata: { added_names: assignedNames },
          });
        }

        if (assignmentLogEntries.length > 0) {
          await supabase.from("event_logs").insert(assignmentLogEntries);
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

          await supabase.from("event_logs").insert({
            event_id: createdId,
            action_type: "created",
            performed_by: userId,
            performer_name: userName,
            change_summary: `opprettet ${isTask ? "oppgave" : "oppdrag"}`,
          });

          if (techIds.length > 0) {
            // Compute all planned dates: primary date + repeat dates (if enabled)
            const allDates: string[] = [date];
            if (repeatEnabled && repeatDates.length > 0) {
              for (const d of repeatDates) {
                const ds = format(d, "yyyy-MM-dd");
                if (!allDates.includes(ds)) allDates.push(ds);
              }
            }

            // Build event_technicians rows. For multi-day, each row gets per-tech
            // start_at/end_at overrides → trigger creates one schedule_block per row.
            const etRows: any[] = [];
            for (const tid of techIds) {
              if (allDates.length === 1) {
                etRows.push({ event_id: createdId, technician_id: tid });
              } else {
                for (const ds of allDates) {
                  const { startISO: dStart, endISO: dEnd } = normalizeOvernightDates(
                    ds, startTime, ds, endTime,
                  );
                  etRows.push({
                    event_id: createdId,
                    technician_id: tid,
                    start_at: dStart,
                    end_at: dEnd,
                  });
                }
              }
            }

            await supabase.from("event_technicians").insert(etRows);

            const assignedNames = techIds.map((id) => techNameMap.get(id) || "Montør");
            await supabase.from("event_logs").insert({
              event_id: createdId,
              action_type: "technician_assigned",
              performed_by: userId,
              performer_name: userName,
              change_summary: allDates.length > 1
                ? `planla ${assignedNames.join(", ")} over ${allDates.length} dager`
                : `tildelte ${assignedNames.join(", ")} til oppdraget`,
              metadata: { added_names: assignedNames, day_count: allDates.length },
            });

            if (isTask) {
              await supabase.from("events").update({ status: "scheduled" } as any).eq("id", createdId);
              syncCreate(createdId);
            } else {
              await supabase.functions.invoke("create-approval", {
                body: {
                  job_id: createdId,
                  reminder_profile: reminderConfig.profile,
                  reminder_config: reminderConfig.profile === "custom" ? reminderConfig.custom : null,
                  response_required: reminderConfig.responseRequired,
                },
              });
              syncCreate(createdId);
            }
          }
        }

        // Upload attachments for new event
        if (files.length > 0) {
          const newUploads = await uploadFiles(createdId, files);
          await supabase.from("events").update({ attachments: newUploads as any }).eq("id", createdId);
        }

        const totalDays = 1 + (repeatEnabled ? repeatDates.length : 0);
        toast.success(isTask ? "Oppgave opprettet" : "Hendelse opprettet og planlagt", {
          description: isTask
            ? `${title} er lagt til som oppgave.`
            : totalDays > 1
              ? `Opprettet ${totalDays} planlagte dager for ${title} (${techIds.length} montør(er) per dag).`
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
    description !== (editEvent.description || "") ||
    customer !== (editEvent.customer || "") ||
    address !== (editEvent.address || "") ||
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
              {/* Primary identifier badges */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {(editEvent as any).projectNumber && (
                  <span className="inline-block font-mono text-[11px] font-semibold bg-primary/10 text-primary rounded-md px-2 py-0.5">
                    {(editEvent as any).projectNumber}
                  </span>
                )}
                {editEvent.jobNumber && (
                  <span className={cn(
                    "inline-block font-mono text-[10px] rounded-md px-1.5 py-0.5",
                    (editEvent as any).projectNumber
                      ? "text-muted-foreground bg-muted/50"
                      : "font-semibold bg-primary/10 text-primary"
                  )}>
                    {editEvent.jobNumber}
                  </span>
                )}
              </div>
              {/* Compact technician line */}
              {isMultiTech ? (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="h-3 w-3 shrink-0" />
                  <span>Montører: <span className="font-medium text-foreground">{editEvent.technicians.map((t) => t.name.split(" ")[0]).join(", ")}</span></span>
                </div>
              ) : clickedTechName ? (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <User className="h-3 w-3 shrink-0" />
                  <span>Montør: <span className="font-medium text-foreground">{clickedTechName}</span></span>
                </div>
              ) : null}
            </div>
          )}
        </SheetHeader>

        {/* Tab switcher for edit mode */}
        {isEditing && editEvent && (
          <div className="flex items-center gap-1 border border-border/40 rounded-lg p-0.5 mt-3">
            <Button
              type="button"
              variant={drawerTab === "details" ? "default" : "ghost"}
              size="sm"
              className="h-8 text-xs rounded-md flex-1 gap-1.5"
              onClick={() => setDrawerTab("details")}
            >
              <Clock className="h-3.5 w-3.5" />
              Detaljer
            </Button>
            <Button
              type="button"
              variant={drawerTab === "thread" ? "default" : "ghost"}
              size="sm"
              className="h-8 text-xs rounded-md flex-1 gap-1.5 relative"
              onClick={() => setDrawerTab("thread")}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Tråd
              {threadUnreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                  {threadUnreadCount > 9 ? "9+" : threadUnreadCount}
                </span>
              )}
            </Button>
            <Button
              type="button"
              variant={drawerTab === "history" ? "default" : "ghost"}
              size="sm"
              className="h-8 text-xs rounded-md flex-1 gap-1.5"
              onClick={() => setDrawerTab("history")}
            >
              <Clock className="h-3.5 w-3.5" />
              Historikk
            </Button>
          </div>
        )}

        {/* Thread tab content */}
        {isEditing && editEvent && drawerTab === "thread" ? (
          <div className="flex-1 mt-3 flex flex-col min-h-0">
            <TaskThreadPanel
              taskId={editEvent.id}
              companyId={editCompanyId || activeCompanyId || ""}
            />
          </div>
        ) : isEditing && editEvent && drawerTab === "history" ? (
          <div className="flex-1 mt-3 overflow-y-auto px-1">
            <EventHistoryTab eventId={editEvent.id} />
          </div>
        ) : (
        <>
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
            <div className="space-y-3">
              {((editEvent as any).projectNumber || editEvent.internalNumber || editEvent.jobNumber) && (
                <div className="flex items-center gap-2 flex-wrap">
                  {(editEvent as any).projectNumber && (
                    <span className="inline-block font-mono text-[11px] font-semibold bg-primary/10 text-primary rounded px-2 py-0.5">
                      {(editEvent as any).projectNumber}
                    </span>
                  )}
                  {(editEvent.internalNumber || editEvent.jobNumber) && (
                    <span className={cn(
                      "inline-block font-mono text-[10px] rounded px-1.5 py-0.5",
                      (editEvent as any).projectNumber
                        ? "text-muted-foreground bg-muted/50"
                        : "font-semibold bg-primary/10 text-primary"
                    )}>
                      {(() => {
                        const num = editEvent.internalNumber || editEvent.jobNumber || "";
                        return num.startsWith("JOB-") ? num : `JOB-${num}`;
                      })()}
                    </span>
                  )}
                </div>
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
              </div>

              {/* ── Grouped status display ── */}
              <div className="rounded-lg border border-border/40 bg-card p-3">
                <JobStatusGroup
                  executionStatus={getExecutionStatus(editEvent.status)}
                  acceptanceStatuses={
                    techApprovals.length > 0
                      ? techApprovals.map((a) => ({ techName: a.technicianName.split(" ")[0], status: a.status }))
                      : editEvent.technicians.map((t) => ({
                          techName: t.name.split(" ")[0],
                          status: ACCEPTANCE_STATUSES.includes(editEvent.status) ? (editEvent.status === "approved" ? "approved" : editEvent.status === "rejected" ? "declined" : editEvent.status === "time_change_proposed" ? "change_request" : "pending") : "approved",
                        }))
                  }
                  billingStatus={BILLING_STATUSES.includes(editEvent.status) ? editEvent.status : null}
                />
              </div>

              {/* ═══ APPROVAL COCKPIT ═══ */}
              {approvalSummary && approvalSummary.total > 0 && editEvent && (
                <ApprovalCockpit
                  jobId={editEvent.id}
                  eventStart={editEvent.start}
                  summary={approvalSummary}
                  approvals={techApprovals}
                  onRefresh={refreshApprovalData}
                  readOnly={readOnly}
                />
              )}

              {/* ═══ TECH REPLACEMENT SUGGESTION ═══ */}
              {approvalSummary && editEvent && (approvalSummary.declined > 0 || approvalSummary.changeRequest > 0 || (approvalSummary.pending > 0 && (editEvent.start.getTime() - Date.now()) < 12 * 60 * 60 * 1000)) && (
                <TechReplacementSuggestion
                  summary={approvalSummary}
                  eventStart={editEvent.start}
                  availableTechs={allTechnicians}
                  assignedTechIds={editEvent.technicianIds || []}
                  insights={techInsights}
                  onSelectTech={(techId) => {
                    if (!techIds.includes(techId)) {
                      setTechIds([...techIds, techId]);
                    }
                  }}
                />
              )}
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

            {/* Multi-day repeat (only for new events, not editing or linking) */}
            {!isEditing && mode === "new" && !readOnly && (
              <div className="rounded-lg border border-border/40 bg-card p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                      Gjenta flere dager
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Opprett samme oppdrag på flere datoer (samme tid og montører)
                    </p>
                  </div>
                  <Switch
                    checked={repeatEnabled}
                    onCheckedChange={(v) => {
                      setRepeatEnabled(v);
                      if (!v) setRepeatDates([]);
                    }}
                  />
                </div>

                {repeatEnabled && (
                  <div className="space-y-2 pt-1">
                    <Popover open={repeatPickerOpen} onOpenChange={setRepeatPickerOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="w-full justify-start h-9">
                          <CalendarPlus className="h-3.5 w-3.5 mr-2" />
                          {repeatDates.length === 0
                            ? "Velg ekstra datoer..."
                            : `${repeatDates.length} ekstra ${repeatDates.length === 1 ? "dag" : "dager"} valgt`}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="multiple"
                          selected={repeatDates}
                          onSelect={(dates) => setRepeatDates(dates || [])}
                          disabled={(d) => {
                            // Disable the primary date (already covered by main date field)
                            if (date && format(d, "yyyy-MM-dd") === date) return true;
                            // Disable past dates
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            return d < today;
                          }}
                          initialFocus
                          locale={nb}
                          weekStartsOn={1}
                          className={cn("p-3 pointer-events-auto")}
                        />
                        <div className="border-t p-2 flex justify-between items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {repeatDates.length} valgt
                          </span>
                          <div className="flex gap-1.5">
                            <Button variant="ghost" size="sm" onClick={() => setRepeatDates([])}>
                              Tøm
                            </Button>
                            <Button size="sm" onClick={() => setRepeatPickerOpen(false)}>
                              Ferdig
                            </Button>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>

                    {repeatDates.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {[...repeatDates]
                          .sort((a, b) => a.getTime() - b.getTime())
                          .map((d) => (
                            <span
                              key={d.toISOString()}
                              className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
                            >
                              {format(d, "d. MMM", { locale: nb })}
                              <button
                                type="button"
                                onClick={() =>
                                  setRepeatDates((prev) =>
                                    prev.filter((x) => x.getTime() !== d.getTime()),
                                  )
                                }
                                className="hover:text-destructive"
                                aria-label="Fjern dato"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                      </div>
                    )}

                    <p className="text-[11px] text-muted-foreground leading-snug">
                      Hovedoppdrag opprettes på <strong>{date ? format(new Date(date), "d. MMM", { locale: nb }) : "valgt dato"}</strong>
                      {repeatDates.length > 0 && ` + ${repeatDates.length} ekstra ${repeatDates.length === 1 ? "dag" : "dager"}`}.
                      Hver dag får egen planlagt blokk per montør.
                    </p>
                  </div>
                )}
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

          {/* ═══ SECTION: PÅMINNELSE ═══ */}
          {(isEditing || eventType === "project") && techIds.length > 0 && (
            <ReminderProfileSelect
              value={reminderConfig}
              onChange={setReminderConfig}
              disabled={readOnly}
              companyRemindersDisabled={reminderSettings?.enabled === false}
            />
          )}

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
                onRemove={readOnly ? undefined : (name) => {
                  const updated = existingAttachments.filter((a) => a.name !== name);
                  setExistingAttachments(updated);
                  if (isEditing && editEvent) {
                    supabase.from("events").update({ attachments: updated as any }).eq("id", editEvent.id);
                  }
                }}
              />
            )}
            {!readOnly && <FileUpload files={files} onChange={setFiles} />}
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
            {!readOnly && drawerTab === "details" && (
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

          {!readOnly && drawerTab === "details" && isEditing && editEvent && (
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
        </>
        )}

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
            <AddressAutocomplete value={address} onChange={setAddress} placeholder="Søk adresse…" className="mt-1" />
          </div>
        </div>
      )}
    </section>
  );
}
