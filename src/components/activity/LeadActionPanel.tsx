import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  CalendarPlus, Mail, CheckCircle2, StickyNote,
  Loader2, Plus, Trash2, X, Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EmailComposer } from "@/components/EmailComposer";
import { ActivityComposer } from "@/components/activity/ActivityComposer";
import { toast } from "sonner";

export type ActionPanelTab = "meeting" | "task" | "email" | "note";

interface LeadActionPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: ActionPanelTab;
  lead: {
    id: string;
    company_name: string;
    email: string | null;
    lead_ref_code: string | null;
  };
  participantEmails?: string[];
  onActivityCreated?: () => void;
}

export function LeadActionPanel({
  open,
  onOpenChange,
  defaultTab = "note",
  lead,
  participantEmails = [],
  onActivityCreated,
}: LeadActionPanelProps) {
  const { user } = useAuth();

  // Meeting state
  const [meetingSubject, setMeetingSubject] = useState("Befaring");
  const [meetingStart, setMeetingStart] = useState("");
  const [meetingDuration, setMeetingDuration] = useState("60");
  const [meetingLocation, setMeetingLocation] = useState("");
  const [meetingAttendees, setMeetingAttendees] = useState<string[]>(participantEmails);
  const [teamsToggle, setTeamsToggle] = useState(false);
  const [creatingMeeting, setCreatingMeeting] = useState(false);

  const resetMeeting = () => {
    setMeetingSubject("Befaring");
    setMeetingStart("");
    setMeetingDuration("60");
    setMeetingLocation("");
    setMeetingAttendees(participantEmails);
    setTeamsToggle(false);
  };

  const handleCreateMeeting = async () => {
    if (!meetingStart) { toast.error("Velg dato og tid"); return; }
    setCreatingMeeting(true);
    try {
      const durationMs = Number(meetingDuration) * 60 * 1000;
      const startDate = new Date(meetingStart);
      const endDate = new Date(startDate.getTime() + durationMs);

      const { data, error } = await supabase.functions.invoke("lead-calendar-event", {
        body: {
          action: "create",
          lead_id: lead.id,
          start_time: startDate.toISOString(),
          end_time: endDate.toISOString(),
          location: meetingLocation || null,
          attendee_emails: meetingAttendees.filter(Boolean),
          subject_suffix: meetingSubject || "Befaring",
          teams_meeting: teamsToggle,
        },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      toast.success("Møte opprettet i Outlook");
      if (data?.web_link) window.open(data.web_link, "_blank");

      await supabase.from("activity_log").insert({
        entity_id: lead.id,
        entity_type: "lead",
        action: "meeting_created",
        type: "meeting",
        title: meetingSubject,
        description: `${meetingSubject} opprettet`,
        performed_by: user?.id,
        microsoft_event_id: data?.outlook_event_id,
      });

      resetMeeting();
      onActivityCreated?.();
      onOpenChange(false);
    } catch (err: any) {
      console.error("[LeadActionPanel] Meeting error:", err);
      toast.error("Kunne ikke opprette møte");
    } finally {
      setCreatingMeeting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md p-0 flex flex-col" side="right">
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/30 shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base">Ny aktivitet</SheetTitle>
          </div>
        </SheetHeader>

        <Tabs defaultValue={defaultTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-5 mt-3 flex-wrap">
            <TabsTrigger value="meeting" className="gap-1.5 text-xs">
              <CalendarPlus className="h-3.5 w-3.5" /> Møte
            </TabsTrigger>
            <TabsTrigger value="task" className="gap-1.5 text-xs">
              <CheckCircle2 className="h-3.5 w-3.5" /> Oppgave
            </TabsTrigger>
            <TabsTrigger value="email" className="gap-1.5 text-xs">
              <Mail className="h-3.5 w-3.5" /> E-post
            </TabsTrigger>
            <TabsTrigger value="note" className="gap-1.5 text-xs">
              <StickyNote className="h-3.5 w-3.5" /> Notat
            </TabsTrigger>
          </TabsList>

          {/* ── Meeting ── */}
          <TabsContent value="meeting" className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            <div className="space-y-1.5">
              <Label>Type / tittel</Label>
              <Select value={meetingSubject} onValueChange={setMeetingSubject}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Befaring">Befaring</SelectItem>
                  <SelectItem value="Møte">Møte</SelectItem>
                  <SelectItem value="Oppfølging">Oppfølging</SelectItem>
                  <SelectItem value="Presentasjon">Presentasjon</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Dato og tid *</Label>
                <Input type="datetime-local" value={meetingStart} onChange={e => setMeetingStart(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Varighet</Label>
                <Select value={meetingDuration} onValueChange={setMeetingDuration}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 min</SelectItem>
                    <SelectItem value="60">1 time</SelectItem>
                    <SelectItem value="90">1,5 timer</SelectItem>
                    <SelectItem value="120">2 timer</SelectItem>
                    <SelectItem value="180">3 timer</SelectItem>
                    <SelectItem value="240">4 timer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Sted</Label>
              <Input value={meetingLocation} onChange={e => setMeetingLocation(e.target.value)} placeholder="Adresse eller lokasjon…" />
            </div>

            {/* Teams toggle */}
            <button
              onClick={() => setTeamsToggle(!teamsToggle)}
              className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 w-full border transition-colors ${
                teamsToggle
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "bg-muted/30 text-muted-foreground border-border/40 hover:bg-muted/50"
              }`}
            >
              <Video className="h-3.5 w-3.5" />
              {teamsToggle ? "Teams-møte aktivert" : "Legg til Teams-link"}
            </button>

            {/* Attendees */}
            <div className="space-y-1.5">
              <Label>Deltakere (e-post)</Label>
              <div className="space-y-1.5">
                {meetingAttendees.map((emailAddr, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      value={emailAddr}
                      onChange={e => {
                        const updated = [...meetingAttendees];
                        updated[idx] = e.target.value;
                        setMeetingAttendees(updated);
                      }}
                      placeholder="e-post@example.com"
                      className="flex-1 h-8 text-xs"
                    />
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setMeetingAttendees(meetingAttendees.filter((_, i) => i !== idx))}>
                      <Trash2 className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="gap-1 text-xs h-7" onClick={() => setMeetingAttendees([...meetingAttendees, ""])}>
                  <Plus className="h-3 w-3" /> Legg til
                </Button>
              </div>
            </div>

            <div className="pt-2">
              <Button onClick={handleCreateMeeting} disabled={creatingMeeting || !meetingStart} className="w-full gap-1.5 rounded-xl">
                {creatingMeeting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
                Opprett møte
              </Button>
            </div>
          </TabsContent>

          {/* ── Task ── */}
          <TabsContent value="task" className="flex-1 overflow-y-auto px-5 py-4">
            <ActivityComposer
              entityType="lead"
              entityId={lead.id}
              forcedMode="task"
              onSubmitted={() => { onActivityCreated?.(); onOpenChange(false); }}
            />
          </TabsContent>

          {/* ── Email ── */}
          <TabsContent value="email" className="flex-1 overflow-y-auto px-5 py-4">
            <EmailComposer
              entityType="lead"
              entityId={lead.id}
              defaultTo={lead.email || undefined}
              defaultSubject={lead.company_name}
              refCode={lead.lead_ref_code || undefined}
              onSent={() => { onActivityCreated?.(); onOpenChange(false); }}
            />
          </TabsContent>

          {/* ── Note ── */}
          <TabsContent value="note" className="flex-1 overflow-y-auto px-5 py-4">
            <ActivityComposer
              entityType="lead"
              entityId={lead.id}
              forcedMode="note"
              onSubmitted={() => { onActivityCreated?.(); onOpenChange(false); }}
            />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
