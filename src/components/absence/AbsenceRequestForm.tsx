import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { useAuth } from "@/hooks/useAuth";
import { ABSENCE_TYPE_LABELS, type AbsenceType } from "@/hooks/useAbsenceRequests";

interface PersonOption {
  person_id: string;
  full_name: string;
}

export function AbsenceRequestForm() {
  const { user } = useAuth();
  const { activeCompanyId, companies } = useCompanyContext();
  const [absenceType, setAbsenceType] = useState<AbsenceType>("ferie");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("16:00");
  const [isFullDay, setIsFullDay] = useState(true);
  const [comment, setComment] = useState("");
  const [companyId, setCompanyId] = useState(activeCompanyId || "");
  const [personId, setPersonId] = useState("");
  const [people, setPeople] = useState<PersonOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [isOnBehalf, setIsOnBehalf] = useState(false);
  const [myPersonId, setMyPersonId] = useState<string | null>(null);

  // Resolve current user's person_id
  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_accounts")
      .select("person_id")
      .eq("auth_user_id", user.id)
      .eq("is_active", true)
      .single()
      .then(({ data }) => {
        if (data?.person_id) {
          setMyPersonId(data.person_id);
          if (!isOnBehalf) setPersonId(data.person_id);
        }
      });
  }, [user]);

  // Load people for "on behalf" mode
  useEffect(() => {
    if (!isOnBehalf) return;
    const cid = companyId || activeCompanyId;
    if (!cid) return;

    supabase
      .from("employment_profiles")
      .select("person_id")
      .eq("company_id", cid)
      .is("archived_at", null)
      .then(async ({ data: eps }) => {
        if (!eps || eps.length === 0) { setPeople([]); return; }
        const pids = [...new Set(eps.map((e: any) => e.person_id))];
        const { data: ppl } = await supabase
          .from("people")
          .select("id, full_name")
          .in("id", pids)
          .eq("is_active", true)
          .order("full_name");
        setPeople((ppl || []).map((p: any) => ({ person_id: p.id, full_name: p.full_name })));
      });
  }, [isOnBehalf, companyId, activeCompanyId]);

  useEffect(() => {
    if (activeCompanyId) setCompanyId(activeCompanyId);
  }, [activeCompanyId]);

  const handleSubmit = async () => {
    if (!startDate || !endDate || !companyId || !personId) {
      toast.error("Fyll ut alle påkrevde felt");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("absence_requests").insert({
      person_id: personId,
      company_id: companyId,
      absence_type: absenceType,
      start_date: startDate,
      end_date: endDate,
      start_time: isFullDay ? null : startTime,
      end_time: isFullDay ? null : endTime,
      is_full_day: isFullDay,
      comment: comment || null,
      requested_by: user?.id || null,
    });
    setSubmitting(false);

    if (error) {
      toast.error("Feil ved innsending", { description: error.message });
    } else {
      toast.success("Forespørsel sendt");
      setStartDate("");
      setEndDate("");
      setComment("");
    }
  };

  return (
    <div className="rounded-lg border p-4 sm:p-6 space-y-5 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">På vegne av andre</p>
          <p className="text-[11px] text-muted-foreground">Registrer fravær for en annen ansatt</p>
        </div>
        <Switch checked={isOnBehalf} onCheckedChange={(v) => {
          setIsOnBehalf(v);
          if (!v && myPersonId) setPersonId(myPersonId);
          else setPersonId("");
        }} />
      </div>

      {isOnBehalf && (
        <div>
          <Label className="text-xs">Ansatt</Label>
          <Select value={personId} onValueChange={setPersonId}>
            <SelectTrigger><SelectValue placeholder="Velg ansatt..." /></SelectTrigger>
            <SelectContent>
              {people.map((p) => (
                <SelectItem key={p.person_id} value={p.person_id}>{p.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {!activeCompanyId && (
        <div>
          <Label className="text-xs">Selskap</Label>
          <Select value={companyId} onValueChange={setCompanyId}>
            <SelectTrigger><SelectValue placeholder="Velg selskap..." /></SelectTrigger>
            <SelectContent>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div>
        <Label className="text-xs">Type fravær</Label>
        <Select value={absenceType} onValueChange={(v) => setAbsenceType(v as AbsenceType)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(ABSENCE_TYPE_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-xs">Fra dato</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Til dato</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm">Heldag</Label>
          <p className="text-[11px] text-muted-foreground">Slå av for å angi klokkeslett</p>
        </div>
        <Switch checked={isFullDay} onCheckedChange={setIsFullDay} />
      </div>

      {!isFullDay && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Fra kl.</Label>
            <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} step="900" />
          </div>
          <div>
            <Label className="text-xs">Til kl.</Label>
            <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} step="900" />
          </div>
        </div>
      )}

      <div>
        <Label className="text-xs">Kommentar (valgfritt)</Label>
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
          placeholder="F.eks. Familieferie, syk barn, etc."
        />
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={submitting || !startDate || !endDate}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
          Send forespørsel
        </Button>
      </div>
    </div>
  );
}
