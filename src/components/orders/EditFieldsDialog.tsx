import { useState, useMemo, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { AlertCircle, Pencil } from "lucide-react";

interface FieldDef {
  id: string;
  field_key: string;
  label: string;
  field_type: string;
  is_required?: boolean;
  options?: any;
  section_id?: string;
}

interface SectionDef {
  id: string;
  title: string;
  fields: FieldDef[];
}

interface EditFieldsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissionId: string;
  submissionNo?: string;
  sections: SectionDef[];
  valuesMap: Record<string, any>;
}

function inputForField(field: FieldDef, value: any, onChange: (v: any) => void) {
  const v = value ?? "";
  switch (field.field_type) {
    case "long_text":
      return (
        <Textarea
          value={v}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-[70px]"
          placeholder={`Fyll inn ${field.label.toLowerCase()}`}
        />
      );
    case "number":
      return (
        <Input
          type="number"
          value={v}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        />
      );
    case "date":
      return <Input type="date" value={v} onChange={(e) => onChange(e.target.value)} />;
    case "time":
      return <Input type="time" value={v} onChange={(e) => onChange(e.target.value)} />;
    case "email":
      return <Input type="email" value={v} onChange={(e) => onChange(e.target.value)} />;
    case "phone":
      return <Input type="tel" value={v} onChange={(e) => onChange(e.target.value)} />;
    case "yes_no":
      return (
        <Select value={v ? String(v) : ""} onValueChange={(val) => onChange(val)}>
          <SelectTrigger><SelectValue placeholder="Velg..." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ja">Ja</SelectItem>
            <SelectItem value="nei">Nei</SelectItem>
          </SelectContent>
        </Select>
      );
    case "dropdown":
    case "radio": {
      const opts = (field.options as any[]) || [];
      return (
        <Select value={v ? String(v) : ""} onValueChange={(val) => onChange(val)}>
          <SelectTrigger><SelectValue placeholder="Velg..." /></SelectTrigger>
          <SelectContent>
            {opts.map((o: any, i: number) => {
              const label = typeof o === "string" ? o : o.label;
              const val = typeof o === "string" ? o : o.value;
              return <SelectItem key={i} value={String(val)}>{label}</SelectItem>;
            })}
          </SelectContent>
        </Select>
      );
    }
    default:
      return (
        <Input
          value={typeof v === "object" ? JSON.stringify(v) : v}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Fyll inn ${field.label.toLowerCase()}`}
        />
      );
  }
}

function valuesEqual(a: any, b: any): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (typeof a === "object" || typeof b === "object") {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return String(a) === String(b);
}

function formatForLog(v: any): string {
  if (v == null || v === "") return "(tom)";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export function EditFieldsDialog({
  open,
  onOpenChange,
  submissionId,
  submissionNo,
  sections,
  valuesMap,
}: EditFieldsDialogProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Record<string, any>>({});

  // Initialize draft when dialog opens
  useEffect(() => {
    if (open) {
      const init: Record<string, any> = {};
      for (const s of sections) {
        for (const f of s.fields || []) {
          init[f.field_key] = valuesMap[f.field_key] ?? "";
        }
      }
      setDraft(init);
    }
  }, [open, sections, valuesMap]);

  const editableSections = useMemo(
    () => sections.filter(s => (s.fields || []).some(f =>
      !["info_box", "section_header", "file_upload", "image_upload"].includes(f.field_type)
    )),
    [sections]
  );

  // Detect missing required fields up-front to surface them
  const missingRequired = useMemo(() => {
    const out: { key: string; label: string }[] = [];
    for (const s of sections) {
      for (const f of s.fields || []) {
        if (f.is_required && (valuesMap[f.field_key] == null || valuesMap[f.field_key] === "")) {
          out.push({ key: f.field_key, label: f.label });
        }
      }
    }
    return out;
  }, [sections, valuesMap]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Compute changed fields
      const changes: { key: string; label: string; oldValue: any; newValue: any; fieldType: string }[] = [];
      for (const s of sections) {
        for (const f of s.fields || []) {
          const oldV = valuesMap[f.field_key] ?? null;
          let newV = draft[f.field_key];
          if (newV === "") newV = null;
          if (!valuesEqual(oldV, newV)) {
            changes.push({
              key: f.field_key,
              label: f.label,
              oldValue: oldV,
              newValue: newV,
              fieldType: f.field_type,
            });
          }
        }
      }

      if (changes.length === 0) {
        return { changes: [] };
      }

      // Get user name for the log
      let userName = "Saksbehandler";
      if (user?.id) {
        const { data: ua } = await supabase
          .from("user_accounts")
          .select("person:people(full_name)")
          .eq("auth_user_id", user.id)
          .eq("is_active", true)
          .maybeSingle();
        userName = (ua as any)?.person?.full_name || userName;
      }

      // Apply each change: delete existing rows for the field_key, then insert if not null
      for (const c of changes) {
        await supabase
          .from("order_form_submission_values")
          .delete()
          .eq("submission_id", submissionId)
          .eq("field_key", c.key);

        if (c.newValue != null && c.newValue !== "") {
          await supabase.from("order_form_submission_values").insert({
            submission_id: submissionId,
            field_key: c.key,
            value: c.newValue,
          } as any);
        }
      }

      // Log a single activity entry summarising all changes
      await supabase.from("order_form_activity_log").insert({
        submission_id: submissionId,
        event_type: "fields_updated",
        payload: {
          source: "admin_manual_fill",
          actor_name: userName,
          changes: changes.map(c => ({
            field_key: c.key,
            label: c.label,
            old_value: c.oldValue,
            new_value: c.newValue,
            old_display: formatForLog(c.oldValue),
            new_display: formatForLog(c.newValue),
          })),
        },
        created_by: user?.id,
      } as any);

      // Touch submission updated_at and last_activity_at
      await supabase
        .from("order_form_submissions")
        .update({
          last_activity_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", submissionId);

      return { changes };
    },
    onSuccess: (result) => {
      if (result.changes.length === 0) {
        toast.info("Ingen endringer å lagre");
      } else {
        toast.success(`${result.changes.length} ${result.changes.length === 1 ? "felt oppdatert" : "felt oppdatert"}`);
      }
      qc.invalidateQueries({ queryKey: ["order-form-values", submissionId] });
      qc.invalidateQueries({ queryKey: ["order-form-activity", submissionId] });
      qc.invalidateQueries({ queryKey: ["order-form-submission", submissionId] });
      onOpenChange(false);
    },
    onError: (err: any) => {
      console.error("Failed to update fields:", err);
      toast.error("Kunne ikke lagre endringer");
    },
  });

  const changedCount = useMemo(() => {
    let n = 0;
    for (const s of sections) {
      for (const f of s.fields || []) {
        const oldV = valuesMap[f.field_key] ?? null;
        let newV = draft[f.field_key];
        if (newV === "") newV = null;
        if (!valuesEqual(oldV, newV)) n++;
      }
    }
    return n;
  }, [draft, sections, valuesMap]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4" />
            Etterfyll informasjon
            {submissionNo && (
              <span className="text-sm text-muted-foreground font-normal">· {submissionNo}</span>
            )}
          </DialogTitle>
          <DialogDescription>
            Oppdater eller fyll inn felter på bestillingen. Alle endringer logges i aktivitetsloggen
            med felt, gammel og ny verdi, hvem og når.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          {missingRequired.length > 0 && (
            <div className="mb-4 p-3 rounded-md border border-amber-200 bg-amber-50 text-amber-900 text-xs flex gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium mb-1">Påkrevde felt mangler verdi:</p>
                <p>{missingRequired.map(m => m.label).join(", ")}</p>
              </div>
            </div>
          )}

          <div className="space-y-6">
            {editableSections.map(section => (
              <div key={section.id}>
                <h3 className="text-sm font-semibold mb-3">{section.title}</h3>
                <div className="space-y-3">
                  {(section.fields || [])
                    .filter(f => !["info_box", "section_header", "file_upload", "image_upload"].includes(f.field_type))
                    .map(field => {
                      const oldV = valuesMap[field.field_key] ?? null;
                      const newV = draft[field.field_key];
                      const isEmpty = oldV == null || oldV === "";
                      const isChanged = !valuesEqual(oldV, newV === "" ? null : newV);
                      return (
                        <div key={field.id} className="grid grid-cols-1 md:grid-cols-3 gap-2 items-start">
                          <div className="md:col-span-1 pt-2">
                            <Label className="text-xs flex items-center gap-1.5 flex-wrap">
                              {field.label}
                              {field.is_required && <span className="text-destructive">*</span>}
                              {isEmpty && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-amber-300 text-amber-700 bg-amber-50">
                                  Mangler
                                </Badge>
                              )}
                              {isChanged && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-blue-300 text-blue-700 bg-blue-50">
                                  Endret
                                </Badge>
                              )}
                            </Label>
                          </div>
                          <div className="md:col-span-2">
                            {inputForField(field, draft[field.field_key], (v) =>
                              setDraft(prev => ({ ...prev, [field.field_key]: v })),
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
            {editableSections.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Denne malen har ingen redigerbare felt.
              </p>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-3 border-t flex-row sm:justify-between gap-2">
          <span className="text-xs text-muted-foreground self-center">
            {changedCount > 0
              ? `${changedCount} ${changedCount === 1 ? "endring klar" : "endringer klare"} for lagring`
              : "Ingen endringer ennå"}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Avbryt</Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || changedCount === 0}
            >
              {saveMutation.isPending ? "Lagrer..." : "Lagre endringer"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
