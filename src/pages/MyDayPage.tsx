import { useState, useRef, useCallback } from "react";
import { checkRequiredForms } from "@/components/forms/ProjectFormsSection";
import { useNavigate } from "react-router-dom";
import { format, isTomorrow } from "date-fns";
import { nb } from "date-fns/locale";
import {
  Sun,
  MapPin,
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
  FileText,
  MapPinCheck,
  MapPinOff,
  Loader2,
  FileImage,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useMyDay, type MyDayBlock } from "@/hooks/useMyDay";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { MyDayChecklists } from "@/components/forms/MyDayChecklists";

/* ─── Status helpers ─── */

const statusConfig: Record<string, { label: string; color: string }> = {
  requested: { label: "Planlagt", color: "bg-info/10 text-info" },
  approved: { label: "Planlagt", color: "bg-info/10 text-info" },
  scheduled: { label: "Planlagt", color: "bg-info/10 text-info" },
  in_progress: { label: "Pågår", color: "bg-warning/10 text-warning" },
  completed: { label: "Ferdig", color: "bg-success/10 text-success" },
  ready_for_invoicing: { label: "Ferdig", color: "bg-success/10 text-success" },
};

type Phase = "planned" | "in_progress" | "documented" | "completed";

function getPhase(status: string | null): Phase {
  if (!status) return "planned";
  if (status === "completed" || status === "ready_for_invoicing") return "completed";
  if (status === "in_progress") return "in_progress";
  return "planned";
}

interface PrimaryCTA {
  label: string;
  icon: React.ElementType;
  variant: "default" | "outline" | "secondary";
}

function getPrimaryCTA(phase: Phase): PrimaryCTA {
  switch (phase) {
    case "planned":
      return { label: "Start arbeid", icon: Play, variant: "default" };
    case "in_progress":
      return { label: "Dokumenter arbeid", icon: Camera, variant: "default" };
    case "completed":
      return { label: "Se rapport", icon: FileText, variant: "outline" };
    default:
      return { label: "Se detaljer", icon: ChevronRight, variant: "outline" };
  }
}

/* ─── GPS Check-in ─── */

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
      { headers: { "User-Agent": "MCSService/1.0" } }
    );
    const data = await resp.json();
    if (data?.[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {}
  return null;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ─── Block Card ─── */

function BlockCard({ block, onOpen }: { block: MyDayBlock; onOpen: (b: MyDayBlock) => void }) {
  const startTime = format(new Date(block.start_at), "HH:mm");
  const endTime = format(new Date(block.end_at), "HH:mm");
  const st = block.project_status ? statusConfig[block.project_status] : null;
  const phase = getPhase(block.project_status);
  const cta = getPrimaryCTA(phase);

  return (
    <Card className="active:scale-[0.99] transition-transform" onClick={() => onOpen(block)}>
      <CardContent className="p-4 flex gap-3">
        <div className="flex flex-col items-center shrink-0 w-14 pt-0.5">
          <span className="text-sm font-bold tabular-nums">{startTime}</span>
          <div className="w-px flex-1 bg-border my-1" />
          <span className="text-xs text-muted-foreground tabular-nums">{endTime}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold truncate">{block.project_title || block.outlook_subject || block.title}</h3>
          {block.customer && <p className="text-xs text-muted-foreground truncate mt-0.5">{block.customer}</p>}
          {block.address && (
            <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3 shrink-0" /> {block.address}
            </p>
          )}
          <div className="flex items-center gap-2 mt-2.5">
            {st && (
              <Badge variant="outline" className={cn("text-[10px] px-2 py-0 border-0 rounded-md", st.color)}>
                {st.label}
              </Badge>
            )}
            {block.project_id && (
              <span className="ml-auto flex items-center gap-1 text-[11px] font-medium text-primary">
                <cta.icon className="h-3 w-3" /> {cta.label}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Job Detail View ─── */

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [completionNote, setCompletionNote] = useState("");
  const [showCompleteForm, setShowCompleteForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [gpsState, setGpsState] = useState<"idle" | "checking" | "on_site" | "off_site" | "error">("idle");
  const [photoCount, setPhotoCount] = useState(0);

  const startTime = format(new Date(block.start_at), "HH:mm");
  const endTime = format(new Date(block.end_at), "HH:mm");
  const dateStr = format(new Date(block.start_at), "EEEE d. MMMM", { locale: nb });
  const st = block.project_status ? statusConfig[block.project_status] : null;
  const phase = getPhase(block.project_status);

  const checkGpsAndStart = useCallback(async () => {
    if (!block.project_id) return;
    setSubmitting(true);

    // Try GPS check if we have an address
    if (block.address && "geolocation" in navigator) {
      setGpsState("checking");
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000, enableHighAccuracy: true })
        );
        const target = await geocodeAddress(block.address);
        if (target) {
          const dist = haversineKm(pos.coords.latitude, pos.coords.longitude, target.lat, target.lng);
          if (dist <= 0.5) {
            setGpsState("on_site");
            toast.success("Du er på stedet ✓");
          } else {
            setGpsState("off_site");
            const proceed = window.confirm(
              `Du ser ut til å være ${dist.toFixed(1)} km fra oppdraget.\n\nEr du på riktig lokasjon?`
            );
            if (!proceed) {
              setSubmitting(false);
              setGpsState("idle");
              return;
            }
          }
        } else {
          setGpsState("idle"); // can't geocode, just proceed
        }
      } catch {
        setGpsState("idle"); // GPS unavailable, just proceed
      }
    }

    // Do the start
    try {
      await supabase.from("events").update({ status: "in_progress" as any }).eq("id", block.project_id);
      await (supabase as any).from("activity_log").insert({
        entity_type: "event",
        entity_id: block.project_id,
        action: "status_change",
        type: "status_change",
        description: gpsState === "on_site" ? "Montør sjekket inn på stedet og startet arbeid" : "Montør startet arbeid",
      });
      toast.success("Arbeid startet");
      onRefetch();
    } catch {
      toast.error("Kunne ikke starte");
    } finally {
      setSubmitting(false);
    }
  }, [block, gpsState, onRefetch]);

  const handleComplete = async () => {
    if (!block.project_id) return;
    setSubmitting(true);

    // Check required forms
    const { canComplete, missingForms } = await checkRequiredForms(block.project_id, "required_before_completion");
    if (!canComplete) {
      toast.error("Obligatoriske skjema mangler", {
        description: `Fullfør: ${missingForms.join(", ")}`,
        duration: 5000,
      });
      setSubmitting(false);
      return;
    }

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
    } catch {
      toast.error("Kunne ikke fullføre");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCameraCapture = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !block.project_id) return;

    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `project-photos/${block.project_id}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;

      const { error } = await supabase.storage.from("attachments").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });

      if (error) {
        console.error("[Photo upload]", error);
        toast.error("Kunne ikke laste opp bilde");
      } else {
        setPhotoCount((c) => c + 1);
        toast.success("Bilde lagret ✓");

        // Log the photo
        await (supabase as any).from("activity_log").insert({
          entity_type: "event",
          entity_id: block.project_id,
          action: "photo_uploaded",
          type: "attachment",
          description: `Montør tok bilde (${file.name})`,
        });
      }
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [block.project_id]);

  const openCamera = () => fileInputRef.current?.click();

  const openMaps = () => {
    if (!block.address) return;
    const q = encodeURIComponent(block.address);
    window.open(`https://maps.google.com/maps?q=${q}`, "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col overflow-hidden">
      {/* Hidden file input for camera */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={handleCameraCapture}
      />

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

      {/* GPS status banner */}
      {gpsState === "checking" && (
        <div className="flex items-center gap-2 px-4 py-2 bg-info/10 text-info text-xs font-medium">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Sjekker posisjon…
        </div>
      )}
      {gpsState === "on_site" && (
        <div className="flex items-center gap-2 px-4 py-2 bg-success/10 text-success text-xs font-medium">
          <MapPinCheck className="h-3.5 w-3.5" /> Du er på stedet ✓
        </div>
      )}
      {gpsState === "off_site" && (
        <div className="flex items-center gap-2 px-4 py-2 bg-warning/10 text-warning text-xs font-medium">
          <MapPinOff className="h-3.5 w-3.5" /> Posisjon avviker fra oppdragsadresse
        </div>
      )}

      {/* Photo count banner */}
      {photoCount > 0 && (
        <div className="flex items-center gap-2 px-4 py-1.5 bg-primary/5 text-primary text-xs font-medium">
          <FileImage className="h-3.5 w-3.5" /> {photoCount} bilde{photoCount > 1 ? "r" : ""} lastet opp
        </div>
      )}

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
                  <Button variant="outline" size="sm" className="mt-2 gap-2 text-xs" onClick={openMaps}>
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

          {/* Checklists */}
          {block.project_id && (
            <MyDayChecklists projectId={block.project_id} />
          )}

          {/* Outlook link */}
          {block.outlook_weblink && (
            <Button variant="outline" className="w-full gap-2 text-xs" onClick={() => window.open(block.outlook_weblink!, "_blank")}>
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
                <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={openCamera}>
                  <Camera className="h-3.5 w-3.5" /> Legg til bilde
                </Button>
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

      {/* Bottom action bar – dynamic per phase */}
      {block.project_id && (
        <div className="shrink-0 border-t border-border/60 bg-card p-4 safe-area-bottom space-y-2">
          {phase === "planned" && (
            <Button className="w-full h-14 text-sm gap-2 font-semibold rounded-xl" onClick={checkGpsAndStart} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-5 w-5" />}
              Start arbeid
            </Button>
          )}

          {phase === "in_progress" && !showCompleteForm && (
            <>
              {/* Primary: Document */}
              <Button className="w-full h-14 text-sm gap-2 font-semibold rounded-xl" onClick={openCamera}>
                <Camera className="h-5 w-5" /> Dokumenter arbeid
              </Button>
              {/* Secondary actions */}
              <div className="grid grid-cols-3 gap-2">
                <ActionButton icon={StickyNote} label="Notat" onClick={() => navigate(`/projects/${block.project_id}`)} />
                <ActionButton icon={AlertTriangle} label="Avvik" onClick={() => navigate(`/projects/${block.project_id}`)} />
                <ActionButton icon={MessageSquare} label="Chat" onClick={() => navigate(`/projects/${block.project_id}`)} />
              </div>
              {/* Finish */}
              <Button
                className="w-full h-12 text-sm gap-2 font-semibold rounded-xl"
                variant="secondary"
                onClick={() => setShowCompleteForm(true)}
              >
                <CheckCircle2 className="h-4 w-4" /> Marker ferdig
              </Button>
            </>
          )}

          {phase === "completed" && (
            <Button
              className="w-full h-14 text-sm gap-2 font-semibold rounded-xl"
              variant="outline"
              onClick={() => navigate(`/projects/${block.project_id}`)}
            >
              <FileText className="h-5 w-5" /> Se rapport
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Action Button ─── */

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

/* ─── Day Group ─── */

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

/* ─── Main Page ─── */

export default function MyDayPage() {
  const { todayBlocks, upcomingBlocks, loading, refetch } = useMyDay();
  const [selectedBlock, setSelectedBlock] = useState<MyDayBlock | null>(null);

  if (selectedBlock) {
    return (
      <JobDetailView
        block={selectedBlock}
        onClose={() => { setSelectedBlock(null); refetch(); }}
        onRefetch={refetch}
      />
    );
  }

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
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
          </div>
        ) : (
          <>
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

            {Object.keys(upcomingByDate).length > 0 && (
              <div className="space-y-4 pt-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">Kommende</h2>
                {Object.entries(upcomingByDate).map(([dateStr, blocks]) => {
                  const d = new Date(dateStr);
                  const label = isTomorrow(d) ? "I morgen" : format(d, "EEEE d. MMM", { locale: nb });
                  return <DayGroup key={dateStr} label={label} blocks={blocks} onOpen={setSelectedBlock} />;
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
