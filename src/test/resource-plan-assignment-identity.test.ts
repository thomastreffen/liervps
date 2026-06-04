import { describe, expect, it } from "vitest";
import type { CalendarEvent } from "@/hooks/useCalendarEvents";
import type { ScheduleBlock } from "@/hooks/useScheduleBlocks";
import {
  filterScheduleBlocksByTechnician,
  findScheduleBlockForAssignment,
  getRenderableAssignments,
} from "@/lib/resource-plan-assignment-identity";

const techA = {
  id: "tech-a",
  name: "Andre Midtgard",
  color: "#111111",
  eventTechnicianId: "assignment-a",
  calendarEventId: "outlook-a",
};

const techB = {
  id: "tech-b",
  name: "Marcus Bogen",
  color: "#222222",
  eventTechnicianId: "assignment-b",
  calendarEventId: "outlook-b",
};

const multiTechEvent: CalendarEvent = {
  id: "event-1",
  microsoftEventId: "legacy-master-id",
  technicianIds: [techA.id, techB.id],
  attendeeStatuses: [],
  title: "Service – Tavlearbeid",
  customer: "BusBar AS",
  address: "Testveien 1",
  description: "Oppdrag",
  start: new Date("2026-03-17T08:00:00.000Z"),
  end: new Date("2026-03-17T12:00:00.000Z"),
  status: "scheduled",
  jobNumber: "JOB-000123",
  internalNumber: "JOB-000123",
  technicians: [techA, techB],
};

const scheduleBlockA: ScheduleBlock = {
  id: "sb-a",
  company_id: "company-1",
  technician_id: techA.id,
  project_id: multiTechEvent.id,
  job_id: multiTechEvent.id,
  outlook_event_id: techA.calendarEventId,
  calendar_id: "andre@example.com",
  source: "outlook",
  start_at: new Date("2026-03-17T08:00:00.000Z"),
  end_at: new Date("2026-03-17T12:00:00.000Z"),
  title: "Service – Tavlearbeid",
  location: null,
  description: null,
  match_confidence: 100,
  match_reason: null,
  match_state: "confirmed",
  mcs_block_id: multiTechEvent.id,
  created_at: "2026-03-17T07:00:00.000Z",
  updated_at: "2026-03-17T07:00:00.000Z",
  outlook_subject: "Service – Tavlearbeid",
  outlook_location: null,
  outlook_preview: null,
  outlook_weblink: null,
  outlook_organizer: null,
  ai_match_reason: null,
  ai_confidence: null,
  technician_name: techA.name,
  technician_color: techA.color,
  project_title: multiTechEvent.title,
  job_number: multiTechEvent.jobNumber,
  internal_number: multiTechEvent.internalNumber,
};

const scheduleBlockB: ScheduleBlock = {
  ...scheduleBlockA,
  id: "sb-b",
  technician_id: techB.id,
  outlook_event_id: techB.calendarEventId,
  calendar_id: "marcus@example.com",
  technician_name: techB.name,
  technician_color: techB.color,
};

describe("resource plan assignment identity", () => {
  it("gir unike assignment-nøkler for ett oppdrag med to montører", () => {
    const assignments = getRenderableAssignments([multiTechEvent], null);

    expect(assignments).toHaveLength(2);
    expect(assignments.map((entry) => entry.assignmentKey)).toEqual([
      "event-1__tech__tech-a",
      "event-1__tech__tech-b",
    ]);
    expect(new Set(assignments.map((entry) => entry.assignmentKey)).size).toBe(2);
    expect(assignments.map((entry) => entry.technician.calendarEventId)).toEqual(["outlook-a", "outlook-b"]);
  });

  it("renderer kun valgt montør når planen filtreres", () => {
    const assignments = getRenderableAssignments([multiTechEvent], techA.id);

    expect(assignments).toHaveLength(1);
    expect(assignments[0].technician.id).toBe(techA.id);
    expect(assignments[0].assignmentKey).toBe("event-1__tech__tech-a");
  });

  it("filtrerer schedule blocks på assignment-nivå per montør", () => {
    const visibleBlocks = filterScheduleBlocksByTechnician([scheduleBlockA, scheduleBlockB], techB.id);

    expect(visibleBlocks).toHaveLength(1);
    expect(visibleBlocks[0].id).toBe("sb-b");
    expect(visibleBlocks[0].technician_id).toBe(techB.id);
  });

  it("finner riktig schedule block for valgt assignment", () => {
    expect(findScheduleBlockForAssignment([scheduleBlockA, scheduleBlockB], multiTechEvent.id, techA.id)?.id).toBe("sb-a");
    expect(findScheduleBlockForAssignment([scheduleBlockA, scheduleBlockB], multiTechEvent.id, techB.id)?.id).toBe("sb-b");
  });
});
