import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trash2, GripVertical, Save, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const ITEM_TYPES = [
  { value: "yes_no_na", label: "Ja / Nei / Ikke aktuelt" },
  { value: "text", label: "Kort tekst" },
  { value: "long_text", label: "Lang tekst" },
  { value: "attachment", label: "Bilde / vedlegg" },
  { value: "risk", label: "Risikopunkt" },
  { value: "mitigation", label: "Tiltak" },
  { value: "signature", label: "Signatur" },
  { value: "responsible", label: "Ansvarlig" },
  { value: "due_date", label: "Frist" },
];

const WORK_TYPES = [
  "datacenter", "naeringsbygg", "tavlemontasje", "stromskinner",
  "service", "near_electrical", "off_hours", "alenearbeid",
];

interface Section {
  id: string;
  title: string;
  description: string | null;
  ordering: number;
  items: Item[];
}
interface Item {
  id: string;
  section_id: string;
  ordering: number;
  item_type: string;
  label: string;
  help_text: string | null;
  is_required: boolean;
}

export default function HmsTemplateEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: template, isLoading } = useQuery({
    queryKey: ["hms-template", id],
    enabled: !!id,
    queryFn: async () => {
      const sb = supabase as any;
      const { data, error } = await sb
        .from("hms_templates").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: sections = [] } = useQuery<Section[]>({
    queryKey: ["hms-template-sections", id],
    enabled: !!id,
    queryFn: async () => {
      const sb = supabase as any;
      const { data: secs, error } = await sb
        .from("hms_template_sections")
        .select("id, title, description, ordering")
        .eq("template_id", id)
        .order("ordering");
      if (error) throw error;
      const { data: items, error: iErr } = await sb
        .from("hms_template_items")
        .select("id, section_id, ordering, item_type, label, help_text, is_required")
        .eq("template_id", id)
        .order("ordering");
      if (iErr) throw iErr;
      return (secs ?? []).map((s: any) => ({
        ...s,
        items: (items ?? []).filter((it: any) => it.section_id === s.id),
      }));
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["hms-template", id] });
    qc.invalidateQueries({ queryKey: ["hms-template-sections", id] });
  };

  const saveMeta = useMutation({
    mutationFn: async (patch: Partial<any>) => {
      const sb = supabase as any;
      const { error } = await sb.from("hms_templates").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Lagret"); refresh(); },
    onError: (e: any) => toast.error(e.message),
  });

  const addSection = useMutation({
    mutationFn: async () => {
      const sb = supabase as any;
      const { error } = await sb.from("hms_template_sections").insert({
        template_id: id, title: "Ny seksjon", ordering: sections.length,
      });
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  const updateSection = useMutation({
    mutationFn: async ({ secId, patch }: { secId: string; patch: any }) => {
      const sb = supabase as any;
      const { error } = await sb.from("hms_template_sections").update(patch).eq("id", secId);
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  const deleteSection = useMutation({
    mutationFn: async (secId: string) => {
      const sb = supabase as any;
      const { error } = await sb.from("hms_template_sections").delete().eq("id", secId);
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  const addItem = useMutation({
    mutationFn: async (section: Section) => {
      const sb = supabase as any;
      const { error } = await sb.from("hms_template_items").insert({
        template_id: id,
        section_id: section.id,
        ordering: section.items.length,
        item_type: "yes_no_na",
        label: "Nytt punkt",
        is_required: false,
      });
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  const updateItem = useMutation({
    mutationFn: async ({ itemId, patch }: { itemId: string; patch: any }) => {
      const sb = supabase as any;
      const { error } = await sb.from("hms_template_items").update(patch).eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  const deleteItem = useMutation({
    mutationFn: async (itemId: string) => {
      const sb = supabase as any;
      const { error } = await sb.from("hms_template_items").delete().eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  if (isLoading || !template) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  const toggleWorkType = (w: string) => {
    const cur: string[] = template.suggested_work_types ?? [];
    const next = cur.includes(w) ? cur.filter((x) => x !== w) : [...cur, w];
    saveMeta.mutate({ suggested_work_types: next });
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link to="/hms/templates"><ArrowLeft className="h-4 w-4 mr-1" /> Tilbake</Link>
        </Button>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <Badge variant={template.kind === "sja" ? "default" : "secondary"} className="text-[10px] uppercase mb-1">
              {template.kind}
            </Badge>
            <h1 className="text-2xl font-semibold">{template.name}</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch
                checked={template.is_active}
                onCheckedChange={(v) => saveMeta.mutate({ is_active: v })}
              />
              <Label className="text-xs">{template.is_active ? "Aktiv" : "Inaktiv"}</Label>
            </div>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Navn</Label>
              <Input
                defaultValue={template.name}
                onBlur={(e) => e.target.value !== template.name && saveMeta.mutate({ name: e.target.value })}
              />
            </div>
            <div>
              <Label>Kategori</Label>
              <Input
                defaultValue={template.category}
                onBlur={(e) => e.target.value !== template.category && saveMeta.mutate({ category: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <Label>Beskrivelse</Label>
              <Textarea
                defaultValue={template.description ?? ""}
                onBlur={(e) => e.target.value !== (template.description ?? "") && saveMeta.mutate({ description: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <div>
            <Label className="mb-2 block">Foreslått for arbeidstype</Label>
            <div className="flex flex-wrap gap-1.5">
              {WORK_TYPES.map((w) => {
                const on = (template.suggested_work_types ?? []).includes(w);
                return (
                  <Badge
                    key={w}
                    variant={on ? "default" : "outline"}
                    className="cursor-pointer text-xs"
                    onClick={() => toggleWorkType(w)}
                  >
                    {w}
                  </Badge>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {sections.map((sec) => (
          <Card key={sec.id} className="border-border/60">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start gap-2">
                <GripVertical className="h-4 w-4 text-muted-foreground/40 mt-2.5" />
                <Input
                  defaultValue={sec.title}
                  onBlur={(e) => e.target.value !== sec.title && updateSection.mutate({ secId: sec.id, patch: { title: e.target.value } })}
                  className="font-semibold"
                />
                <Button variant="ghost" size="icon" onClick={() => deleteSection.mutate(sec.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-2 pl-6">
                {sec.items.map((it) => (
                  <div key={it.id} className="flex items-start gap-2 p-2 rounded border border-border/40 bg-muted/20">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr,180px,auto] gap-2 items-start">
                      <div className="space-y-1">
                        <Input
                          defaultValue={it.label}
                          onBlur={(e) => e.target.value !== it.label && updateItem.mutate({ itemId: it.id, patch: { label: e.target.value } })}
                          placeholder="Spørsmål eller punkt"
                        />
                        <Input
                          defaultValue={it.help_text ?? ""}
                          onBlur={(e) => e.target.value !== (it.help_text ?? "") && updateItem.mutate({ itemId: it.id, patch: { help_text: e.target.value || null } })}
                          placeholder="Hjelpetekst (valgfritt)"
                          className="text-xs h-8"
                        />
                      </div>
                      <Select
                        value={it.item_type}
                        onValueChange={(v) => updateItem.mutate({ itemId: it.id, patch: { item_type: v } })}
                      >
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ITEM_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex items-center gap-2 pt-1">
                        <Switch
                          checked={it.is_required}
                          onCheckedChange={(v) => updateItem.mutate({ itemId: it.id, patch: { is_required: v } })}
                        />
                        <Label className="text-xs">Påkrevd</Label>
                        <Button variant="ghost" size="icon" onClick={() => deleteItem.mutate(it.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                <Button variant="ghost" size="sm" onClick={() => addItem.mutate(sec)}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Legg til punkt
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        <Button variant="outline" onClick={() => addSection.mutate()} className="w-full">
          <Plus className="h-4 w-4 mr-1.5" /> Legg til seksjon
        </Button>
      </div>
    </div>
  );
}
