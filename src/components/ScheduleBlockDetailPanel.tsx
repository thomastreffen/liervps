import { memo, useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import {
  X, ExternalLink, Check, ArrowRight, MapPin, Info,
  Calendar as CalendarIcon, User, FileText, Sparkles,
  Plus, Link2, Globe, Trash2, Loader2, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import type { ScheduleBlock } from "@/hooks/useScheduleBlocks";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface Props {
  block: ScheduleBlock;
  onClose: () => void;
  onConfirmed?: () => void;
}

const stateLabels: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  auto: { label: "Auto-koblet", variant: "default" },
  confirmed: { label: "Bekreftet", variant: "default" },
  needs_confirmation: { label: "Trenger bekreftelse", variant: "secondary" },
  external: { label: "Ekstern", variant: "outline" },
  external_confirmed: { label: "Ekstern (bekreftet)", variant: "outline" },
  manual: { label: "Manuell", variant: "default" },
};

interface ProjectOption {
  id: string;
  title: string;
  customer: string | null;
  internal_number: string | null;
}

export const ScheduleBlockDetailPanel = memo(function ScheduleBlockDetailPanel({ block, onClose, onConfirmed }: Props) {
  const navigate = useNavigate();
  const stateInfo = stateLabels[block.match_state] || stateLabels.external;
  const isOutlook = block.source === "outlook";
  const isSystem = block.source === "system" || block.source === "manual" || (block.source as string) === "linked_outlook";
  const hasNoProject = !block.project_id;

  // Action states
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Link to existing project
  const [showProjectSearch, setShowProjectSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProjectOption[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Search projects
  useEffect(() => {
    if (!showProjectSearch || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      const { data } = await supabase
        .from("events")
        .select("id, title, customer, internal_number")
        .is("deleted_at", null)
        .or(`title.ilike.%${searchQuery}%,customer.ilike.%${searchQuery}%,internal_number.ilike.%${searchQuery}%`)
        .order("title", { ascending: true })
        .limit(8);
      setSearchResults(data || []);
      setSearchLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, showProjectSearch]);

  // A) Action: Create new job from this outlook block
  const handleCreateJob = async () => {
    setActionLoading("create");
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;

      const { data: created, error } = await supabase.from("events").insert({
        title: block.outlook_subject || block.title || "Ny jobb",
        address: block.outlook_location || block.location || null,
        description: block.outlook_preview || block.description || null,
        start_time: block.start_at.toISOString(),
        end_time: block.end_at.toISOString(),
        technician_id: block.technician_id,
        status: "requested" as any,
        created_by: userId || null,
      } as any).select("id").single();

      if (error || !created) {
        toast.error("Kunne ikke opprette jobb", { description: error?.message });
        return;
      }

      // Assign technician
      await supabase.from("event_technicians").insert({
        event_id: created.id,
        technician_id: block.technician_id,
      });

      // Link schedule_block to the new project
      await supabase.from("schedule_blocks").update({
        project_id: created.id,
        match_state: "confirmed",
        match_reason: "Manuelt opprettet fra Outlook-blokk",
      }).eq("id", block.id);

      toast.success("Jobb opprettet og koblet ✓");
      onConfirmed?.();
      onClose();
    } catch (err: any) {
      toast.error("Feil", { description: err?.message });
    } finally {
      setActionLoading(null);
    }
  };

  // A) Action: Link to existing project
  const handleLinkProject = async (projectId: string) => {
    setActionLoading("link");
    try {
      const { error } = await supabase.from("schedule_blocks").update({
        project_id: projectId,
        match_state: "confirmed",
        match_reason: "Manuelt koblet fra sidepanel",
      }).eq("id", block.id);

      if (error) {
        toast.error("Kunne ikke koble");
        return;
      }

      // Log learning
      const subject = block.outlook_subject || block.title || "";
      const tokens = subject.split(/[\s–\-,.:;/()]+/).filter(w => w.length > 2).map(w => w.toLowerCase());
      try {
        await supabase.from("confirmation_learnings").insert({
          company_id: block.company_id,
          technician_id: block.technician_id,
          project_id: projectId,
          signal_tokens: tokens,
          source_block_id: block.id,
        });
      } catch { /* ignore */ }

      toast.success("Koblet til prosjekt ✓");
      onConfirmed?.();
      onClose();
    } catch (err: any) {
      toast.error("Feil", { description: err?.message });
    } finally {
      setActionLoading(null);
    }
  };

  // A) Action: Mark as external (will not appear as needing action)
  const handleMarkExternal = async () => {
    setActionLoading("external");
    try {
      const { error } = await supabase.from("schedule_blocks").update({
        match_state: "external_confirmed",
        project_id: null,
      }).eq("id", block.id);

      if (error) toast.error("Kunne ikke markere som ekstern");
      else {
        toast.success("Markert som ekstern");
        onConfirmed?.();
        onClose();
      }
    } catch (err: any) {
      toast.error("Feil", { description: err?.message });
    } finally {
      setActionLoading(null);
    }
  };

  // Confirm existing suggestion (from ConfirmationsPage logic)
  const handleConfirmSuggestion = async () => {
    if (!block.project_id) return;
    setActionLoading("confirm");
    try {
      const { error } = await supabase.from("schedule_blocks")
        .update({ match_state: "confirmed" })
        .eq("id", block.id);
      if (error) toast.error("Kunne ikke bekrefte");
      else {
        toast.success("Bekreftet ✓");

        // Log learning
        const subject = block.outlook_subject || block.title || "";
        const tokens = subject.split(/[\s–\-,.:;/()]+/).filter(w => w.length > 2).map(w => w.toLowerCase());
        try {
          await supabase.from("confirmation_learnings").insert({
            company_id: block.company_id,
            technician_id: block.technician_id,
            project_id: block.project_id,
            signal_tokens: tokens,
            source_block_id: block.id,
          });
        } catch { /* ignore */ }

        onConfirmed?.();
        onClose();
      }
    } catch { /* handled above */ } finally {
      setActionLoading(null);
    }
  };

  // B) Delete / Remove from plan
  const handleDelete = async () => {
    setActionLoading("delete");
    try {
      if (isSystem) {
        // Call edge function to delete from Outlook + soft-delete
        const { data, error } = await supabase.functions.invoke("delete-schedule-block", {
          body: { schedule_block_id: block.id },
        });

        if (error) {
          toast.error("Kunne ikke slette", { description: error.message });
          return;
        }

        const result = data as any;
        if (result?.status === "ok") {
          toast.success("Slettet", {
            description: result.deleted_in_outlook
              ? "Fjernet fra system og Outlook"
              : "Fjernet fra system",
          });
        } else {
          toast.error("Feil ved sletting");
        }
      } else {
        // Outlook block: soft-delete only (don't touch Graph)
        const { error } = await supabase.from("schedule_blocks")
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", block.id);

        if (error) {
          toast.error("Kunne ikke fjerne fra plan");
          return;
        }
        toast.success("Fjernet fra plan", {
          description: "Slett i Outlook for å fjerne den helt.",
        });
      }

      onConfirmed?.();
      onClose();
    } catch (err: any) {
      toast.error("Feil", { description: err?.message });
    } finally {
      setActionLoading(null);
      setShowDeleteConfirm(false);
    }
  };

  const outlookUrl = block.outlook_weblink
    || (block.calendar_id && block.outlook_event_id
      ? `https://outlook.office.com/calendar/item/${encodeURIComponent(block.outlook_event_id)}`
      : null);

  const isLoading = actionLoading !== null;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="fixed right-4 top-24 z-50 w-80 bg-card border border-border/60 rounded-2xl shadow-xl p-4 space-y-3 animate-in slide-in-from-right-4 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {isOutlook && (
              <div className="flex items-center gap-1.5 mb-1">
                <CalendarIcon className="h-3.5 w-3.5 text-primary" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">Outlook</span>
              </div>
            )}
            <p className="text-sm font-semibold truncate">{block.outlook_subject || block.title || "Uten tittel"}</p>
            <p className="text-xs text-muted-foreground">
              {block.technician_name} · {format(block.start_at, "EEE d. MMM HH:mm", { locale: nb })}–{format(block.end_at, "HH:mm")}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Location */}
        {(block.outlook_location || block.location) && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{block.outlook_location || block.location}</span>
          </div>
        )}

        {/* Organizer */}
        {block.outlook_organizer && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <User className="h-3 w-3 shrink-0" />
            <span className="truncate">{block.outlook_organizer}</span>
          </div>
        )}

        {/* Preview / description */}
        {block.outlook_preview && (
          <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <FileText className="h-3 w-3 shrink-0 mt-0.5" />
            <p className="line-clamp-3">{block.outlook_preview}</p>
          </div>
        )}

        {/* State badge + AI chip */}
        <div className="flex items-center gap-1.5">
          <Badge variant={stateInfo.variant} className="text-xs">
            {stateInfo.label}
          </Badge>
          {block.ai_confidence !== null && block.ai_confidence > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold uppercase tracking-wider text-primary bg-primary/10 rounded px-1.5 py-0.5 cursor-default">
                  <Sparkles className="h-2.5 w-2.5" />
                  AI {block.ai_confidence}%
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs max-w-[220px]">
                {block.ai_match_reason || `AI confidence: ${block.ai_confidence}%`}
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Project link (when linked) */}
        {block.project_title && block.project_id && (
          <button
            onClick={() => navigate(`/projects/${block.project_id}`)}
            className="flex items-center gap-2 w-full text-left p-2 rounded-lg bg-primary/5 hover:bg-primary/10 transition-colors"
          >
            <span className="text-xs font-medium text-primary truncate">{block.project_title}</span>
            <ArrowRight className="h-3 w-3 text-primary shrink-0" />
          </button>
        )}

        {/* AI suggestion line for needs_confirmation */}
        {block.match_state === "needs_confirmation" && block.project_title && block.project_id && (
          <div className="p-2 rounded-lg bg-amber-500/5 border border-amber-500/20">
            <p className="text-xs font-medium text-amber-700">
              Foreslått prosjekt: {block.project_title}
              {block.ai_confidence !== null && block.ai_confidence > 0 && (
                <span className="text-muted-foreground ml-1">(AI {block.ai_confidence}%)</span>
              )}
            </p>
            {block.match_reason && (
              <p className="text-[10px] text-muted-foreground mt-0.5">{block.match_reason}</p>
            )}
          </div>
        )}

        {/* ──── A) Outlook block without project: 3 actions ──── */}
        {isOutlook && hasNoProject && !showProjectSearch && (
          <div className="space-y-1.5 pt-1">
            <Button
              size="sm" className="h-8 text-xs gap-1.5 rounded-lg w-full justify-start"
              onClick={handleCreateJob} disabled={isLoading}
            >
              {actionLoading === "create" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              Opprett ny jobb
            </Button>
            <Button
              variant="outline" size="sm" className="h-8 text-xs gap-1.5 rounded-lg w-full justify-start"
              onClick={() => setShowProjectSearch(true)} disabled={isLoading}
            >
              <Link2 className="h-3 w-3" />
              Knytt til eksisterende
            </Button>
            <Button
              variant="ghost" size="sm" className="h-8 text-xs gap-1.5 rounded-lg w-full justify-start text-muted-foreground"
              onClick={handleMarkExternal} disabled={isLoading}
            >
              {actionLoading === "external" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Globe className="h-3 w-3" />}
              Behold ekstern
            </Button>
          </div>
        )}

        {/* Project search inline */}
        {showProjectSearch && (
          <div className="space-y-2 pt-1">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Søk prosjekt..."
                className="pl-8 h-8 text-xs"
                autoFocus
              />
            </div>
            {searchLoading && (
              <div className="flex justify-center py-2"><Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /></div>
            )}
            {searchResults.length > 0 && (
              <div className="max-h-32 overflow-y-auto space-y-0.5 rounded-lg border border-border p-1">
                {searchResults.map((p) => (
                  <button
                    key={p.id} type="button"
                    onClick={() => handleLinkProject(p.id)}
                    disabled={isLoading}
                    className="w-full text-left rounded-md px-2.5 py-1.5 text-xs hover:bg-muted transition-colors"
                  >
                    <p className="font-medium truncate">{p.title}</p>
                    <p className="text-[10px] text-muted-foreground">{p.internal_number} · {p.customer || "Ingen kunde"}</p>
                  </button>
                ))}
              </div>
            )}
            <Button variant="ghost" size="sm" className="h-7 text-xs w-full"
              onClick={() => { setShowProjectSearch(false); setSearchQuery(""); }}>
              Avbryt
            </Button>
          </div>
        )}

        {/* needs_confirmation with suggestion: Godta + Velg annet + Ekstern */}
        {block.match_state === "needs_confirmation" && block.project_id && !showProjectSearch && (
          <div className="flex items-center gap-1.5 pt-1">
            <Button size="sm" className="h-7 text-xs gap-1 rounded-lg flex-1" onClick={handleConfirmSuggestion} disabled={isLoading}>
              {actionLoading === "confirm" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Godta
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs rounded-lg"
              onClick={() => setShowProjectSearch(true)} disabled={isLoading}>
              Velg annet
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs rounded-lg text-muted-foreground"
              onClick={handleMarkExternal} disabled={isLoading}>
              Ekstern
            </Button>
          </div>
        )}

        {/* needs_confirmation without project */}
        {block.match_state === "needs_confirmation" && !block.project_id && !showProjectSearch && (
          <div className="space-y-1.5 pt-1">
            <Button size="sm" className="h-8 text-xs gap-1.5 rounded-lg w-full justify-start"
              onClick={handleCreateJob} disabled={isLoading}>
              {actionLoading === "create" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              Opprett ny jobb
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 rounded-lg w-full justify-start"
              onClick={() => setShowProjectSearch(true)} disabled={isLoading}>
              <Link2 className="h-3 w-3" />
              Knytt til eksisterende
            </Button>
            <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 rounded-lg w-full justify-start text-muted-foreground"
              onClick={handleMarkExternal} disabled={isLoading}>
              {actionLoading === "external" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Globe className="h-3 w-3" />}
              Behold ekstern
            </Button>
          </div>
        )}

        {/* Outlook link */}
        {outlookUrl && (
          <a href={outlookUrl} target="_blank" rel="noopener noreferrer" className="block">
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 rounded-lg w-full justify-start">
              <ExternalLink className="h-3 w-3" />
              Åpne i Outlook
            </Button>
          </a>
        )}

        {/* ──── B) Delete / Remove from plan ──── */}
        <div className="border-t border-border/40 pt-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost" size="sm"
                className="h-7 text-xs gap-1.5 rounded-lg w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isLoading}
              >
                <Trash2 className="h-3 w-3" />
                {isSystem ? "Slett" : "Fjern fra plan"}
              </Button>
            </TooltipTrigger>
            {!isSystem && (
              <TooltipContent side="bottom" className="text-xs max-w-[220px]">
                Dette er en Outlook-avtale. Slett i Outlook for å fjerne den helt.
              </TooltipContent>
            )}
          </Tooltip>
        </div>

        {/* Delete confirmation dialog */}
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {isSystem ? "Slett hendelse?" : "Fjern fra plan?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {isSystem
                  ? "Dette sletter hendelsen fra systemet og fra Outlook-kalenderen. Handlingen kan ikke angres."
                  : "Blokken fjernes fra planoversikten. Outlook-avtalen beholdes – slett den i Outlook for å fjerne den helt."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={actionLoading === "delete"}>Avbryt</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={actionLoading === "delete"}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {actionLoading === "delete" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : null}
                {isSystem ? "Slett" : "Fjern"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
});
