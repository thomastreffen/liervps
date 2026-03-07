import { useState, useEffect, useCallback, Component, type ReactNode, type ErrorInfo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TechnicianMultiSelect } from "./TechnicianMultiSelect";
import { FileUpload } from "./FileUpload";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { useCalendarSync } from "@/hooks/useCalendarSync";

interface CreateJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedTechId?: string;
  onJobCreated?: () => void;
}

interface ErrorBoundaryProps { children: ReactNode; onReset: () => void }
interface ErrorBoundaryState { hasError: boolean; errorMsg: string }

class CreateJobErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, errorMsg: "" };
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMsg: error?.message || "Unknown error" };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("CreateJobDialog crashed:", error?.message, error?.stack, info?.componentStack);
    this.props.onReset();
  }
  render() {
    if (this.state.hasError) {
      return (
        <p className="p-4 text-sm text-destructive">
          Noe gikk galt: {this.state.errorMsg}. Prøv å lukke og åpne dialogen på nytt.
        </p>
      );
    }
    return this.props.children;
  }
}

interface ConflictInfo {
  technicianName: string;
  jobTitle: string;
  start: string;
  end: string;
}

function CreateJobDialogInner({
  open,
  onOpenChange,
  preselectedTechId,
  onJobCreated,
}: CreateJobDialogProps) {
  const [title, setTitle] = useState("");
  const [customer, setCustomer] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [jobNumber, setJobNumber] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("16:00");
  const [techIds, setTechIds] = useState<string[]>(preselectedTechId ? [preselectedTechId] : []);
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [clientRequestId, setClientRequestId] = useState(() => crypto.randomUUID());
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
  const [showMore, setShowMore] = useState(false);
  const { syncCreate } = useCalendarSync();

  // DB-based conflict check
  const checkConflicts = useCallback(async () => {
    const ids = Array.isArray(techIds) ? techIds : [];
    if (!startDate || !startTime || !endDate || !endTime || ids.length === 0) {
      setConflicts([]);
      return;
    }
    const startISO = new Date(`${startDate}T${startTime}`).toISOString();
    const endISO = new Date(`${endDate}T${endTime}`).toISOString();

    const { data: overlapping } = await supabase
      .from("event_technicians")
      .select(`
        technician_id,
        technicians ( name ),
        events:event_id ( id, title, start_time, end_time )
      `)
      .in("technician_id", ids);

    if (!overlapping) { setConflicts([]); return; }

    const found: ConflictInfo[] = [];
    for (const row of overlapping as any[]) {
      const ev = row.events;
      if (!ev) continue;
      if (ev.start_time < endISO && ev.end_time > startISO) {
        found.push({
          technicianName: row.technicians?.name ?? "Ukjent",
          jobTitle: ev.title?.replace("SERVICE – ", "") ?? "",
          start: format(new Date(ev.start_time), "HH:mm"),
          end: format(new Date(ev.end_time), "HH:mm"),
        });
      }
    }
    setConflicts(found);
  }, [techIds, startDate, startTime, endDate, endTime]);

  useEffect(() => {
    if (open) checkConflicts();
  }, [open, checkConflicts]);

  const safeTechIds = Array.isArray(techIds) ? techIds : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (safeTechIds.length === 0 || submitting || submitted) return;
    setSubmitting(true);

    try {
      const startISO = new Date(`${startDate}T${startTime}`).toISOString();
      const endISO = new Date(`${endDate}T${endTime}`).toISOString();

      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;

      const { data: createdEvent, error: eventError } = await supabase
        .from("events")
        .insert({
          title: `SERVICE – ${title}`,
          customer,
          address: address || null,
          description: description || null,
          job_number: jobNumber || null,
          start_time: startISO,
          end_time: endISO,
          technician_id: safeTechIds[0],
          status: "requested",
          created_by: userId || null,
          client_request_id: clientRequestId,
        })
        .select("id")
        .single();

      if (eventError || !createdEvent) {
        toast.error("Kunne ikke opprette jobb", { description: eventError?.message });
        setSubmitting(false);
        return;
      }

      // Upload files
      if (files.length > 0) {
        const attachments: { name: string; url: string; size: number }[] = [];
        for (const file of files) {
          const filePath = `${createdEvent.id}/${Date.now()}-${file.name}`;
          const { error: uploadError } = await supabase.storage
            .from("job-attachments")
            .upload(filePath, file);
          if (uploadError) { toast.error(`Kunne ikke laste opp ${file.name}`); continue; }
          const { data: urlData } = supabase.storage.from("job-attachments").getPublicUrl(filePath);
          attachments.push({ name: file.name, url: urlData.publicUrl, size: file.size });
        }
        if (attachments.length > 0) {
          await supabase.from("events").update({ attachments }).eq("id", createdEvent.id);
        }
      }

      // Insert event_technicians
      const techInserts = safeTechIds.map((techId) => ({
        event_id: createdEvent.id,
        technician_id: techId,
      }));
      const { error: techError } = await supabase.from("event_technicians").insert(techInserts);
      if (techError) {
        toast.error("Jobb opprettet, men montørtilknytning feilet", { description: techError.message });
      }

      // Create approval & sync to Outlook
      const { data: approvalData, error: approvalError } = await supabase.functions.invoke(
        "create-approval",
        { body: { job_id: createdEvent.id } }
      );

      if (approvalError || approvalData?.error) {
        toast.error("Jobb opprettet, men godkjenning feilet");
      } else {
        toast.success("Jobb opprettet og sendt til montør", {
          description: `${title} – ${safeTechIds.length} montør(er)`,
        });
        syncCreate(createdEvent.id);
      }

      setSubmitted(true);
      onOpenChange(false);
      resetForm();
      onJobCreated?.();
    } catch (err: any) {
      toast.error("Noe gikk galt", { description: err?.message || "Ukjent feil" });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setCustomer("");
    setAddress("");
    setDescription("");
    setJobNumber("");
    setStartDate("");
    setEndDate("");
    setTechIds(preselectedTechId ? [preselectedTechId] : []);
    setFiles([]);
    setSubmitted(false);
    setShowMore(false);
    setClientRequestId(crypto.randomUUID());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ny jobb</DialogTitle>
          <DialogDescription>Opprett en servicejobb og send til montør</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Essential fields */}
          <div className="space-y-1.5">
            <Label htmlFor="title">Hva skal gjøres? *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="F.eks. Bytte varmepumpe"
              required
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="customer">Kunde *</Label>
            <Input
              id="customer"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              placeholder="Kundenavn"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label>Montør *</Label>
            <TechnicianMultiSelect selectedIds={techIds} onChange={setTechIds} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Startdato *</Label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (!endDate) setEndDate(e.target.value);
                  }}
                  required
                />
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                  className="w-24"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Sluttdato *</Label>
              <div className="flex gap-2">
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required className="w-24" />
              </div>
            </div>
          </div>

          {/* Conflict warning */}
          {conflicts.length > 0 && (
            <div className="rounded-lg border-2 border-destructive/30 bg-destructive/5 p-3 space-y-2">
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4" />
                <p className="text-sm font-medium">Overlappende jobber</p>
              </div>
              <div className="space-y-1">
                {conflicts.map((c, i) => (
                  <p key={i} className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{c.technicianName}</span> har allerede{" "}
                    <span className="font-medium">"{c.jobTitle}"</span> {c.start}–{c.end}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Show more toggle */}
          <Button
            type="button"
            variant="ghost"
            className="w-full gap-1.5 text-xs text-muted-foreground h-8"
            onClick={() => setShowMore(!showMore)}
          >
            {showMore ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {showMore ? "Skjul detaljer" : "Adresse, beskrivelse, vedlegg…"}
          </Button>

          {showMore && (
            <div className="space-y-4 pt-1 border-t border-border/50">
              <div className="space-y-1.5">
                <Label htmlFor="address">Adresse</Label>
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Gateadresse, sted"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="jobNumber">Jobbnummer</Label>
                <Input
                  id="jobNumber"
                  value={jobNumber}
                  onChange={(e) => setJobNumber(e.target.value)}
                  placeholder="F.eks. P-12345"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description">Beskrivelse</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Kort beskrivelse til montøren..."
                  rows={3}
                />
              </div>

              <FileUpload files={files} onChange={setFiles} />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Avbryt
            </Button>
            <Button type="submit" disabled={safeTechIds.length === 0 || submitting || submitted}>
              {submitting ? "Oppretter…" : "Opprett og send"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CreateJobDialog(props: CreateJobDialogProps) {
  return (
    <CreateJobErrorBoundary onReset={() => props.onOpenChange(false)}>
      <CreateJobDialogInner {...props} />
    </CreateJobErrorBoundary>
  );
}
