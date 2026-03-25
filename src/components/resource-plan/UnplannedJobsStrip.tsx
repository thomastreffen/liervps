import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FolderKanban, GripVertical, Clock, MapPin, User, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { Draggable } from "@fullcalendar/interaction";

interface UnplannedJob {
  id: string;
  title: string;
  customer: string | null;
  address: string | null;
  internal_number: string | null;
  status: string;
  start_time: string | null;
  end_time: string | null;
  estimated_hours?: number | null;
  technician_names: string[];
}

interface UnplannedJobsStripProps {
  companyId?: string | null;
}

export function UnplannedJobsStrip({ companyId }: UnplannedJobsStripProps) {
  const [jobs, setJobs] = useState<UnplannedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggableRef = useRef<Draggable | null>(null);

  const fetchJobs = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from("events")
      .select("id, title, customer, address, internal_number, status, start_time, end_time")
      .is("deleted_at", null)
      .is("archived_at", null)
      .eq("project_type", "project")
      .in("status", ["requested", "approved"])
      .order("created_at", { ascending: false })
      .limit(30);

    if (companyId) {
      query = query.eq("company_id", companyId);
    }

    const { data, error } = await query;
    if (error) {
      console.error("[UnplannedJobsStrip] fetch error:", error);
      setJobs([]);
      setLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      setJobs([]);
      setLoading(false);
      return;
    }

    // Find jobs that have NO schedule_blocks yet (truly unplanned)
    const jobIds = data.map((j: any) => j.id);
    const { data: blockData } = await supabase
      .from("schedule_blocks")
      .select("project_id")
      .in("project_id", jobIds)
      .is("deleted_at", null);

    const plannedIds = new Set((blockData || []).map((b: any) => b.project_id));

    // Get technician assignments for these jobs
    const { data: techData } = await supabase
      .from("event_technicians")
      .select("event_id, technician_id, technicians(name)")
      .in("event_id", jobIds);

    const techMap = new Map<string, string[]>();
    for (const t of (techData || []) as any[]) {
      const names = techMap.get(t.event_id) || [];
      names.push((t.technicians as any)?.name || "Ukjent");
      techMap.set(t.event_id, names);
    }

    const unplanned: UnplannedJob[] = (data as any[])
      .filter((j) => !plannedIds.has(j.id))
      .map((j) => ({
        ...j,
        technician_names: techMap.get(j.id) || [],
      }));

    setJobs(unplanned);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  // Refresh every 60s
  useEffect(() => {
    const interval = setInterval(fetchJobs, 60000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  // FullCalendar Draggable
  useEffect(() => {
    if (!containerRef.current) return;
    if (draggableRef.current) draggableRef.current.destroy();

    draggableRef.current = new Draggable(containerRef.current, {
      itemSelector: "[data-fc-draggable]",
      eventData: (el) => {
        const jobId = el.getAttribute("data-task-id") || "";
        const title = el.getAttribute("data-task-title") || "Prosjekt";
        const minutes = parseInt(el.getAttribute("data-task-minutes") || "480", 10);
        return {
          title,
          duration: { minutes },
          extendedProps: {
            isExternalDrop: true,
            taskId: jobId,
            taskTitle: title,
            estimatedMinutes: minutes,
            priority: "normal",
            dropType: "project",
          },
          create: false,
        };
      },
    });

    return () => {
      if (draggableRef.current) {
        draggableRef.current.destroy();
        draggableRef.current = null;
      }
    };
  }, [jobs]);

  if (loading || jobs.length === 0) return null;

  return (
    <div className="mb-1 border border-border/30 rounded-lg bg-card/60 overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-muted/40 transition-colors"
      >
        <FolderKanban className="h-3.5 w-3.5 text-primary" />
        <span className="text-[11px] font-semibold">Uplanlagte jobber</span>
        <Badge variant="secondary" className="text-[9px] h-4 px-1.5">{jobs.length}</Badge>
        <span className="text-[9px] text-muted-foreground ml-auto mr-1">Dra til kalender</span>
        {expanded ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
      </button>

      {expanded && (
        <div ref={containerRef} className="flex gap-2 p-2 overflow-x-auto border-t border-border/20">
          {jobs.map((job) => {
            const estimatedMin = (job.estimated_hours || 8) * 60;
            const jobNum = job.internal_number;

            return (
              <div
                key={job.id}
                data-fc-draggable
                data-task-id={job.id}
                data-task-title={job.title}
                data-task-minutes={estimatedMin}
                data-task-priority="normal"
                data-task-type="project"
                className="shrink-0 w-60 rounded-lg border border-primary/20 bg-primary/5 p-3 cursor-grab active:cursor-grabbing transition-shadow hover:shadow-md select-none"
              >
                <div className="flex items-start gap-1.5">
                  <GripVertical className="h-4 w-4 opacity-40 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {jobNum && (
                        <span className="text-[9px] font-mono font-bold bg-primary/15 text-primary rounded px-1 py-0.5 shrink-0">
                          {jobNum.startsWith("JOB-") ? jobNum : `JOB-${jobNum}`}
                        </span>
                      )}
                      <Badge variant="outline" className="text-[9px] h-4 px-1 capitalize">
                        {job.status === "requested" ? "Forespurt" : job.status === "approved" ? "Godkjent" : "Planlagt"}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium truncate">{job.title}</p>
                    {job.customer && (
                      <p className="text-[11px] text-muted-foreground truncate">{job.customer}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                      {job.estimated_hours && (
                        <span className="flex items-center gap-0.5">
                          <Clock className="h-3 w-3" />
                          {job.estimated_hours}t
                        </span>
                      )}
                      {job.address && (
                        <span className="flex items-center gap-0.5 truncate">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{job.address}</span>
                        </span>
                      )}
                    </div>
                    {job.technician_names.length > 0 && (
                      <div className="flex items-center gap-1 mt-1.5">
                        <User className="h-3 w-3 opacity-60" />
                        <span className="text-[11px] truncate">{job.technician_names.join(", ")}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
