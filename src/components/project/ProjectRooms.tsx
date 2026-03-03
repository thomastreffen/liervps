import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow, format } from "date-fns";
import { nb } from "date-fns/locale";
import {
  MessageSquare,
  CheckCircle2,
  FileText,
  CalendarCheck,
  MessagesSquare,
  Loader2,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Types ── */

interface RoomCardProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

interface ActivityItem {
  id: string;
  description: string;
  created_at: string;
  author?: string;
  type: string;
  linkLabel?: string;
}

interface ProjectRoomsProps {
  jobId: string;
  onOpenPlan: () => void;
}

/* ── Room Card ── */

function RoomCard({ icon, title, children, onClick, className }: RoomCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col rounded-2xl border border-border/40 bg-card text-left",
        "transition-all duration-200 hover:shadow-md hover:shadow-foreground/[0.03] hover:border-border/60",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "min-h-[220px]",
        className
      )}
    >
      <div className="px-5 pt-5 pb-3">
        <h3 className="text-base font-bold text-foreground text-center">{title}</h3>
      </div>
      <div className="flex-1 px-5 pb-5 overflow-hidden">
        {children}
      </div>
    </button>
  );
}

/* ── Main Component ── */

export function ProjectRooms({ jobId, onOpenPlan }: ProjectRoomsProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [emails, setEmails] = useState<any[]>([]);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);

    const [msgRes, taskRes, docRes, emailRes, scheduleRes, actRes] = await Promise.all([
      // Messages (notes from activity_log)
      supabase.from("activity_log")
        .select("id, title, description, created_at, performed_by")
        .eq("entity_id", jobId)
        .in("type", ["note", "comment"])
        .order("created_at", { ascending: false })
        .limit(5),
      // Tasks
      supabase.from("job_tasks")
        .select("id, title, status, scheduled_date, created_at")
        .eq("job_id", jobId)
        .order("created_at", { ascending: false })
        .limit(5),
      // Documents
      supabase.from("documents")
        .select("id, file_name, created_at, category")
        .eq("entity_id", jobId)
        .eq("entity_type", "job")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(5),
      // Emails
      supabase.from("communication_logs")
        .select("id, subject, body_preview, created_at, direction")
        .eq("entity_id", jobId)
        .order("created_at", { ascending: false })
        .limit(5),
      // Schedule (tasks with dates)
      supabase.from("job_tasks")
        .select("id, title, scheduled_date, status")
        .eq("job_id", jobId)
        .not("scheduled_date", "is", null)
        .order("scheduled_date", { ascending: true })
        .limit(5),
      // Activity log (all types)
      supabase.from("activity_log")
        .select("id, action, title, description, created_at, performed_by, type")
        .eq("entity_id", jobId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    setMessages(msgRes.data || []);
    setTasks(taskRes.data || []);
    setDocs(docRes.data || []);
    setEmails(emailRes.data || []);
    setSchedule(scheduleRes.data || []);

    const activityItems: ActivityItem[] = (actRes.data || []).map((a: any) => ({
      id: a.id,
      description: a.title || a.description || a.action,
      created_at: a.created_at,
      author: a.performed_by,
      type: a.type || a.action,
    }));
    setActivity(activityItems);
    setLoading(false);
  }, [jobId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* ── Room Cards Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Message Board */}
        <RoomCard
          icon={<MessageSquare className="h-5 w-5" />}
          title="Meldinger"
        >
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground/50 text-center mt-4">Ingen meldinger ennå</p>
          ) : (
            <div className="space-y-2.5">
              {messages.map(m => (
                <div key={m.id} className="flex items-start gap-2.5">
                  <div className="h-7 w-7 rounded-full bg-accent/15 text-accent flex items-center justify-center shrink-0 text-[11px] font-bold mt-0.5">
                    {(m.performed_by || "?").slice(0, 2).toUpperCase()}
                  </div>
                  <p className="text-sm text-foreground line-clamp-2">{m.title || m.description}</p>
                </div>
              ))}
            </div>
          )}
        </RoomCard>

        {/* To-dos */}
        <RoomCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          title="Oppgaver"
        >
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground/50 text-center mt-4">Ingen oppgaver ennå</p>
          ) : (
            <div className="space-y-2">
              {tasks.map(t => (
                <div key={t.id} className="flex items-center gap-2">
                  <div className={cn(
                    "h-4 w-4 rounded-full border-2 shrink-0",
                    t.status === "completed"
                      ? "bg-success border-success"
                      : "border-muted-foreground/30"
                  )} />
                  <span className={cn(
                    "text-sm",
                    t.status === "completed" ? "text-muted-foreground line-through" : "text-foreground"
                  )}>
                    {t.title}
                  </span>
                </div>
              ))}
            </div>
          )}
        </RoomCard>

        {/* Docs & Files */}
        <RoomCard
          icon={<FileText className="h-5 w-5" />}
          title="Dokumenter"
        >
          {docs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground/50">
              <FileText className="h-10 w-10 text-accent/30" />
              <p className="text-sm">Del dokumenter, tegninger og filer</p>
            </div>
          ) : (
            <div className="space-y-2">
              {docs.map(d => (
                <div key={d.id} className="flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm text-foreground truncate">{d.file_name}</span>
                </div>
              ))}
            </div>
          )}
        </RoomCard>

        {/* Chat / E-post */}
        <RoomCard
          icon={<MessagesSquare className="h-5 w-5" />}
          title="E-post"
        >
          {emails.length === 0 ? (
            <p className="text-sm text-muted-foreground/50 text-center mt-4">Ingen e-post ennå</p>
          ) : (
            <div className="space-y-2.5">
              {emails.slice(0, 3).map(e => (
                <div key={e.id} className="space-y-0.5">
                  <p className="text-sm font-medium text-foreground line-clamp-1">{e.subject || "(Uten emne)"}</p>
                  {e.body_preview && (
                    <p className="text-xs text-muted-foreground line-clamp-1">{e.body_preview}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </RoomCard>

        {/* Schedule */}
        <RoomCard
          icon={<CalendarCheck className="h-5 w-5" />}
          title="Tidsplan"
          onClick={onOpenPlan}
        >
          {schedule.length === 0 ? (
            <p className="text-sm text-muted-foreground/50 text-center mt-4">Ingen planlagte hendelser</p>
          ) : (
            <div className="space-y-2.5">
              {schedule.map(s => (
                <div key={s.id} className="flex items-start gap-2">
                  <CalendarCheck className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{s.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(s.scheduled_date), "EEE d. MMM", { locale: nb })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </RoomCard>
      </div>

      {/* ── Project Activity ── */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border/60" />
          <h2 className="text-lg font-bold text-foreground">Prosjektaktivitet</h2>
          <div className="h-px flex-1 bg-border/60" />
        </div>

        {activity.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground/50 py-8">Ingen aktivitet ennå</p>
        ) : (
          <div className="space-y-0">
            {/* Today label */}
            <div className="flex justify-center py-2">
              <span className="bg-foreground text-background text-[10px] font-bold uppercase tracking-wider px-3 py-0.5 rounded">
                I dag
              </span>
            </div>

            {activity.map(item => (
              <div key={item.id} className="flex items-start gap-3 py-3">
                <div className="h-8 w-8 rounded-full bg-accent/15 text-accent flex items-center justify-center shrink-0 text-[11px] font-bold">
                  {(item.author || "SY").slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{item.description}</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatDistanceToNow(new Date(item.created_at), { addSuffix: false, locale: nb })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
