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
import { Lock, CalendarCheck, AlertTriangle, Globe, Monitor, MapPin, Moon, Users } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { TechAvatar } from "@/components/TechAvatar";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { toast } from "sonner";

interface TechLookup {
  name: string;
  color: string | null;
  avatarId?: string | null;
}

interface ResourceCalendarProps {
  technicianId: string | null;
  companyId?: string | null;
  referenceDate: Date;
  calendarView?: string;
  technicianMap: Map<string, TechLookup>;
  getBusySlotsForDay?: (date: Date) => ExternalBusySlot[];
  dayCapacities?: DayCapacity[];
  scheduleBlocks?: ScheduleBlock[];
  onEventClick?: (event: CalendarEvent, clickedTechId?: string) => void;
  onScheduleBlockClick?: (block: ScheduleBlock) => void;
  onDateSelect?: (start: Date, end: Date) => void;
  onEventDrop?: (eventId: string, newStart: Date, newEnd: Date) => void;
  onEventResize?: (eventId: string, newStart: Date, newEnd: Date) => void;
  onExternalDrop?: (info: { taskId: string; title: string; start: Date; end: Date; estimatedMinutes: number; priority: string; dropType: string }) => void;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
  canWriteEvents?: boolean;
  canViewExternalDetails?: boolean;
  canReadBusy?: boolean;
  hideExternalEvents?: boolean;
  slotMinTime?: string;
  slotMaxTime?: string;
  slotDuration?: string;
  operatingStartHour?: number;
  operatingEndHour?: number;
  hasNightHours?: boolean;
}

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

const statusDotColors: Record<string, string> = {
  planned: "#1E3A8A",
  requested: "#D97706",
  scheduled: "#2563EB",
  in_progress: "#059669",
  completed: "#6B7280",
  done: "#6B7280",
  invoiced: "#9CA3AF",
};

const matchStateColors: Record<string, { bg: string; border: string; text: string }> = {
  auto: { bg: "#059669", border: "#059669", text: "#FFFFFF" },
  confirmed: { bg: "#059669", border: "#059669", text: "#FFFFFF" },
  needs_confirmation: { bg: "#D97706", border: "#D97706", text: "#FFFFFF" },
  external: { bg: "#6B7280", border: "#6B7280", text: "#FFFFFF" },
  manual: { bg: "#2563EB", border: "#2563EB", text: "#FFFFFF" },
};

export const ResourceCalendar = memo(function ResourceCalendar({
  technicianId,
  companyId,
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
  canWriteEvents,
  canViewExternalDetails,
  canReadBusy = true,
  hideExternalEvents = false,
  slotMinTime = "07:00:00",
  slotMaxTime = "16:00:00",
  slotDuration = "00:30:00",
  operatingStartHour = 7,
  operatingEndHour = 16,
  hasNightHours = false,
}: ResourceCalendarProps) {
  const effectiveCanWrite = canWriteEvents ?? isAdmin;
  const effectiveCanViewExternal = canViewExternalDetails ?? isSuperAdmin;
  const calendarRef = useRef<FullCalendar>(null);
  const scopedTechnicianIds = useMemo(() => Array.from(technicianMap.keys()), [technicianMap]);
  const { events: calendarEvents } = useCalendarEvents(technicianId, referenceDate, companyId, scopedTechnicianIds);

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

  useEffect(() => {
    if (isDayView || calendarView === "timeGridWeek") {
      const api = calendarRef.current?.getApi();
      if (api) {
        setTimeout(() => api.scrollToTime(new Date().toTimeString().slice(0, 8)), 100);
      }
    }
  }, [isDayView, calendarView, referenceDate]);

  const [wrapperRef, setWrapperRef] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!wrapperRef || !hasNightHours) return;
    wrapperRef.classList.add("fc-night-shading");
    return () => { wrapperRef?.classList.remove("fc-night-shading"); };
  }, [hasNightHours, wrapperRef]);

  useEffect(() => {
    const handler = (e: Event) => {
      const time = (e as CustomEvent).detail as string;
      calendarRef.current?.getApi()?.scrollToTime(time);
    };
    window.addEventListener("resource-calendar:scroll-to", handler);
    return () => window.removeEventListener("resource-calendar:scroll-to", handler);
  }, []);

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
    const calEventRangesByTech = new Map<string, Array<{ start: number; end: number }>>();
    const assignmentMetaByEventTech = new Map<string, {
      eventId: string;
      technicianId: string;
      eventTechnicianId: string | null;
      calendarEventId: string | null;
      start: number;
      end: number;
      displayName: string;
    }>();

    const result: EventInput[] = [];

    // ── Assignment-based rendering (authoritative for internal/system jobs) ──
    for (const ev of calendarEvents) {
      const isOvernight = ev.start.toDateString() !== ev.end.toDateString();
      const multiTech = ev.technicians.length > 1;

      for (const tech of ev.technicians) {
        const ranges = calEventRangesByTech.get(tech.id) || [];
        ranges.push({ start: ev.start.getTime(), end: ev.end.getTime() });
        calEventRangesByTech.set(tech.id, ranges);

        assignmentMetaByEventTech.set(`${ev.id}::${tech.id}`, {
          eventId: ev.id,
          technicianId: tech.id,
          eventTechnicianId: tech.eventTechnicianId ?? null,
          calendarEventId: tech.calendarEventId ?? null,
          start: ev.start.getTime(),
          end: ev.end.getTime(),
          displayName: tech.name,
        });

        const techColor = techColorMap.get(tech.id) || GCAL_PALETTE[0];
        const techFirstName = tech.name.split(" ")[0];
        const allTechNames = ev.technicians.map((t) => t.name.split(" ")[0]).join(", ");
        const techInfo = technicianMap.get(tech.id);
        const renderKey = multiTech ? `${ev.id}__tech__${tech.id}` : ev.id;

        result.push({
          id: renderKey,
          title: ev.title.replace("SERVICE – ", ""),
          start: ev.start,
          end: ev.end,
          backgroundColor: techColor,
          borderColor: techColor,
          textColor: "#FFFFFF",
          extendedProps: {
            calendarEvent: ev,
            source: "calendar_event",
            renderKey,
            eventId: ev.id,
            eventTechnicianId: tech.eventTechnicianId ?? null,
            technicianId: tech.id,
            scheduleBlockId: null,
            calendarEventId: tech.calendarEventId ?? null,
            outlookEventId: null,
            displayName: tech.name,
            customer: ev.customer,
            status: ev.status,
            jobNumber: ev.internalNumber || ev.jobNumber || null,
            techNames: allTechNames,
            techName: techFirstName,
            techFullName: tech.name,
            techAvatarId: techInfo?.avatarId || null,
            baseColor: techColor,
            statusDot: statusDotColors[ev.status] || "#FFFFFF",
            isOvernight,
            isMultiTech: multiTech,
            assignedTechId: tech.id,
          },
          editable: effectiveCanWrite,
        });
      }
    }

    // External busy slots
    let missingNameCount = 0;
    if (getBusySlotsForDay && !hideExternalEvents) {
      const sbRangesByTech = new Map<string, Array<{ start: number; end: number }>>();
      for (const block of scheduleBlocks) {
        const ranges = sbRangesByTech.get(block.technician_id) || [];
        ranges.push({ start: block.start_at.getTime(), end: block.end_at.getTime() });
        sbRangesByTech.set(block.technician_id, ranges);
      }

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
          const tech = technicianMap.get(techId);
          if (!tech) continue;
          const merged = mergeExternalSlots(techSlots);
          const techSbRanges = sbRangesByTech.get(techId) || [];

          for (const slot of merged) {
            const slotStart = slot.start.getTime();
            const slotEnd = slot.end.getTime();
            // Widen tolerance to 65 minutes to catch timezone-shifted duplicates (±1h for CET/CEST)
            const TZ_TOLERANCE = 65 * 60000;
            const coveredBySb = techSbRanges.some(
              (r) => r.start <= slotStart + TZ_TOLERANCE && r.end >= slotEnd - TZ_TOLERANCE
            );
            if (coveredBySb) continue;

            const calRanges = calEventRangesByTech.get(techId) || [];
            const coveredByCalEvent = calRanges.some(
              (r) => r.start <= slotStart + TZ_TOLERANCE && r.end >= slotEnd - TZ_TOLERANCE
            );
            if (coveredByCalEvent) continue;

            const techName = tech?.name?.trim();
            const displayName = techName ? techName.split(" ")[0] : "Ukjent montør";
            if (!techName) missingNameCount++;
            const busyTechColor = techColorMap.get(techId) || GCAL_PALETTE[0];
            const maskedTitle = effectiveCanViewExternal ? `${displayName} – opptatt` : "Opptatt";
            const BUSY_GRAY = "#9CA3AF";
            result.push({
              id: `busy-${techId}-${slot.start.getTime()}`,
              title: maskedTitle,
              start: slot.start,
              end: slot.end,
              backgroundColor: effectiveCanViewExternal ? hexToRgba(busyTechColor, 0.25) : hexToRgba(BUSY_GRAY, 0.15),
              borderColor: effectiveCanViewExternal ? hexToRgba(busyTechColor, 0.5) : hexToRgba(BUSY_GRAY, 0.35),
              textColor: effectiveCanViewExternal ? busyTechColor : "#9CA3AF",
              editable: false,
              extendedProps: {
                source: "busy_slot",
                renderKey: `busy-${techId}-${slot.start.getTime()}`,
                eventId: null,
                eventTechnicianId: null,
                technicianId: techId,
                calendarEventId: null,
                displayName,
                isBusy: true,
                techName: effectiveCanViewExternal ? displayName : undefined,
                busyTechColor: effectiveCanViewExternal ? busyTechColor : BUSY_GRAY,
                busyTechId: techId,
                isExternalMasked: !effectiveCanViewExternal,
              },
            });
          }
        }
      }
    }

    // Build index of internal (non-outlook) schedule blocks per technician for dedup
    const TZ_TOLERANCE_DEDUP = 65 * 60000;
    const internalBlocksByTech = new Map<string, Array<{ start: number; end: number; projectId: string | null; jobNumber: string | null }>>();
    for (const block of scheduleBlocks) {
      if (block.source === "outlook") continue;
      const arr = internalBlocksByTech.get(block.technician_id) || [];
      arr.push({
        start: block.start_at.getTime(),
        end: block.end_at.getTime(),
        projectId: block.project_id,
        jobNumber: block.job_number ?? null,
      });
      internalBlocksByTech.set(block.technician_id, arr);
    }

    // Schedule blocks – suppress mirrored variants when authoritative assignment exists
    const seenScheduleBlockKeys = new Set<string>();
    for (const block of scheduleBlocks) {
      const isExternal = block.source === "outlook" && !block.project_id;
      if (hideExternalEvents && isExternal) continue;

      const assignmentMeta = block.project_id
        ? assignmentMetaByEventTech.get(`${block.project_id}::${block.technician_id}`)
        : null;
      const overlapsAuthoritativeAssignment = !!assignmentMeta
        && block.start_at.getTime() < assignmentMeta.end + TZ_TOLERANCE_DEDUP
        && block.end_at.getTime() > assignmentMeta.start - TZ_TOLERANCE_DEDUP;

      if (overlapsAuthoritativeAssignment) {
        console.info("[ResourceCalendar][SuppressMirrorBlock]", {
          source: block.source,
          event_id: block.project_id,
          event_technician_id: assignmentMeta?.eventTechnicianId ?? null,
          technician_id: block.technician_id,
          render_key: `sb-${block.id}`,
          schedule_block_id: block.id,
          calendar_event_id: assignmentMeta?.calendarEventId ?? null,
          outlook_event_id: block.outlook_event_id ?? null,
          display_name: assignmentMeta?.displayName ?? block.technician_name ?? null,
        });
        continue;
      }

      // Suppress Outlook blocks that mirror an internal block for same tech + same project/job + start within ±65min
      if (block.source === "outlook" && block.project_id) {
        const internals = internalBlocksByTech.get(block.technician_id) || [];
        const blockStart = block.start_at.getTime();
        const matchesInternal = internals.some((ib) => {
          const sameProject = ib.projectId && ib.projectId === block.project_id;
          const sameJob = ib.jobNumber && block.job_number && ib.jobNumber === block.job_number;
          const startClose = Math.abs(ib.start - blockStart) <= TZ_TOLERANCE_DEDUP;
          return (sameProject || sameJob) && startClose;
        });
        if (matchesInternal) {
          console.info("[ResourceCalendar][SuppressOutlookDuplicate]", {
            technician_id: block.technician_id,
            project_id: block.project_id,
            job_number: block.job_number,
            outlook_start: block.start_at.toISOString(),
            block_id: block.id,
          });
          continue;
        }
      }

      const techName = block.technician_name?.split(" ")[0] || "";
      const sourceLabel = block.source === "outlook" ? "Outlook" : "System";
      const displayTitle = block.outlook_subject || block.title || "Outlook-blokk";

      const normalizedTitle = displayTitle.trim().toLowerCase();
      const dedupKey = block.project_id
        ? `linked|${block.source}|${block.technician_id}|${block.project_id}|${block.start_at.toISOString()}|${block.end_at.toISOString()}|${normalizedTitle}`
        : `external|${block.source}|${block.technician_id}|${block.outlook_event_id || "no_external_id"}|${block.start_at.toISOString()}|${block.end_at.toISOString()}`;

      if (seenScheduleBlockKeys.has(dedupKey)) continue;
      seenScheduleBlockKeys.add(dedupKey);

      const masked = isExternal && !effectiveCanViewExternal;
      const BUSY_GRAY = "#9CA3AF";

      // Project-linked blocks inherit technician color for visual consistency
      const isLinkedToProject = !!block.project_id;
      const techColor = techColorMap.get(block.technician_id);
      const fallbackColors = matchStateColors[block.match_state] || matchStateColors.external;
      const useTechColor = isLinkedToProject && techColor;

      const renderKey = `sb-${block.id}`;

      result.push({
        id: renderKey,
        title: masked ? "Opptatt" : (isLinkedToProject ? (block.project_title || block.title || displayTitle) : displayTitle),
        start: block.start_at,
        end: block.end_at,
        backgroundColor: masked ? hexToRgba(BUSY_GRAY, 0.15) : (useTechColor ? hexToRgba(techColor, 0.85) : hexToRgba(fallbackColors.bg, 0.85)),
        borderColor: masked ? hexToRgba(BUSY_GRAY, 0.35) : (useTechColor ? techColor : fallbackColors.border),
        textColor: masked ? "#9CA3AF" : (useTechColor ? "#FFFFFF" : fallbackColors.text),
        editable: false,
        extendedProps: {
          source: "schedule_block",
          renderKey,
          eventId: block.project_id,
          eventTechnicianId: assignmentMeta?.eventTechnicianId ?? null,
          technicianId: block.technician_id,
          scheduleBlockId: block.id,
          calendarEventId: assignmentMeta?.calendarEventId ?? null,
          outlookEventId: block.outlook_event_id || null,
          displayName: masked ? undefined : (block.technician_name || techName),
          isScheduleBlock: true,
          scheduleBlock: masked ? null : block,
          isExternalMasked: masked,
          matchState: block.match_state,
          techName: masked ? undefined : techName,
          techFullName: masked ? undefined : block.technician_name,
          techAvatarId: masked ? undefined : (technicianMap.get(block.technician_id)?.avatarId || null),
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
          isLinkedToProject,
          assignedTechId: block.technician_id,
        },
      });
    }

    console.info(
      "[ResourceCalendar][RenderMap]",
      result.map((ev) => ({
        render_key: ev.id,
        source: (ev.extendedProps as any)?.source ?? "unknown",
        event_id: (ev.extendedProps as any)?.eventId ?? null,
        event_technician_id: (ev.extendedProps as any)?.eventTechnicianId ?? null,
        technician_id: (ev.extendedProps as any)?.technicianId ?? null,
        schedule_block_id: (ev.extendedProps as any)?.scheduleBlockId ?? null,
        calendar_event_id: (ev.extendedProps as any)?.calendarEventId ?? null,
        outlook_event_id: (ev.extendedProps as any)?.outlookEventId ?? null,
        display_name: (ev.extendedProps as any)?.displayName ?? null,
        title: ev.title,
        start: ev.start instanceof Date ? ev.start.toISOString() : ev.start,
        end: ev.end instanceof Date ? ev.end.toISOString() : ev.end,
      }))
    );

    return result;
  }, [calendarEvents, getBusySlotsForDay, technicianMap, techColorMap, referenceDate, effectiveCanWrite, effectiveCanViewExternal, hideExternalEvents, isMonthView, scheduleBlocks]);

  const handleEventClick = useCallback((info: EventClickArg) => {
    const props = info.event.extendedProps as Record<string, any>;

    console.info("[ResourceCalendar][Click]", {
      render_key: props.renderKey ?? info.event.id,
      source: props.source ?? "unknown",
      event_id: props.eventId ?? null,
      event_technician_id: props.eventTechnicianId ?? null,
      technician_id: props.technicianId ?? props.assignedTechId ?? null,
      schedule_block_id: props.scheduleBlockId ?? null,
      calendar_event_id: props.calendarEventId ?? null,
      outlook_event_id: props.outlookEventId ?? null,
      display_name: props.displayName ?? props.techFullName ?? props.techName ?? null,
      title: info.event.title,
      start: info.event.start?.toISOString?.() ?? null,
      end: info.event.end?.toISOString?.() ?? null,
      open_handler: "pending",
    });

    if (props.isExternalMasked) return;

    if (props.isScheduleBlock && props.scheduleBlock) {
      const scheduleBlock = props.scheduleBlock as ScheduleBlock;
      const matchingAssignmentEvent = scheduleBlock.project_id
        ? calendarEvents.find(
            (ev) =>
              ev.id === scheduleBlock.project_id
              && ev.technicians.some((t) => t.id === scheduleBlock.technician_id)
              && ev.start.getTime() < scheduleBlock.end_at.getTime()
              && ev.end.getTime() > scheduleBlock.start_at.getTime()
          )
        : undefined;

      if (matchingAssignmentEvent) {
        console.info("[ResourceCalendar][Click->EventDrawer]", {
          open_handler: "event_drawer(authoritative_assignment)",
          render_key: props.renderKey ?? info.event.id,
          source: props.source ?? "unknown",
          event_id: matchingAssignmentEvent.id,
          event_technician_id: props.eventTechnicianId ?? null,
          technician_id: scheduleBlock.technician_id,
          schedule_block_id: scheduleBlock.id,
          calendar_event_id: props.calendarEventId ?? null,
          outlook_event_id: props.outlookEventId ?? scheduleBlock.outlook_event_id ?? null,
          display_name: props.displayName ?? scheduleBlock.technician_name ?? null,
        });
        onEventClick?.(matchingAssignmentEvent, scheduleBlock.technician_id);
        return;
      }

      console.info("[ResourceCalendar][Click->ScheduleBlockDetail]", {
        open_handler: "schedule_block_detail_panel",
        render_key: props.renderKey ?? info.event.id,
        source: props.source ?? "unknown",
        event_id: scheduleBlock.project_id,
        event_technician_id: props.eventTechnicianId ?? null,
        technician_id: scheduleBlock.technician_id,
        schedule_block_id: scheduleBlock.id,
        calendar_event_id: props.calendarEventId ?? null,
        outlook_event_id: props.outlookEventId ?? scheduleBlock.outlook_event_id ?? null,
        display_name: props.displayName ?? scheduleBlock.technician_name ?? null,
      });
      onScheduleBlockClick?.(scheduleBlock);
      return;
    }

    if (props.isBusy) {
      const busyStart = info.event.start?.getTime() ?? 0;
      const busyEnd = info.event.end?.getTime() ?? busyStart;
      const busyTechId = props.busyTechId as string | undefined;
      if (busyTechId && scheduleBlocks.length > 0) {
        const match = scheduleBlocks.find(
          (sb) =>
            sb.technician_id === busyTechId &&
            sb.start_at.getTime() < busyEnd &&
            sb.end_at.getTime() > busyStart
        );
        if (match) {
          console.info("[ResourceCalendar][Click->ScheduleBlockDetail]", {
            open_handler: "schedule_block_detail_panel",
            render_key: props.renderKey ?? info.event.id,
            source: "busy_slot",
            event_id: match.project_id,
            event_technician_id: null,
            technician_id: match.technician_id,
            schedule_block_id: match.id,
            calendar_event_id: null,
            outlook_event_id: match.outlook_event_id ?? null,
            display_name: match.technician_name ?? null,
          });
          onScheduleBlockClick?.(match);
          return;
        }
      }
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
          description: `NO_MATCH: ${scheduleBlocks.length} schedule_blocks vurdert`,
          match_confidence: 0,
          match_reason: `Debug: busy slot uten schedule_block.`,
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
        console.info("[ResourceCalendar][Click->ScheduleBlockDetail]", {
          open_handler: "schedule_block_detail_panel(debug_busy)",
          render_key: props.renderKey ?? info.event.id,
          source: "busy_slot",
          event_id: null,
          event_technician_id: null,
          technician_id: debugBlock.technician_id,
          schedule_block_id: debugBlock.id,
          calendar_event_id: null,
          outlook_event_id: null,
          display_name: debugBlock.technician_name ?? null,
        });
        onScheduleBlockClick(debugBlock);
      }
      return;
    }

    const calEvent = props.calendarEvent as CalendarEvent | undefined;
    if (calEvent) {
      console.info("[ResourceCalendar][Click->EventDrawer]", {
        open_handler: "event_drawer",
        render_key: props.renderKey ?? info.event.id,
        source: props.source ?? "calendar_event",
        event_id: calEvent.id,
        event_technician_id: props.eventTechnicianId ?? null,
        technician_id: (props.assignedTechId as string | undefined) ?? (props.technicianId as string | undefined) ?? null,
        schedule_block_id: props.scheduleBlockId ?? null,
        calendar_event_id: props.calendarEventId ?? null,
        outlook_event_id: props.outlookEventId ?? null,
        display_name: props.displayName ?? props.techFullName ?? props.techName ?? null,
      });
      const clickedTechId = (props.assignedTechId as string | undefined) ?? (props.technicianId as string | undefined) ?? undefined;
      onEventClick?.(calEvent, clickedTechId);
    }
  }, [calendarEvents, onEventClick, onScheduleBlockClick, scheduleBlocks]);

  const handleDateSelect = useCallback((info: DateSelectArg) => {
    if (effectiveCanWrite) onDateSelect?.(info.start, info.end);
  }, [effectiveCanWrite, onDateSelect]);

  const handleEventDrop = useCallback((info: EventDropArg) => {
    if (info.event.extendedProps.isBusy) { info.revert(); return; }
    // Extract real event ID from composite ID
    const rawId = info.event.id;
    const realId = rawId.includes("__tech__") ? rawId.split("__tech__")[0] : rawId;
    onEventDrop?.(realId, info.event.start!, info.event.end!);
  }, [onEventDrop]);

  const handleEventResize = useCallback((info: any) => {
    if (info.event.extendedProps.isBusy) { info.revert(); return; }
    const rawId = info.event.id;
    const realId = rawId.includes("__tech__") ? rawId.split("__tech__")[0] : rawId;
    onEventResize?.(realId, info.event.start!, info.event.end!);
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
    <div ref={setWrapperRef} className="fc-wrapper rounded-2xl border border-border/30 bg-card shadow-card overflow-hidden">
      <FullCalendar
        key={`fc-${hideExternalEvents ? "hide" : "show"}`}
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
        initialView={calendarView}
        initialDate={referenceDate}
        headerToolbar={false}
        locale="nb"
        firstDay={1}
        height={800}
        scrollTimeReset={false}
        allDaySlot={false}
        slotMinTime={slotMinTime}
        slotMaxTime={slotMaxTime}
        slotDuration={slotDuration}
        slotLabelInterval="01:00:00"
        slotLabelFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
        weekends={true}
        nowIndicator={true}
        selectable={effectiveCanWrite}
        selectMirror={true}
        editable={effectiveCanWrite}
        eventDurationEditable={effectiveCanWrite}
        eventStartEditable={effectiveCanWrite}
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
        eventOrder="start,-duration,allDay,title"
        eventMaxStack={4}
        eventMinHeight={32}
        eventContent={(arg) => {
          const props = arg.event.extendedProps;

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
                  <div className="px-2 py-1 overflow-hidden h-full cursor-pointer select-none">
                    <div className="flex items-center gap-1">
                      {props.techAvatarId ? (
                        <TechAvatar name={props.techFullName || props.techName || ""} avatarId={props.techAvatarId} size={20} />
                      ) : (
                        <StateIcon className="h-3 w-3 shrink-0 opacity-80" />
                      )}
                      <p className="text-[11px] font-bold leading-tight truncate">
                        {props.techName}
                      </p>
                      <span className="ml-auto flex items-center gap-0.5 text-[7px] font-semibold uppercase tracking-wider opacity-60 bg-white/15 rounded px-1 shrink-0">
                        <SourceIcon className="h-2 w-2" />
                        {props.sourceLabel}
                      </span>
                    </div>
                    <p className="text-[10px] font-medium truncate mt-0.5">{arg.event.title}</p>
                    {props.projectTitle && (
                      <p className="text-[9px] opacity-70 truncate">{props.projectTitle}</p>
                    )}
                    <span className="text-[8px] opacity-50 block">{arg.timeText}</span>
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
                {props.techName && <span className="text-[9px] opacity-60 truncate">· {props.techName}</span>}
              </div>
            );
          }

          // Day/Week view – busy slot
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
                  <div className="fc-event-external flex items-center gap-1.5 px-2 py-1 cursor-pointer select-none h-full">
                    <Lock className="h-3 w-3 opacity-50 shrink-0" />
                    <div className="min-w-0 flex-1">
                      {props.techName && (
                        <p className="text-[10px] font-bold truncate">{props.techName}</p>
                      )}
                      <span className="text-[9px] font-medium truncate block">Opptatt</span>
                      <span className="text-[8px] opacity-60">{arg.timeText}</span>
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top">{busyTooltip}</TooltipContent>
              </Tooltip>
            );
          }

          // ── Regular event – assignment-based block ──
          const eventTooltip = (
            <div className="space-y-1 text-xs max-w-[240px]">
              <p className="font-semibold">{arg.event.title}</p>
              {props.jobNumber && <p className="font-mono text-[10px] text-white/80">{props.jobNumber}</p>}
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
                  className="fc-event-internal px-2 py-1 overflow-hidden h-full cursor-grab active:cursor-grabbing select-none"
                >
                  <div className="flex items-center gap-1">
                    {props.techAvatarId && (
                      <TechAvatar name={props.techFullName || props.techName || ""} avatarId={props.techAvatarId} size={20} />
                    )}
                    {props.isOvernight && (
                      <Moon className="h-2.5 w-2.5 shrink-0 text-white/80" />
                    )}
                    <p className="text-[11px] font-bold leading-tight truncate text-white/90">
                      {props.techName}
                    </p>
                    {props.isMultiTech && (
                      <Users className="h-2.5 w-2.5 shrink-0 text-white/60" />
                    )}
                    {props.jobNumber && (
                      <span className="text-[8px] font-mono font-semibold bg-white/20 text-white/90 rounded px-1 shrink-0 ml-auto">
                        {props.jobNumber}
                      </span>
                    )}
                    {!props.jobNumber && (
                      <span
                        className="h-1.5 w-1.5 rounded-full shrink-0 ml-auto border border-white/30"
                        style={{ backgroundColor: props.statusDot }}
                      />
                    )}
                  </div>
                  <p className="text-[11px] font-semibold leading-tight truncate text-white">
                    {arg.event.title}
                  </p>
                  {props.customer && (
                    <p className="text-[9px] text-white/70 truncate">{props.customer}</p>
                  )}
                  <span className="text-[8px] text-white/50 block">{arg.timeText}</span>
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
            <div className={`py-1.5 text-center ${isToday ? "text-primary font-bold" : ""}`}>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {arg.date.toLocaleDateString("nb-NO", { weekday: "short" })}
              </div>
              <div className={`text-base font-bold ${isToday ? "text-primary" : ""}`}>
                {arg.date.getDate()}
              </div>
              {dayCap && !isMonthView && (
                <div className="mt-0.5 flex flex-col items-center gap-0.5">
                  <div className="w-8 h-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(dayCap.percent, 100)}%`,
                        backgroundColor: dayCap.color,
                      }}
                    />
                  </div>
                  <span className="text-[8px] font-semibold" style={{ color: dayCap.color }}>
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
