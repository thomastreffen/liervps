import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Briefcase, ExternalLink, Loader2, Save } from "lucide-react";
import {
  useCommercialCase,
  COMMERCIAL_PHASES,
  type UpdateCommercialCaseInput,
} from "@/hooks/useCommercialCase";
import { useCompanyContext } from "@/hooks/useCompanyContext";

interface Props {
  caseId: string | null | undefined;
  /** Show "Open case" link in header */
  showOpenLink?: boolean;
}

interface OwnerOption { user_id: string; name: string }

/**
 * Full CRM-redigeringspanel for en commercial case, brukt som "Sak"-fane i
 * kalkyle/tilbud/lead. Dette er den eneste plassen modulene endrer eier/fase/
 * neste steg — felles SSOT er commercial_cases.
 */
export function CommercialCasePanel({ caseId, showOpenLink = true }: Props) {
  const navigate = useNavigate();
  const { activeCompanyId } = useCompanyContext();
  const { data, loading, saving, update } = useCommercialCase(caseId);
  const [owners, setOwners] = useState<OwnerOption[]>([]);

  const [phase, setPhase] = useState<string>("");
  const [ownerId, setOwnerId] = useState<string>("");
  const [nextStep, setNextStep] = useState<string>("");
  const [nextStepDue, setNextStepDue] = useState<string>("");
  const [valueEstimate, setValueEstimate] = useState<string>("");
  const [probability, setProbability] = useState<string>("");
  const [expectedClose, setExpectedClose] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!data) return;
    setPhase(data.phase || "lead");
    setOwnerId(data.owner_user_id || "");
    setNextStep(data.next_step || "");
    setNextStepDue(data.next_step_due_at ? data.next_step_due_at.slice(0, 16) : "");
    setValueEstimate(data.value_estimate != null ? String(data.value_estimate) : "");
    setProbability(data.probability_pct != null ? String(data.probability_pct) : "");
    setExpectedClose(data.expected_close_date || "");
    setDescription(data.description || "");
    setDirty(false);
  }, [data]);

  useEffect(() => {
    if (!activeCompanyId) return;
    (async () => {
      const { data: techs } = await supabase
        .from("technicians")
        .select("user_id, name")
        .eq("company_id", activeCompanyId)
        .not("user_id", "is", null)
        .order("name");
      setOwners(((techs || []) as any[]).filter(t => t.user_id));
    })();
  }, [activeCompanyId]);

  if (!caseId) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        Ingen sak er knyttet enda. Saken opprettes automatisk når kalkyle/tilbud får en kunde.
      </Card>
    );
  }
  if (loading && !data) {
    return (
      <Card className="p-10 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </Card>
    );
  }
  if (!data) {
    return <Card className="p-6 text-sm text-muted-foreground">Sak ikke funnet.</Card>;
  }

  const handleSave = async () => {
    const patch: UpdateCommercialCaseInput = {};
    if (phase !== data.phase) patch.phase = phase;
    if ((ownerId || null) !== data.owner_user_id) patch.owner_user_id = ownerId || null;
    if ((nextStep || null) !== data.next_step) patch.next_step = nextStep || null;
    const dueIso = nextStepDue ? new Date(nextStepDue).toISOString() : null;
    if (dueIso !== data.next_step_due_at) patch.next_step_due_at = dueIso;
    const valNum = valueEstimate ? Number(valueEstimate) : null;
    if (valNum !== data.value_estimate) patch.value_estimate = valNum;
    const probNum = probability ? Number(probability) : null;
    if (probNum !== data.probability_pct) patch.probability_pct = probNum;
    if ((expectedClose || null) !== data.expected_close_date) patch.expected_close_date = expectedClose || null;
    if ((description || null) !== data.description) patch.description = description || null;

    if (Object.keys(patch).length === 0) {
      setDirty(false);
      return;
    }
    await update(patch);
    setDirty(false);
  };

  const markDirty = () => setDirty(true);

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="p-4 flex items-center gap-3 bg-gradient-to-r from-primary/[0.04] to-transparent">
        <div className="rounded-xl bg-primary/10 p-2">
          <Briefcase className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-muted-foreground">Kommersiell sak</div>
          <div className="font-medium truncate">{data.title}</div>
        </div>
        {data.case_number && (
          <Badge variant="outline" className="font-mono text-xs">{data.case_number}</Badge>
        )}
        {showOpenLink && (
          <Button variant="ghost" size="sm" onClick={() => navigate(`/sales/cases/${data.id}`)} className="gap-1.5">
            <ExternalLink className="h-3.5 w-3.5" /> Åpne sak
          </Button>
        )}
      </Card>

      <Card className="p-5 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Fase</Label>
            <Select value={phase} onValueChange={(v) => { setPhase(v); markDirty(); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {COMMERCIAL_PHASES.map(p => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Ansvarlig</Label>
            <Select value={ownerId || "__none"} onValueChange={(v) => { setOwnerId(v === "__none" ? "" : v); markDirty(); }}>
              <SelectTrigger><SelectValue placeholder="Ingen" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Ingen</SelectItem>
                {owners.map(o => (
                  <SelectItem key={o.user_id} value={o.user_id}>{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label>Neste steg</Label>
            <Input
              value={nextStep}
              onChange={(e) => { setNextStep(e.target.value); markDirty(); }}
              placeholder="F.eks. ringe kunde for avklaring"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Frist for neste steg</Label>
            <Input
              type="datetime-local"
              value={nextStepDue}
              onChange={(e) => { setNextStepDue(e.target.value); markDirty(); }}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Forventet lukket</Label>
            <Input
              type="date"
              value={expectedClose}
              onChange={(e) => { setExpectedClose(e.target.value); markDirty(); }}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Estimert verdi (NOK)</Label>
            <Input
              type="number"
              inputMode="numeric"
              value={valueEstimate}
              onChange={(e) => { setValueEstimate(e.target.value); markDirty(); }}
              placeholder="0"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Sannsynlighet (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={probability}
              onChange={(e) => { setProbability(e.target.value); markDirty(); }}
              placeholder="0"
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label>Beskrivelse</Label>
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => { setDescription(e.target.value); markDirty(); }}
              placeholder="Kort intern beskrivelse av saken"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border/40">
          <p className="text-xs text-muted-foreground">
            Endringer her oppdaterer den felles saken og logges i aktivitet.
          </p>
          <Button onClick={handleSave} disabled={!dirty || saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Lagre
          </Button>
        </div>
      </Card>
    </div>
  );
}
