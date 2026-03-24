import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ORDER_FIELD_TYPE_LABELS, type OrderFormFieldType } from "@/types/order-forms";
import { Settings2, Trash2 } from "lucide-react";

interface FieldInspectorProps {
  field: any | null;
  section: any | null;
  onUpdateField: (fieldId: string, updates: Record<string, any>) => void;
  onUpdateSection: (sectionId: string, updates: Record<string, any>) => void;
  onDeleteField: (fieldId: string) => void;
  onDeleteSection: (sectionId: string) => void;
}

const WIDTH_OPTIONS = [
  { value: "full", label: "Full bredde (100%)" },
  { value: "half", label: "Halv bredde (50%)" },
  { value: "third", label: "Tredjedel (33%)" },
  { value: "two_thirds", label: "To tredjedeler (66%)" },
];

export function FieldInspector({
  field, section, onUpdateField, onUpdateSection, onDeleteField, onDeleteSection,
}: FieldInspectorProps) {
  const [localField, setLocalField] = useState<Record<string, any>>({});
  const [localSection, setLocalSection] = useState<Record<string, any>>({});

  useEffect(() => {
    if (field) setLocalField({ ...field });
  }, [field?.id]);

  useEffect(() => {
    if (section && !field) setLocalSection({ ...section });
  }, [section?.id, field]);

  if (!field && !section) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center">
          <Settings2 className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Velg et felt eller en seksjon for å redigere egenskaper</p>
        </div>
      </div>
    );
  }

  // Section inspector
  if (!field && section) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="p-3 border-b border-border">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Seksjonsegenskaper</h3>
        </div>
        <div className="p-3 space-y-3">
          <div>
            <Label className="text-xs">Tittel</Label>
            <Input
              value={localSection.title || ""}
              onChange={(e) => setLocalSection((p) => ({ ...p, title: e.target.value }))}
              onBlur={() => onUpdateSection(section.id, { title: localSection.title })}
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">Beskrivelse</Label>
            <Textarea
              value={localSection.description || ""}
              onChange={(e) => setLocalSection((p) => ({ ...p, description: e.target.value }))}
              onBlur={() => onUpdateSection(section.id, { description: localSection.description || null })}
              className="text-sm min-h-[60px]"
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Aktiv</Label>
            <Switch
              checked={section.is_active !== false}
              onCheckedChange={(v) => onUpdateSection(section.id, { is_active: v })}
            />
          </div>
          <Separator />
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 text-xs"
            onClick={() => onDeleteSection(section.id)}
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Slett seksjon
          </Button>
        </div>
      </div>
    );
  }

  if (!field) return null;

  const needsOptions = ["dropdown", "radio", "checkbox_list", "multi_select"].includes(field.field_type);
  const isLookup = ["customer_lookup", "project_lookup", "user_lookup"].includes(field.field_type);
  const optionsText = Array.isArray(localField.options) ? localField.options.join("\n") : "";

  const saveField = (updates: Record<string, any>) => {
    onUpdateField(field.id, updates);
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Feltegenskaper</h3>
          <Badge variant="outline" className="text-[9px]">
            {ORDER_FIELD_TYPE_LABELS[field.field_type as OrderFormFieldType] || field.field_type}
          </Badge>
        </div>
      </div>
      <div className="p-3 space-y-3">
        <div>
          <Label className="text-xs">Label</Label>
          <Input
            value={localField.label || ""}
            onChange={(e) => setLocalField((p) => ({ ...p, label: e.target.value }))}
            onBlur={() => saveField({ label: localField.label })}
            className="h-8 text-sm"
          />
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">Feltnøkkel</Label>
          <Input
            value={localField.field_key || ""}
            onChange={(e) => setLocalField((p) => ({ ...p, field_key: e.target.value }))}
            onBlur={() => saveField({ field_key: localField.field_key })}
            className="h-8 text-xs text-muted-foreground"
          />
        </div>

        <div>
          <Label className="text-xs">Hjelpetekst</Label>
          <Textarea
            value={localField.help_text || ""}
            onChange={(e) => setLocalField((p) => ({ ...p, help_text: e.target.value }))}
            onBlur={() => saveField({ help_text: localField.help_text || null })}
            className="text-sm min-h-[50px]"
            placeholder="Valgfri hjelpetekst for brukeren"
          />
        </div>

        <div>
          <Label className="text-xs">Placeholder</Label>
          <Input
            value={localField.placeholder || ""}
            onChange={(e) => setLocalField((p) => ({ ...p, placeholder: e.target.value }))}
            onBlur={() => saveField({ placeholder: localField.placeholder || null })}
            className="h-8 text-sm"
          />
        </div>

        <Separator />

        {/* Layout */}
        <div>
          <Label className="text-xs font-semibold">Layout</Label>
          <Select
            value={field.field_width || "full"}
            onValueChange={(v) => saveField({ field_width: v })}
          >
            <SelectTrigger className="h-8 text-xs mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WIDTH_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground mt-1">
            Felter med halv bredde plasseres side om side i skjemaet.
          </p>
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <Label className="text-xs">Påkrevd</Label>
          <Switch
            checked={field.is_required || false}
            onCheckedChange={(v) => saveField({ is_required: v })}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-xs">Aktiv</Label>
          <Switch
            checked={field.is_active !== false}
            onCheckedChange={(v) => saveField({ is_active: v })}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-xs">Skrivebeskyttet</Label>
          <Switch
            checked={field.is_readonly || false}
            onCheckedChange={(v) => saveField({ is_readonly: v })}
          />
        </div>

        {needsOptions && (
          <>
            <Separator />
            <div>
              <Label className="text-xs">Alternativer (én per linje)</Label>
              <Textarea
                value={optionsText}
                onChange={(e) => setLocalField((p) => ({ ...p, options: e.target.value.split("\n") }))}
                onBlur={() => {
                  const opts = (localField.options || []).map((o: string) => o.trim()).filter(Boolean);
                  saveField({ options: opts.length > 0 ? opts : null });
                }}
                className="text-sm min-h-[80px]"
                placeholder="Alternativ 1&#10;Alternativ 2&#10;Alternativ 3"
              />
            </div>
          </>
        )}

        {isLookup && (
          <>
            <Separator />
            <div className="rounded-lg bg-muted/30 p-2.5 text-xs text-muted-foreground space-y-1.5">
              <p className="font-medium text-foreground">
                {field.field_type === "customer_lookup" && "Kundeoppslag"}
                {field.field_type === "project_lookup" && "Prosjektoppslag"}
                {field.field_type === "user_lookup" && "Brukeroppslag"}
              </p>
              {field.field_type === "customer_lookup" && (
                <p>Lar brukeren velge en eksisterende kunde fra systemet. Kan autofylle kundenavn, org.nr, adresse og kontaktinfo i andre felt.</p>
              )}
              {field.field_type === "project_lookup" && (
                <p>Lar brukeren koble bestillingen til et eksisterende prosjekt. Prosjektdata kan brukes videre i behandlingen.</p>
              )}
              {field.field_type === "user_lookup" && (
                <p>Lar brukeren velge en intern bruker, f.eks. ansvarlig kontaktperson eller prosjektleder.</p>
              )}
            </div>
          </>
        )}

        <div>
          <Label className="text-xs">Standardverdi</Label>
          <Input
            value={localField.default_value || ""}
            onChange={(e) => setLocalField((p) => ({ ...p, default_value: e.target.value }))}
            onBlur={() => saveField({ default_value: localField.default_value || null })}
            className="h-8 text-sm"
          />
        </div>

        <Separator />

        <Button
          variant="ghost"
          size="sm"
          className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 text-xs"
          onClick={() => onDeleteField(field.id)}
        >
          <Trash2 className="h-3 w-3 mr-1" />
          Slett felt
        </Button>
      </div>
    </div>
  );
}
