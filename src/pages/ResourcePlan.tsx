import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { addWeeks, addDays, startOfWeek, startOfMonth, addMonths, format, isSameWeek } from "date-fns";
import { useNavigate } from "react-router-dom";
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
  Calendar, List, Bell,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { useTechnicians } from "@/hooks/useTechnicians";
import { useExternalBusy } from "@/hooks/useExternalBusy";
import { useCalendarEvents, type CalendarEvent } from "@/hooks/useCalendarEvents";
import { useCapacity } from "@/hooks/useCapacity";
import { useTechnicianNowStatus, getContiguousFreeMinutes } from "@/hooks/useTechnicianNowStatus";
import { useCalendarSync } from "@/hooks/useCalendarSync";
import { OutlookConflictDialog } from "@/components/OutlookConflictDialog";
import { useConfirmationCount, useScheduleBlocks, type ScheduleBlock } from "@/hooks/useScheduleBlocks";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ScheduleBlockDetailPanel } from "@/components/ScheduleBlockDetailPanel";
import { useSyncHealth } from "@/hooks/useSyncHealth";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { MobileResourceHeader } from "@/components/resource-plan/MobileResourceHeader";
import { CapacityStatusBar } from "@/components/resource-plan/CapacityStatusBar";
import { UnplannedProjectsBanner } from "@/components/resource-plan/UnplannedProjectsBanner";
import { useUnplannedProjects } from "@/hooks/useUnplannedProjects";
import { DropConfirmPopover, type DropPayload } from "@/components/resource-plan/DropConfirmPopover";

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
  // Permission-based access: use permission keys, NOT role checks
  const canReadBusy = hasPermission("calendar.read_busy");
  const canViewExternal = hasPermission("calendar.view_external");
  const canWriteEvents = hasPermission("calendar.write_events");
  const canDeleteEvents = hasPermission("calendar.delete_events");
  const confirmationCount = useConfirmationCount();
  const syncHealth = useSyncHealth(isAdmin);
  const { technicians } = useTechnicians();
  const unplannedCount = useUnplannedProjects();
  const [selectedTechId, setSelectedTechId] = useState<string | null>(null);
  const [capacityFilter, setCapacityFilter] = useState<"all" | "available" | "partial">("all");
  const [externalBlocksCapacity, setExternalBlocksCapacity] = useState(true);
  const [minFreeMinutes, setMinFreeMinutes] = useState<number | null>(null);
  const [calendarView, setCalendarView] = useState<CalendarViewType>(getStoredView);
  // Only fetch external busy data if user has calendar.read_busy permission
  const { busySlots, getBusySlotsForDay, getExternalBusyMinutesForDay } = useExternalBusy(canReadBusy ? selectedTechId : "__disabled__");
  const { syncUpdate, syncCreate, forceUpdate, acceptGraphVersion, conflict, dismissConflict } = useCalendarSync();
  const [selectedBlock, setSelectedBlock] = useState<ScheduleBlock | null>(null);
  const [hideExternalEvents, setHideExternalEvents] = useState(false);
  const [dropPayload, setDropPayload] = useState<DropPayload | null>(null);

  // Persist view choice
  useEffect(() => {
    localStorage.setItem(VIEW_STORAGE_KEY, calendarView);
  }, [calendarView]);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null);
  const [preselectedStart, setPreselectedStart] = useState<Date | null>(null);
  const [preselectedEnd, setPreselectedEnd] = useState<Date | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Week navigation
  const [referenceDate, setReferenceDate] = useState<Date>(new Date());
  const { blocks: scheduleBlocks, refetch: refetchBlocks } = useScheduleBlocks(referenceDate, selectedTechId);
  const isCurrentWeek = isSameWeek(referenceDate, new Date(), { weekStartsOn: 1 });
  const weekStart = startOfWeek(referenceDate, { weekStartsOn: 1 });

  const selectedTech = selectedTechId ? technicians.find((t) => t.id === selectedTechId) : null;

  const [colorOverrides, setColorOverrides] = useState<Map<string, string>>(new Map());

  const technicianMap = useMemo(() => {
    const map = new Map<string, { name: string; color: string | null }>();
    for (const t of technicians) {
      map.set(t.id, { name: t.name, color: colorOverrides.get(t.id) || t.color || null });
    }
    return map;
  }, [technicians, colorOverrides]);

  const handleTechColorChange = useCallback((techId: string, color: string) => {
    setColorOverrides((prev) => new Map(prev).set(techId, color));
  }, []);

  const techIds = useMemo(
    () => selectedTechId ? [selectedTechId] : technicians.map((t) => t.id),
    [selectedTechId, technicians]
  );
  const { events: calEvents } = useCalendarEvents(selectedTechId, referenceDate);

  // Navigation helpers – view-aware
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

  const handleEventClick = useCallback((event: CalendarEvent) => {
    setEditEvent(event);
    setPreselectedStart(null);
    setPreselectedEnd(null);
    setDrawerOpen(true);
  }, []);

  const handleDateSelect = useCallback((start: Date, end: Date) => {
    if (!canWriteEvents) return;
    setEditEvent(null);
    setPreselectedStart(start);
    setPreselectedEnd(end);
    setDrawerOpen(true);
  }, [canWriteEvents]);

  const handleNewEvent = useCallback(() => {
    setEditEvent(null);
    setPreselectedStart(null);
    setPreselectedEnd(null);
    setDrawerOpen(true);
  }, []);

  // Listen for global FAB "Ny aktivitet" from MobileTabBar
  useEffect(() => {
    const handler = () => handleNewEvent();
    window.addEventListener("resource-plan:new-activity", handler);
    return () => window.removeEventListener("resource-plan:new-activity", handler);
  }, [handleNewEvent]);

  const handleEventDrop = useCallback(async (eventId: string, newStart: Date, newEnd: Date) => {
    const oldEvent = calEvents.find((e) => e.id === eventId);
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
      // Sync linked service_jobs + work_orders
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
    setRefreshKey((k) => k + 1);
  }, [syncUpdate, calEvents]);

  const handleEventResize = useCallback(async (eventId: string, newStart: Date, newEnd: Date) => {
    const oldEvent = calEvents.find((e) => e.id === eventId);
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
      // Sync linked service_jobs + work_orders
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
    setRefreshKey((k) => k + 1);
  }, [syncUpdate, calEvents]);
  const { aggregatedDays, techCapacities, availableTechIds, partialTechIds } = useCapacity(
    calEvents, busySlots, referenceDate, techIds
  );

  // Handle external drop from TaskResourceStrip
  const handleExternalDrop = useCallback((info: { taskId: string; title: string; start: Date; end: Date; estimatedMinutes: number; priority: string; dropType: string }) => {
    // Determine technician: use selected tech or first available
    const techId = selectedTechId || (technicians.length > 0 ? technicians[0].id : null);
    if (!techId) {
      toast.error("Velg en montør først");
      return;
    }
    const tech = technicians.find((t) => t.id === techId);
    setDropPayload({
      taskId: info.taskId,
      taskTitle: info.title,
      estimatedMinutes: info.estimatedMinutes,
      priority: info.priority,
      type: info.dropType as "task" | "project",
      technicianId: techId,
      technicianName: tech?.name,
      dropTime: info.start,
    });
  }, [selectedTechId, technicians]);

  // Only compute now-status if user has permission to see busy/available
  const nowStatusMap = useTechnicianNowStatus(calEvents, canReadBusy ? busySlots : [], techIds, externalBlocksCapacity);

  const todayDayIndex = useMemo(() => {
    const today = new Date();
    const ws = startOfWeek(referenceDate, { weekStartsOn: 1 });
    const diff = Math.floor((today.getTime() - ws.getTime()) / 86400000);
    return diff >= 0 && diff < 7 ? diff : 0;
  }, [referenceDate]);

  // Build per-tech day percent map for overbooking indicators
  const techDayPercents = useMemo(() => {
    const map = new Map<string, number>();
    for (const tc of techCapacities) {
      map.set(tc.techId, tc.days[todayDayIndex]?.percent ?? 0);
    }
    return map;
  }, [techCapacities, todayDayIndex]);

  // Extended capacity filter supporting "full" and "overbooked"
  const handleCapacityFilterClick = useCallback((filter: "all" | "available" | "partial" | "full" | "overbooked") => {
    if (filter === "full" || filter === "overbooked") {
      // Filter to techs matching this category
      const matchIds = techCapacities
        .filter((tc) => {
          const p = tc.days[todayDayIndex]?.percent ?? 0;
          if (filter === "overbooked") return p > 100;
          return p >= 90 && p <= 100;
        })
        .map((tc) => tc.techId);
      // Use the first matched tech to focus, or clear
      if (matchIds.length === 1) setSelectedTechId(matchIds[0]);
      else setSelectedTechId(null);
      setCapacityFilter("all");
      return;
    }
    setCapacityFilter(filter);
  }, [techCapacities, todayDayIndex]);

  // Filter technicians: capacity + min free minutes
  const filteredTechForSidebar = useMemo(() => {
    let ids: string[] | null = null;

    if (capacityFilter === "available") {
      ids = availableTechIds(todayDayIndex);
    } else if (capacityFilter === "partial") {
      ids = partialTechIds(todayDayIndex);
    }

    // Apply "min free minutes" filter
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

  // Swipe navigation for mobile
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

  return (
    <div className="flex flex-1 overflow-hidden h-full">
      {!isMobile && (
        <aside className="w-56 shrink-0 border-r border-border/30 bg-card/50 overflow-y-auto p-3">
          <TechnicianList
            selectedId={selectedTechId}
            onSelect={setSelectedTechId}
            allowDeselect
            filterIds={filteredTechForSidebar}
            nowStatusMap={canReadBusy ? nowStatusMap : undefined}
            onColorChange={handleTechColorChange}
            techDayPercents={canReadBusy ? techDayPercents : undefined}
          />
        </aside>
      )}

      <div className="flex-1 overflow-y-auto p-2 sm:p-6 lg:p-8 relative">
        {/* MOBILE HEADER – compact 2-row layout */}
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
            onHideExternalEventsChange={setHideExternalEvents}
            isSuperAdmin={canViewExternal}
            minFreeMinutes={canReadBusy ? minFreeMinutes : null}
            onMinFreeMinutesChange={canReadBusy ? setMinFreeMinutes : undefined}
          />
        ) : (
          <>
            {/* DESKTOP HEADER – original layout */}
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2.5">
                    <CalendarDays className="h-6 w-6 text-primary" />
                    Ressursplan
                  </h1>
                  {selectedTech && (
                    <span
                      className="inline-flex items-center gap-1.5 text-base font-semibold px-3 py-1 rounded-full"
                      style={{
                        backgroundColor: `${selectedTech.color || "#6366f1"}15`,
                        color: selectedTech.color || "#6366f1",
                      }}
                    >
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: selectedTech.color || "#6366f1" }} />
                      {selectedTech.name}
                    </span>
                  )}
                </div>
                <span className="text-[9px] font-mono text-muted-foreground/60 select-all">
                  UI build: 2026-03-07 10:00
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Quick capacity filters */}
                <div className="flex items-center gap-1 border border-border/40 rounded-lg p-0.5">
                  <Button variant={capacityFilter === "all" ? "default" : "ghost"} size="sm" className="h-7 text-xs rounded-md px-2.5" onClick={() => setCapacityFilter("all")}>Alle</Button>
                  <Button variant={capacityFilter === "available" ? "default" : "ghost"} size="sm" className="h-7 text-xs rounded-md px-2.5 gap-1" onClick={() => setCapacityFilter("available")}>
                    <UserCheck className="h-3 w-3" />Ledige
                  </Button>
                  <Button variant={capacityFilter === "partial" ? "default" : "ghost"} size="sm" className="h-7 text-xs rounded-md px-2.5 gap-1" onClick={() => setCapacityFilter("partial")}>
                    <UserMinus className="h-3 w-3" />Delvis
                  </Button>
                </div>

                {/* Min free minutes filter */}
                <Select value={minFreeMinutes?.toString() || "none"} onValueChange={(v) => setMinFreeMinutes(v === "none" ? null : Number(v))}>
                  <SelectTrigger className="w-[140px] h-7 text-xs rounded-lg border-border/40">
                    <Clock className="h-3 w-3 mr-1 text-muted-foreground" />
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

                {/* External blocks capacity toggle */}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Switch checked={externalBlocksCapacity} onCheckedChange={setExternalBlocksCapacity} className="scale-75" />
                  <span className="whitespace-nowrap">Ekstern blokkerer</span>
                </div>

                {/* Superadmin: toggle external event visibility */}
                {canViewExternal && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Switch checked={hideExternalEvents} onCheckedChange={setHideExternalEvents} className="scale-75" />
                    <span className="whitespace-nowrap">Skjul eksterne</span>
                  </div>
                )}

                {hasPermission("admin.manage_settings") && (
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1.5 text-xs cursor-default">
                          <span
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{
                              backgroundColor: syncHealth.color === "green" ? "hsl(var(--success, 142 71% 45%))"
                                : syncHealth.color === "yellow" ? "hsl(var(--accent, 38 92% 50%))"
                                : "hsl(var(--destructive, 0 84% 60%))",
                            }}
                          />
                          <span className="text-muted-foreground whitespace-nowrap">Synk: {syncHealth.label}</span>
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

                <StatusLegend />

                {confirmationCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 rounded-xl relative"
                    onClick={() => navigate("/calendar/confirmations")}
                  >
                    <Bell className="h-4 w-4" />
                    <span>{confirmationCount} bekreftelser</span>
                  </Button>
                )}

                {canWriteEvents && (
                  <Button onClick={handleNewEvent} size="sm" className="gap-1.5 rounded-xl">
                    <Plus className="h-4 w-4" />
                    Ny aktivitet
                  </Button>
                )}
              </div>
            </div>

            {/* View switcher + navigation */}
            <div className="flex items-center justify-between mb-4 bg-card/80 backdrop-blur-sm border border-border/30 rounded-xl px-4 py-2.5">
              <Button variant="ghost" size="icon" onClick={goToPrev} className="h-8 w-8 rounded-lg">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-0.5 border border-border/40 rounded-lg p-0.5">
                  {VIEW_OPTIONS.map((v) => (
                    <Button
                      key={v.value}
                      variant={calendarView === v.value ? "default" : "ghost"}
                      size="sm"
                      className="h-7 text-xs rounded-md px-2.5"
                      onClick={() => setCalendarView(v.value)}
                    >
                      {v.label}
                    </Button>
                  ))}
                </div>

                <div className="text-center">
                  <p className="text-sm font-semibold text-foreground">
                    {calendarView === "dayGridMonth"
                      ? format(referenceDate, "MMMM yyyy", { locale: nb })
                      : calendarView === "timeGridDay"
                      ? format(referenceDate, "EEEE d. MMMM", { locale: nb })
                      : `Uke ${format(weekStart, "w", { locale: nb })}`}
                  </p>
                  {(calendarView === "timeGridWeek" || calendarView === "listWeek") && (
                    <p className="text-xs text-muted-foreground">
                      {format(weekStart, "d. MMM", { locale: nb })} – {format(addWeeks(weekStart, 1), "d. MMM yyyy", { locale: nb })}
                    </p>
                  )}
                </div>
                {!isCurrentWeek && (
                  <Button variant="outline" size="sm" onClick={goToToday} className="gap-1.5 rounded-lg text-xs h-7">
                    <RotateCcw className="h-3 w-3" />
                    I dag
                  </Button>
                )}
              </div>
              <Button variant="ghost" size="icon" onClick={goToNext} className="h-8 w-8 rounded-lg">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}

        {/* Capacity status bar (desktop only) – only shown if user can read busy */}
        {!isMobile && canReadBusy && techCapacities.length > 0 && (
          <CapacityStatusBar
            techCapacities={techCapacities}
            todayDayIndex={todayDayIndex}
            onFilterClick={handleCapacityFilterClick}
            activeFilter={capacityFilter}
          />
        )}

        {/* Unplanned projects warning */}
        {!isMobile && <UnplannedProjectsBanner count={unplannedCount} />}

        {/* Unscheduled tasks strip */}
        <TaskResourceStrip
          technicianUserId={null}
          referenceDate={referenceDate}
        />

        {/* Interactive FullCalendar – swipe on mobile */}
        <div onTouchStart={isMobile ? handleTouchStart : undefined} onTouchEnd={isMobile ? handleTouchEnd : undefined}>
        <ResourceCalendar
          key={refreshKey}
          technicianId={capacityFilter !== "all" && filteredTechForSidebar
            ? (filteredTechForSidebar.size === 1 ? Array.from(filteredTechForSidebar)[0] : selectedTechId)
            : selectedTechId}
          referenceDate={referenceDate}
          calendarView={calendarView}
          technicianMap={technicianMap}
          getBusySlotsForDay={canReadBusy ? getBusySlotsForDay : undefined}
          dayCapacities={canReadBusy ? aggregatedDays : undefined}
          scheduleBlocks={scheduleBlocks}
          onEventClick={handleEventClick}
          onScheduleBlockClick={(block) => setSelectedBlock(block)}
          onDateSelect={canWriteEvents ? handleDateSelect : undefined}
          onEventDrop={canWriteEvents ? handleEventDrop : undefined}
          onEventResize={canWriteEvents ? handleEventResize : undefined}
          onExternalDrop={canWriteEvents ? handleExternalDrop : undefined}
          canWriteEvents={canWriteEvents}
          canViewExternalDetails={canViewExternal}
          canReadBusy={canReadBusy}
          hideExternalEvents={hideExternalEvents}
        />
        </div>

        {/* Mobile: tap on empty calendar slot handles creation via onDateSelect – no duplicate FAB needed */}
      </div>

      <EventDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        editEvent={editEvent}
        preselectedStart={preselectedStart}
        preselectedEnd={preselectedEnd}
        preselectedTechId={selectedTechId}
        scheduleBlockId={
          editEvent
            ? scheduleBlocks.find(
                (sb) => sb.project_id === editEvent.id || sb.mcs_block_id === editEvent.id
              )?.id ?? null
            : null
        }
        onSaved={(eventId) => {
          setRefreshKey((k) => k + 1);
          if (eventId) {
            if (editEvent) syncUpdate(eventId);
            else syncCreate(eventId);
          }
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
          onConfirmed={() => refetchBlocks()}
        />
      )}

      <DropConfirmPopover
        payload={dropPayload}
        onClose={() => setDropPayload(null)}
        onCreated={() => {
          setRefreshKey((k) => k + 1);
          refetchBlocks();
        }}
      />
    </div>
  );
}
