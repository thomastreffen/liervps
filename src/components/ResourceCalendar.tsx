import { useRef, useCallback, useMemo, useEffect, useState, memo } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import type { EventInput, EventDropArg, DateSelectArg, EventClickArg } from "@fullcalendar/core";
import { useCalendarEvents, type CalendarEvent } from "@/hooks/useCalendarEvents";
import type { ExternalBusySlot } from "@/hooks/useExternalBusy";
import type { DayCapacity } from "@/hooks/useCapacity";
import type { ScheduleBlock } from "@/hooks/useScheduleBlocks";
import { Lock, CalendarCheck, AlertTriangle, Globe, Monitor, MapPin } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { toast } from "sonner";

interface TechLookup {
  name: string;
  color: string | null;
}

interface ResourceCalendarProps {
  technicianId: string | null;
  referenceDate: Date;
  calendarView?: string;
  technicianMap: Map<string, TechLookup>;
  getBusySlotsForDay?: (date: Date) => ExternalBusySlot[];
  dayCapacities?: DayCapacity[];
  scheduleBlocks?: ScheduleBlock[];
  onEventClick?: (event: CalendarEvent) => void;
  onScheduleBlockClick?: (block: ScheduleBlock) => void;
  onDateSelect?: (start: Date, end: Date) => void;
  onEventDrop?: (eventId: string, newStart: Date, newEnd: Date) => void;
  onEventResize?: (eventId: string, newStart: Date, newEnd: Date) => void;
  onExternalDrop?: (info: { taskId: string; title: string; start: Date; end: Date; estimatedMinutes: number; priority: string; dropType: string }) => void;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
  hideExternalEvents?: boolean;
}

/** Merge overlapping external slots into contiguous blocks */
function mergeExternalSlots(slots: ExternalBusySlot[]): ExternalBusySlot[] {
  if (slots.length <= 1) return slots;
  const sorted = [...slots].sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: ExternalBusySlot[] = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    if (sorted[i].start <= last.end) {
      if (sorted[i].end > last.end) last.end = sorted[i].end;
    } else {
      merged.push({ ...sorted[i] });
    }
  }
  return merged;
}

/** Vivid, distinct colors for each technician – Google Calendar style */
const GCAL_PALETTE = [
  "#D50000", "#F4511E", "#E67C73", "#F09300",
  "#009688", "#0B8043", "#33B679", "#7CB342",
  "#039BE5", "#3F51B5", "#7986CB", "#8E24AA",
  "#616161", "#795548",
];

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Status indicator dot colors */
const statusDotColors: Record<string, string> = {
  planned: "#1E3A8A",
  requested: "#D97706",
  scheduled: "#2563EB",
  in_progress: "#059669",
  completed: "#6B7280",
  done: "#6B7280",
  invoiced: "#9CA3AF",
};

/** Match state color map */
const matchStateColors: Record<string, { bg: string; border: string; text: string }> = {
  auto: { bg: "#059669", border: "#059669", text: "#FFFFFF" },
  confirmed: { bg: "#059669", border: "#059669", text: "#FFFFFF" },
  needs_confirmation: { bg: "#D97706", border: "#D97706", text: "#FFFFFF" },
  external: { bg: "#6B7280", border: "#6B7280", text: "#FFFFFF" },
  manual: { bg: "#2563EB", border: "#2563EB", text: "#FFFFFF" },
};

export const ResourceCalendar = memo(function ResourceCalendar({
  technicianId,
  referenceDate,
  calendarView = "timeGridWeek",
  technicianMap,
  getBusySlotsForDay,
  dayCapacities,
  scheduleBlocks = [],
  onEventClick,
  onScheduleBlockClick,
  onDateSelect,
  onEventDrop,
  onEventResize,
  onExternalDrop,
  isAdmin = false,
  isSuperAdmin = false,
  hideExternalEvents = false,
}: ResourceCalendarProps) {
  const calendarRef = useRef<FullCalendar>(null);
  const { events: calendarEvents } = useCalendarEvents(technicianId, referenceDate);

  const isMonthView = calendarView === "dayGridMonth";
  const isDayView = calendarView === "timeGridDay";

  useEffect(() => {
    const api = calendarRef.current?.getApi();
    if (api) {
      api.gotoDate(referenceDate);
      if (api.view.type !== calendarView) {
        api.changeView(calendarView);
      }
    }
  }, [referenceDate, calendarView]);

  // Scroll to current time in day view
  useEffect(() => {
    if (isDayView) {
      const api = calendarRef.current?.getApi();
      if (api) api.scrollToTime(new Date().toTimeString().slice(0, 8));
    }
  }, [isDayView, calendarView]);

  // Build a stable color assignment per technician (Google Calendar style)
  const techColorMap = useMemo(() => {
    const map = new Map<string, string>();
    let idx = 0;
    for (const [techId, info] of technicianMap) {
      map.set(techId, info.color || GCAL_PALETTE[idx % GCAL_PALETTE.length]);
      idx++;
    }
    return map;
  }, [technicianMap]);

  const fcEvents: EventInput[] = useMemo(() => {
    const result: EventInput[] = calendarEvents.map((ev) => {
      const techNames = ev.technicians.map((t) => t.name.split(" ")[0]).join(", ");
      const firstTechId = ev.technicians[0]?.id;
      const baseColor = (firstTechId && techColorMap.get(firstTechId)) || GCAL_PALETTE[0];
      return {
        id: ev.id,
        title: ev.title.replace("SERVICE – ", ""),
        start: ev.start,
        end: ev.end,
        backgroundColor: baseColor,
        borderColor: baseColor,
        textColor: "#FFFFFF",
        extendedProps: {
          calendarEvent: ev,
          customer: ev.customer,
          status: ev.status,
          techNames,
          baseColor,
          statusDot: statusDotColors[ev.status] || "#FFFFFF",
        },
        editable: isAdmin,
      };
    });

    // External busy slots – merged and solid
    let missingNameCount = 0;
    if (getBusySlotsForDay) {
      const weekStart = new Date(referenceDate);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
      const daysToRender = isMonthView ? 42 : 7;
      for (let i = 0; i < daysToRender; i++) {
        const day = new Date(weekStart);
        day.setDate(day.getDate() + i);
        const rawSlots = getBusySlotsForDay(day);
        const byTech = new Map<string, ExternalBusySlot[]>();
        for (const s of rawSlots) {
          const arr = byTech.get(s.technicianId) || [];
          arr.push(s);
          byTech.set(s.technicianId, arr);
        }
        for (const [techId, techSlots] of byTech) {
          // Only show busy slots for technicians in the active plannable set
          const tech = technicianMap.get(techId);
          if (!tech) {
            console.debug(`[ResourceCalendar] Skipping ${techSlots.length} busy slot(s) for non-plannable techId=${techId}`);
            continue;
          }
          const merged = mergeExternalSlots(techSlots);
          for (const slot of merged) {
            const techName = tech?.name?.trim();
            const displayName = techName
              ? techName.split(" ")[0]
              : "Ukjent montør";
            if (!techName) {
              missingNameCount++;
              console.warn(`[ResourceCalendar] Busy slot missing technician name – techId=${techId}, slot=${slot.start.toISOString()}`);
            }
            const busyTechColor = techColorMap.get(techId) || GCAL_PALETTE[0];
            // Privacy: non-superadmins see only "Opptatt" without names
            const maskedTitle = isSuperAdmin ? `${displayName} – opptatt` : "Opptatt";
            const BUSY_GRAY = "#9CA3AF";
            result.push({
              id: `busy-${techId}-${slot.start.getTime()}`,
              title: maskedTitle,
              start: slot.start,
              end: slot.end,
              backgroundColor: isSuperAdmin ? hexToRgba(busyTechColor, 0.25) : hexToRgba(BUSY_GRAY, 0.15),
              borderColor: isSuperAdmin ? hexToRgba(busyTechColor, 0.5) : hexToRgba(BUSY_GRAY, 0.35),
              textColor: isSuperAdmin ? busyTechColor : "#9CA3AF",
              editable: false,
              extendedProps: {
                isBusy: true,
                techName: isSuperAdmin ? displayName : undefined,
                busyTechColor: isSuperAdmin ? busyTechColor : BUSY_GRAY,
                busyTechId: techId,
                isExternalMasked: !isSuperAdmin,
              },
            });
          }
        }
      }
    }

    if (missingNameCount > 0) {
      console.warn(`[ResourceCalendar] ${missingNameCount} busy slot(s) rendered with missing technician displayName`);
    }

    // Schedule blocks (Outlook-synced)
    for (const block of scheduleBlocks) {
      const isExternal = block.source === "outlook" && !block.project_id;

      // If hideExternalEvents is on AND block is unlinked external → skip entirely
      if (hideExternalEvents && isExternal) continue;

      const colors = matchStateColors[block.match_state] || matchStateColors.external;
      const techName = block.technician_name?.split(" ")[0] || "";
      const sourceLabel = block.source === "outlook" ? "Outlook" : "System";
      // Use outlook_subject for display title when available
      const displayTitle = block.outlook_subject || block.title || "Outlook-blokk";

      // Privacy: non-superadmins see masked external blocks
      const masked = isExternal && !isSuperAdmin;
      const BUSY_GRAY = "#9CA3AF";

      result.push({
        id: `sb-${block.id}`,
        title: masked ? "Opptatt" : displayTitle,
        start: block.start_at,
        end: block.end_at,
        backgroundColor: masked ? hexToRgba(BUSY_GRAY, 0.15) : hexToRgba(colors.bg, 0.85),
        borderColor: masked ? hexToRgba(BUSY_GRAY, 0.35) : colors.border,
        textColor: masked ? "#9CA3AF" : colors.text,
        editable: false,
        extendedProps: {
          isScheduleBlock: true,
          scheduleBlock: masked ? null : block,
          isExternalMasked: masked,
          matchState: block.match_state,
          techName: masked ? undefined : techName,
          projectTitle: masked ? undefined : block.project_title,
          sourceLabel,
          blockSource: block.source,
          matchConfidence: masked ? undefined : block.match_confidence,
          matchReason: masked ? undefined : block.match_reason,
          blockStartAt: block.start_at,
          blockEndAt: block.end_at,
          outlookLocation: masked ? undefined : block.outlook_location,
          aiConfidence: masked ? undefined : block.ai_confidence,
          aiMatchReason: masked ? undefined : block.ai_match_reason,
        },
      });
    }

    return result;
  }, [calendarEvents, getBusySlotsForDay, technicianMap, techColorMap, referenceDate, isAdmin, isSuperAdmin, hideExternalEvents, isMonthView, scheduleBlocks]);

  const handleEventClick = useCallback((info: EventClickArg) => {
    const props = info.event.extendedProps;

    // Block clicks on masked external events for non-superadmins
    if (props.isExternalMasked) return;

    // Schedule block click → always open side panel
    if (props.isScheduleBlock && props.scheduleBlock) {
      toast.info(`Clicked block: sb-${(props.scheduleBlock as ScheduleBlock).id.slice(0, 8)}`);
      onScheduleBlockClick?.(props.scheduleBlock as ScheduleBlock);
      return;
    }

    // Busy slot click → find matching schedule_block by technician + time overlap
    if (props.isBusy) {
      const busyStart = info.event.start?.getTime() ?? 0;
      const busyEnd = info.event.end?.getTime() ?? busyStart;
      const busyTechId = props.busyTechId as string | undefined;
      toast.info(`Clicked busy slot: tech=${busyTechId?.slice(0,8)}, blocks=${scheduleBlocks.length}`);
      if (busyTechId && scheduleBlocks.length > 0) {
        const match = scheduleBlocks.find(
          (sb) =>
            sb.technician_id === busyTechId &&
            sb.start_at.getTime() < busyEnd &&
            sb.end_at.getTime() > busyStart
        );
        if (match) {
          onScheduleBlockClick?.(match);
          return;
        }
      }
      // No matching schedule_block – open debug panel with synthetic block
      if (busyTechId && onScheduleBlockClick) {
        const debugBlock: ScheduleBlock = {
          id: `debug-${busyTechId}-${busyStart}`,
          company_id: "",
          technician_id: busyTechId,
          project_id: null,
          outlook_event_id: null,
          calendar_id: null,
          source: "outlook",
          start_at: info.event.start || new Date(busyStart),
          end_at: info.event.end || new Date(busyEnd),
          title: props.techName ? `${props.techName} – opptatt` : "Opptatt",
          location: null,
          description: `NO_MATCH: ${scheduleBlocks.length} schedule_blocks vurdert, ingen traff for tech=${busyTechId}`,
          match_confidence: 0,
          match_reason: `Debug: busy slot uten schedule_block. Checked ${scheduleBlocks.filter(sb => sb.technician_id === busyTechId).length} blocks for this tech.`,
          match_state: "external",
          mcs_block_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          outlook_subject: props.techName ? `${props.techName} – opptatt (ekstern)` : "Opptatt (ekstern)",
          outlook_location: null,
          outlook_preview: null,
          outlook_weblink: null,
          outlook_organizer: null,
          ai_match_reason: null,
          ai_confidence: null,
          technician_name: props.techName || "Ukjent",
          technician_color: props.busyTechColor || null,
          project_title: null,
        };
        onScheduleBlockClick(debugBlock);
      }
      return;
    }

    // Regular calendar event → check if a schedule_block covers it first
    const calEvent = props.calendarEvent as CalendarEvent | undefined;
    if (calEvent) {
      toast.info(`Clicked event: ${calEvent.id.slice(0, 8)}`);
      const evStart = info.event.start?.getTime() ?? 0;
      const evEnd = info.event.end?.getTime() ?? evStart;
      const matchBlock = scheduleBlocks.find(
        (sb) =>
          sb.start_at.getTime() < evEnd &&
          sb.end_at.getTime() > evStart &&
          (sb.project_id === calEvent.id ||
           sb.mcs_block_id === calEvent.id)
      );
      if (matchBlock) {
        onScheduleBlockClick?.(matchBlock);
        return;
      }
      onEventClick?.(calEvent);
    }
  }, [onEventClick, onScheduleBlockClick, scheduleBlocks]);

  const handleDateSelect = useCallback((info: DateSelectArg) => {
    if (isAdmin) onDateSelect?.(info.start, info.end);
  }, [isAdmin, onDateSelect]);

  const handleEventDrop = useCallback((info: EventDropArg) => {
    if (info.event.extendedProps.isBusy) { info.revert(); return; }
    onEventDrop?.(info.event.id, info.event.start!, info.event.end!);
  }, [onEventDrop]);

  const handleEventResize = useCallback((info: any) => {
    if (info.event.extendedProps.isBusy) { info.revert(); return; }
    onEventResize?.(info.event.id, info.event.start!, info.event.end!);
  }, [onEventResize]);

  const handleExternalDrop = useCallback((info: any) => {
    const props = info.draggedEl?.dataset || {};
    const taskId = props.taskId || "";
    const title = props.taskTitle || "Oppgave";
    const minutes = parseInt(props.taskMinutes || "60", 10);
    const priority = props.taskPriority || "normal";
    const dropType = props.taskType || "task";
    const start = info.date as Date;
    const end = new Date(start.getTime() + minutes * 60000);
    onExternalDrop?.({ taskId, title, start, end, estimatedMinutes: minutes, priority, dropType });
  }, [onExternalDrop]);

  return (
    <TooltipProvider delayDuration={300}>
    <div className="fc-wrapper rounded-2xl border border-border/30 bg-card shadow-card overflow-hidden">
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
        initialView={calendarView}
        initialDate={referenceDate}
        headerToolbar={false}
        locale="nb"
        firstDay={1}
        height="auto"
        allDaySlot={false}
        slotMinTime="07:00:00"
        slotMaxTime="16:00:00"
        slotDuration="00:30:00"
        slotLabelInterval="01:00:00"
        slotLabelFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
        weekends={true}
        nowIndicator={true}
        selectable={isAdmin}
        selectMirror={true}
        editable={isAdmin}
        eventDurationEditable={isAdmin}
        eventStartEditable={isAdmin}
        snapDuration="00:15:00"
        droppable={true}
        drop={handleExternalDrop}
        events={fcEvents}
        eventClick={handleEventClick}
        select={handleDateSelect}
        eventDrop={handleEventDrop}
        eventResize={handleEventResize}
        slotEventOverlap={true}
        eventOverlap={true}
        eventMaxStack={3}
        eventMinHeight={36}
        eventContent={(arg) => {
          const props = arg.event.extendedProps;

          // List view – simple text
          if (calendarView === "listWeek") return undefined;

          // Schedule block rendering
          if (props.isScheduleBlock) {
            const StateIcon = props.matchState === "needs_confirmation" ? AlertTriangle
              : props.matchState === "external" ? Globe : CalendarCheck;
            const SourceIcon = props.blockSource === "outlook" ? CalendarCheck : Monitor;

            const tooltipContent = (
              <div className="space-y-1 text-xs max-w-[220px]">
                <p className="font-semibold">{arg.event.title}</p>
                <p className="text-muted-foreground">
                  {props.blockStartAt ? format(props.blockStartAt, "EEE d. MMM HH:mm", { locale: nb }) : ""} – {props.blockEndAt ? format(props.blockEndAt, "HH:mm") : ""}
                </p>
                {props.projectTitle && <p>Prosjekt: {props.projectTitle}</p>}
                <p>Kilde: {props.sourceLabel}</p>
                {props.matchState === "needs_confirmation" && (
                  <>
                    <p className="text-amber-400">⚠ Trenger bekreftelse ({props.matchConfidence}%)</p>
                    {props.matchReason && <p className="text-muted-foreground italic">{props.matchReason}</p>}
                  </>
                )}
                {props.aiConfidence > 0 && (
                  <p className="text-primary">✨ AI: {props.aiMatchReason || `${props.aiConfidence}%`}</p>
                )}
              </div>
            );

            if (isMonthView) {
              return (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 px-1 py-0.5 text-[10px] truncate">
                      <StateIcon className="h-2.5 w-2.5 shrink-0 opacity-80" />
                      <span className="truncate">{arg.event.title}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top">{tooltipContent}</TooltipContent>
                </Tooltip>
              );
            }
            return (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="px-2 py-1.5 overflow-hidden h-full cursor-pointer select-none">
                    <div className="flex items-center gap-1.5">
                      <StateIcon className="h-3 w-3 shrink-0 opacity-80" />
                      <p className="text-[12px] font-bold leading-tight truncate">
                        {props.techName}
                      </p>
                      <span className="ml-auto flex items-center gap-0.5 text-[8px] font-semibold uppercase tracking-wider opacity-70 bg-white/15 rounded px-1 py-px shrink-0">
                        <SourceIcon className="h-2.5 w-2.5" />
                        {props.sourceLabel}
                      </span>
                    </div>
                    <p className="text-[11px] font-medium truncate mt-0.5">{arg.event.title}</p>
                    {props.projectTitle && (
                      <p className="text-[10px] opacity-75 truncate mt-0.5">{props.projectTitle}</p>
                    )}
                    <span className="text-[9px] opacity-60 mt-0.5 block">{arg.timeText}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top">{tooltipContent}</TooltipContent>
              </Tooltip>
            );
          }

          // Month view – compact
          if (isMonthView) {
            if (props.isBusy) {
              return (
                <div className="flex items-center gap-1 px-1 py-0.5 text-[10px] truncate cursor-pointer">
                   <Lock className="h-2.5 w-2.5 opacity-50 shrink-0" />
                   <span className="truncate">{props.techName || "Ukjent montør"}</span>
                </div>
              );
            }
            return (
              <div className="flex items-center gap-1 px-1 py-0.5 overflow-hidden">
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: props.baseColor }}
                />
                <span className="text-[10px] font-semibold truncate text-white">{arg.event.title}</span>
                {props.techNames && <span className="text-[9px] opacity-60 truncate">· {props.techNames}</span>}
              </div>
            );
          }

          // Day/Week view – detailed
          if (props.isBusy) {
            const busyTooltip = (
              <div className="space-y-1 text-xs max-w-[220px]">
                <p className="font-semibold">{props.techName || "Ukjent montør"} – Opptatt</p>
                <p className="text-muted-foreground">{arg.timeText}</p>
                <p className="text-muted-foreground">Ekstern kalenderavtale</p>
              </div>
            );
            return (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="fc-event-external flex items-center gap-1.5 px-2 py-1.5 cursor-pointer select-none h-full">
                    <Lock className="h-3 w-3 opacity-50 shrink-0" />
                    <div className="min-w-0 flex-1">
                      {props.techName && (
                        <p className="text-[11px] font-bold truncate">{props.techName}</p>
                      )}
                      <span className="text-[10px] font-medium truncate block">Opptatt</span>
                      <span className="text-[9px] opacity-70">{arg.timeText}</span>
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top">{busyTooltip}</TooltipContent>
              </Tooltip>
            );
          }

          // Regular event tooltip
          const eventTooltip = (
            <div className="space-y-1 text-xs max-w-[240px]">
              <p className="font-semibold">{arg.event.title}</p>
              {props.customer && <p className="text-muted-foreground">Kunde: {props.customer}</p>}
              <p className="text-muted-foreground">{arg.timeText}</p>
              {props.techNames && <p>Montører: {props.techNames}</p>}
              {props.calendarEvent?.address && (
                <p className="flex items-center gap-1">
                  <MapPin className="h-3 w-3 shrink-0" />
                  {props.calendarEvent.address}
                </p>
              )}
            </div>
          );

          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="fc-event-internal px-2 py-1.5 overflow-hidden h-full cursor-grab active:cursor-grabbing select-none"
                >
                  <div className="flex items-center gap-1.5">
                    {props.techNames && (
                      <p className="text-[12px] font-bold leading-tight truncate text-white/90">
                        {props.techNames}
                      </p>
                    )}
                    <span
                      className="h-1.5 w-1.5 rounded-full shrink-0 border border-white/30"
                      style={{ backgroundColor: props.statusDot }}
                    />
                  </div>
                  <p className="text-[13px] font-semibold leading-tight truncate mt-0.5 text-white">
                    {arg.event.title}
                  </p>
                  {props.customer && (
                    <p className="text-[11px] text-white/75 truncate mt-0.5">{props.customer}</p>
                  )}
                  <span className="text-[10px] text-white/60 mt-0.5 block">{arg.timeText}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top">{eventTooltip}</TooltipContent>
            </Tooltip>
          );
        }}
        dayHeaderContent={(arg) => {
          const isToday = new Date().toDateString() === arg.date.toDateString();
          const dayCap = dayCapacities?.find(
            (d) => d.date.toDateString() === arg.date.toDateString()
          );
          return (
            <div className={`py-2 text-center ${isToday ? "text-primary font-bold" : ""}`}>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {arg.date.toLocaleDateString("nb-NO", { weekday: "short" })}
              </div>
              <div className={`text-lg font-bold ${isToday ? "text-primary" : ""}`}>
                {arg.date.getDate()}
              </div>
              {dayCap && !isMonthView && (
                <div className="mt-1 flex flex-col items-center gap-0.5">
                  <div className="w-10 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(dayCap.percent, 100)}%`,
                        backgroundColor: dayCap.color,
                      }}
                    />
                  </div>
                  <span className="text-[9px] font-semibold" style={{ color: dayCap.color }}>
                    {dayCap.label}
                  </span>
                </div>
              )}
            </div>
          );
        }}
        loading={() => {}}
      />
    </div>
    </TooltipProvider>
  );
});