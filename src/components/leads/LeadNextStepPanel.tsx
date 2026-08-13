import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { CalendarPlus, CheckCircle2, ClipboardList, Copy, Loader2, Sparkles } from "lucide-react";
import { LEAD_STATUS_CONFIG, type LeadStatus } from "@/lib/lead-status";
import { toast } from "sonner";
import { calcSummaryLine } from "@/lib/calc-summary";

export interface NextStepLead {
  id: string;
  company_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  status: LeadStatus;
  company_id: string | null;
  public_lead_id?: string | null;
}

interface PublicLeadRow {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  segment: string | null;
  request_type: string | null;
  message: string | null;
  lead_source: string | null;
  selected_brand: string | null;
  selected_product_name: string | null;
  selected_solution_name: string | null;
  calculator_summary: any;
}

const REQUEST_TYPE_LABELS: Record<string, string> = {
  befaring: "Befaring",
  "modell-anbefaling": "Modell-anbefaling",
  "losning-anbefaling": "Løsning-anbefaling",
  beregning: "Beregning",
  service: "Service",
  feilsoking: "Feilsøking",
};

type Recommendation = { label: string; hint: string; action: "befaring" | "call" | "task" };

function recommend(requestType: string | null | undefined): Recommendation {
  switch ((requestType || "").toLowerCase()) {
    case "befaring":
      return { label: "Lag befaring", hint: "Kunden ønsker befaring – sett opp tidspunkt nå.", action: "befaring" };
    case "modell-anbefaling":
      return { label: "Ring kunde / lag befaring", hint: "Avklar behov og anbefal modell.", action: "call" };
    case "losning-anbefaling":
      return { label: "Ring kunde / lag befaring", hint: "Avklar behov og anbefal løsning.", action: "call" };
    case "beregning":
      return { label: "Ring kunde med beregning", hint: "Gå gjennom kalkulatorresultatet med kunden.", action: "call" };
    case "service":
      return { label: "Opprett serviceoppdrag", hint: "Registrer serviceoppgave og planlegg besøk.", action: "task" };
    case "feilsoking":
      return { label: "Opprett sak/oppdrag", hint: "Registrer feilsøkingsoppgave og planlegg besøk.", action: "task" };
    default:
      return { label: "Ring kunde / lag befaring", hint: "Ta kontakt for å avklare behov.", action: "call" };
  }
}

function fmtCalc(summary: any): string {
  return calcSummaryLine(summary);
}

interface Props {
  lead: NextStepLead;
  users: { id: string; name: string }[];
  onCreateBefaring: () => void;
  onChanged: () => void;
}

export function LeadNextStepPanel({ lead, users, onCreateBefaring, onChanged }: Props) {
  const { user } = useAuth();
  const { activeCompanyId } = useCompanyContext();
  const [pl, setPl] = useState<PublicLeadRow | null>(null);
  const [marking, setMarking] = useState(false);

  const [taskOpen, setTaskOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [taskUser, setTaskUser] = useState("__none__");
  const [taskNote, setTaskNote] = useState("");
  const [savingTask, setSavingTask] = useState(false);

  const [leadTasks, setLeadTasks] = useState<{ id: string; title: string; due_at: string | null; status: string }[]>([]);

  useEffect(() => {
    if (!lead.public_lead_id) { setPl(null); return; }
    supabase.from("public_leads").select("*").eq("id", lead.public_lead_id).maybeSingle()
      .then(({ data }) => setPl((data as any) || null));
  }, [lead.public_lead_id]);

  const fetchLeadTasks = useCallback(() => {
    supabase.from("tasks").select("id, title, due_at, status")
      .eq("linked_lead_id", lead.id)
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => setLeadTasks((data as any) || []));
  }, [lead.id]);

  useEffect(() => { fetchLeadTasks(); }, [fetchLeadTasks]);

  const rec = useMemo(() => recommend(pl?.request_type), [pl?.request_type]);
  const statusCfg = LEAD_STATUS_CONFIG[lead.status];

  // ── Marker kontaktet ──
  const markContacted = async () => {
    if (marking) return;
    setMarking(true);
    try {
      const stamp = format(new Date(), "dd.MM.yyyy HH:mm");
      const desc = `Kunde markert som kontaktet: ${stamp}`;
      const { error } = await supabase.from("leads").update({ status: "contacted" as any }).eq("id", lead.id);
      if (error) throw error;
      await supabase.from("lead_history").insert({
        lead_id: lead.id, action: "contacted", description: desc, performed_by: user?.id, metadata: {},
      } as any);
      await supabase.from("activity_log").insert({
        entity_type: "lead", entity_id: lead.id, action: "contacted", type: "note",
        title: "Kontaktet", description: desc, performed_by: user?.id || null, metadata: {},
      } as any);
      toast.success("Markert som kontaktet");
      onChanged();
    } catch (err: any) {
      console.error("[LeadNextStep] markContacted", err);
      toast.error("Kunne ikke oppdatere status", { description: err?.message });
    } finally {
      setMarking(false);
    }
  };

  // ── Kopier oppsummering ──
  const buildSummary = useCallback(() => {
    const segment = (pl?.segment || "").toLowerCase().startsWith("n") ? "næring" : "bolig";
    const name = pl?.name || lead.contact_name || lead.company_name;
    const product = [pl?.selected_brand, pl?.selected_product_name].filter(Boolean).join(" ");
    const requestLabel = REQUEST_TYPE_LABELS[(pl?.request_type || "").toLowerCase()] || pl?.request_type || "Henvendelse";
    const lines: string[] = [];
    lines.push(`Nettsidehenvendelse fra ${name}, ${segment}.`);
    if (product) lines.push(`Ønsker anbefaling på ${product}.`);
    else if (pl?.selected_solution_name) lines.push(`Ønsker løsning: ${pl.selected_solution_name}.`);
    lines.push(`Type: ${requestLabel}${pl?.lead_source ? ` (kilde: ${pl.lead_source})` : ""}`);
    if (lead.phone || pl?.phone) lines.push(`Telefon: ${lead.phone || pl?.phone}`);
    if (lead.email || pl?.email) lines.push(`E-post: ${lead.email || pl?.email}`);
    if (pl?.address) lines.push(`Adresse: ${pl.address}`);
    const calc = fmtCalc(pl?.calculator_summary);
    if (calc) lines.push(`Beregning: ${calc}`);
    const msg = pl?.message || lead.notes;
    if (msg) lines.push(`Melding: ${msg}`);
    lines.push(`Anbefalt neste steg: ${rec.label}`);
    return lines.join("\n");
  }, [pl, lead, rec]);

  const copySummary = async () => {
    const text = buildSummary();
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Oppsummering kopiert");
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      toast.success("Oppsummering kopiert");
    }
  };

  // ── Opprett oppgave ──
  const openTask = () => {
    const product = [pl?.selected_brand, pl?.selected_product_name].filter(Boolean).join(" ");
    const base = rec.action === "task" ? rec.label : `Følg opp ${pl?.name || lead.company_name}`;
    setTaskTitle(product ? `${base} – ${product}` : base);
    setTaskDue(format(new Date(Date.now() + 24 * 3600 * 1000), "yyyy-MM-dd'T'09:00"));
    setTaskUser("__none__");
    setTaskNote(buildSummary());
    setTaskOpen(true);
  };

  const saveTask = async () => {
    if (!taskTitle.trim() || savingTask) return;
    setSavingTask(true);
    try {
      let companyId = lead.company_id || activeCompanyId || null;
      if (!companyId) {
        const { data: ic } = await supabase.from("internal_companies").select("id").order("name").limit(1).maybeSingle();
        companyId = (ic as any)?.id ?? null;
      }
      if (!companyId || !user?.id) {
        toast.error("Fant ikke selskap for oppgaven");
        setSavingTask(false);
        return;
      }
      const assignee = taskUser !== "__none__" ? taskUser : null;
      const { data: createdTask, error } = await supabase.from("tasks").insert({
        title: taskTitle.trim(),
        description: taskNote.trim() || null,
        due_at: taskDue ? new Date(taskDue).toISOString() : null,
        assigned_user_id: assignee,
        owner_user_id: user.id,
        created_by: user.id,
        company_id: companyId,
        status: "open",
        priority: "normal",
        linked_lead_id: lead.id,
      } as any).select("id").single();
      if (error) throw error;

      if (assignee && createdTask?.id) {
        await (supabase as any).from("task_assignees").insert({ task_id: createdTask.id, user_id: assignee, role: "owner" });
        if (assignee !== user.id) {
          await (supabase as any).from("notifications").insert({
            user_id: assignee, company_id: companyId, type: "task_assigned",
            title: "Ny oppgave tildelt", message: taskTitle.trim(), link_url: `/tasks/${createdTask.id}`, read: false,
          });
        }
      }

      const desc = `Oppgave opprettet: ${taskTitle.trim()}${taskDue ? ` (frist ${format(new Date(taskDue), "dd.MM.yyyy HH:mm")})` : ""}`;
      await supabase.from("lead_history").insert({
        lead_id: lead.id, action: "task_created", description: desc, performed_by: user.id, metadata: {},
      } as any);
      await supabase.from("activity_log").insert({
        entity_type: "lead", entity_id: lead.id, action: "task_created", type: "note",
        title: "Oppgave", description: desc, performed_by: user.id, metadata: {},
      } as any);
      toast.success("Oppgave opprettet");
      setTaskOpen(false);
      fetchLeadTasks();
      onChanged();
    } catch (err: any) {
      console.error("[LeadNextStep] saveTask", err);
      toast.error("Kunne ikke opprette oppgave", { description: err?.message });
    } finally {
      setSavingTask(false);
    }
  };

  return (
    <>
      <Card className="rounded-2xl shadow-sm border-primary/20">
        <CardContent className="py-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Neste steg</span>
            <Badge variant="outline" className="text-[11px]">{statusCfg?.label || lead.status}</Badge>
            {pl?.request_type && (
              <Badge variant="secondary" className="text-[11px]">
                {REQUEST_TYPE_LABELS[pl.request_type.toLowerCase()] || pl.request_type}
              </Badge>
            )}
          </div>

          <div className="flex items-start gap-2 rounded-xl bg-primary/[0.05] p-3">
            <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold">{rec.label}</p>
              <p className="text-xs text-muted-foreground">{rec.hint}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="gap-1.5 rounded-xl" onClick={onCreateBefaring}>
              <CalendarPlus className="h-4 w-4" /> Lag befaring
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 rounded-xl" onClick={markContacted} disabled={marking}>
              {marking ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Marker kontaktet
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 rounded-xl" onClick={openTask}>
              <ClipboardList className="h-4 w-4" /> Opprett oppgave
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 rounded-xl" onClick={copySummary}>
              <Copy className="h-4 w-4" /> Kopier oppsummering
            </Button>
          </div>

          {leadTasks.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Oppgaver på henvendelsen</p>
              {leadTasks.map(t => (
                <div key={t.id} className="flex items-center gap-2 text-sm border-b border-border/30 last:border-0 py-1.5">
                  <ClipboardList className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="flex-1 min-w-0 truncate">{t.title}</span>
                  {t.due_at && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      {format(new Date(t.due_at), "dd.MM.yyyy HH:mm")}
                    </span>
                  )}
                  <Badge variant="outline" className="text-[10px] shrink-0">{t.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Opprett oppgave</DialogTitle>
            <DialogDescription>Oppgaven knyttes til denne henvendelsen.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Tittel *</Label>
              <Input value={taskTitle} onChange={e => setTaskTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Frist</Label>
              <Input type="datetime-local" value={taskDue} onChange={e => setTaskDue(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Ansvarlig</Label>
              <Select value={taskUser} onValueChange={setTaskUser}>
                <SelectTrigger><SelectValue placeholder="Ikke tildelt" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Ikke tildelt</SelectItem>
                  {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Notat</Label>
              <Textarea rows={5} value={taskNote} onChange={e => setTaskNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskOpen(false)}>Avbryt</Button>
            <Button onClick={saveTask} disabled={!taskTitle.trim() || savingTask}>
              {savingTask && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Opprett oppgave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
