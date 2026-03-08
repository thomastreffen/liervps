import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, formatDistanceToNow, isToday, isTomorrow } from "date-fns";
import { nb } from "date-fns/locale";
import {
  Sun,
  MapPin,
  Clock,
  ChevronRight,
  Play,
  CheckCircle2,
  Camera,
  StickyNote,
  AlertTriangle,
  MessageSquare,
  ExternalLink,
  Phone,
  Navigation,
  ArrowLeft,
  CalendarDays,
  X,
  Upload,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer";
import { useMyDay, type MyDayBlock } from "@/hooks/useMyDay";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const statusConfig: Record<string, { label: string; color: string }> = {
  requested: { label: "Planlagt", color: "bg-info/10 text-info" },
  approved: { label: "Planlagt", color: "bg-info/10 text-info" },
  scheduled: { label: "Planlagt", color: "bg-info/10 text-info" },
  in_progress: { label: "Pågår", color: "bg-warning/10 text-warning" },
  completed: { label: "Ferdig", color: "bg-success/10 text-success" },
  ready_for_invoicing: { label: "Ferdig", color: "bg-success/10 text-success" },
};

function BlockCard({ block, onOpen }: { block: MyDayBlock; onOpen: (b: MyDayBlock) => void }) {
  const startTime = format(new Date(block.start_at), "HH:mm");
  const endTime = format(new Date(block.end_at), "HH:mm");
  const st = block.project_status ? statusConfig[block.project_status] : null;

  return (
    <Card className="active:scale-[0.99] transition-transform" onClick={() => onOpen(block)}>
      <CardContent className="p-4 flex gap-3">
        {/* Time strip */}
        <div className="flex flex-col items-center shrink-0 w-14 pt-0.5">
          <span className="text-sm font-bold tabular-nums">{startTime}</span>
          <div className="w-px flex-1 bg-border my-1" />
          <span className="text-xs text-muted-foreground tabular-nums">{endTime}</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold truncate">{block.project_title || block.outlook_subject || block.title}</h3>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
          </div>
          {block.customer && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{block.customer}</p>
          )}
          {block.address && (
            <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3 shrink-0" /> {block.address}
            </p>
          )}
          <div className="flex items-center gap-2 mt-2">
            {st && (
              <Badge variant="outline" className={cn("text-[10px] px-2 py-0 border-0 rounded-md", st.color)}>
                {st.label}
              </Badge>
            )}
            {block.source === "outlook" && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-0 rounded-md bg-muted text-muted-foreground">
                Outlook
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function JobDetailView({
  block,
  onClose,
  onRefetch,
}: {
  block: MyDayBlock;
  onClose: () => void;
  onRefetch: () => void;
}) {
  const navigate = useNavigate();
  const [completionNote, setCompletionNote] = useState("");
  const [showCompleteForm, setShowCompleteForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const startTime = format(new Date(block.start_at), "HH:mm");
  const endTime = format(new Date(block.end_at), "HH:mm");
  const dateStr = format(new Date(block.start_at), "EEEE d. MMMM", { locale: nb });
  const st = block.project_status ? statusConfig[block.project_status] : null;
  const isInProgress = block.project_status === "in_progress";
  const isCompleted = block.project_status === "completed" || block.project_status === "ready_for_invoicing";

  const handleStartWork = async () => {
    if (!block.project_id) return;
    setSubmitting(true);
    try {
      await supabase.from("events").update({ status: "in_progress" as any }).eq("id", block.project_id);
      await (supabase as any).from("activity_log").insert({
        entity_type: "event",
        entity_id: block.project_id,
        action: "status_change",
        type: "status_change",
        description: "Montør startet arbeid",
      });
      toast.success("Arbeid startet");
      onRefetch();
    } catch (e) {
      toast.error("Kunne ikke starte");
    } finally {
      setSubmitting(false);
    }
  };

  const handleComplete = async () => {
    if (!block.project_id) return;
    setSubmitting(true);
    try {
      await supabase.from("events").update({ status: "completed" as any }).eq("id", block.project_id);
      await (supabase as any).from("activity_log").insert({
        entity_type: "event",
        entity_id: block.project_id,
        action: "status_change",
        type: "status_change",
        description: completionNote || "Montør markerte ferdig",
      });
      toast.success("Oppdrag ferdigstilt");
      setShowCompleteForm(false);
      onRefetch();
    } catch (e) {
      toast.error("Kunne ikke fullføre");
    } finally {
      setSubmitting(false);
    }
  };

  const openMaps = () => {
    if (!block.address) return;
    const q = encodeURIComponent(block.address);
    window.open(`https://maps.google.com/maps?q=${q}`, "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border/60 bg-card shrink-0 safe-area-top">
        <button onClick={onClose} className="p-1 -ml-1 rounded-lg hover:bg-muted active:bg-muted/80">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold truncate">{block.project_title || block.title}</h1>
          <p className="text-xs text-muted-foreground">{dateStr} · {startTime}–{endTime}</p>
        </div>
        {st && (
          <Badge variant="outline" className={cn("text-[10px] px-2 py-0 border-0 rounded-md shrink-0", st.color)}>
            {st.label}
          </Badge>
        )}
      </header>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4">
          {/* Customer & location */}
          <Card>
            <CardContent className="p-4 space-y-3">
              {block.customer && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Kunde</p>
                  <p className="text-sm font-semibold mt-0.5">{block.customer}</p>
                </div>
              )}
              {block.address && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Adresse</p>
                  <p className="text-sm mt-0.5">{block.address}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 gap-2 text-xs"
                    onClick={openMaps}
                  >
                    <Navigation className="h-3.5 w-3.5" /> Start navigasjon
                  </Button>
                </div>
              )}
              {block.contact_phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  <a href={`tel:${block.contact_phone}`} className="text-sm text-primary underline">
                    {block.contact_person || block.contact_phone}
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Description */}
          {block.project_description && (
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">Hva skal gjøres</p>
                <p className="text-sm text-foreground whitespace-pre-line">{block.project_description}</p>
              </CardContent>
            </Card>
          )}

          {/* Outlook link */}
          {block.outlook_weblink && (
            <Button
              variant="outline"
              className="w-full gap-2 text-xs"
              onClick={() => window.open(block.outlook_weblink!, "_blank")}
            >
              <ExternalLink className="h-3.5 w-3.5" /> Åpne i Outlook
            </Button>
          )}

          {/* Completion form */}
          {showCompleteForm && (
            <Card className="border-success/30 bg-success/5">
              <CardContent className="p-4 space-y-3">
                <p className="text-sm font-semibold">Ferdigstill oppdrag</p>
                <Textarea
                  placeholder="Kort oppsummering av utført arbeid (valgfritt)"
                  value={completionNote}
                  onChange={(e) => setCompletionNote(e.target.value)}
                  rows={3}
                  className="text-sm"
                />
                <div className="flex gap-2">
                  <Button className="flex-1 gap-2" onClick={handleComplete} disabled={submitting}>
                    <CheckCircle2 className="h-4 w-4" /> Marker ferdig
                  </Button>
                  <Button variant="outline" onClick={() => setShowCompleteForm(false)}>Avbryt</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Bottom action bar */}
      {block.project_id && !isCompleted && (
        <div className="shrink-0 border-t border-border/60 bg-card p-4 safe-area-bottom">
          {!isInProgress ? (
            <Button className="w-full h-12 text-sm gap-2 font-semibold" onClick={handleStartWork} disabled={submitting}>
              <Play className="h-4 w-4" /> Start arbeid
            </Button>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <ActionButton icon={Camera} label="Ta bilde" onClick={() => navigate(`/projects/${block.project_id}`)} />
              <ActionButton icon={StickyNote} label="Notat" onClick={() => navigate(`/projects/${block.project_id}`)} />
              <ActionButton icon={AlertTriangle} label="Avvik" onClick={() => navigate(`/projects/${block.project_id}`)} />
              <ActionButton icon={MessageSquare} label="Chat" onClick={() => navigate(`/projects/${block.project_id}`)} />
            </div>
          )}
          {isInProgress && !showCompleteForm && (
            <Button
              className="w-full h-12 text-sm gap-2 font-semibold mt-2"
              variant="default"
              onClick={() => setShowCompleteForm(true)}
            >
              <CheckCircle2 className="h-4 w-4" /> Marker ferdig
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function ActionButton({ icon: Icon, label, onClick }: { icon: React.ElementType; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-muted/60 hover:bg-muted active:bg-muted/80 transition-colors"
    >
      <Icon className="h-5 w-5 text-foreground" />
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
    </button>
  );
}

function DayGroup({ label, blocks, onOpen }: { label: string; blocks: MyDayBlock[]; onOpen: (b: MyDayBlock) => void }) {
  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">{label}</h2>
      <div className="space-y-2">
        {blocks.map((b) => (
          <BlockCard key={b.id} block={b} onOpen={onOpen} />
        ))}
      </div>
    </section>
  );
}

export default function MyDayPage() {
  const { todayBlocks, upcomingBlocks, loading, refetch } = useMyDay();
  const [selectedBlock, setSelectedBlock] = useState<MyDayBlock | null>(null);

  if (selectedBlock) {
    return (
      <JobDetailView
        block={selectedBlock}
        onClose={() => { setSelectedBlock(null); refetch(); }}
        onRefetch={() => { refetch(); }}
      />
    );
  }

  // Group upcoming by date
  const upcomingByDate: Record<string, MyDayBlock[]> = {};
  for (const b of upcomingBlocks) {
    const d = format(new Date(b.start_at), "yyyy-MM-dd");
    if (!upcomingByDate[d]) upcomingByDate[d] = [];
    upcomingByDate[d].push(b);
  }

  const now = new Date();
  const greeting = now.getHours() < 12 ? "God morgen" : now.getHours() < 17 ? "God ettermiddag" : "God kveld";

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Hero header */}
      <div className="bg-primary/5 px-5 pt-6 pb-5 safe-area-top">
        <div className="flex items-center gap-3 mb-1">
          <Sun className="h-5 w-5 text-warning" />
          <h1 className="text-lg font-bold text-foreground">{greeting}</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {format(now, "EEEE d. MMMM", { locale: nb })} ·{" "}
          {todayBlocks.length === 0 ? "Ingen oppdrag i dag" : `${todayBlocks.length} oppdrag i dag`}
        </p>
      </div>

      <div className="px-4 pt-4 space-y-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        ) : (
          <>
            {/* Today */}
            {todayBlocks.length > 0 ? (
              <DayGroup label="I dag" blocks={todayBlocks} onOpen={setSelectedBlock} />
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <CalendarDays className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Ingen planlagte oppdrag i dag.</p>
                  <p className="text-xs text-muted-foreground mt-1">Sjekk Outlook-kalenderen for eventuelle endringer.</p>
                </CardContent>
              </Card>
            )}

            {/* Upcoming */}
            {Object.keys(upcomingByDate).length > 0 && (
              <div className="space-y-4 pt-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">Kommende</h2>
                {Object.entries(upcomingByDate).map(([dateStr, blocks]) => {
                  const d = new Date(dateStr);
                  const label = isTomorrow(d)
                    ? "I morgen"
                    : format(d, "EEEE d. MMM", { locale: nb });
                  return (
                    <DayGroup key={dateStr} label={label} blocks={blocks} onOpen={setSelectedBlock} />
                  );
                })}
              </div>
            )}

            {todayBlocks.length === 0 && upcomingBlocks.length === 0 && (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">Ingen kommende oppdrag denne uken.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
