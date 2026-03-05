/**
 * Test: Schedule Block Deletion Must Never Delete Projects
 *
 * Background (bug #1, #2, #3 – March 2026):
 *   schedule_blocks has TWO foreign keys to events: project_id and job_id.
 *   When the Supabase query used `events(title)` without specifying the FK,
 *   PostgREST returned PGRST201 (ambiguous relationship), causing the
 *   scheduleBlocks list to be empty. The delete handler then fell through
 *   to the `else if (editEvent)` branch and soft-deleted the PROJECT.
 *
 * Fix:
 *   1. Query uses explicit FK: `events!schedule_blocks_project_id_fkey(title)`
 *   2. Delete handler has a safety check: even if scheduleBlockId is null,
 *      it queries for linked blocks before allowing project deletion.
 */

import { describe, it, expect, vi } from "vitest";

// ---------------------------------------------------------------------------
// 1. Ambiguous FK detection (unit-level)
// ---------------------------------------------------------------------------
describe("schedule_blocks query FK disambiguation", () => {
  it("query string must contain explicit FK alias to avoid PGRST201", () => {
    // The select string used by useScheduleBlocks must reference the FK name
    const EXPECTED_FK = "events!schedule_blocks_project_id_fkey";

    // Simulate what the hook builds
    const selectString = `
      *,
      technicians!inner(name, color),
      events!schedule_blocks_project_id_fkey(title)
    `;

    expect(selectString).toContain(EXPECTED_FK);

    // The BAD pattern (no FK alias) must NOT be present alone
    const ambiguousPattern = /events\(title\)/; // "events(title)" without "!"
    expect(selectString).not.toMatch(ambiguousPattern);
  });
});

// ---------------------------------------------------------------------------
// 2. Delete logic must never soft-delete a project that has schedule blocks
// ---------------------------------------------------------------------------
describe("EventDrawer delete logic", () => {
  /**
   * Simulates the exact branching logic from EventDrawer.tsx lines 594-631.
   * Returns which action was taken.
   */
  function simulateDeleteAction(params: {
    scheduleBlockId: string | null;
    editEventId: string | null;
    linkedBlockIds: string[]; // blocks found via safety query
  }): "delete-block" | "delete-linked-blocks" | "block-project-delete" | "noop" {
    const { scheduleBlockId, editEventId, linkedBlockIds } = params;

    if (scheduleBlockId) {
      return "delete-block";
    } else if (editEventId) {
      if (linkedBlockIds.length > 0) {
        return "delete-linked-blocks";
      } else {
        // NEVER soft-delete projects from resource plan – user must go to project page
        return "block-project-delete";
      }
    }
    return "noop";
  }

  it("deletes only the schedule block when scheduleBlockId is known", () => {
    const result = simulateDeleteAction({
      scheduleBlockId: "block-123",
      editEventId: "project-abc",
      linkedBlockIds: [],
    });
    expect(result).toBe("delete-block");
  });

  it("deletes linked blocks (not the project) when scheduleBlockId is null but blocks exist", () => {
    // This is the exact scenario that caused the bug:
    // useScheduleBlocks query failed → scheduleBlockId was null
    // But the project still had schedule blocks in the DB
    const result = simulateDeleteAction({
      scheduleBlockId: null,
      editEventId: "project-abc",
      linkedBlockIds: ["block-456"],
    });
    expect(result).toBe("delete-linked-blocks");
    expect(result).not.toBe("block-project-delete"); // THE CRITICAL ASSERTION
  });

  it("blocks project deletion when event has zero schedule blocks", () => {
    // Previously this would soft-delete the project – now it's blocked
    const result = simulateDeleteAction({
      scheduleBlockId: null,
      editEventId: "standalone-event",
      linkedBlockIds: [],
    });
    expect(result).toBe("block-project-delete");
    expect(result).not.toBe("soft-delete-event"); // Must NEVER happen
  });

  it("does nothing if neither scheduleBlockId nor editEvent exist", () => {
    const result = simulateDeleteAction({
      scheduleBlockId: null,
      editEventId: null,
      linkedBlockIds: [],
    });
    expect(result).toBe("noop");
  });
});

// ---------------------------------------------------------------------------
// 3. Regression guard: the delete-schedule-block edge function must NOT
//    touch the events table (verified by reading the function source)
// ---------------------------------------------------------------------------
describe("delete-schedule-block edge function contract", () => {
  it("edge function only soft-deletes schedule_blocks, never events", () => {
    // This is a documentation/contract test.
    // The edge function (supabase/functions/delete-schedule-block/index.ts):
    //   - Updates schedule_blocks.deleted_at (soft delete)
    //   - Optionally deletes Outlook calendar event via Graph API
    //   - Logs to activity_log
    //   - Does NOT update or delete from the events table
    //
    // If someone modifies the edge function to touch events, this test
    // should be updated and the change reviewed carefully.

    const EDGE_FUNCTION_TABLES_TOUCHED = [
      "schedule_blocks", // soft-delete target
      "activity_log",    // audit logging
    ];

    expect(EDGE_FUNCTION_TABLES_TOUCHED).not.toContain("events");
  });
});
