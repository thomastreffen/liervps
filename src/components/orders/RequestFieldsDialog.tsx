import { useState, useMemo, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { HelpCircle, Plus, Trash2, MailPlus, FormInput, Pencil } from "lucide-react";

interface FieldDef {
  id: string;
  field_key: string;
  label: string;
  field_type: string;
  options?: any;
  section_id?: string;
}

interface SectionDef {
  id: string;
  title: string;
  fields: FieldDef[];
}

interface FreeText {
  id: string;
  label: string;
  field_type: "short_text" | "long_text" | "number" | "date";
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissionId: string;
  submissionNo?: string;
  sections: SectionDef[];
  valuesMap: Record<string, any>;
  recipientEmail?: string;
  recipientName?: string;
}

const SKIP_TYPES = ["info_box", "section_header", "file_upload", "image_upload"];

export function RequestFieldsDialog({
  open,
  onOpenChange,
  submissionId,
  submissionNo,
  sections,
  valuesMap,
  recipientEmail,
  recipientName,
}: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [freeTexts, setFreeTexts] = useState<FreeText[]>([]);
  const [sendEmail, setSendEmail] = useState(true);

  useEffect(() => {
    if (open) {
      setSelectedKeys(new Set());
      setFreeTexts([]);
      setSendEmail(!!recipientEmail);
    }
  }, [open, recipientEmail]);

  // Group fields with hint about empty/filled
  const allFields = useMemo(() => {
    const out: { section: string; field: FieldDef; isEmpty: boolean }[] = [];
    for (const s of sections) {
      for (const f of s.fields || []) {
        if (SKIP_TYPES.includes(f.field_type)) continue;
        const isEmpty = valuesMap[f.field_key] == null || valuesMap[f.field_key] === "";
        out.push({ section: s.title, field: f, isEmpty });
      }
    }
    return out;
  }, [sections, valuesMap]);

  const grouped = useMemo(() => {
    const m = new Map<string, { section: string; field: FieldDef; isEmpty: boolean }[]>();
    for (const item of allFields) {
      if (!m.has(item.section)) m.set(item.section, []);
      m.get(item.section)!.push(item);
    }
    return Array.from(m.entries());
  }, [allFields]);

  const toggleField = (key: string) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const addFreeText = () => {
    setFreeTexts(prev => [
      ...prev,
      { id: crypto.randomUUID(), label: "", field_type: "short_text" },
    ]);
  };

  const updateFreeText = (id: string, patch: Partial<FreeText>) => {
    setFreeTexts(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f));
  };

  const removeFreeText = (id: string) => {
    setFreeTexts(prev => prev.filter(f => f.id !== id));
  };

  const totalCount = selectedKeys.size + freeTexts.filter(f => f.label.trim()).length;

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (totalCount === 0) throw new Error("Velg minst ett felt");

      // Resolve actor name
      let actorName = "Saksbehandler";
      if (user?.id) {
        const { data: ua } = await supabase
          .from("user_accounts")
          .select("person:people(full_name)")
          .eq("auth_user_id", user.id)
          .eq("is_active", true)
          .maybeSingle();
        actorName = (ua as any)?.person?.full_name || actorName;
      }

      const batchId = crypto.randomUUID();
      const rows: any[] = [];

      // Existing fields
      for (const key of selectedKeys) {
        const item = allFields.find(a => a.field.field_key === key);
        if (!item) continue;
        rows.push({
          submission_id: submissionId,
          request_batch_id: batchId,
          field_key: item.field.field_key,
          field_label: item.field.label,
          field_type: item.field.field_type,
          options: item.field.options ?? null,
          is_free_text: false,
          status: "open",
          requested_by: user?.id ?? null,
          requested_by_name: actorName,
        });
      }
      // Free text additions
      for (const ft of freeTexts) {
        const label = ft.label.trim();
        if (!label) continue;
        rows.push({
          submission_id: submissionId,
          request_batch_id: batchId,
          field_key: null,
          field_label: label,
          field_type: ft.field_type,
          options: null,
          is_free_text: true,
          status: "open",
          requested_by: user?.id ?? null,
          requested_by_name: actorName,
        });
      }

      const { error } = await supabase
        .from("order_form_field_requests" as any)
        .insert(rows);
      if (error) throw error;

      // Activity log
      await supabase.from("order_form_activity_log").insert({
        submission_id: submissionId,
        event_type: "field_request_created",
        payload: {
          batch_id: batchId,
          actor_name: actorName,
          send_email: sendEmail,
          fields: rows.map(r => ({
            label: r.field_label,
            field_key: r.field_key,
            is_free_text: r.is_free_text,
          })),
          summary: `${rows.length} ${rows.length === 1 ? "felt" : "felter"} forespurt fra bestiller`,
        },
        created_by: user?.id,
      } as any);

      // Touch submission
      await supabase
        .from("order_form_submissions")
        .update({
          last_activity_at: new Date().toISOString(),
          awaiting_customer_reply: true,
        } as any)
        .eq("id", submissionId);

      // Optionally trigger email — reuses confirmation notify so customer gets the link
      if (sendEmail && recipientEmail) {
        try {
          await supabase.functions.invoke("order-form-notify", {
            body: {
              submission_id: submissionId,
              notification_type: "field_request",
              field_request_batch_id: batchId,
            },
          });
        } catch (e) {
          console.warn("Could not send email notification:", e);
        }
      }

      return { count: rows.length, sentEmail: sendEmail && !!recipientEmail };
    },
    onSuccess: (r) => {
      toast.success(
        r.sentEmail
          ? `${r.count} forespørsler sendt til bestiller`
          : `${r.count} forespørsler lagt til (ingen e-post sendt)`
      );
      qc.invalidateQueries({ queryKey: ["order-form-field-requests", submissionId] });
      qc.invalidateQueries({ queryKey: ["order-form-activity", submissionId] });
      qc.invalidateQueries({ queryKey: ["order-form-submission", submissionId] });
      onOpenChange(false);
    },
    onError: (e: any) => {
      toast.error(e?.message || "Kunne ikke sende forespørsel");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4" />
            Be bestiller om mer informasjon
            {submissionNo && (
              <span className="text-sm text-muted-foreground font-normal">· {submissionNo}</span>
            )}
          </DialogTitle>
          <DialogDescription>
            Velg felter bestiller skal etterfylle. De vises tydelig på bestillerens kundeside,
            og kan svares på direkte der.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-5">
            {/* Existing fields — primary */}
            <section>
              <div className="flex items-center gap-2 mb-2">
                <FormInput className="h-3.5 w-3.5 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Felter fra skjemaet</h3>
                <span className="text-xs text-muted-foreground">
                  ({selectedKeys.size} valgt)
                </span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Anbefalt — hold strukturert info samlet. Tomme felter er markert.
              </p>

              <div className="space-y-3">
                {grouped.map(([section, items]) => (
                  <div key={section}>
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                      {section}
                    </p>
                    <div className="space-y-1">
                      {items.map(({ field, isEmpty }) => (
                        <label
                          key={field.id}
                          className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedKeys.has(field.field_key)}
                            onCheckedChange={() => toggleField(field.field_key)}
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm">{field.label}</span>
                            {isEmpty && (
                              <Badge variant="outline" className="ml-2 text-[9px] px-1 py-0 h-4 border-amber-300 text-amber-700 bg-amber-50">
                                Mangler
                              </Badge>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
                {grouped.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">
                    Ingen redigerbare felter i skjemaet.
                  </p>
                )}
              </div>
            </section>

            {/* Free text — secondary */}
            <section className="border-t pt-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">Egne spørsmål (valgfritt)</h3>
                </div>
                <Button variant="ghost" size="sm" onClick={addFreeText} className="h-7">
                  <Plus className="h-3 w-3 mr-1" /> Legg til
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Bruk når du trenger informasjon som ikke finnes som felt i skjemaet.
              </p>

              {freeTexts.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  Ingen egne spørsmål lagt til.
                </p>
              ) : (
                <div className="space-y-2">
                  {freeTexts.map(ft => (
                    <div key={ft.id} className="flex gap-2 items-start">
                      <Input
                        placeholder="F.eks. Hvilket etasjenummer skal arbeidet utføres på?"
                        value={ft.label}
                        onChange={(e) => updateFreeText(ft.id, { label: e.target.value })}
                        className="flex-1 h-9 text-sm"
                      />
                      <select
                        value={ft.field_type}
                        onChange={(e) => updateFreeText(ft.id, { field_type: e.target.value as any })}
                        className="h-9 px-2 text-xs border rounded-md bg-background"
                      >
                        <option value="short_text">Kort tekst</option>
                        <option value="long_text">Lang tekst</option>
                        <option value="number">Tall</option>
                        <option value="date">Dato</option>
                      </select>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFreeText(ft.id)}
                        className="h-9 w-9 p-0 text-muted-foreground"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Notification */}
            <section className="border-t pt-4">
              <Label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={sendEmail}
                  onCheckedChange={(c) => setSendEmail(!!c)}
                  disabled={!recipientEmail}
                />
                <span className="text-sm flex items-center gap-1.5">
                  <MailPlus className="h-3.5 w-3.5" />
                  Send e-post nå til bestiller
                </span>
              </Label>
              {recipientEmail ? (
                <p className="text-xs text-muted-foreground mt-1.5 ml-6">
                  Sendes til {recipientName ? `${recipientName} (${recipientEmail})` : recipientEmail}.
                  Forespørselen vises uansett på kundesiden ved neste besøk.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mt-1.5 ml-6">
                  Ingen e-post på bestiller — forespørselen vises bare på kundesiden.
                </p>
              )}
            </section>
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-3 border-t flex-row sm:justify-between gap-2">
          <span className="text-xs text-muted-foreground self-center">
            {totalCount === 0
              ? "Velg minst ett felt"
              : `${totalCount} ${totalCount === 1 ? "forespørsel klar" : "forespørsler klare"}`}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Avbryt</Button>
            <Button
              onClick={() => sendMutation.mutate()}
              disabled={sendMutation.isPending || totalCount === 0}
            >
              {sendMutation.isPending ? "Sender..." : sendEmail && recipientEmail ? "Send forespørsel + e-post" : "Send forespørsel"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
