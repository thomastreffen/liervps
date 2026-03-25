import { useState, useMemo } from "react";
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
import { UserPlus, CalendarDays, Paperclip, CalendarIcon, Clock } from "lucide-react";
import { TechnicianMultiSelect } from "@/components/TechnicianMultiSelect";
import { format, parse, setHours, setMinutes } from "date-fns";
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

const HOUR_OPTIONS = Array.from({ length: 15 }, (_, i) => i + 6); // 06-20
const DURATION_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12];

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
    const raw = findVal("onsket_utfort_dato", "onsket_dato", "dato", "oensket_utfoert_dato");
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

  const [title, setTitle] = useState(
    findVal("oppdragstittel") || summary?.oppdragstittel || `Oppgave fra ${submissionNo || "bestilling"}`
  );
  const [description, setDescription] = useState(
    findVal("detaljert_arbeidsbeskrivelse", "beskrivelse", "arbeidsbeskrivelse") || ""
  );
  const [address, setAddress] = useState(
    findVal("anleggsadresse", "adresse") || ""
  );
  const [customer, setCustomer] = useState(
    findVal("kundenavn", "kunde", "firmanavn") || summary?.kundenavn || ""
  );
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(parseInitialDate());
  const [startHour, setStartHour] = useState(8);
  const [durationHours, setDurationHours] = useState(8);
  const [selectedTechIds, setSelectedTechIds] = useState<string[]>([]);
  const [includeAttachments, setIncludeAttachments] = useState(true);

  const computedStart = useMemo(() => {
    if (!selectedDate) return null;
    return setMinutes(setHours(new Date(selectedDate), startHour), 0);
  }, [selectedDate, startHour]);

  const computedEnd = useMemo(() => {
    if (!computedStart) return null;
    return new Date(computedStart.getTime() + durationHours * 60 * 60 * 1000);
  }, [computedStart, durationHours]);

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
          status: "pending" as any,
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
          if (!att.storage_path) continue;
          const newPath = `${activeCompanyId}/${newEvent.id}/${att.file_name}`;
          const { data: fileData } = await supabase.storage
            .from("order-form-attachments")
            .download(att.storage_path);
          if (fileData) {
            await supabase.storage
              .from("job-attachments")
              .upload(newPath, fileData, { contentType: att.mime_type });
          }
          attMeta.push({
            name: att.file_name,
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

      await supabase.from("order_form_activity_log").insert({
        submission_id: submissionId,
        event_type: "converted_to_order",
        payload: {
          target_type: "resource_task",
          created_id: newEvent.id,
          internal_number: newEvent.internal_number,
          technician_count: selectedTechIds.length,
        },
        created_by: user?.id,
      });

      return newEvent;
    },
    onSuccess: (newEvent) => {
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

            {/* Date & time section */}
            <div className="space-y-3">
              <Label className="text-xs flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" />
                Dato og tid
              </Label>

              {/* Date picker */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate
                      ? format(selectedDate, "EEEE d. MMMM yyyy", { locale: nb })
                      : "Velg dato"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                    locale={nb}
                  />
                </PopoverContent>
              </Popover>

              {/* Start time & duration */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Starttid
                  </Label>
                  <select
                    value={startHour}
                    onChange={(e) => setStartHour(Number(e.target.value))}
                    className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {HOUR_OPTIONS.map((h) => (
                      <option key={h} value={h}>
                        {String(h).padStart(2, "0")}:00
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Varighet</Label>
                  <select
                    value={durationHours}
                    onChange={(e) => setDurationHours(Number(e.target.value))}
                    className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {DURATION_OPTIONS.map((d) => (
                      <option key={d} value={d}>
                        {d} time{d !== 1 ? "r" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Preview */}
              {selectedDate && (
                <p className="text-xs text-muted-foreground">
                  {format(selectedDate, "d. MMM", { locale: nb })} kl. {String(startHour).padStart(2, "0")}:00 – {String(startHour + durationHours).padStart(2, "0")}:00 ({durationHours}t)
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