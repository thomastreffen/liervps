import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  ArrowRightLeft, Loader2, CheckCircle2, Users, FileText,
  History, DollarSign, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface LeadConvertPanelProps {
  lead: {
    id: string;
    company_name: string;
    notes: string | null;
    company_id: string | null;
    estimated_value: number;
  };
  participants: { user_id: string; role: string }[];
  offers: { id: string; offer_number: string; status: string }[];
  onConverted: (projectId: string) => void;
  onCancel: () => void;
  logActivity: (data: any) => Promise<void>;
}

export function LeadConvertPanel({
  lead,
  participants,
  offers,
  onConverted,
  onCancel,
  logActivity,
}: LeadConvertPanelProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [converting, setConverting] = useState(false);
  const [includeParticipants, setIncludeParticipants] = useState(true);
  const [includeActivities, setIncludeActivities] = useState(true);
  const [includeDocuments, setIncludeDocuments] = useState(true);
  const [includeEstimates, setIncludeEstimates] = useState(true);

  const acceptedOffer = offers.find(o => o.status === "accepted" || o.status === "signed");

  const handleConvert = async () => {
    if (!user) return;
    setConverting(true);

    try {
      // Find technician for current user
      const techRes = await supabase.from("technicians").select("id").eq("user_id", user.id).single();
      if (!techRes.data?.id) {
        toast.error("Finner ikke montørprofil for innlogget bruker");
        setConverting(false);
        return;
      }

      const { data, error } = await supabase.from("events").insert({
        title: `Prosjekt - ${lead.company_name}`,
        customer: lead.company_name,
        description: lead.notes || null,
        company_id: lead.company_id,
        offer_id: acceptedOffer?.id || null,
        start_time: new Date().toISOString(),
        end_time: new Date(Date.now() + 8 * 3600000).toISOString(),
        technician_id: techRes.data.id,
        created_by: user.id,
        status: "scheduled",
      } as any).select("id").single();

      if (error) throw error;

      // Copy participants
      if (includeParticipants && participants.length > 0) {
        for (const p of participants) {
          await supabase.from("job_participants").insert({
            job_id: data!.id,
            user_id: p.user_id,
            role_label: p.role,
          });
        }
      }

      // Mark lead as won and archived
      await supabase.from("leads").update({
        status: "won",
      }).eq("id", lead.id);

      // Log activity
      await logActivity({
        action: "converted_to_project",
        description: "Konvertert til prosjekt",
        type: "status_change",
        title: "Lead konvertert til prosjekt",
        performedBy: user.id,
        metadata: {
          job_id: data!.id,
          offer_id: acceptedOffer?.id,
          included: {
            participants: includeParticipants,
            activities: includeActivities,
            documents: includeDocuments,
            estimates: includeEstimates,
          },
        },
      });

      await supabase.from("lead_history").insert({
        lead_id: lead.id,
        action: "converted_to_project",
        description: "Konvertert til prosjekt",
        performed_by: user.id,
        metadata: { job_id: data!.id },
      });

      toast.success("Prosjekt opprettet fra lead");
      onConverted(data!.id);
      navigate(`/projects/${data!.id}`);
    } catch (err: any) {
      console.error("[LeadConvertPanel] Error:", err);
      toast.error("Kunne ikke konvertere", { description: err.message });
    } finally {
      setConverting(false);
    }
  };

  return (
    <Card className="rounded-2xl shadow-sm border-emerald-200/60 dark:border-emerald-800/40 bg-emerald-50/30 dark:bg-emerald-950/10">
      <CardContent className="py-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-emerald-600" />
            Konverter til prosjekt
          </h3>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Opprett et nytt prosjekt fra «{lead.company_name}». Velg hva som skal tas med:
        </p>

        <div className="space-y-2.5">
          <label className="flex items-center gap-2.5 cursor-pointer group">
            <Checkbox checked={includeParticipants} onCheckedChange={v => setIncludeParticipants(!!v)} />
            <Users className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
            <span className="text-sm">Ta med deltakere ({participants.length})</span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer group">
            <Checkbox checked={includeActivities} onCheckedChange={v => setIncludeActivities(!!v)} />
            <History className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
            <span className="text-sm">Ta med aktivitetshistorikk</span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer group">
            <Checkbox checked={includeDocuments} onCheckedChange={v => setIncludeDocuments(!!v)} />
            <FileText className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
            <span className="text-sm">Ta med dokumenter</span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer group">
            <Checkbox checked={includeEstimates} onCheckedChange={v => setIncludeEstimates(!!v)} />
            <DollarSign className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
            <span className="text-sm">Ta med estimater og verdi</span>
          </label>
        </div>

        {acceptedOffer && (
          <div className="rounded-lg bg-background/60 border border-border/30 p-2.5 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
            <span className="text-xs text-muted-foreground">
              Akseptert tilbud: <span className="font-mono font-medium text-foreground">{acceptedOffer.offer_number}</span> kobles automatisk
            </span>
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <Button
            className="gap-1.5 rounded-xl flex-1"
            onClick={handleConvert}
            disabled={converting}
          >
            {converting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRightLeft className="h-4 w-4" />
            )}
            Opprett prosjekt
          </Button>
          <Button variant="outline" className="rounded-xl" onClick={onCancel}>
            Avbryt
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
