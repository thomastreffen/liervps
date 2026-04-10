import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { addWeeks, addDays, startOfWeek, startOfMonth, addMonths, format, isSameWeek } from "date-fns";
import { useNavigate, useSearchParams } from "react-router-dom";
import { nb } from "date-fns/locale";
import { TechnicianList } from "@/components/TechnicianList";
import { StatusLegend } from "@/components/StatusLegend";
import { ResourceCalendar } from "@/components/ResourceCalendar";
import { EventDrawer } from "@/components/EventDrawer";
import { TaskResourceStrip } from "@/components/tasks/TaskResourceStrip";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, CalendarDays, ChevronLeft, ChevronRight, RotateCcw, UserCheck, UserMinus, Clock,
  Calendar, List, Bell, Sun, Moon, Sunrise, ZoomIn, Filter, Maximize2, Minimize2, PanelLeftClose, PanelLeftOpen,
} from "lucide-react";
import { useOperatingHours, type ZoomLevel } from "@/hooks/useOperatingHours";
import { setWorkHours } from "@/hooks/useTechnicianNowStatus";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { useTechnicians } from "@/hooks/useTechnicians";
import { useExternalBusy } from "@/hooks/useExternalBusy";
import { useCalendarEvents, type CalendarEvent } from "@/hooks/useCalendarEvents";
import { useApprovalSummaries } from "@/hooks/useApprovalSummaries";
import { useCapacity } from "@/hooks/useCapacity";
import { useTechnicianNowStatus, getContiguousFreeMinutes } from "@/hooks/useTechnicianNowStatus";
import { useCalendarSync } from "@/hooks/useCalendarSync";
import { OutlookConflictDialog } from "@/components/OutlookConflictDialog";
import { useConfirmationCount, useScheduleBlocks, type ScheduleBlock } from "@/hooks/useScheduleBlocks";
import { useAbsenceBlocks } from "@/hooks/useAbsenceBlocks";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ScheduleBlockDetailPanel } from "@/components/ScheduleBlockDetailPanel";
import { useSyncHealth } from "@/hooks/useSyncHealth";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { MobileResourceHeader } from "@/components/resource-plan/MobileResourceHeader";
import { CapacityStatusBar } from "@/components/resource-plan/CapacityStatusBar";
import { UnplannedProjectsBanner } from "@/components/resource-plan/UnplannedProjectsBanner";
import { UnplannedJobsStrip } from "@/components/resource-plan/UnplannedJobsStrip";
import { FollowUpStrip, getFilteredJobIds, type FollowUpCategory } from "@/components/resource-plan/FollowUpStrip";
import { RecommendedActions } from "@/components/resource-plan/RecommendedActions";
import { CapacityGapsStrip } from "@/components/resource-plan/CapacityGapsStrip";
import { useCapacityGaps, type CapacityGap } from "@/hooks/useCapacityGaps";
import { useUnplannedProjects } from "@/hooks/useUnplannedProjects";
import { addMinutes } from "date-fns";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { QuickProjectSearch } from "@/components/resource-plan/QuickProjectSearch";
import { findLinkedScheduleBlockIds, findScheduleBlockForAssignment } from "@/lib/resource-plan-assignment-identity";
import { cn } from "@/lib/utils";

/* Compact tech list for collapsed sidebar – shows initials only */
function CompactTechList({
  technicians,
  selectedId,
  onSelect,
  filterIds,
}: {
  technicians: Array<{ id: string; name: string; color?: string }>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  filterIds?: Set<string> | null;
}) {
  const filtered = filterIds ? technicians.filter(t => filterIds.has(t.id)) : technicians;
  return (
    <div className="flex flex-col gap-1">
      {filtered.map(t => {
        const initials = t.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
        const isActive = selectedId === t.id;
        return (
          <TooltipProvider key={t.id} delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onSelect(isActive ? null : t.id)}
                  className={cn(
                    "h-8 w-10 rounded-md text-[10px] font-bold transition-all flex items-center justify-center mx-auto",
                    isActive
                      ? "ring-2 ring-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                  style={isActive ? { backgroundColor: t.color || "hsl(var(--primary))" } : undefined}
                >
                  {initials}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">{t.name}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      })}
    </div>
  );
}

type CalendarViewType = "timeGridDay" | "timeGridWeek" | "dayGridMonth" | "listWeek";

const VIEW_STORAGE_KEY = "resourcePlanView";
const VIEW_OPTIONS: { value: CalendarViewType; label: string; icon: typeof Calendar }[] = [
  { value: "timeGridDay", label: "Dag", icon: Calendar },
  { value: "timeGridWeek", label: "Uke", icon: CalendarDays },
  { value: "dayGridMonth", label: "Måned", icon: Calendar },
  { value: "listWeek", label: "Liste", icon: List },
];

function getStoredView(): CalendarViewType {
  try {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY);
    if (stored && VIEW_OPTIONS.some((v) => v.value === stored)) return stored as CalendarViewType;
  } catch {}
  return "timeGridWeek";
}

export default function ResourcePlan() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { isAdmin, isSuperAdmin } = useAuth();
  const { hasPermission } = usePermissions();
  const { activeCompanyId, allowedCompanyIds } = useCompanyContext();
  const canReadBusy = hasPermission("calendar.read_busy");
  const canViewExternal = hasPermission("calendar.view_external");
  const canPlanResources = hasPermission("resource_plan.plan_resources") || hasPermission("resourceplan.schedule");
  const canWriteEvents = canPlanResources || hasPermission("calendar.write_events");
  const canDeleteEvents = hasPermission("calendar.delete_events");
  const canEditOthers = hasPermission("resource_plan.edit_others") || hasPermission("resourceplan.edit_others");
  // Cross-company access is now driven by memberships, not a separate permission
  const canCrossCompany = allowedCompanyIds.length > 1;
  const drawerReadOnly = !canPlanResources;
  const confirmationCount = useConfirmationCount();
  const syncHealth = useSyncHealth(isAdmin);

  const effectiveCompanyId = activeCompanyId;

  // Debug: log which companyId is being used for data fetching
  useEffect(() => {
    console.info("[ResourcePlan][CompanyContext]", {
      activeCompanyId,
      effectiveCompanyId,
      isAllCompanies: !activeCompanyId,
      source: "useCompanyContext (global source of truth)",
    });
  }, [activeCompanyId]);

  const { technicians } = useTechnicians(effectiveCompanyId, allowedCompanyIds);
  const [selectedTechId, setSelectedTechId] = useState<string | null>(null);
  const [capacityFilter, setCapacityFilter] = useState<"all" | "available" | "partial">("all");
  const [externalBlocksCapacity, setExternalBlocksCapacity] = useState(true);
  const [minFreeMinutes, setMinFreeMinutes] = useState<number | null>(null);
  const [calendarView, setCalendarView] = useState<CalendarViewType>(getStoredView);
  const [focusMode, setFocusMode] = useState(() => {
    try { return localStorage.getItem("resourceplan_focus") === "true"; } catch { return false; }
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const toggleFocusMode = useCallback(() => {
    setFocusMode(prev => {
      const next = !prev;
      try { localStorage.setItem("resourceplan_focus", String(next)); } catch {}
      if (next) setSidebarCollapsed(true);
      else setSidebarCollapsed(false);
      return next;
    });
  }, []);

  const [referenceDate, setReferenceDate] = useState<Date>(new Date());

  const scopedCompanyTechIds = useMemo(
    () => technicians.map((t) => t.id),
    [technicians]
  );

  const techIds = useMemo(
    () => selectedTechId ? [selectedTechId] : scopedCompanyTechIds,
    [selectedTechId, scopedCompanyTechIds]
  );

  useEffect(() => {
    if (selectedTechId && !technicians.some((t) => t.id === selectedTechId)) {
      setSelectedTechId(null);
    }
  }, [selectedTechId, technicians]);

  const unplannedCount = useUnplannedProjects(effectiveCompanyId, allowedCompanyIds);

  const { busySlots, getBusySlotsForDay, getExternalBusyMinutesForDay, refetch: refetchBusySlots } = useExternalBusy(
    canReadBusy ? selectedTechId : "__disabled__",
    { technicianIds: techIds, referenceDate }
  );

  const { syncUpdate, forceUpdate, acceptGraphVersion, conflict, dismissConflict } = useCalendarSync();
  const [selectedBlock, setSelectedBlock] = useState<ScheduleBlock | null>(null);
  const [hideExternalEvents, setHideExternalEvents] = useState(() => {
    try { return localStorage.getItem("resourceplan_hide_external") === "true"; } catch { return false; }
  });
  const handleHideExternalChange = useCallback((v: boolean) => {
    setHideExternalEvents(v);
    try { localStorage.setItem("resourceplan_hide_external", String(v)); } catch {}
  }, []);
  const [dropProjectId, setDropProjectId] = useState<string | null>(null);
  const [dropProjectTitle, setDropProjectTitle] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(VIEW_STORAGE_KEY, calendarView);
  }, [calendarView]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null);
  const [clickedTechId, setClickedTechId] = useState<string | null>(null);
  const [preselectedStart, setPreselectedStart] = useState<Date | null>(null);
  const [preselectedEnd, setPreselectedEnd] = useState<Date | null>(null);
  const [deepLinkTab, setDeepLinkTab] = useState<"details" | "thread" | undefined>(undefined);
  const [deepLinkHandled, setDeepLinkHandled] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [refreshKey, setRefreshKey] = useState(0);

  const { blocks: scheduleBlocks, refetch: refetchBlocks, removeBlockOptimistic } = useScheduleBlocks(referenceDate, selectedTechId, undefined, effectiveCompanyId, allowedCompanyIds);
  const { absenceBlocks } = useAbsenceBlocks(referenceDate, selectedTechId, effectiveCompanyId, allowedCompanyIds);
  const isCurrentWeek = isSameWeek(referenceDate, new Date(), { weekStartsOn: 1 });
  const weekStart = startOfWeek(referenceDate, { weekStartsOn: 1 });

  const selectedTech = selectedTechId ? technicians.find((t) => t.id === selectedTechId) : null;

  const [colorOverrides, setColorOverrides] = useState<Map<string, string>>(new Map());

  const technicianMap = useMemo(() => {
    const map = new Map<string, { name: string; color: string | null; avatarId?: string | null }>();
    for (const t of technicians) {
      map.set(t.id, { name: t.name, color: colorOverrides.get(t.id) || t.color || null, avatarId: (t as any).avatar_id || null });
    }
    return map;
  }, [technicians, colorOverrides]);

  const handleTechColorChange = useCallback((techId: string, color: string) => {
    setColorOverrides((prev) => new Map(prev).set(techId, color));
  }, []);

  const { events: calEvents, refetch: refetchCalendarEvents } = useCalendarEvents(selectedTechId, referenceDate, effectiveCompanyId, scopedCompanyTechIds, allowedCompanyIds);
  const approvalEventIds = useMemo(() => calEvents.map(e => e.id), [calEvents]);
  const { summaries: approvalSummaries } = useApprovalSummaries(approvalEventIds);
  const [followUpFilter, setFollowUpFilter] = useState<FollowUpCategory>(null);
  const followUpJobIds = useMemo(
    () => getFilteredJobIds(followUpFilter, approvalSummaries, calEvents),
    [followUpFilter, approvalSummaries, calEvents]
  );

  const refreshPlanData = useCallback(async () => {
    setRefreshKey((k) => k + 1);
    await Promise.allSettled([
      Promise.resolve(refetchBlocks(true)),
      Promise.resolve(refetchBusySlots()),
      Promise.resolve(refetchCalendarEvents()),
    ]);
  }, [refetchBlocks, refetchBusySlots, refetchCalendarEvents]);

  // ── Deep link handler: ?openTask=...&companyId=...&tab=...&date=... ──
  useEffect(() => {
    if (deepLinkHandled) return;
    const openTaskId = searchParams.get("openTask");
    if (!openTaskId) return;

    const targetTab = searchParams.get("tab") as "details" | "thread" | null;
    const targetDate = searchParams.get("date");

    // Navigate calendar to the correct date
    if (targetDate) {
      const parsed = new Date(targetDate + "T12:00:00");
      if (!isNaN(parsed.getTime())) {
        setReferenceDate(parsed);
      }
    }

    // Fetch the event from DB to build a CalendarEvent for the drawer
    const openDeepLinkedTask = async () => {
      try {
        const { data: task, error } = await supabase
          .from("events")
          .select("id, title, customer, address, description, start_time, end_time, internal_number, company_id")
          .eq("id", openTaskId)
          .is("deleted_at", null)
          .single();

        if (error || !task) {
          toast.error("Kunne ikke åpne oppgaven", {
            description: "Oppgaven ble ikke funnet eller er slettet.",
          });
          setSearchParams({}, { replace: true });
          setDeepLinkHandled(true);
          return;
        }

        // Fetch technician assignments
        const { data: techLinks } = await supabase
          .from("event_technicians")
          .select("technician_id, technicians(id, name, color)")
          .eq("event_id", openTaskId);

        const technicianIds = (techLinks || []).map((l: any) => l.technician_id);
        const techniciansList = (techLinks || []).map((l: any) => ({
          id: l.technicians?.id || l.technician_id,
          name: l.technicians?.name || "Ukjent",
          color: l.technicians?.color || null,
        }));

        const calEvent: CalendarEvent = {
          id: task.id,
          microsoftEventId: "",
          title: task.title || "",
          customer: task.customer || "",
          address: task.address || "",
          description: task.description || "",
          start: task.start_time ? new Date(task.start_time) : new Date(),
          end: task.end_time ? new Date(task.end_time) : new Date(),
          status: "Planlagt" as any,
          technicianIds,
          attendeeStatuses: [],
          technicians: techniciansList,
          internalNumber: task.internal_number || null,
        };

        if (targetTab) setDeepLinkTab(targetTab);
        setEditEvent(calEvent);
        setClickedTechId(technicianIds[0] || null);
        setPreselectedStart(null);
        setPreselectedEnd(null);
        setDrawerOpen(true);

        // Clean URL params
        setSearchParams({}, { replace: true });
      } catch (err) {
        console.error("[ResourcePlan][DeepLink] Error opening task:", err);
        toast.error("Noe gikk galt", {
          description: "Kunne ikke åpne oppgaven fra lenken.",
        });
        setSearchParams({}, { replace: true });
      }
      setDeepLinkHandled(true);
    };

    openDeepLinkedTask();
  }, [searchParams, deepLinkHandled, setSearchParams]);

  const goToPrev = useCallback(() => {
    setReferenceDate((d) => {
      if (calendarView === "timeGridDay") return addDays(d, -1);
      if (calendarView === "dayGridMonth") return addMonths(d, -1);
      return addWeeks(d, -1);
    });
  }, [calendarView]);
  const goToNext = useCallback(() => {
    setReferenceDate((d) => {
      if (calendarView === "timeGridDay") return addDays(d, 1);
      if (calendarView === "dayGridMonth") return addMonths(d, 1);
      return addWeeks(d, 1);
    });
  }, [calendarView]);
  const goToToday = useCallback(() => setReferenceDate(new Date()), []);

  const handleEventClick = useCallback((event: CalendarEvent, techId?: string) => {
    console.info("[ResourcePlan][OpenEventDrawer]", {
      open_handler: "event_drawer",
      event_id: event.id,
      clicked_tech_id: techId ?? null,
      technician_ids: event.technicianIds,
      technician_names: event.technicians.map((t) => t.name),
      start: event.start?.toISOString?.() ?? null,
      end: event.end?.toISOString?.() ?? null,
    });
    setEditEvent(event);
    setClickedTechId(techId ?? null);
    setPreselectedStart(null);
    setPreselectedEnd(null);
    setDropProjectId(null);
    setDropProjectTitle(null);
    setDrawerOpen(true);
  }, []);

  const handleDateSelect = useCallback((start: Date, end: Date) => {
    if (!canWriteEvents) return;
    setEditEvent(null);
    setPreselectedStart(start);
    setPreselectedEnd(end);
    setDropProjectId(null);
    setDropProjectTitle(null);
    setDrawerOpen(true);
  }, [canWriteEvents]);

  const handleNewEvent = useCallback(() => {
    setEditEvent(null);
    setPreselectedStart(null);
    setPreselectedEnd(null);
    setDropProjectId(null);
    setDropProjectTitle(null);
    setDrawerOpen(true);
  }, []);

  useEffect(() => {
    const handler = () => handleNewEvent();
    window.addEventListener("resource-plan:new-activity", handler);
    return () => window.removeEventListener("resource-plan:new-activity", handler);
  }, [handleNewEvent]);

  const handleScheduleBlockDrop = useCallback(async (blockId: string, newStart: Date, newEnd: Date, technicianId?: string) => {
    const { error } = await supabase
      .from("schedule_blocks")
      .update({ start_at: newStart.toISOString(), end_at: newEnd.toISOString() } as any)
      .eq("id", blockId);

    if (error) {
      toast.error("Kunne ikke flytte planblokken");
      return;
    }

    const techName = technicianId ? technicianMap.get(technicianId)?.name : null;
    toast.success(techName ? `${techName} flyttet` : "Planblokk flyttet", {
      description: `${format(newStart, "dd.MM HH:mm")}–${format(newEnd, "HH:mm")}`,
    });
    await refreshPlanData();
  }, [refreshPlanData, technicianMap]);

  const handleEventDrop = useCallback(async (eventId: string, newStart: Date, newEnd: Date, technicianId?: string) => {
    const oldEvent = calEvents.find((e) => e.id === eventId);
    const isMultiTech = oldEvent && oldEvent.technicians.length > 1;

    if (isMultiTech && technicianId) {
      // Per-technician time update: only change this tech's override
      const tech = oldEvent?.technicians.find((t) => t.id === technicianId);
      const etId = tech?.eventTechnicianId;
      if (etId) {
        const { error } = await supabase.from("event_technicians")
          .update({ start_at: newStart.toISOString(), end_at: newEnd.toISOString() })
          .eq("id", etId);
        if (error) { toast.error("Kunne ikke flytte montøren"); }
        else {
          const techName = tech?.name || "Montør";
          toast.success(`${techName} flyttet`, {
            description: `${format(newStart, "dd.MM HH:mm")}–${format(newEnd, "HH:mm")}`,
          });
          const { data: session } = await supabase.auth.getSession();
          await supabase.from("event_logs").insert({
            event_id: eventId,
            action_type: "technician_time_changed",
            performed_by: session?.session?.user?.id || null,
            change_summary: `${techName} flyttet til ${format(newStart, "dd.MM HH:mm")}–${format(newEnd, "HH:mm")}`,
          });
        }
      }
    } else {
      // Single tech or no tech context: update event-level time (existing behavior)
      const { error } = await supabase.from("events")
        .update({ start_time: newStart.toISOString(), end_time: newEnd.toISOString() })
        .eq("id", eventId);
      if (error) toast.error("Kunne ikke flytte hendelsen");
      else {
        const { data: session } = await supabase.auth.getSession();
        const userId = session?.session?.user?.id;
        await supabase.from("event_logs").insert({
          event_id: eventId,
          action_type: "time_changed",
          performed_by: userId || null,
          change_summary: `Flyttet fra ${oldEvent ? format(oldEvent.start, "dd.MM HH:mm") + "–" + format(oldEvent.end, "HH:mm") : "ukjent"} til ${format(newStart, "dd.MM HH:mm")}–${format(newEnd, "HH:mm")}`,
        });
        await supabase.from("service_jobs")
          .update({ starts_at: newStart.toISOString(), ends_at: newEnd.toISOString() } as any)
          .eq("project_id", eventId);
        await supabase.from("work_orders")
          .update({ starts_at: newStart.toISOString(), ends_at: newEnd.toISOString() } as any)
          .eq("project_id", eventId);
        const result = await syncUpdate(eventId);
        if (result === "synced") {
          toast.success("Tidspunkt oppdatert. Outlook synkronisert ✓");
        } else if (result !== "conflict") {
          toast.success("Hendelse flyttet");
        }
      }
    }
    await refetchCalendarEvents();
    setRefreshKey((k) => k + 1);
  }, [syncUpdate, calEvents, refetchCalendarEvents]);

  const handleScheduleBlockResize = useCallback(async (blockId: string, newStart: Date, newEnd: Date, technicianId?: string) => {
    const { error } = await supabase
      .from("schedule_blocks")
      .update({ start_at: newStart.toISOString(), end_at: newEnd.toISOString() } as any)
      .eq("id", blockId);

    if (error) {
      toast.error("Kunne ikke endre planblokken");
      return;
    }

    const techName = technicianId ? technicianMap.get(technicianId)?.name : null;
    toast.success(techName ? `${techName} oppdatert` : "Planblokk oppdatert", {
      description: `${format(newStart, "dd.MM HH:mm")}–${format(newEnd, "HH:mm")}`,
    });
    await refreshPlanData();
  }, [refreshPlanData, technicianMap]);

  const handleEventResize = useCallback(async (eventId: string, newStart: Date, newEnd: Date, technicianId?: string) => {
    const oldEvent = calEvents.find((e) => e.id === eventId);
    const isMultiTech = oldEvent && oldEvent.technicians.length > 1;

    if (isMultiTech && technicianId) {
      const tech = oldEvent?.technicians.find((t) => t.id === technicianId);
      const etId = tech?.eventTechnicianId;
      if (etId) {
        const { error } = await supabase.from("event_technicians")
          .update({ start_at: newStart.toISOString(), end_at: newEnd.toISOString() })
          .eq("id", etId);
        if (error) { toast.error("Kunne ikke endre varighet"); }
        else {
          toast.success(`${tech?.name || "Montør"} varighet oppdatert`);
        }
      }
    } else {
      const { error } = await supabase.from("events")
        .update({ start_time: newStart.toISOString(), end_time: newEnd.toISOString() })
        .eq("id", eventId);
      if (error) toast.error("Kunne ikke endre varighet");
      else {
        const { data: session } = await supabase.auth.getSession();
        const userId = session?.session?.user?.id;
        await supabase.from("event_logs").insert({
          event_id: eventId,
          action_type: "duration_changed",
          performed_by: userId || null,
          change_summary: `Varighet endret fra ${oldEvent ? format(oldEvent.start, "HH:mm") + "–" + format(oldEvent.end, "HH:mm") : "ukjent"} til ${format(newStart, "HH:mm")}–${format(newEnd, "HH:mm")}`,
        });
        await supabase.from("service_jobs")
          .update({ starts_at: newStart.toISOString(), ends_at: newEnd.toISOString() } as any)
          .eq("project_id", eventId);
        await supabase.from("work_orders")
          .update({ starts_at: newStart.toISOString(), ends_at: newEnd.toISOString() } as any)
          .eq("project_id", eventId);
        const result = await syncUpdate(eventId);
        if (result === "synced") {
          toast.success("Varighet oppdatert. Outlook synkronisert ✓");
        } else if (result !== "conflict") {
          toast.success("Varighet oppdatert");
        }
      }
    }
    await refetchCalendarEvents();
    setRefreshKey((k) => k + 1);
  }, [syncUpdate, calEvents, refetchCalendarEvents]);
  const operatingHours = useOperatingHours(effectiveCompanyId);

  useEffect(() => {
    setWorkHours(operatingHours.startHour, operatingHours.endHour === 24 ? 23 : operatingHours.endHour);
  }, [operatingHours.startHour, operatingHours.endHour]);

  const { aggregatedDays, techCapacities, availableTechIds, partialTechIds } = useCapacity(
    calEvents, busySlots, referenceDate, techIds, operatingHours.workDayMinutes
  );

  const capacityGapsSummary = useCapacityGaps(calEvents, techCapacities, technicianMap, referenceDate);

  const handleGapClick = useCallback((gap: CapacityGap) => {
    // Highlight the technician and scroll to the gap time – don't change view
    setSelectedTechId(gap.techId);
    setReferenceDate(gap.date);
    const timeStr = `${String(Math.floor(gap.startHour)).padStart(2, "0")}:00:00`;
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("resource-calendar:scroll-to", { detail: timeStr }));
    }, 300);
  }, []);

  const handleExternalDrop = useCallback((info: { taskId: string; title: string; start: Date; end: Date; estimatedMinutes: number; priority: string; dropType: string }) => {
    const techId = selectedTechId || (technicians.length > 0 ? technicians[0].id : null);
    if (!techId) {
      toast.error("Velg en montør først");
      return;
    }
    // Open EventDrawer with drop context
    setEditEvent(null);
    setClickedTechId(techId);
    setPreselectedStart(info.start);
    setPreselectedEnd(info.end || addMinutes(info.start, info.estimatedMinutes || 480));
    setDropProjectId(info.taskId || null);
    setDropProjectTitle(info.title || null);
    setDrawerOpen(true);
  }, [selectedTechId, technicians]);

  const nowStatusMap = useTechnicianNowStatus(calEvents, canReadBusy ? busySlots : [], techIds, externalBlocksCapacity);

  const todayDayIndex = useMemo(() => {
    const today = new Date();
    const ws = startOfWeek(referenceDate, { weekStartsOn: 1 });
    const diff = Math.floor((today.getTime() - ws.getTime()) / 86400000);
    return diff >= 0 && diff < 7 ? diff : 0;
  }, [referenceDate]);

  const techDayPercents = useMemo(() => {
    const map = new Map<string, number>();
    for (const tc of techCapacities) {
      map.set(tc.techId, tc.days[todayDayIndex]?.percent ?? 0);
    }
    return map;
  }, [techCapacities, todayDayIndex]);

  const techWeekCapacities = useMemo(() => {
    const map = new Map<string, import("@/components/TechnicianList").TechWeekCapacity>();
    for (const tc of techCapacities) {
      const todayDay = tc.days[todayDayIndex];
      const todayMinutes = todayDay?.totalMinutes ?? 0;
      const todayFreeMinutes = Math.max(0, operatingHours.workDayMinutes - todayMinutes);
      map.set(tc.techId, {
        weekPlannedHours: tc.weekPlannedHours,
        weekCapacityHours: tc.weekCapacityHours,
        overtimeHours: tc.overtimeHours,
        weekPercent: tc.weekPercent,
        todayMinutes,
        todayFreeMinutes,
      });
    }
    return map;
  }, [techCapacities, todayDayIndex, operatingHours.workDayMinutes]);

  const handleCapacityFilterClick = useCallback((filter: "all" | "available" | "partial" | "full" | "overbooked") => {
    if (filter === "full" || filter === "overbooked") {
      const matchIds = techCapacities
        .filter((tc) => {
          const p = tc.days[todayDayIndex]?.percent ?? 0;
          if (filter === "overbooked") return p > 100;
          return p >= 90 && p <= 100;
        })
        .map((tc) => tc.techId);
      if (matchIds.length === 1) setSelectedTechId(matchIds[0]);
      else setSelectedTechId(null);
      setCapacityFilter("all");
      return;
    }
    setCapacityFilter(filter);
  }, [techCapacities, todayDayIndex]);

  const filteredTechForSidebar = useMemo(() => {
    let ids: string[] | null = null;

    if (capacityFilter === "available") {
      ids = availableTechIds(todayDayIndex);
    } else if (capacityFilter === "partial") {
      ids = partialTechIds(todayDayIndex);
    }

    if (minFreeMinutes) {
      const candidateIds = ids || techIds;
      ids = candidateIds.filter((techId) => {
        const free = getContiguousFreeMinutes(techId, calEvents, busySlots, externalBlocksCapacity);
        return free >= minFreeMinutes;
      });
    }

    if (ids === null && capacityFilter === "all") return null;
    return new Set(ids || []);
  }, [capacityFilter, availableTechIds, partialTechIds, todayDayIndex, minFreeMinutes, techIds, calEvents, busySlots, externalBlocksCapacity]);

  const touchStartX = useRef<number | null>(null);
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(diff) > 80) {
      if (diff > 0) goToPrev();
      else goToNext();
    }
  }, [goToPrev, goToNext]);

  // Period label
  const periodLabel = calendarView === "dayGridMonth"
    ? format(referenceDate, "MMMM yyyy", { locale: nb })
    : calendarView === "timeGridDay"
    ? format(referenceDate, "EEEE d. MMMM", { locale: nb })
    : `Uke ${format(weekStart, "w", { locale: nb })}`;

  const periodSub = (calendarView === "timeGridWeek" || calendarView === "listWeek")
    ? `${format(weekStart, "d. MMM", { locale: nb })} – ${format(addWeeks(weekStart, 1), "d. MMM yyyy", { locale: nb })}`
    : null;

  return (
    <div className={cn("flex flex-1 overflow-hidden h-full", focusMode && "focus-mode")}>
      {!isMobile && (
        <aside className={cn(
          "shrink-0 border-r border-border/30 bg-card/50 overflow-y-auto transition-all duration-200",
          sidebarCollapsed ? "w-14 p-1.5" : "w-56 p-3"
        )}>
          {/* Sidebar collapse toggle */}
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-7 text-[10px] mb-2 gap-1"
            onClick={() => setSidebarCollapsed(v => !v)}
          >
            {sidebarCollapsed ? <PanelLeftOpen className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
            {!sidebarCollapsed && "Minimer"}
          </Button>
          {sidebarCollapsed ? (
            <CompactTechList
              technicians={technicians}
              selectedId={selectedTechId}
              onSelect={setSelectedTechId}
              filterIds={filteredTechForSidebar}
            />
          ) : (
            <TechnicianList
              technicians={technicians}
              isGlobalScope={effectiveCompanyId === null}
              selectedId={selectedTechId}
              onSelect={setSelectedTechId}
              allowDeselect
              filterIds={filteredTechForSidebar}
              nowStatusMap={canReadBusy ? nowStatusMap : undefined}
              onColorChange={handleTechColorChange}
              techDayPercents={canReadBusy ? techDayPercents : undefined}
              techWeekCapacities={canReadBusy ? techWeekCapacities : undefined}
            />
          )}
        </aside>
      )}

      <div className={cn("flex-1 overflow-y-auto relative", focusMode ? "p-2" : "p-2 sm:p-4 lg:p-6")}>
        {isMobile ? (
          <MobileResourceHeader
            technicians={technicians}
            selectedTechId={selectedTechId}
            onSelectTech={setSelectedTechId}
            capacityFilter={capacityFilter}
            onCapacityFilterChange={setCapacityFilter}
            calendarView={calendarView}
            onCalendarViewChange={setCalendarView}
            referenceDate={referenceDate}
            isCurrentPeriod={isCurrentWeek}
            onPrev={goToPrev}
            onNext={goToNext}
            onToday={goToToday}
            externalBlocksCapacity={externalBlocksCapacity}
            onExternalBlocksCapacityChange={setExternalBlocksCapacity}
            hideExternalEvents={hideExternalEvents}
            onHideExternalEventsChange={handleHideExternalChange}
            isSuperAdmin={canViewExternal}
            minFreeMinutes={canReadBusy ? minFreeMinutes : null}
            onMinFreeMinutesChange={canReadBusy ? setMinFreeMinutes : undefined}
          />
        ) : (
          <>
            {/* ═══ PRIMARY ROW (sticky in focus mode) ═══ */}
            <div className={cn(
              "flex items-center justify-between mb-2",
              focusMode && "sticky top-0 z-20 bg-background/95 backdrop-blur-sm py-1.5 -mx-2 px-2 border-b border-border/20"
            )}>
              {/* Left: Title + selected tech */}
              <div className="flex items-center gap-3 min-w-0">
                <h1 className="text-lg font-bold tracking-tight flex items-center gap-2 shrink-0">
                  <CalendarDays className="h-5 w-5 text-primary" />
                  Ressursplan
                </h1>
                {selectedTech && (
                  <span
                    className="inline-flex items-center gap-1.5 text-sm font-semibold px-2.5 py-0.5 rounded-full shrink-0"
                    style={{
                      backgroundColor: `${selectedTech.color || "#6366f1"}15`,
                      color: selectedTech.color || "#6366f1",
                    }}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: selectedTech.color || "#6366f1" }} />
                    {selectedTech.name}
                  </span>
                )}
              </div>

              {/* Center: Nav + period + view */}
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={goToPrev} className="h-7 w-7 rounded-md">
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <div className="text-center min-w-[120px]">
                  <p className="text-sm font-semibold text-foreground leading-tight">{periodLabel}</p>
                  {periodSub && (
                    <p className="text-[10px] text-muted-foreground leading-tight">{periodSub}</p>
                  )}
                </div>

                <Button variant="ghost" size="icon" onClick={goToNext} className="h-7 w-7 rounded-md">
                  <ChevronRight className="h-4 w-4" />
                </Button>

                {!isCurrentWeek && (
                  <Button variant="outline" size="sm" onClick={goToToday} className="gap-1 rounded-md text-xs h-7 px-2">
                    <RotateCcw className="h-3 w-3" />
                    I dag
                  </Button>
                )}

                <div className="flex items-center gap-0.5 border border-border/40 rounded-md p-0.5 ml-1">
                  {VIEW_OPTIONS.map((v) => (
                    <Button
                      key={v.value}
                      variant={calendarView === v.value ? "default" : "ghost"}
                      size="sm"
                      className="h-6 text-[11px] rounded px-2"
                      onClick={() => setCalendarView(v.value)}
                    >
                      {v.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Right: Search + Primary actions */}
              <div className="flex items-center gap-2 shrink-0">
                {canWriteEvents && (
                  <QuickProjectSearch
                    onPlanProject={(projectId, projectTitle) => {
                      setEditEvent(null);
                      setDropProjectId(projectId);
                      setDropProjectTitle(projectTitle);
                      // Use last date-selected range if available, otherwise no time
                      setClickedTechId(selectedTechId || null);
                      // Keep preselectedStart/End as-is (from last calendar selection)
                      setDrawerOpen(true);
                    }}
                  />
                )}

                {confirmationCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 rounded-lg relative h-8 text-xs"
                    onClick={() => navigate("/calendar/confirmations")}
                  >
                    <Bell className="h-3.5 w-3.5" />
                    {confirmationCount}
                  </Button>
                )}

                {canWriteEvents && (
                  <Button onClick={handleNewEvent} size="sm" className="gap-1.5 rounded-lg h-8">
                    <Plus className="h-4 w-4" />
                    {!focusMode && "Ny aktivitet"}
                  </Button>
                )}

                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={focusMode ? "default" : "outline"}
                        size="icon"
                        className="h-8 w-8 rounded-lg"
                        onClick={toggleFocusMode}
                      >
                        {focusMode ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">
                      {focusMode ? "Vis alt" : "Fokusmodus"}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            {/* ═══ SECONDARY ROW (hidden in focus mode) ═══ */}
            {!focusMode && (
            <div className="flex items-center justify-between mb-3 gap-2 py-1.5 px-3 bg-muted/30 rounded-lg border border-border/20">
              <div className="flex items-center gap-3 flex-wrap">
                {/* Capacity filter chips */}
                <div className="flex items-center gap-0.5 border border-border/30 rounded-md p-0.5">
                  <Button variant={capacityFilter === "all" ? "default" : "ghost"} size="sm" className="h-6 text-[10px] rounded px-2" onClick={() => setCapacityFilter("all")}>Alle</Button>
                  <Button variant={capacityFilter === "available" ? "default" : "ghost"} size="sm" className="h-6 text-[10px] rounded px-2 gap-0.5" onClick={() => setCapacityFilter("available")}>
                    <UserCheck className="h-3 w-3" />Ledige
                  </Button>
                  <Button variant={capacityFilter === "partial" ? "default" : "ghost"} size="sm" className="h-6 text-[10px] rounded px-2 gap-0.5" onClick={() => setCapacityFilter("partial")}>
                    <UserMinus className="h-3 w-3" />Delvis
                  </Button>
                </div>

                {/* Min free minutes */}
                <Select value={minFreeMinutes?.toString() || "none"} onValueChange={(v) => setMinFreeMinutes(v === "none" ? null : Number(v))}>
                  <SelectTrigger className="w-[120px] h-6 text-[10px] rounded-md border-border/30">
                    <Clock className="h-3 w-3 mr-0.5 text-muted-foreground" />
                    <SelectValue placeholder="Min. ledig" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Alle (ingen min.)</SelectItem>
                    <SelectItem value="30">Ledig 30+ min</SelectItem>
                    <SelectItem value="60">Ledig 60+ min</SelectItem>
                    <SelectItem value="90">Ledig 90+ min</SelectItem>
                    <SelectItem value="120">Ledig 120+ min</SelectItem>
                  </SelectContent>
                </Select>

                <div className="h-4 w-px bg-border/40" />

                {/* Toggles */}
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Switch checked={externalBlocksCapacity} onCheckedChange={setExternalBlocksCapacity} className="scale-[0.6]" />
                  <span className="whitespace-nowrap">Ekstern blokkerer</span>
                </div>

                {canViewExternal && (
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Switch checked={hideExternalEvents} onCheckedChange={handleHideExternalChange} className="scale-[0.6]" />
                    <span className="whitespace-nowrap">Skjul eksterne</span>
                  </div>
                )}

                <div className="h-4 w-px bg-border/40" />

                <StatusLegend />
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Sync health */}
                {hasPermission("admin.manage_settings") && (
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1 text-[10px] cursor-default">
                          <span
                            className="h-1.5 w-1.5 rounded-full shrink-0"
                            style={{
                              backgroundColor: syncHealth.color === "green" ? "hsl(var(--success, 142 71% 45%))"
                                : syncHealth.color === "yellow" ? "hsl(var(--accent, 38 92% 50%))"
                                : "hsl(var(--destructive, 0 84% 60%))",
                            }}
                          />
                          <span className="text-muted-foreground whitespace-nowrap">{syncHealth.label}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">
                        {syncHealth.minutesAgo !== null
                          ? `Siste synkronisering ${syncHealth.minutesAgo} min siden${syncHealth.status === "error" ? " (feil)" : ""}`
                          : "Ingen synkroniseringsdata"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}

                {/* Zoom + quick nav */}
                {(calendarView === "timeGridDay" || calendarView === "timeGridWeek") && (
                  <div className="flex items-center gap-0.5 border border-border/30 rounded-md p-0.5">
                    {(["compact", "normal", "detailed"] as ZoomLevel[]).map((z) => (
                      <Button
                        key={z}
                        variant={operatingHours.zoom === z ? "default" : "ghost"}
                        size="sm"
                        className="h-5 text-[9px] rounded px-1.5"
                        onClick={() => operatingHours.setZoom(z)}
                      >
                        {z === "compact" ? "1t" : z === "normal" ? "30m" : "15m"}
                      </Button>
                    ))}
                  </div>
                )}

                {(calendarView === "timeGridDay" || calendarView === "timeGridWeek") && (
                  <div className="flex items-center gap-0.5 border border-border/30 rounded-md p-0.5">
                    <Button variant="ghost" size="sm" className="h-5 text-[9px] rounded px-1.5 gap-0.5" onClick={() => {
                      window.dispatchEvent(new CustomEvent("resource-calendar:scroll-to", { detail: "06:00:00" }));
                    }}>
                      <Sunrise className="h-2.5 w-2.5" /> Morgen
                    </Button>
                    <Button variant="ghost" size="sm" className="h-5 text-[9px] rounded px-1.5 gap-0.5" onClick={() => {
                      window.dispatchEvent(new CustomEvent("resource-calendar:scroll-to", { detail: "18:00:00" }));
                    }}>
                      <Sun className="h-2.5 w-2.5" /> Kveld
                    </Button>
                    <Button variant="ghost" size="sm" className="h-5 text-[9px] rounded px-1.5 gap-0.5" onClick={() => {
                      window.dispatchEvent(new CustomEvent("resource-calendar:scroll-to", { detail: "00:00:00" }));
                    }}>
                      <Moon className="h-2.5 w-2.5" /> Natt
                    </Button>
                  </div>
                )}

                <Badge variant="outline" className="text-[9px] h-4 px-1.5">
                  {operatingHours.profile === "office" ? "Kontor" : operatingHours.profile === "extended" ? "Utvidet" : "24/7"}
                </Badge>
              </div>
            </div>
            )}
          </>
        )}

        {/* Capacity status bar (hidden in focus mode) */}
        {!isMobile && !focusMode && canReadBusy && techCapacities.length > 0 && (
          <CapacityStatusBar
            techCapacities={techCapacities}
            todayDayIndex={todayDayIndex}
            onFilterClick={handleCapacityFilterClick}
            activeFilter={capacityFilter}
          />
        )}

        {/* Unplanned projects warning (hidden in focus mode) */}
        {!isMobile && !focusMode && <UnplannedProjectsBanner count={unplannedCount} />}

        {/* Draggable unplanned jobs (hidden in focus mode) */}
        {!isMobile && !focusMode && canWriteEvents && (
          <UnplannedJobsStrip companyId={effectiveCompanyId} />
        )}

        {/* Follow-up strip (shown as compact in focus mode) */}
        {!isMobile && (
          <FollowUpStrip
            summaries={approvalSummaries}
            events={calEvents}
            activeFilter={followUpFilter}
            onFilterChange={setFollowUpFilter}
          />
        )}

        {/* Recommended actions (hidden in focus mode) */}
        {!isMobile && !focusMode && (
          <RecommendedActions
            summaries={approvalSummaries}
            events={calEvents}
            onActionClick={(jobId) => {
              const event = calEvents.find(e => e.id === jobId);
              if (event) handleEventClick(event);
            }}
          />
        )}

        {/* Capacity gaps (hidden in focus mode) */}
        {!isMobile && !focusMode && canReadBusy && (
          <CapacityGapsStrip
            summary={capacityGapsSummary}
            onGapClick={handleGapClick}
          />
        )}

        {/* Unscheduled tasks strip (hidden in focus mode) */}
        {!focusMode && (
          <TaskResourceStrip
            technicianUserId={null}
            referenceDate={referenceDate}
          />
        )}

        {/* Interactive FullCalendar */}
        <div onTouchStart={isMobile ? handleTouchStart : undefined} onTouchEnd={isMobile ? handleTouchEnd : undefined}>
        <ResourceCalendar
          key={refreshKey}
          technicianId={capacityFilter !== "all" && filteredTechForSidebar
            ? (filteredTechForSidebar.size === 1 ? Array.from(filteredTechForSidebar)[0] : selectedTechId)
            : selectedTechId}
          companyId={effectiveCompanyId}
          referenceDate={referenceDate}
          calendarView={calendarView}
          technicianMap={technicianMap}
          getBusySlotsForDay={canReadBusy ? getBusySlotsForDay : undefined}
          dayCapacities={canReadBusy ? aggregatedDays : undefined}
          scheduleBlocks={scheduleBlocks}
          absenceBlocks={absenceBlocks}
          onEventClick={handleEventClick}
          onScheduleBlockClick={(block) => {
            console.info("[ResourcePlan][OpenScheduleBlock]", {
              block_id: block.id,
              source: block.source,
              event_id: block.project_id,
              event_technician_id: null,
              technician_id: block.technician_id,
              calendar_event_id: block.outlook_event_id || block.calendar_id || null,
              title: block.outlook_subject || block.title,
              start: block.start_at?.toISOString?.() ?? null,
              end: block.end_at?.toISOString?.() ?? null,
              display_name: block.technician_name ?? null,
            });
            setSelectedBlock(block);
          }}
          onDateSelect={canWriteEvents ? handleDateSelect : undefined}
          onEventDrop={canWriteEvents ? handleEventDrop : undefined}
          onEventResize={canWriteEvents ? handleEventResize : undefined}
          onExternalDrop={canWriteEvents ? handleExternalDrop : undefined}
          canWriteEvents={canWriteEvents}
          canViewExternalDetails={canViewExternal}
          canReadBusy={canReadBusy}
          hideExternalEvents={hideExternalEvents}
          slotMinTime={operatingHours.slotMinTime}
          slotMaxTime={operatingHours.slotMaxTime}
          slotDuration={operatingHours.slotDuration}
          operatingStartHour={operatingHours.startHour}
          operatingEndHour={operatingHours.endHour}
          hasNightHours={operatingHours.hasNightHours}
          approvalSummaries={approvalSummaries}
          highlightEventIds={followUpJobIds}
          onMonthDayClick={(date) => {
            setReferenceDate(date);
            setCalendarView("timeGridDay");
          }}
        />
        </div>
      </div>

      <EventDrawer
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) {
            setDropProjectId(null);
            setDropProjectTitle(null);
            setDeepLinkTab(undefined);
          }
        }}
        editEvent={editEvent}
        clickedTechId={clickedTechId}
        preselectedStart={preselectedStart}
        preselectedEnd={preselectedEnd}
        preselectedTechId={selectedTechId}
        projectId={dropProjectId}
        projectTitle={dropProjectTitle}
        readOnly={editEvent ? drawerReadOnly : false}
        initialTab={deepLinkTab}
        scheduleBlockId={
          editEvent
            ? findScheduleBlockForAssignment(scheduleBlocks, editEvent.id, clickedTechId)?.id ?? null
            : null
        }
        onSaved={() => {
          if (editEvent) {
            const linkedIds = findLinkedScheduleBlockIds(scheduleBlocks, editEvent.id, clickedTechId);
            for (const id of linkedIds) removeBlockOptimistic(id);
          }
          setDropProjectId(null);
          setDropProjectTitle(null);
          void refreshPlanData();
        }}
      />

      <OutlookConflictDialog
        conflict={conflict}
        onUseSystem={() => conflict && forceUpdate(conflict.eventId)}
        onUseOutlook={() => {
          if (conflict?.graphVersion) {
            acceptGraphVersion(conflict.eventId, conflict.graphVersion.start, conflict.graphVersion.end);
            setRefreshKey((k) => k + 1);
          }
        }}
        onDismiss={dismissConflict}
      />

      {selectedBlock && (
        <ScheduleBlockDetailPanel
          block={selectedBlock}
          onClose={() => setSelectedBlock(null)}
          onConfirmed={(deletedBlockIds) => {
            if (deletedBlockIds?.length) {
              for (const id of deletedBlockIds) removeBlockOptimistic(id);
            }
            setSelectedBlock(null);
            void refreshPlanData();
          }}
        />
      )}

    </div>
  );
}
