import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Plus, GripVertical, Trash2, ChevronDown, ChevronUp, Save, Eye, EyeOff, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import { ORDER_FIELD_TYPE_LABELS, type OrderFormFieldType } from "@/types/order-forms";

export default function OrderFormBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const [addFieldOpen, setAddFieldOpen] = useState<string | null>(null);
  const [templateSettingsOpen, setTemplateSettingsOpen] = useState(false);

  const [newSection, setNewSection] = useState({ title: "", description: "" });
  const [newField, setNewField] = useState({
    field_key: "",
    label: "",
    field_type: "short_text" as OrderFormFieldType,
    placeholder: "",
    help_text: "",
    is_required: false,
    options: "",
  });

  // Load template
  const { data: template } = useQuery({
    queryKey: ["order-form-template", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_form_templates")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Load sections with fields
  const { data: sections = [] } = useQuery({
    queryKey: ["order-form-sections", id],
    enabled: !!id,
    queryFn: async () => {
      const { data: secs } = await supabase
        .from("order_form_template_sections")
        .select("*")
        .eq("template_id", id!)
        .order("sort_order");

      const { data: fields } = await supabase
        .from("order_form_template_fields")
        .select("*")
        .eq("template_id", id!)
        .order("sort_order");

      return (secs || []).map((s: any) => ({
        ...s,
        fields: (fields || []).filter((f: any) => f.section_id === s.id),
      }));
    },
  });

  // Auto-expand all sections on initial load
  useEffect(() => {
    if (sections.length > 0 && expandedSections.size === 0) {
      setExpandedSections(new Set(sections.map((s: any) => s.id)));
    }
  }, [sections]);

  const toggleSection = (sId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      next.has(sId) ? next.delete(sId) : next.add(sId);
      return next;
    });
  };

  // Mutations
  const addSectionMutation = useMutation({
    mutationFn: async () => {
      const maxOrder = sections.reduce((m: number, s: any) => Math.max(m, s.sort_order), -1);
      const { error } = await supabase.from("order_form_template_sections").insert({
        template_id: id!,
        title: newSection.title,
        description: newSection.description || null,
        sort_order: maxOrder + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order-form-sections", id] });
      setAddSectionOpen(false);
      setNewSection({ title: "", description: "" });
      toast.success("Seksjon lagt til");
    },
  });

  const addFieldMutation = useMutation({
    mutationFn: async (sectionId: string) => {
      const sectionFields = sections.find((s: any) => s.id === sectionId)?.fields || [];
      const maxOrder = sectionFields.reduce((m: number, f: any) => Math.max(m, f.sort_order), -1);
      const fieldKey = newField.field_key || newField.label.toLowerCase().replace(/[^a-z0-9æøå]+/g, "_").replace(/(^_|_$)/g, "");

      const optionsArr = newField.options
        ? newField.options.split("\n").map((o) => o.trim()).filter(Boolean)
        : null;

      const { error } = await supabase.from("order_form_template_fields").insert({
        template_id: id!,
        section_id: sectionId,
        field_key: fieldKey,
        label: newField.label,
        field_type: newField.field_type,
        placeholder: newField.placeholder || null,
        help_text: newField.help_text || null,
        is_required: newField.is_required,
        options: optionsArr,
        sort_order: maxOrder + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order-form-sections", id] });
      setAddFieldOpen(null);
      setNewField({ field_key: "", label: "", field_type: "short_text", placeholder: "", help_text: "", is_required: false, options: "" });
      toast.success("Felt lagt til");
    },
  });

  const deleteField = useMutation({
    mutationFn: async (fieldId: string) => {
      const { error } = await supabase.from("order_form_template_fields").delete().eq("id", fieldId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order-form-sections", id] });
      toast.success("Felt slettet");
    },
  });

  const toggleFieldActive = useMutation({
    mutationFn: async ({ fieldId, active }: { fieldId: string; active: boolean }) => {
      const { error } = await supabase
        .from("order_form_template_fields")
        .update({ is_active: active })
        .eq("id", fieldId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["order-form-sections", id] }),
  });

  const toggleFieldRequired = useMutation({
    mutationFn: async ({ fieldId, required }: { fieldId: string; required: boolean }) => {
      const { error } = await supabase
        .from("order_form_template_fields")
        .update({ is_required: required })
        .eq("id", fieldId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["order-form-sections", id] }),
  });

  const toggleSectionActive = useMutation({
    mutationFn: async ({ sectionId, active }: { sectionId: string; active: boolean }) => {
      const { error } = await supabase
        .from("order_form_template_sections")
        .update({ is_active: active })
        .eq("id", sectionId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["order-form-sections", id] }),
  });

  const updateTemplate = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const { error } = await supabase
        .from("order_form_templates")
        .update(updates)
        .eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order-form-template", id] });
      toast.success("Mal oppdatert");
    },
  });

  const needsOptions = ["dropdown", "radio", "checkbox_list", "multi_select"].includes(newField.field_type);

  if (!template) return <div className="p-6 text-center text-muted-foreground">Laster...</div>;

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/order-forms")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">{template.name}</h1>
            <p className="text-xs text-muted-foreground">/{template.slug}</p>
          </div>
          <Badge variant={template.is_active ? "default" : "secondary"}>
            {template.is_active ? "Aktiv" : "Inaktiv"}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setTemplateSettingsOpen(true)}>
            <Settings className="h-3.5 w-3.5 mr-1" />
            Innstillinger
          </Button>
          <Button
            size="sm"
            variant={template.is_active ? "secondary" : "default"}
            onClick={() => updateTemplate.mutate({ is_active: !template.is_active })}
          >
            {template.is_active ? "Deaktiver" : "Publiser"}
          </Button>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-3">
        {sections.map((section: any) => (
          <Card key={section.id} className={!section.is_active ? "opacity-50" : ""}>
            <Collapsible open={expandedSections.has(section.id)} onOpenChange={() => toggleSection(section.id)}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CollapsibleTrigger className="flex items-center gap-2 cursor-pointer hover:text-primary transition-colors">
                    {expandedSections.has(section.id) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronUp className="h-4 w-4 rotate-180" />
                    )}
                    <CardTitle className="text-sm">{section.title}</CardTitle>
                    <Badge variant="outline" className="text-[10px]">
                      {section.fields?.length || 0} felt
                    </Badge>
                  </CollapsibleTrigger>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={section.is_active}
                      onCheckedChange={(v) => toggleSectionActive.mutate({ sectionId: section.id, active: v })}
                    />
                  </div>
                </div>
              </CardHeader>
              <CollapsibleContent>
                <CardContent>
                  <div className="space-y-1.5">
                    {(section.fields || []).map((field: any) => (
                      <div
                        key={field.id}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg border border-border/50 text-sm ${
                          !field.is_active ? "opacity-40" : ""
                        }`}
                      >
                        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="font-medium">{field.label}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {ORDER_FIELD_TYPE_LABELS[field.field_type as OrderFormFieldType] || field.field_type}
                          </span>
                          {field.is_required && (
                            <span className="text-destructive text-xs ml-1">*</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            className="text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => toggleFieldRequired.mutate({ fieldId: field.id, required: !field.is_required })}
                            title={field.is_required ? "Gjør valgfritt" : "Gjør påkrevd"}
                          >
                            {field.is_required ? "Påkrevd" : "Valgfritt"}
                          </button>
                          <button
                            className="p-1 hover:bg-muted rounded"
                            onClick={() => toggleFieldActive.mutate({ fieldId: field.id, active: !field.is_active })}
                            title={field.is_active ? "Deaktiver" : "Aktiver"}
                          >
                            {field.is_active ? (
                              <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : (
                              <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </button>
                          <button
                            className="p-1 hover:bg-destructive/10 rounded"
                            onClick={() => deleteField.mutate(field.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive/60" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 text-xs"
                    onClick={() => setAddFieldOpen(section.id)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Legg til felt
                  </Button>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        ))}
      </div>

      <Button variant="outline" onClick={() => setAddSectionOpen(true)}>
        <Plus className="h-4 w-4 mr-1" />
        Legg til seksjon
      </Button>

      {/* Add Section Dialog */}
      <Dialog open={addSectionOpen} onOpenChange={setAddSectionOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ny seksjon</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tittel *</Label>
              <Input value={newSection.title} onChange={(e) => setNewSection((p) => ({ ...p, title: e.target.value }))} />
            </div>
            <div>
              <Label>Beskrivelse</Label>
              <Textarea value={newSection.description} onChange={(e) => setNewSection((p) => ({ ...p, description: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddSectionOpen(false)}>Avbryt</Button>
            <Button disabled={!newSection.title} onClick={() => addSectionMutation.mutate()}>Legg til</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Field Dialog */}
      <Dialog open={!!addFieldOpen} onOpenChange={() => setAddFieldOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nytt felt</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Label *</Label>
              <Input value={newField.label} onChange={(e) => setNewField((p) => ({ ...p, label: e.target.value }))} />
            </div>
            <div>
              <Label>Feltnøkkel</Label>
              <Input
                value={newField.field_key}
                onChange={(e) => setNewField((p) => ({ ...p, field_key: e.target.value }))}
                placeholder="Genereres fra label"
              />
            </div>
            <div>
              <Label>Felttype</Label>
              <Select
                value={newField.field_type}
                onValueChange={(v) => setNewField((p) => ({ ...p, field_type: v as OrderFormFieldType }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ORDER_FIELD_TYPE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {needsOptions && (
              <div>
                <Label>Alternativer (én per linje)</Label>
                <Textarea
                  value={newField.options}
                  onChange={(e) => setNewField((p) => ({ ...p, options: e.target.value }))}
                  placeholder={"Alternativ 1\nAlternativ 2\nAlternativ 3"}
                />
              </div>
            )}
            <div>
              <Label>Placeholder</Label>
              <Input value={newField.placeholder} onChange={(e) => setNewField((p) => ({ ...p, placeholder: e.target.value }))} />
            </div>
            <div>
              <Label>Hjelpetekst</Label>
              <Input value={newField.help_text} onChange={(e) => setNewField((p) => ({ ...p, help_text: e.target.value }))} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={newField.is_required} onCheckedChange={(v) => setNewField((p) => ({ ...p, is_required: v }))} />
              <Label>Påkrevd</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddFieldOpen(null)}>Avbryt</Button>
            <Button disabled={!newField.label} onClick={() => addFieldMutation.mutate(addFieldOpen!)}>Legg til</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Settings Dialog */}
      <Dialog open={templateSettingsOpen} onOpenChange={setTemplateSettingsOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Malinnstillinger</DialogTitle></DialogHeader>
          {template && (
            <TemplateSettingsForm
              template={template}
              onSave={(updates) => {
                updateTemplate.mutate(updates);
                setTemplateSettingsOpen(false);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TemplateSettingsForm({ template, onSave }: { template: any; onSave: (u: any) => void }) {
  const [form, setForm] = useState({
    name: template.name || "",
    internal_title: template.internal_title || "",
    external_title: template.external_title || "",
    description: template.description || "",
    confirmation_text: template.confirmation_text || "",
    send_email_to: (template.send_email_to || []).join(", "),
    audience_type: template.audience_type || "both",
    on_submit_action: template.on_submit_action || "queue",
  });

  return (
    <div className="space-y-3">
      <div>
        <Label>Navn</Label>
        <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
      </div>
      <div>
        <Label>Intern tittel</Label>
        <Input value={form.internal_title} onChange={(e) => setForm((p) => ({ ...p, internal_title: e.target.value }))} />
      </div>
      <div>
        <Label>Ekstern tittel</Label>
        <Input value={form.external_title} onChange={(e) => setForm((p) => ({ ...p, external_title: e.target.value }))} />
      </div>
      <div>
        <Label>Beskrivelse</Label>
        <Textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
      </div>
      <div>
        <Label>Bekreftelsestekst etter innsending</Label>
        <Textarea value={form.confirmation_text} onChange={(e) => setForm((p) => ({ ...p, confirmation_text: e.target.value }))} />
      </div>
      <div>
        <Label>E-post mottaker(e) (kommaseparert)</Label>
        <Input value={form.send_email_to} onChange={(e) => setForm((p) => ({ ...p, send_email_to: e.target.value }))} />
      </div>
      <div>
        <Label>Målgruppe</Label>
        <Select value={form.audience_type} onValueChange={(v) => setForm((p) => ({ ...p, audience_type: v }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="internal">Intern</SelectItem>
            <SelectItem value="external">Ekstern</SelectItem>
            <SelectItem value="both">Begge</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Ved innsending</Label>
        <Select value={form.on_submit_action} onValueChange={(v) => setForm((p) => ({ ...p, on_submit_action: v }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="queue">Legg i kø</SelectItem>
            <SelectItem value="create_case">Opprett sak</SelectItem>
            <SelectItem value="create_task">Opprett oppgave</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <DialogFooter>
        <Button onClick={() => onSave({
          ...form,
          send_email_to: form.send_email_to ? form.send_email_to.split(",").map((s: string) => s.trim()).filter(Boolean) : null,
        })}>
          Lagre
        </Button>
      </DialogFooter>
    </div>
  );
}
