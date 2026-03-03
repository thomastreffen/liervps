import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfWeek, endOfWeek, formatDistanceToNow } from "date-fns";
import { nb } from "date-fns/locale";
import {
  CheckCircle2, Calendar, MessageSquare, ChevronRight,
  FolderKanban, Loader2,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import type { JobStatus } from "@/lib/job-status";

interface MyTask {
  id: string;
  title: string;
  status: string;
  scheduled_date: string | null;
  job_id: string;
  job_title?: string;
}

interface MyProject {
  id: string;
  title: string;
  customer: string;
  status: JobStatus;
  internal_number: string | null;
}

interface RecentMessage {
  id: string;
  subject: string;
  created_at: string;
  entity_id: string;
  direction: string;
}

export default function OverviewPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<MyTask[]>([]);
  const [projects, setProjects] = useState<MyProject[]>([]);
  const [weekEvents, setWeekEvents] = useState<{ id: string; title: string; scheduled_date: string | null; job_id: string }[]>([]);
  const [messages, setMessages] = useState<RecentMessage[]>([]);

  useEffect(() => {
    if (!user) return;
    fetchAll();
  }, [user]);

  async function fetchAll() {
    setLoading(true);
    const now = new Date();
    const wkStart = startOfWeek(now, { weekStartsOn: 1 });
    const wkEnd = endOfWeek(now, { weekStartsOn: 1 });
    const activeStatuses: JobStatus[] = ["requested", "approved", "scheduled", "in_progress", "time_change_proposed"];

    const [tasksRes, projectsRes, eventsRes, msgsRes] = await Promise.all([
      // Open tasks assigned to me via job_tasks (simple approach)
      supabase.from("job_tasks").select("id, title, status, scheduled_date, job_id")
        .neq("status", "completed")
        .order("scheduled_date", { ascending: true })
        .limit(10),
      // Projects I'm involved in
      supabase.from("events").select("id, title, customer, status, internal_number")
        .in("status", activeStatuses)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(20),
      // This week's calendar items
      supabase.from("job_tasks").select("id, title, scheduled_date, job_id")
        .gte("scheduled_date", wkStart.toISOString().split("T")[0])
        .lte("scheduled_date", wkEnd.toISOString().split("T")[0])
        .neq("status", "completed")
        .order("scheduled_date", { ascending: true })
        .limit(8),
      // Recent messages
      supabase.from("communication_logs").select("id, subject, created_at, entity_id, direction")
        .eq("direction", "inbound")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    setTasks((tasksRes.data as MyTask[]) || []);
    setProjects((projectsRes.data as MyProject[]) || []);
    setWeekEvents(eventsRes.data || []);
    setMessages((msgsRes.data as RecentMessage[]) || []);
    setLoading(false);
  }

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 10) return "God morgen";
    if (h < 17) return "Hei";
    return "God kveld";
  };

  const firstName = user?.name?.split(" ")[0] || "";

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-10">
      {/* Greeting */}
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
          {greeting()}, {firstName}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {format(new Date(), "EEEE d. MMMM", { locale: nb })} · Uke {format(new Date(), "w")}
        </p>
      </div>

      {/* Mine oppgaver */}
      <Section
        title="Mine åpne oppgaver"
        icon={<CheckCircle2 className="h-4 w-4 text-primary" />}
        count={tasks.length}
      >
        {tasks.length === 0 ? (
          <EmptyState text="Ingen åpne oppgaver. Alt i rute." />
        ) : (
          <div className="space-y-0.5">
            {tasks.map(t => (
              <button
                key={t.id}
                onClick={() => navigate(`/projects/${t.job_id}?tab=plan`)}
                className="flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-left hover:bg-muted/50 transition-colors group"
              >
                <div className="h-2 w-2 rounded-full bg-primary/40 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground truncate group-hover:text-primary transition-colors">{t.title}</p>
                  {t.scheduled_date && (
                    <p className="text-[11px] text-muted-foreground">
                      {format(new Date(t.scheduled_date), "d. MMM", { locale: nb })}
                    </p>
                  )}
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/20 group-hover:text-primary/40 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </Section>

      {/* Denne uken */}
      <Section
        title="Denne uken"
        icon={<Calendar className="h-4 w-4 text-primary" />}
        count={weekEvents.length}
      >
        {weekEvents.length === 0 ? (
          <EmptyState text="Ingen planlagte aktiviteter denne uken." />
        ) : (
          <div className="space-y-0.5">
            {weekEvents.map(e => (
              <button
                key={e.id}
                onClick={() => navigate(`/projects/${e.job_id}?tab=plan`)}
                className="flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-left hover:bg-muted/50 transition-colors group"
              >
                <span className="text-xs text-muted-foreground font-mono w-12 shrink-0">
                  {e.scheduled_date ? format(new Date(e.scheduled_date), "EEE", { locale: nb }) : "–"}
                </span>
                <p className="text-sm text-foreground truncate group-hover:text-primary transition-colors">{e.title}</p>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/20 group-hover:text-primary/40 shrink-0 ml-auto" />
              </button>
            ))}
          </div>
        )}
      </Section>

      {/* Nye meldinger */}
      <Section
        title="Nye meldinger"
        icon={<MessageSquare className="h-4 w-4 text-primary" />}
        count={messages.length}
      >
        {messages.length === 0 ? (
          <EmptyState text="Ingen nye meldinger." />
        ) : (
          <div className="space-y-0.5">
            {messages.map(m => (
              <button
                key={m.id}
                onClick={() => navigate(`/projects/${m.entity_id}?tab=epost`)}
                className="flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-left hover:bg-muted/50 transition-colors group"
              >
                <div className="h-2 w-2 rounded-full bg-accent/60 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground truncate group-hover:text-primary transition-colors">{m.subject || "(Uten emne)"}</p>
                </div>
                <span className="text-[11px] text-muted-foreground/50 shrink-0">
                  {formatDistanceToNow(new Date(m.created_at), { addSuffix: true, locale: nb })}
                </span>
              </button>
            ))}
          </div>
        )}
      </Section>

      {/* Mine prosjekter */}
      <Section
        title="Aktive prosjekter"
        icon={<FolderKanban className="h-4 w-4 text-primary" />}
        count={projects.length}
      >
        {projects.length === 0 ? (
          <EmptyState text="Ingen aktive prosjekter." />
        ) : (
          <div className="space-y-0.5">
            {projects.map(p => (
              <button
                key={p.id}
                onClick={() => navigate(`/projects/${p.id}`)}
                className="flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-left hover:bg-muted/50 transition-colors group"
              >
                <div className="h-8 w-8 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
                  <FolderKanban className="h-4 w-4 text-primary/60" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                    {p.internal_number ? `${p.internal_number} – ` : ""}{p.title}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">{p.customer || "Ingen kunde"}</p>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/20 group-hover:text-primary/40 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({ title, icon, count, children }: {
  title: string;
  icon: React.ReactNode;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h2 className="text-sm font-semibold text-foreground tracking-tight">{title}</h2>
        {count !== undefined && count > 0 && (
          <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0">{count}</Badge>
        )}
      </div>
      <div className="rounded-xl border border-border/50 bg-card">
        {children}
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground/60 py-6 text-center">{text}</p>;
}