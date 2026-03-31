import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Save, Eye, Settings, Link2, ExternalLink, Copy, Check, Tag, Share2 } from "lucide-react";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ORDER_FIELD_TYPE_LABELS, type OrderFormFieldType } from "@/types/order-forms";
import { OrderFieldPalette, type FieldBlock } from "@/components/orders/builder/OrderFieldPalette";
import { BuilderCanvas } from "@/components/orders/builder/BuilderCanvas";
import { BuilderPreview } from "@/components/orders/builder/BuilderPreview";
import { FieldInspector } from "@/components/orders/builder/FieldInspector";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { ShareFormDialog } from "@/components/orders/admin/ShareFormDialog";

export default function OrderFormBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [shareOpen, setShareOpen] = useState(false);

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

  // Auto-select first section
  useEffect(() => {
    if (sections.length > 0 && !selectedSectionId) {
      setSelectedSectionId(sections[0].id);
    }
  }, [sections, selectedSectionId]);

  const selectedField = sections
    .flatMap((s: any) => s.fields || [])
    .find((f: any) => f.id === selectedFieldId) || null;

  const selectedSection = sections.find((s: any) => s.id === selectedSectionId) || null;

  const invalidate = () => qc.invalidateQueries({ queryKey: ["order-form-sections", id] });

  // Mutations
  const updateField = useMutation({
    mutationFn: async ({ fieldId, updates }: { fieldId: string; updates: Record<string, any> }) => {
      const { error } = await supabase.from("order_form_template_fields").update(updates).eq("id", fieldId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const updateSection = useMutation({
    mutationFn: async ({ sectionId, updates }: { sectionId: string; updates: Record<string, any> }) => {
      const { error } = await supabase.from("order_form_template_sections").update(updates).eq("id", sectionId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteField = useMutation({
    mutationFn: async (fieldId: string) => {
      const { error } = await supabase.from("order_form_template_fields").delete().eq("id", fieldId);
      if (error) throw error;
    },
    onSuccess: () => {
      setSelectedFieldId(null);
      invalidate();
      toast.success("Felt slettet");
    },
  });

  const deleteSection = useMutation({
    mutationFn: async (sectionId: string) => {
      await supabase.from("order_form_template_fields").delete().eq("section_id", sectionId);
      const { error } = await supabase.from("order_form_template_sections").delete().eq("id", sectionId);
      if (error) throw error;
    },
    onSuccess: () => {
      setSelectedSectionId(null);
      setSelectedFieldId(null);
      invalidate();
      toast.success("Seksjon slettet");
    },
  });

  const addSection = useMutation({
    mutationFn: async (title: string) => {
      const maxOrder = sections.reduce((m: number, s: any) => Math.max(m, s.sort_order), -1);
      const { error } = await supabase.from("order_form_template_sections").insert({
        template_id: id!,
        title,
        sort_order: maxOrder + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setAddSectionOpen(false);
      setNewSectionTitle("");
      invalidate();
      toast.success("Seksjon lagt til");
    },
  });

  const addFieldToSection = useCallback(async (
    type: OrderFormFieldType,
    sectionId: string,
    preset?: { label: string; fieldKey: string; helpText?: string; options?: string[]; isRequired?: boolean; fieldWidth?: string },
    insertAtIndex?: number,
  ) => {
    const section = sections.find((s: any) => s.id === sectionId);
    const sectionFields: any[] = section?.fields || [];
    const label = preset?.label || ORDER_FIELD_TYPE_LABELS[type] || type;
    const fieldKey = preset?.fieldKey || label.toLowerCase().replace(/[^a-zæøå0-9]+/g, "_").replace(/(^_|_$)/g, "");
    const needsOptions = ["dropdown", "radio", "checkbox_list", "multi_select"].includes(type);

    // Calculate sort_order based on insertAtIndex
    let sortOrder: number;
    if (insertAtIndex !== undefined && insertAtIndex < sectionFields.length) {
      // Insert before the field at insertAtIndex
      const targetSort = sectionFields[insertAtIndex]?.sort_order ?? 0;
      sortOrder = targetSort;
      // Bump all fields at or after this index
      const bumps = sectionFields.filter((f: any) => f.sort_order >= sortOrder);
      for (const f of bumps) {
        await supabase.from("order_form_template_fields").update({ sort_order: f.sort_order + 1 }).eq("id", f.id);
      }
    } else {
      const maxOrder = sectionFields.reduce((m: number, f: any) => Math.max(m, f.sort_order), -1);
      sortOrder = maxOrder + 1;
    }

    const { error } = await supabase.from("order_form_template_fields").insert({
      template_id: id!,
      section_id: sectionId,
      field_key: fieldKey + "_" + Date.now().toString(36),
      label,
      field_type: type,
      sort_order: sortOrder,
      help_text: preset?.helpText || null,
      is_required: preset?.isRequired || false,
      options: preset?.options || (needsOptions ? ["Alternativ 1", "Alternativ 2"] : null),
      field_width: preset?.fieldWidth || "full",
    });
    if (error) { toast.error(error.message); return; }
    invalidate();
  }, [sections, id]);

  const addBlockToSection = useCallback(async (block: FieldBlock, sectionId: string, insertAtIndex?: number) => {
    const sectionFields = sections.find((s: any) => s.id === sectionId)?.fields || [];
    let startSortOrder: number;

    if (insertAtIndex !== undefined && insertAtIndex < sectionFields.length) {
      startSortOrder = sectionFields[insertAtIndex]?.sort_order ?? 0;
      const bumps = sectionFields.filter((f: any) => f.sort_order >= startSortOrder);
      for (const f of bumps) {
        await supabase
          .from("order_form_template_fields")
          .update({ sort_order: f.sort_order + block.fields.length })
          .eq("id", f.id);
      }
    } else {
      const maxOrder = sectionFields.reduce((m: number, f: any) => Math.max(m, f.sort_order), -1);
      startSortOrder = maxOrder + 1;
    }

    const rows = block.fields.map((f, i) => ({
      template_id: id!,
      section_id: sectionId,
      field_key: f.field_key + "_" + Date.now().toString(36) + i,
      label: f.label,
      field_type: f.type,
      is_required: f.is_required || false,
      options: f.options || null,
      help_text: f.help_text || null,
      sort_order: startSortOrder + i,
      field_width: (f as any).field_width || "full",
    }));

    const { error } = await supabase.from("order_form_template_fields").insert(rows);
    if (error) { toast.error(error.message); return; }
    invalidate();
    toast.success(`${block.label} lagt til (${block.fields.length} felt)`);
  }, [sections, id]);

  // ── Reordering ──

  const moveSection = useCallback(async (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    const sorted = [...sections];
    const [moved] = sorted.splice(fromIdx, 1);
    sorted.splice(toIdx, 0, moved);
    // Update all sort_orders
    const updates = sorted.map((s: any, i: number) =>
      supabase.from("order_form_template_sections").update({ sort_order: i }).eq("id", s.id)
    );
    await Promise.all(updates);
    invalidate();
  }, [sections]);

  const moveField = useCallback(async (fieldId: string, fromSectionId: string, toSectionId: string, toIndex: number) => {
    const toSection = sections.find((s: any) => s.id === toSectionId);
    const toFields: any[] = (toSection?.fields || []).filter((f: any) => f.id !== fieldId);

    // Insert at toIndex
    toFields.splice(toIndex, 0, { id: fieldId });

    // Update section_id if moving between sections
    if (fromSectionId !== toSectionId) {
      await supabase.from("order_form_template_fields").update({ section_id: toSectionId }).eq("id", fieldId);
    }

    // Re-number all fields in the target section
    const updates = toFields.map((f: any, i: number) =>
      supabase.from("order_form_template_fields").update({ sort_order: i }).eq("id", f.id)
    );
    await Promise.all(updates);

    // If moved between sections, re-number the source section too
    if (fromSectionId !== toSectionId) {
      const fromSection = sections.find((s: any) => s.id === fromSectionId);
      const fromFields = (fromSection?.fields || []).filter((f: any) => f.id !== fieldId);
      const srcUpdates = fromFields.map((f: any, i: number) =>
        supabase.from("order_form_template_fields").update({ sort_order: i }).eq("id", f.id)
      );
      await Promise.all(srcUpdates);
    }

    invalidate();
  }, [sections]);

  const updateTemplate = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const { error } = await supabase.from("order_form_templates").update(updates).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order-form-template", id] });
      toast.success("Mal oppdatert");
    },
  });

  if (!template) return <div className="p-6 text-center text-muted-foreground">Laster...</div>;

  if (previewMode) {
    return (
      <div className="h-[calc(100vh-3.5rem)] flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPreviewMode(false)}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Tilbake til redigering
            </Button>
            <Badge variant="outline">Forhåndsvisning</Badge>
          </div>
        </div>
        <BuilderPreview sections={sections} templateTitle={template.name} />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/admin/order-forms")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-sm font-bold">{template.name}</h1>
            <p className="text-[10px] text-muted-foreground">/{template.slug}</p>
          </div>
          <Badge variant={template.is_active ? "default" : "secondary"} className="text-[10px]">
            {template.is_active ? "Publisert" : "Kladd"}
          </Badge>
          {template.category && (
            <Badge variant="outline" className="text-[10px] gap-1">
              <Tag className="h-2.5 w-2.5" />
              {template.category}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {template.is_active && (
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => setShareOpen(true)}>
              <Share2 className="h-3.5 w-3.5" />
              Del / Embed
            </Button>
          )}
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setPreviewMode(true)}>
            <Eye className="h-3.5 w-3.5 mr-1" />
            Forhåndsvisning
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setSettingsOpen(true)}>
            <Settings className="h-3.5 w-3.5 mr-1" />
            Innstillinger
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs"
            variant={template.is_active ? "secondary" : "default"}
            onClick={() => updateTemplate.mutate({ is_active: !template.is_active })}
          >
            {template.is_active ? "Deaktiver" : "Publiser"}
          </Button>
        </div>
      </div>

      {/* 3-column layout */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Field palette */}
        <div className="w-64 border-r border-border bg-card shrink-0 overflow-hidden">
          <OrderFieldPalette
            onAddField={addFieldToSection}
            onAddBlock={addBlockToSection}
            activeSectionId={selectedSectionId}
          />
        </div>

        {/* Center: Canvas */}
        <div className="flex-1 bg-muted/10 overflow-hidden">
          <BuilderCanvas
            sections={sections}
            selectedFieldId={selectedFieldId}
            selectedSectionId={selectedSectionId}
            onSelectField={(fId, sId) => { setSelectedFieldId(fId); setSelectedSectionId(sId); }}
            onSelectSection={(sId) => { setSelectedSectionId(sId); setSelectedFieldId(null); }}
            onAddSection={() => setAddSectionOpen(true)}
            onToggleFieldRequired={(fId, req) => updateField.mutate({ fieldId: fId, updates: { is_required: req } })}
            onToggleFieldActive={(fId, act) => updateField.mutate({ fieldId: fId, updates: { is_active: act } })}
            onToggleSectionActive={(sId, act) => updateSection.mutate({ sectionId: sId, updates: { is_active: act } })}
            onMoveSection={moveSection}
            onMoveField={moveField}
            onDropNewField={(type, sId, idx, preset) => addFieldToSection(type, sId, preset, idx)}
            onDropNewBlock={(block, sId, idx) => addBlockToSection(block as FieldBlock, sId, idx)}
            templateTitle={template.name}
          />
        </div>

        {/* Right: Inspector */}
        <div className="w-72 border-l border-border bg-card shrink-0 overflow-hidden">
          <FieldInspector
            field={selectedField}
            section={!selectedFieldId ? selectedSection : null}
            onUpdateField={(fId, updates) => updateField.mutate({ fieldId: fId, updates })}
            onUpdateSection={(sId, updates) => updateSection.mutate({ sectionId: sId, updates })}
            onDeleteField={(fId) => deleteField.mutate(fId)}
            onDeleteSection={(sId) => deleteSection.mutate(sId)}
          />
        </div>
      </div>

      {/* Add Section Dialog */}
      <Dialog open={addSectionOpen} onOpenChange={setAddSectionOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Ny seksjon</DialogTitle></DialogHeader>
          <div>
            <Label>Tittel</Label>
            <Input
              value={newSectionTitle}
              onChange={(e) => setNewSectionTitle(e.target.value)}
              placeholder="F.eks. Kundeinformasjon"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddSectionOpen(false)}>Avbryt</Button>
            <Button disabled={!newSectionTitle.trim()} onClick={() => addSection.mutate(newSectionTitle.trim())}>Legg til</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Settings Sheet */}
      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Malinnstillinger</SheetTitle>
          </SheetHeader>
          <TemplateSettingsForm
            template={template}
            onSave={(updates) => {
              updateTemplate.mutate(updates);
              setSettingsOpen(false);
            }}
          />
        </SheetContent>
      </Sheet>
      {/* Share / Embed Dialog */}
      <ShareFormDialog open={shareOpen} onOpenChange={setShareOpen} template={template} />
    </div>
  );
}

function PublishLinkActions({ template }: { template: any }) {
  const [copied, setCopied] = useState(false);
  const internalUrl = `${window.location.origin}/orders/new/${template.slug}`;
  const publicUrl = `${window.location.origin}/bestilling/${template.slug}`;
  const isExternal = template.audience_type === "external" || template.audience_type === "both";
  const url = isExternal ? publicUrl : internalUrl;

  const accessLabel = (() => {
    if (template.audience_type === "internal") return "Intern · Krever innlogging";
    const login = template.requires_login ? "Krever innlogging" : "Åpent uten innlogging";
    const catalog = template.show_in_catalog ? "Vises på bestillingssiden" : "Kun via direkte lenke";
    return `${template.audience_type === "external" ? "Ekstern" : "Intern + ekstern"} · ${login} · ${catalog}`;
  })();

  const copyLink = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Lenke kopiert");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-1.5">
      <Badge variant="outline" className="text-[10px] font-normal max-w-[280px] truncate">{accessLabel}</Badge>
      <Button variant="outline" size="sm" className="h-8 text-xs" onClick={copyLink}>
        {copied ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
        {copied ? "Kopiert!" : "Kopier lenke"}
      </Button>
      <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => window.open(url, "_blank")}>
        <ExternalLink className="h-3.5 w-3.5 mr-1" />
        Åpne skjema
      </Button>
    </div>
  );
}

function TemplateSettingsForm({ template, onSave }: { template: any; onSave: (u: any) => void }) {
  const { activeCompanyId } = useCompanyContext();
  const { data: categories = [] } = useQuery({
    queryKey: ["order-form-categories", activeCompanyId],
    enabled: !!activeCompanyId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("order_form_categories")
        .select("*")
        .eq("company_id", activeCompanyId!)
        .order("sort_order");
      return data || [];
    },
  });

  const [form, setForm] = useState({
    name: template.name || "",
    internal_title: template.internal_title || "",
    external_title: template.external_title || "",
    description: template.description || "",
    confirmation_text: template.confirmation_text || "",
    send_email_to: (template.send_email_to || []).join(", "),
    audience_type: template.audience_type || "both",
    on_submit_action: template.on_submit_action || "queue",
    requires_login: template.requires_login ?? false,
    show_in_catalog: template.show_in_catalog ?? true,
    category_id: template.category_id || "__none__",
  });

  const selectedCat = categories.find((c: any) => c.id === form.category_id);

  const accessSummary = (() => {
    const parts: string[] = [];
    if (form.audience_type === "internal") {
      parts.push("Intern");
      parts.push("Krever innlogging");
    } else {
      parts.push(form.audience_type === "external" ? "Ekstern" : "Intern + ekstern");
      parts.push(form.requires_login ? "Krever innlogging" : "Åpent uten innlogging");
      parts.push(form.show_in_catalog ? "Vises på bestillingssiden" : "Kun via direkte lenke");
    }
    if (selectedCat) parts.push(`Kategori: ${selectedCat.name}`);
    else parts.push("Ingen kategori");
    return parts.join(" · ");
  })();

  return (
    <div className="space-y-5 mt-4">
      {/* General */}
      <div className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Generelt</p>
        <div><Label className="text-xs">Navn</Label><Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} /></div>
        <div><Label className="text-xs">Intern tittel</Label><Input value={form.internal_title} onChange={(e) => setForm((p) => ({ ...p, internal_title: e.target.value }))} /></div>
        <div><Label className="text-xs">Ekstern tittel</Label><Input value={form.external_title} onChange={(e) => setForm((p) => ({ ...p, external_title: e.target.value }))} /></div>
        <div><Label className="text-xs">Beskrivelse</Label><Textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} /></div>
        <div><Label className="text-xs">Bekreftelsestekst</Label><Textarea value={form.confirmation_text} onChange={(e) => setForm((p) => ({ ...p, confirmation_text: e.target.value }))} /></div>
        <div><Label className="text-xs">E-post mottaker(e)</Label><Input value={form.send_email_to} onChange={(e) => setForm((p) => ({ ...p, send_email_to: e.target.value }))} placeholder="Kommaseparert" /></div>
      </div>

      {/* Kategori */}
      <div className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Kategori</p>
        <div>
          <Label className="text-xs">Kategori</Label>
          <Select value={form.category_id} onValueChange={(v) => setForm((p) => ({ ...p, category_id: v }))}>
            <SelectTrigger><SelectValue placeholder="Velg kategori" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Ingen kategori</SelectItem>
              {categories.filter((c: any) => c.is_active).map((c: any) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {form.category_id === "__none__" && form.show_in_catalog && (
            <p className="text-[10px] text-amber-600 mt-1">⚠️ Skjema uten kategori vises ikke i katalogen</p>
          )}
        </div>
      </div>

      {/* Målgruppe */}
      <div className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Målgruppe</p>
        <div>
          <Label className="text-xs">Hvem er skjemaet for?</Label>
          <Select value={form.audience_type} onValueChange={(v) => setForm((p) => ({ ...p, audience_type: v, ...(v === "internal" ? { requires_login: true, show_in_catalog: false } : {}) }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="internal">Kun intern</SelectItem>
              <SelectItem value="external">Kun ekstern</SelectItem>
              <SelectItem value="both">Intern + ekstern</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tilgjengelighet */}
      {form.audience_type !== "internal" && (
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tilgjengelighet</p>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="requires_login"
                checked={!form.requires_login}
                onChange={() => setForm((p) => ({ ...p, requires_login: false }))}
                className="accent-primary"
              />
              <span className="text-xs">Åpent uten innlogging</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="requires_login"
                checked={form.requires_login}
                onChange={() => setForm((p) => ({ ...p, requires_login: true }))}
                className="accent-primary"
              />
              <span className="text-xs">Krever innlogging</span>
            </label>
          </div>
        </div>
      )}

      {/* Synlighet */}
      {form.audience_type !== "internal" && (
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Synlighet</p>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="show_in_catalog"
                checked={form.show_in_catalog}
                onChange={() => setForm((p) => ({ ...p, show_in_catalog: true }))}
                className="accent-primary"
              />
              <span className="text-xs">Vis på offentlig bestillingsside</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="show_in_catalog"
                checked={!form.show_in_catalog}
                onChange={() => setForm((p) => ({ ...p, show_in_catalog: false }))}
                className="accent-primary"
              />
              <span className="text-xs">Kun tilgjengelig via direkte lenke</span>
            </label>
          </div>
        </div>
      )}

      {/* Status summary */}
      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Oppsummering</p>
        <p className="text-xs text-foreground">{accessSummary}</p>
      </div>

      {/* Ved innsending */}
      <div className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Handling ved innsending</p>
        <Select value={form.on_submit_action} onValueChange={(v) => setForm((p) => ({ ...p, on_submit_action: v }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="queue">Legg i kø</SelectItem>
            <SelectItem value="create_case">Opprett sak</SelectItem>
            <SelectItem value="create_task">Opprett oppgave</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button className="w-full" onClick={() => {
        const catId = form.category_id === "__none__" ? null : form.category_id;
        const catName = categories.find((c: any) => c.id === catId)?.name || null;
        onSave({
          ...form,
          category_id: catId,
          category: catName,
          send_email_to: form.send_email_to ? form.send_email_to.split(",").map((s: string) => s.trim()).filter(Boolean) : null,
        });
      }}>
        Lagre innstillinger
      </Button>
    </div>
  );
}
