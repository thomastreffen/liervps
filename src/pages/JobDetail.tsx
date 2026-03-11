import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ProjectHeader } from "@/components/project/ProjectHeader";
import { ProjectRooms } from "@/components/project/ProjectRooms";
import { ProjectFeed } from "@/components/project/ProjectFeed";
import { ThreadList } from "@/components/conversations/ThreadList";
import { DocsFilesRoom } from "@/components/docs/DocsFilesRoom";
import { ProjectPlanTab } from "@/components/ProjectPlanTab";
import { ServiceJournal } from "@/components/project/ServiceJournal";
import { ProjectScheduleSheet } from "@/components/project/ProjectScheduleSheet";
import { Button } from "@/components/ui/button";
import type { Job, Attachment } from "@/lib/mock-data";
import {
  JOB_STATUS_CONFIG,
  canSetStatus,
  getDisplayNumber,
  type JobStatus,
} from "@/lib/job-status";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { ImageLightbox } from "@/components/ImageLightbox";
import { ProjectAccessDrawer } from "@/components/project/ProjectAccessDrawer";
import { Loader2, X, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import type { OutlookSyncStatus } from "@/lib/mock-data";

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const canEditPlan = hasPermission("projects.edit_plan");
  const canDeleteAttachment = hasPermission("projects.delete_attachment");

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [technicianNames, setTechnicianNames] = useState<string[]>([]);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [showPlan, setShowPlan] = useState(false);
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [accessDrawerOpen, setAccessDrawerOpen] = useState(false);
  const [accessDrawerTab, setAccessDrawerTab] = useState<"members" | "spaces">("members");
  const [scheduleSheetOpen, setScheduleSheetOpen] = useState(false);
  const [scheduleRefreshKey, setScheduleRefreshKey] = useState(0);

  /* ── Fetch data ── */
  const fetchJob = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("events")
      .select(`
        *,
        event_technicians (
          technician_id,
          technicians ( id, name, color )
        )
      `)
      .eq("id", id)
      .single();

    if (error || !data) {
      setJob(null);
      setLoading(false);
      return;
    }

    const techs = (data.event_technicians ?? [])
      .filter((et: any) => et.technicians)
      .map((et: any) => et.technicians);

    setTechnicianNames(techs.map((t: any) => t.name));

    setJob({
      id: data.id,
      microsoftEventId: data.microsoft_event_id ?? "",
      technicianIds: (data.event_technicians ?? []).map((et: any) => et.technician_id),
      attendeeStatuses: [],
      title: data.title,
      customer: data.customer ?? "",
      address: data.address ?? "",
      description: data.description ?? "",
      start: new Date(data.start_time),
      end: new Date(data.end_time),
      status: data.status as JobStatus,
      jobNumber: data.job_number,
      internalNumber: data.internal_number,
      proposedStart: data.proposed_start ? new Date(data.proposed_start) : undefined,
      proposedEnd: data.proposed_end ? new Date(data.proposed_end) : undefined,
      createdAt: data.created_at ? new Date(data.created_at) : undefined,
      updatedAt: data.updated_at ? new Date(data.updated_at) : undefined,
      attachments: Array.isArray(data.attachments) ? (data.attachments as unknown as Attachment[]) : [],
      outlookSyncStatus: (data.outlook_sync_status as OutlookSyncStatus) || "not_synced",
      outlookLastSyncedAt: data.outlook_last_synced_at ? new Date(data.outlook_last_synced_at) : undefined,
      outlookDeletedAt: data.outlook_deleted_at ? new Date(data.outlook_deleted_at) : undefined,
      calendarDirty: data.calendar_dirty || false,
      calendarLastSyncedAt: data.calendar_last_synced_at || null,
      meetingJoinUrl: data.meeting_join_url || null,
      meetingId: data.meeting_id || null,
      meetingCreatedAt: data.meeting_created_at ? new Date(data.meeting_created_at) : null,
    });
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchJob(); }, [fetchJob]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex items-center justify-center p-20">
        <div className="text-center space-y-3">
          <p className="text-lg font-semibold">Prosjekt ikke funnet</p>
          <Button variant="outline" onClick={() => navigate("/projects")}>Tilbake til prosjekter</Button>
        </div>
      </div>
    );
  }

  const imageAttachments = (job.attachments ?? []).filter((a) => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(a.name));

  /* ── Plan overlay ── */
  if (showPlan) {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-30 border-b border-border/40 bg-background/95 backdrop-blur-sm">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">{job.title} – Plan</h2>
              <p className="text-xs text-muted-foreground">{technicianNames.join(", ") || "Ingen montører tildelt"}</p>
            </div>
            <Button variant="ghost" size="icon" className="rounded-lg" onClick={() => setShowPlan(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
        <div className="p-4 sm:p-6">
          <ProjectPlanTab
            jobId={job.id}
            jobTitle={job.title}
            jobStart={job.start}
            jobEnd={job.end}
            jobAddress={job.address}
            technicianIds={job.technicianIds}
            technicianNames={technicianNames}
            isAdmin={canEditPlan}
            calendarDirty={job.calendarDirty}
            calendarLastSyncedAt={job.calendarLastSyncedAt}
            onSynced={() => fetchJob()}
            onResourceAssign={() => fetchJob()}
          />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <ProjectHeader
          jobNumber={job.jobNumber ?? null}
          internalNumber={job.internalNumber ?? null}
          title={job.title}
          customer={job.customer}
          address={job.address}
          start={job.start}
          end={job.end}
          status={job.status}
          technicianNames={technicianNames}
          onOpenPlan={() => setShowPlan(true)}
          onEdit={() => navigate(`/projects/${id}/settings`)}
          onOpenAccess={() => { setAccessDrawerTab("members"); setAccessDrawerOpen(true); }}
          onOpenSpaces={() => { setAccessDrawerTab("spaces"); setAccessDrawerOpen(true); }}
          projectId={id}
        />

        {/* Room content or Rooms overview */}
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 pb-28 md:pb-8">
         {activeRoom ? (
            <div className="space-y-4">
              <button
                onClick={() => setActiveRoom(null)}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Tilbake til prosjektet
              </button>
              <h2 className="text-xl font-bold text-foreground capitalize">{activeRoom}</h2>

              {activeRoom === "samtaler" && (
                <ThreadList projectId={id!} />
              )}
              {(activeRoom === "oppgaver" || activeRoom === "arbeidspakker") && (
                <ProjectFeed
                  jobId={id!}
                  jobTitle={job.title}
                  customer={job.customer}
                  internalNumber={job.internalNumber || null}
                  filter="tasks"
                />
              )}
              {activeRoom === "dokumenter" && (
                <DocsFilesRoom projectId={id!} jobId={id!} />
              )}
              {activeRoom === "servicejournal" && (
                <ServiceJournal
                  projectId={id!}
                  projectTitle={job.title}
                  customer={job.customer}
                  address={job.address}
                  technicianNames={technicianNames}
                  internalNumber={job.internalNumber || undefined}
                />
              )}
            </div>
          ) : (
            <ProjectRooms
              jobId={id!}
              onOpenPlan={() => setShowPlan(true)}
              onOpenRoom={(room) => setActiveRoom(room)}
              onOpenScheduleSheet={() => setScheduleSheetOpen(true)}
              key={scheduleRefreshKey}
            />
          )}
        </div>
      </div>

      {/* Lightbox */}
      <ImageLightbox
        images={imageAttachments}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        canDelete={canDeleteAttachment}
        onDelete={async (name) => {
          if (!job || !canDeleteAttachment) return;
          const updated = (job.attachments ?? []).filter((a) => a.name !== name);
          const { error } = await supabase.from("events").update({ attachments: updated as any }).eq("id", job.id);
          if (!error) { setJob((p) => p ? { ...p, attachments: updated } : null); toast.success("Vedlegg slettet"); }
        }}
      />

      {/* Access drawer – slides in from right */}
      {accessDrawerOpen && id && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/20 backdrop-blur-[2px]"
            onClick={() => setAccessDrawerOpen(false)}
          />
          <div className="relative w-full max-w-md bg-background border-l border-border shadow-xl overflow-y-auto p-6">
            <ProjectAccessDrawer
              projectId={id}
              onClose={() => setAccessDrawerOpen(false)}
              initialTab={accessDrawerTab}
            />
          </div>
        </div>
      )}

      {/* Schedule sheet – inline from project page */}
      {job && (
        <ProjectScheduleSheet
          open={scheduleSheetOpen}
          onOpenChange={setScheduleSheetOpen}
          projectId={job.id}
          projectTitle={job.title}
          customer={job.customer}
          address={job.address}
          suggestedDate={job.start}
          onCreated={() => setScheduleRefreshKey((k) => k + 1)}
        />
      )}
    </>
  );
}
