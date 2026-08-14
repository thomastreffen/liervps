import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CheckCircle2, Loader2, Wrench } from "lucide-react";
import { toast } from "sonner";

export interface AcceptOffer {
  id: string;
  project_title: string;
  status: string;
  offer_sent_at?: string | null;
  offer_accepted_at?: string | null;
}

interface Props {
  offer: AcceptOffer;
  leadId: string;
  onUpdated: () => void;
  /** Åpner eksisterende «Opprett oppdrag»-skuff, forhåndsutfylt fra tilbudet. */
  onCreateJob: (offer: AcceptOffer) => void;
}

/** Handlinger på sendte tilbud: marker som akseptert og opprett/bekreft oppdrag. */
export function OfferAcceptActions({ offer, leadId, onUpdated, onCreateJob }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [linkedJob, setLinkedJob] = useState<{ id: string; status: string } | null>(null);

  const isSent = Boolean(offer.offer_sent_at) || offer.status === "sent";
  const isAccepted = offer.status === "accepted" || Boolean(offer.offer_accepted_at);

  const fetchLinkedJob = useCallback(async () => {
    const { data } = await supabase
      .from("events")
      .select("id, status")
      .eq("source_calculation_id", offer.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setLinkedJob((data as any) || null);
  }, [offer.id]);

  useEffect(() => { fetchLinkedJob(); }, [fetchLinkedJob]);

  const handleAccept = async () => {
    setSaving(true);
    try {
      const nowIso = new Date().toISOString();
      const stamp = format(new Date(), "dd.MM.yyyy HH:mm");
      const { error } = await supabase
        .from("calculations")
        .update({ status: "accepted" as any, offer_accepted_at: offer.offer_accepted_at || nowIso } as any)
        .eq("id", offer.id);
      if (error) throw error;

      const note = `Tilbud akseptert: ${stamp}`;
      await supabase.from("lead_history").insert({
        lead_id: leadId, action: "offer_accepted", description: note,
        performed_by: user?.id, metadata: { offer_id: offer.id },
      } as any);
      await supabase.from("activity_log").insert({
        entity_type: "lead", entity_id: leadId, action: "offer_accepted", type: "note",
        title: offer.project_title, description: note, performed_by: user?.id || null,
        metadata: { offer_id: offer.id },
      } as any);

      // Lead settes kun til «vunnet» når et oppdrag faktisk er bekreftet.
      const { data: confirmedJob } = await supabase
        .from("events")
        .select("id")
        .eq("source_calculation_id", offer.id)
        .in("status", ["scheduled", "approved", "in_progress", "completed"] as any)
        .is("deleted_at", null)
        .limit(1)
        .maybeSingle();
      if (confirmedJob) {
        await supabase.from("leads").update({ status: "won" as any }).eq("id", leadId);
      }

      toast.success("Tilbudet er markert som akseptert", {
        description: confirmedJob ? undefined : "Opprett eller bekreft oppdraget for å sette henvendelsen til «vunnet».",
      });
      setConfirmOpen(false);
      onUpdated();
    } catch (e: any) {
      console.error("[OfferAccept]", e);
      toast.error("Kunne ikke markere tilbudet som akseptert", { description: e?.message });
    } finally {
      setSaving(false);
    }
  };

  if (!isSent && !isAccepted) return null;

  return (
    <>
      {!isAccepted && (
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs rounded-lg gap-1.5"
          onClick={() => setConfirmOpen(true)}
        >
          <CheckCircle2 className="h-3 w-3" /> Marker som akseptert
        </Button>
      )}

      {isAccepted && (
        <Button
          size="sm"
          variant={linkedJob ? "outline" : "default"}
          className="h-7 text-xs rounded-lg gap-1.5"
          onClick={() => {
            if (linkedJob) navigate(`/projects/${linkedJob.id}`);
            else onCreateJob(offer);
          }}
        >
          <Wrench className="h-3 w-3" /> {linkedJob ? "Åpne oppdrag" : "Opprett/bekreft oppdrag"}
        </Button>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marker tilbudet som akseptert?</AlertDialogTitle>
            <AlertDialogDescription>
              «{offer.project_title}» settes til akseptert med tidsstempel og notat. Henvendelsen settes til «vunnet»
              først når oppdraget er bekreftet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); handleAccept(); }} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Marker som akseptert"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
