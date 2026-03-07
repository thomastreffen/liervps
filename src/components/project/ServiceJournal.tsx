import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ClipboardList, User, Clock, CalendarDays, FileImage, AlertTriangle,
  History, Loader2, CheckCircle2, Image as ImageIcon, FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Types ── */

interface ScheduleBlock {
  id: string;
  start_at: string;
  end_at: string;
  title: string;
  match_state: string;
  technician_name?: string;
  technician_color?: string;
}

interface Deviation {
  id: string;
  title: string;
  status: string;
  created_at: string;
  severity?: string;
}

interface DocFile {
  id: string;
  title: string;
  mime_type: string | null;
  created_at: string;
}

interface ActivityEntry {
  id: string;
  type: string;
  action: string;
  title: string | null;
  description: string | null;
  created_at: string;
}

interface ServiceJournalProps {
  projectId: string;
  projectTitle: string;
  customer: string;
  address?: string;
  technicianNames: string[];
}

const MATCH_STATE_LABELS: Record<string, string> = {
  manual: "Manuell",
  confirmed: "Bekreftet",
  auto: "Auto",
  needs_confirmation: "Trenger bekreftelse",
  external: "Ekstern",
};

/* ── Main Component ── */

export function ServiceJournal({
  projectId, projectTitle, customer, address, technicianNames,
}: ServiceJournalProps) {
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [deviations, setDeviations] = useState<Deviation[]>([]);
  const [docs, setDocs] = useState<DocFile[]>([]);
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);

    const [blocksRes, devsRes, docsRes, actRes] = await Promise.all([
      // Schedule blocks
      supabase
        .from("schedule_blocks")
        .select("id, start_at, end_at, title, match_state, technicians!inner(name, color)")
        .eq("project_id", projectId)
        .is("deleted_at", null)
        .order("start_at", { ascending: true })
        .limit(50),
      // Deviations (job_tasks with type=deviation or category containing avvik)
      supabase
        .from("job_tasks")
        .select("id, title, status, created_at, priority")
        .eq("job_id", projectId)
        .eq("category", "avvik")
        .order("created_at", { ascending: false })
        .limit(20),
      // Docs & images
      supabase
        .from("docs_files")
        .select("id, title, mime_type, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(30) as any,
      // Activity log
      supabase
        .from("activity_log")
        .select("id, type, action, title, description, created_at")
        .eq("entity_id", projectId)
        .eq("entity_type", "job")
        .in("type", ["status_change", "note", "email", "meeting", "task"])
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    setBlocks(
      (blocksRes.data || []).map((r: any) => ({
        id: r.id,
        start_at: r.start_at,
        end_at: r.end_at,
        title: r.title,
        match_state: r.match_state,
        technician_name: r.technicians?.name,
        technician_color: r.technicians?.color,
      }))
    );

    setDeviations(
      (devsRes.data || []).map((r: any) => ({
        id: r.id,
        title: r.title,
        status: r.status,
        created_at: r.created_at,
        severity: r.priority,
      }))
    );

    setDocs(docsRes.data || []);
    setActivities(
      (actRes.data || []).map((r: any) => ({
        id: r.id,
        type: r.type,
        action: r.action,
        title: r.title,
        description: r.description,
        created_at: r.created_at,
      }))
    );

    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Derive period from blocks
  const sortedBlocks = [...blocks].sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  const periodStart = sortedBlocks[0] ? format(new Date(sortedBlocks[0].start_at), "d. MMM yyyy", { locale: nb }) : "—";
  const periodEnd = sortedBlocks.length > 0
    ? format(new Date(sortedBlocks[sortedBlocks.length - 1].end_at), "d. MMM yyyy", { locale: nb })
    : "—";

  // Unique technicians from blocks
  const uniqueTechs = Array.from(
    new Map(blocks.filter(b => b.technician_name).map(b => [b.technician_name!, { name: b.technician_name!, color: b.technician_color }])).values()
  );

  // Split docs into images and other
  const imageDocs = docs.filter(d => d.mime_type?.startsWith("image/"));
  const otherDocs = docs.filter(d => !d.mime_type?.startsWith("image/"));

  const completedBlocks = blocks.filter(b => new Date(b.end_at) < new Date());
  const upcomingBlocks = blocks.filter(b => new Date(b.end_at) >= new Date());

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
          <ClipboardList className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">Servicejournal</h2>
          <p className="text-xs text-muted-foreground">Samlet oversikt over utført og planlagt arbeid</p>
        </div>
      </div>

      {/* ── 1. Sammendrag ── */}
      <Section title="Sammendrag" icon={<ClipboardList className="h-4 w-4" />}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InfoRow label="Prosjekt" value={projectTitle} />
          <InfoRow label="Kunde" value={customer || "—"} />
          {address && <InfoRow label="Adresse" value={address} />}
          <InfoRow label="Periode" value={sortedBlocks.length > 0 ? `${periodStart} – ${periodEnd}` : "Ingen planlagte økter"} />
          <div className="space-y-1">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Montører</p>
            {uniqueTechs.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {uniqueTechs.map(t => (
                  <Badge key={t.name} variant="secondary" className="gap-1.5 text-xs font-medium">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: t.color || "hsl(var(--primary))" }} />
                    {t.name}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{technicianNames.length > 0 ? technicianNames.join(", ") : "Ingen tildelt"}</p>
            )}
          </div>
          <InfoRow label="Arbeidsøkter" value={`${completedBlocks.length} fullført, ${upcomingBlocks.length} planlagt`} />
        </div>
      </Section>

      {/* ── 2. Arbeidsøkter ── */}
      <Section title="Arbeidsøkter" icon={<CalendarDays className="h-4 w-4" />} count={blocks.length}>
        {blocks.length === 0 ? (
          <EmptyState text="Ingen planlagte arbeidsøkter" />
        ) : (
          <div className="space-y-2">
            {blocks.map(block => {
              const start = new Date(block.start_at);
              const end = new Date(block.end_at);
              const isPast = end < new Date();
              const durationMin = Math.round((end.getTime() - start.getTime()) / 60000);
              const durationLabel = durationMin >= 60
                ? `${Math.floor(durationMin / 60)}t${durationMin % 60 > 0 ? ` ${durationMin % 60}m` : ""}`
                : `${durationMin}m`;

              return (
                <div
                  key={block.id}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border p-3",
                    isPast
                      ? "border-border/30 bg-muted/20"
                      : "border-border/40 bg-card"
                  )}
                >
                  <span
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: block.technician_color || "hsl(var(--primary))" }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold">{format(start, "EEE d. MMM", { locale: nb })}</p>
                      <span className="text-xs text-muted-foreground">
                        {format(start, "HH:mm")} – {format(end, "HH:mm")}
                      </span>
                      <span className="text-[10px] text-muted-foreground/70">({durationLabel})</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <User className="h-3 w-3" />
                      <span>{block.technician_name || "Ukjent"}</span>
                      <span className="text-[10px]">· {MATCH_STATE_LABELS[block.match_state] || block.match_state}</span>
                    </div>
                  </div>
                  {isPast && (
                    <Badge variant="secondary" className="text-[10px] h-5 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                      Fullført
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* ── 3. Dokumentasjon ── */}
      <Section title="Dokumentasjon" icon={<FileImage className="h-4 w-4" />} count={docs.length}>
        {docs.length === 0 ? (
          <EmptyState text="Ingen dokumenter eller bilder lastet opp" />
        ) : (
          <div className="space-y-4">
            {imageDocs.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <ImageIcon className="h-3 w-3" /> Bilder ({imageDocs.length})
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {imageDocs.slice(0, 8).map(img => (
                    <div
                      key={img.id}
                      className="aspect-square rounded-lg border border-border/40 bg-muted/30 flex items-center justify-center overflow-hidden"
                    >
                      <div className="text-center p-2">
                        <ImageIcon className="h-5 w-5 text-muted-foreground mx-auto" />
                        <p className="text-[9px] text-muted-foreground mt-1 truncate max-w-[80px]">{img.file_name}</p>
                      </div>
                    </div>
                  ))}
                  {imageDocs.length > 8 && (
                    <div className="aspect-square rounded-lg border border-dashed border-border/40 flex items-center justify-center">
                      <p className="text-xs text-muted-foreground">+{imageDocs.length - 8} til</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            {otherDocs.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="h-3 w-3" /> Dokumenter ({otherDocs.length})
                </p>
                <div className="space-y-1">
                  {otherDocs.map(doc => (
                    <div key={doc.id} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm border border-border/30 bg-card">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate flex-1">{doc.file_name}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {format(new Date(doc.created_at), "d. MMM", { locale: nb })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Section>

      {/* ── 4. Avvik ── */}
      <Section title="Avvik" icon={<AlertTriangle className="h-4 w-4" />} count={deviations.length}>
        {deviations.length === 0 ? (
          <EmptyState text="Ingen avvik registrert" />
        ) : (
          <div className="space-y-2">
            {deviations.map(dev => (
              <div key={dev.id} className="flex items-center gap-3 rounded-xl border border-border/40 bg-card p-3">
                <AlertTriangle className={cn(
                  "h-4 w-4 shrink-0",
                  dev.severity === "high" ? "text-destructive" : "text-amber-500"
                )} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{dev.title}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {format(new Date(dev.created_at), "d. MMM yyyy", { locale: nb })}
                  </p>
                </div>
                <Badge
                  variant="secondary"
                  className={cn(
                    "text-[10px] h-5",
                    dev.status === "completed" && "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
                    dev.status === "open" && "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
                  )}
                >
                  {dev.status === "completed" ? "Lukket" : dev.status === "open" ? "Åpen" : dev.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── 5. Aktivitetslogg ── */}
      <Section title="Aktivitet" icon={<History className="h-4 w-4" />} count={activities.length}>
        {activities.length === 0 ? (
          <EmptyState text="Ingen registrert aktivitet" />
        ) : (
          <div className="space-y-1">
            {activities.map(act => (
              <div key={act.id} className="flex items-start gap-3 py-2">
                <div className="mt-0.5 shrink-0">
                  <ActivityIcon type={act.type} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{act.title || act.description || act.action}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {format(new Date(act.created_at), "d. MMM HH:mm", { locale: nb })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

/* ── Subcomponents ── */

function Section({ title, icon, count, children }: {
  title: string;
  icon: React.ReactNode;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        {count !== undefined && count > 0 && (
          <Badge variant="secondary" className="text-[10px] h-5">{count}</Badge>
        )}
      </div>
      <Separator className="bg-border/40" />
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <p className="text-sm text-muted-foreground py-4 text-center">{text}</p>
  );
}

function ActivityIcon({ type }: { type: string }) {
  switch (type) {
    case "status_change": return <CheckCircle2 className="h-3.5 w-3.5 text-primary" />;
    case "note": return <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />;
    case "email": return <FileText className="h-3.5 w-3.5 text-primary" />;
    case "task": return <CheckCircle2 className="h-3.5 w-3.5 text-amber-500" />;
    default: return <History className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}
