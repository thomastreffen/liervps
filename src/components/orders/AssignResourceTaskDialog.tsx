import { useState, useMemo, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { UserPlus, CalendarDays, Paperclip, CalendarIcon, Clock, ArrowRight } from "lucide-react";
import { TechnicianMultiSelect } from "@/components/TechnicianMultiSelect";
import { format, setHours, setMinutes } from "date-fns";
import { nb } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface AssignResourceTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissionId: string;
  submissionNo?: string;
  summary: Record<string, any> | null;
  values: Record<string, any>;
  attachments: any[];
}

// Generate time options in 15-min intervals for full 24h
const TIME_OPTIONS: string[] = [];
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 15) {
    TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
}

export function AssignResourceTaskDialog({
  open,
  onOpenChange,
  submissionId,
  submissionNo,
  summary,
  values,
  attachments,
}: AssignResourceTaskDialogProps) {
  const { user } = useAuth();
  const { activeCompanyId } = useCompanyContext();
  const qc = useQueryClient();

  const findVal = (...prefixes: string[]): string => {
    for (const prefix of prefixes) {
      if (values[prefix]) return String(values[prefix]);
      const key = Object.keys(values).find((k) => k.startsWith(prefix));
      if (key && values[key]) return String(values[key]);
    }
    return "";
  };

  // Parse initial date from submission
  const parseInitialDate = (): Date | undefined => {
    const raw = findVal("oensket_dato", "onsket_utfort_dato", "onsket_dato", "dato", "oensket_utfoert_dato");
    if (!raw) return undefined;
    try {
      // Handle various formats: "2026-03-25", "25.03.2026", etc.
      if (raw.includes("-")) return new Date(raw);
      if (raw.includes(".")) {
        const parts = raw.split(".");
        if (parts.length === 3) return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
      }
      return new Date(raw);
    } catch {
      return undefined;
    }
  };

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [customer, setCustomer] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [startTime, setStartTime] = useState("08:00");
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [endTime, setEndTime] = useState("16:00");
  const [selectedTechIds, setSelectedTechIds] = useState<string[]>([]);
  const [includeAttachments, setIncludeAttachments] = useState(true);

  // Reset all fields when dialog opens with fresh data
  useEffect(() => {
    if (!open) return;
    const initialDate = parseInitialDate();
    setTitle(findVal("oppdragstittel") || summary?.oppdragstittel || `Oppgave fra ${submissionNo || "bestilling"}`);
    setDescription(findVal("arbeidsbeskrivelse", "detaljert_arbeidsbeskrivelse", "beskrivelse") || "");
    setAddress(findVal("anleggsadresse", "oppdragssted", "adresse") || "");
    setCustomer(findVal("firmanavn", "kundenavn", "kunde") || summary?.kundenavn || "");
    setStartDate(initialDate);
    setEndDate(initialDate);
    setStartTime("08:00");
    setEndTime("16:00");
    setSelectedTechIds([]);
    setIncludeAttachments(true);
    // Log values for debugging
    console.log("[AssignResourceTask] values keys:", Object.keys(values));
    console.log("[AssignResourceTask] values:", values);
    console.log("[AssignResourceTask] summary:", summary);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyTime = (date: Date | undefined, time: string): Date => {
    const d = date ? new Date(date) : new Date();
    const [h, m] = time.split(":").map(Number);
    return setMinutes(setHours(d, h), m);
  };

  const computedStart = useMemo(() => applyTime(startDate, startTime), [startDate, startTime]);
  const computedEnd = useMemo(() => applyTime(endDate, endTime), [endDate, endTime]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!activeCompanyId) throw new Error("Mangler selskap");
      if (selectedTechIds.length === 0) throw new Error("Velg minst én montør");

      const startTime = computedStart || new Date();
      const endTime = computedEnd || new Date(startTime.getTime() + 8 * 60 * 60 * 1000);

      const descParts = [];
      if (customer) descParts.push(`Kunde: ${customer}`);
      if (address) descParts.push(`Adresse: ${address}`);
      if (description) descParts.push(`\n${description}`);

      const { data: newEvent, error: eventErr } = await supabase
        .from("events")
        .insert({
          company_id: activeCompanyId,
          title: title || "Oppgave uten tittel",
          description: descParts.join("\n"),
          address: address || null,
          customer: customer || null,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          status: "scheduled" as any,
          project_type: "service",
          created_by: user?.id,
          source_order_form_id: submissionId,
        })
        .select("id, internal_number")
        .single();

      if (eventErr) throw eventErr;

      const techRows = selectedTechIds.map((techId) => ({
        event_id: newEvent.id,
        technician_id: techId,
      }));
      await supabase.from("event_technicians").insert(techRows as any);

      if (includeAttachments && attachments.length > 0) {
        const attMeta: any[] = [];
        for (const att of attachments) {
          const storagePath = att.storage_path || att.file_path;
          if (!storagePath) continue;
          const newPath = `${activeCompanyId}/${newEvent.id}/${att.file_name}`;
          const { data: fileData } = await supabase.storage
            .from("order-form-attachments")
            .download(storagePath);
          if (fileData) {
            await supabase.storage
              .from("job-attachments")
              .upload(newPath, fileData, { contentType: att.mime_type });
          }
          const { data: urlData } = supabase.storage.from("job-attachments").getPublicUrl(newPath);
          attMeta.push({
            name: att.file_name,
            url: urlData.publicUrl,
            path: newPath,
            size: att.file_size,
            type: att.mime_type,
          });
        }
        if (attMeta.length > 0) {
          await supabase
            .from("events")
            .update({ attachments: attMeta })
            .eq("id", newEvent.id);
        }
      }

      // Auto-update ticket status to "task_created"
      await supabase
        .from("order_form_submissions")
        .update({
          status: "task_created",
          last_activity_at: new Date().toISOString(),
        })
        .eq("id", submissionId);

      // Fetch technician names for activity log
      let techNames: string[] = [];
      if (selectedTechIds.length > 0) {
        const { data: techs } = await supabase
          .from("technicians")
          .select("id, name")
          .in("id", selectedTechIds);
        techNames = (techs || []).map((t: any) => t.name).filter(Boolean);
      }

      const startFormatted = format(startTime, "d. MMM yyyy 'kl.' HH:mm", { locale: nb });

      await supabase.from("order_form_activity_log").insert({
        submission_id: submissionId,
        event_type: "converted_to_order",
        payload: {
          target_type: "resource_task",
          created_id: newEvent.id,
          internal_number: newEvent.internal_number,
          technician_count: selectedTechIds.length,
          technician_names: techNames,
          scheduled_start: startTime.toISOString(),
          scheduled_end: endTime.toISOString(),
          summary: techNames.length > 0
            ? `Tildelt ${techNames.join(", ")} ${startFormatted}`
            : `Planlagt ${startFormatted}`,
        },
        created_by: user?.id,
      });

      // Trigger Outlook calendar sync for each assigned technician
      try {
        await supabase.functions.invoke("calendar-write-sync", {
          body: { action: "create", event_id: newEvent.id },
        });
      } catch (e) {
        console.warn("[AssignResourceTask] Calendar sync failed:", e);
      }

      return newEvent;
    },
    onSuccess: (newEvent) => {
      qc.invalidateQueries({ queryKey: ["order-form-submission", submissionId] });
      qc.invalidateQueries({ queryKey: ["order-form-activity", submissionId] });
      toast.success("Ressursoppgave opprettet", {
        action: {
          label: "Åpne i ressursplan",
          onClick: () => {
            window.location.href = `/projects/plan?openTask=${newEvent.id}`;
          },
        },
      });
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Kunne ikke opprette oppgave");
    },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Tildel ressursoppgave
          </SheetTitle>
          <SheetDescription>
            Opprett en oppgave i ressursplanen basert på bestillingen. Rediger data og velg montører.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Tittel</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Kunde</Label>
              <Input value={customer} onChange={(e) => setCustomer(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Adresse</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Beskrivelse</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 min-h-[100px]"
              />
            </div>

            {/* Date & time section - Fra / Til */}
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tidspunkt</p>

              {/* FRA */}
              <div>
                <Label className="text-xs text-muted-foreground">Fra</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn("flex-1 justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                        {startDate ? format(startDate, "dd.MM.yyyy", { locale: nb }) : "Velg dato"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={(d) => {
                          setStartDate(d);
                          if (!endDate || (d && endDate < d)) setEndDate(d);
                        }}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                        locale={nb}
                      />
                    </PopoverContent>
                  </Popover>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <select
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {TIME_OPTIONS.map((t) => (
                        <option key={`s-${t}`} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-center">
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>

              {/* TIL */}
              <div>
                <Label className="text-xs text-muted-foreground">Til</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn("flex-1 justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                        {endDate ? format(endDate, "dd.MM.yyyy", { locale: nb }) : "Velg dato"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                        locale={nb}
                        disabled={(date) => startDate ? date < startDate : false}
                      />
                    </PopoverContent>
                  </Popover>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <select
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {TIME_OPTIONS.map((t) => (
                        <option key={`e-${t}`} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Tidsrom preview */}
              {startDate && endDate && (
                <p className="text-xs font-medium text-muted-foreground">
                  <span className="uppercase tracking-wider">Tidsrom</span>
                  <br />
                  <span className="text-foreground">
                    {format(computedStart, "dd.MM.yyyy HH:mm")} → {format(computedEnd, "dd.MM.yyyy HH:mm")}
                  </span>
                </p>
              )}
            </div>
          </div>

          <Separator />

          <TechnicianMultiSelect
            selectedIds={selectedTechIds}
            onChange={setSelectedTechIds}
          />

          <Separator />

          {attachments.length > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Inkluder vedlegg ({attachments.length})</span>
              </div>
              <button
                type="button"
                onClick={() => setIncludeAttachments(!includeAttachments)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  includeAttachments ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-background transition-transform ${
                    includeAttachments ? "translate-x-4.5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          )}

          {includeAttachments && attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {attachments.map((att: any) => (
                <Badge key={att.id} variant="outline" className="text-[10px]">
                  {att.file_name}
                </Badge>
              ))}
            </div>
          )}

          <Button
            className="w-full"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || selectedTechIds.length === 0}
          >
            {mutation.isPending ? "Oppretter..." : (
              <>
                <UserPlus className="h-4 w-4 mr-1.5" />
                Opprett og tildel ({selectedTechIds.length} montør{selectedTechIds.length !== 1 ? "er" : ""})
              </>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}