import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Loader2, Wrench, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  OFFER_LOST_REASONS, syncLeadOnOfferAccepted, syncLeadOnOfferRejected,
} from "@/lib/lead-status-sync";

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

/** Handlinger på sendte tilbud: aksepter, marker tapt, og opprett/bekreft oppdrag. */
export function OfferAcceptActions({ offer, leadId, onUpdated, onCreateJob }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [lostOpen, setLostOpen] = useState(false);
  const [lostReason, setLostReason] = useState<string>(OFFER_LOST_REASONS[0]);
  const [saving, setSaving] = useState(false);
  const [linkedJob, setLinkedJob] = useState<{ id: string; status: string } | null>(null);

  const isSent = Boolean(offer.offer_sent_at) || offer.status === "sent";
  const isAccepted = offer.status === "accepted" || Boolean(offer.offer_accepted_at);
  const isRejected = offer.status === "rejected";

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
      const { error } = await supabase
        .from("calculations")
        .update({ status: "accepted" as any, offer_accepted_at: offer.offer_accepted_at || nowIso } as any)
        .eq("id", offer.id);
      if (error) throw error;

      const { won } = await syncLeadOnOfferAccepted({
        leadId, offerId: offer.id, offerTitle: offer.project_title, userId: user?.id || null,
      });

      toast.success("Tilbudet er markert som akseptert", {
        description: won ? undefined : "Tilbud akseptert, venter på oppdrag.",
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

  const handleReject = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("calculations")
        .update({ status: "rejected" as any } as any)
        .eq("id", offer.id);
      if (error) throw error;

      await syncLeadOnOfferRejected({
        leadId, offerId: offer.id, offerTitle: offer.project_title,
        reason: lostReason, userId: user?.id || null,
      });

      toast.success("Tilbudet er markert som tapt/avslått");
      setLostOpen(false);
      onUpdated();
    } catch (e: any) {
      console.error("[OfferReject]", e);
      toast.error("Kunne ikke markere tilbudet som tapt", { description: e?.message });
    } finally {
      setSaving(false);
    }
  };

  if (!isSent && !isAccepted && !isRejected) return null;

  return (
    <>
      {!isAccepted && !isRejected && (
        <>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs rounded-lg gap-1.5"
            onClick={() => setConfirmOpen(true)}
          >
            <CheckCircle2 className="h-3 w-3" /> Marker som akseptert
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs rounded-lg gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
            onClick={() => setLostOpen(true)}
          >
            <XCircle className="h-3 w-3" /> Marker som tapt/avslått
          </Button>
        </>
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

      <AlertDialog open={lostOpen} onOpenChange={setLostOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marker tilbudet som tapt/avslått?</AlertDialogTitle>
            <AlertDialogDescription>
              «{offer.project_title}» settes til avslått, og henvendelsen settes til «tapt».
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Årsak (valgfri)</Label>
            <Select value={lostReason} onValueChange={setLostReason}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Velg årsak" />
              </SelectTrigger>
              <SelectContent>
                {OFFER_LOST_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleReject(); }}
              disabled={saving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Marker som tapt"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
