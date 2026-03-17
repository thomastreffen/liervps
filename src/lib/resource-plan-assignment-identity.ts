import type { CalendarEvent, TechnicianInfo } from "@/hooks/useCalendarEvents";
import type { ScheduleBlock } from "@/hooks/useScheduleBlocks";

export interface RenderableAssignment {
  assignmentKey: string;
  event: CalendarEvent;
  technician: TechnicianInfo;
  isMultiTech: boolean;
  technicianNames: string;
}

export function getAssignmentLookupKey(eventId: string, technicianId: string) {
  return `${eventId}::${technicianId}`;
}

export function getRenderableAssignments(
  calendarEvents: CalendarEvent[],
  technicianFilterId: string | null
): RenderableAssignment[] {
  const assignments: RenderableAssignment[] = [];

  for (const event of calendarEvents) {
    const visibleTechnicians = technicianFilterId
      ? event.technicians.filter((tech) => tech.id === technicianFilterId)
      : event.technicians;

    if (visibleTechnicians.length === 0) continue;

    const isMultiTech = event.technicians.length > 1;
    const technicianNames = event.technicians.map((tech) => tech.name.split(" ")[0]).join(", ");

    for (const technician of visibleTechnicians) {
      assignments.push({
        assignmentKey: isMultiTech ? `${event.id}__tech__${technician.id}` : event.id,
        event,
        technician,
        isMultiTech,
        technicianNames,
      });
    }
  }

  return assignments;
}

export function filterScheduleBlocksByTechnician(
  scheduleBlocks: ScheduleBlock[],
  technicianFilterId: string | null
) {
  return technicianFilterId
    ? scheduleBlocks.filter((block) => block.technician_id === technicianFilterId)
    : scheduleBlocks;
}

export function findScheduleBlockForAssignment(
  scheduleBlocks: ScheduleBlock[],
  eventId: string,
  technicianId?: string | null
) {
  return scheduleBlocks.find(
    (block) =>
      (block.project_id === eventId || block.mcs_block_id === eventId)
      && (!technicianId || block.technician_id === technicianId)
  ) ?? null;
}

export function findLinkedScheduleBlockIds(
  scheduleBlocks: ScheduleBlock[],
  eventId: string,
  technicianId?: string | null
) {
  return scheduleBlocks
    .filter(
      (block) =>
        (block.project_id === eventId || block.mcs_block_id === eventId)
        && (!technicianId || block.technician_id === technicianId)
    )
    .map((block) => block.id);
}
