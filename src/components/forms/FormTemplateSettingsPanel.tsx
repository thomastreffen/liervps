import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FolderKanban,
  FileText,
  Sun,
  Globe,
  Link2,
  Lock,
  Users,
  ShieldCheck,
  AlertTriangle,
  ClipboardCheck,
  Save,
  Loader2,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface FormTemplateSettings {
  available_in_projects: boolean;
  available_in_documents: boolean;
  available_in_my_day: boolean;
  available_in_customer_portal: boolean;
  shareable_via_link: boolean;
  internal_only: boolean;
  allowed_roles: string[];
  is_required: boolean;
  required_before_completion: boolean;
  required_before_billing: boolean;
  required_for_job_types: string[];
  form_type: string;
  is_active: boolean;
}

const FORM_TYPES = [
  { value: "checklist", label: "Sjekkliste" },
  { value: "control", label: "Kontroll" },
  { value: "signature", label: "Signering" },
  { value: "hms", label: "HMS" },
  { value: "handover", label: "Overlevering" },
];

const ROLE_OPTIONS = [
  { value: "technician", label: "Montør" },
  { value: "project_manager", label: "Prosjektleder" },
  { value: "admin", label: "Admin" },
  { value: "customer", label: "Kunde" },
];

const AVAILABILITY_OPTIONS = [
  { key: "available_in_projects" as const, label: "Brukes i prosjekter", icon: FolderKanban },
  { key: "available_in_documents" as const, label: "Brukes i dokumentasjon", icon: FileText },
  { key: "available_in_my_day" as const, label: "Brukes i Min dag", icon: Sun },
  { key: "available_in_customer_portal" as const, label: "Synlig i kundeportal", icon: Globe },
  { key: "shareable_via_link" as const, label: "Kan deles via lenke", icon: Link2 },
  { key: "internal_only" as const, label: "Kun intern bruk", icon: Lock },
];

interface Props {
  templateId: string;
  settings: FormTemplateSettings;
  onSettingsChange: (s: FormTemplateSettings) => void;
}

export function FormTemplateSettingsPanel({ templateId, settings, onSettingsChange }: Props) {
  const [saving, setSaving] = useState(false);

  const toggle = (key: keyof FormTemplateSettings) => {
    const val = settings[key];
    if (typeof val === "boolean") {
      onSettingsChange({ ...settings, [key]: !val });
    }
  };

  const toggleRole = (role: string) => {
    const roles = settings.allowed_roles.includes(role)
      ? settings.allowed_roles.filter((r) => r !== role)
      : [...settings.allowed_roles, role];
    onSettingsChange({ ...settings, allowed_roles: roles });
  };

  const saveSettings = async () => {
    setSaving(true);
    const { error } = await (supabase as any)
      .from("form_templates")
      .update({
        available_in_projects: settings.available_in_projects,
        available_in_documents: settings.available_in_documents,
        available_in_my_day: settings.available_in_my_day,
        available_in_customer_portal: settings.available_in_customer_portal,
        shareable_via_link: settings.shareable_via_link,
        internal_only: settings.internal_only,
        allowed_roles: settings.allowed_roles,
        is_required: settings.is_required,
        required_before_completion: settings.required_before_completion,
        required_before_billing: settings.required_before_billing,
        required_for_job_types: settings.required_for_job_types,
        form_type: settings.form_type,
        is_active: settings.is_active,
      })
      .eq("id", templateId);

    if (error) {
      toast.error("Kunne ikke lagre innstillinger");
    } else {
      toast.success("Innstillinger lagret");
    }
    setSaving(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mal-innstillinger</h3>
        </div>
        <Button size="sm" variant="outline" className="rounded-lg gap-1.5 text-xs h-7" onClick={saveSettings} disabled={saving}>
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          Lagre
        </Button>
      </div>

      {/* Form type */}
      <div>
        <Label className="text-xs text-muted-foreground mb-1.5 block">Skjematype</Label>
        <Select value={settings.form_type} onValueChange={(v) => onSettingsChange({ ...settings, form_type: v })}>
          <SelectTrigger className="h-8 text-xs rounded-lg">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FORM_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Active toggle */}
      <div className="flex items-center gap-2">
        <Checkbox
          id="is_active"
          checked={settings.is_active}
          onCheckedChange={() => toggle("is_active")}
        />
        <Label htmlFor="is_active" className="text-xs cursor-pointer">
          Aktiv mal
        </Label>
        <Badge variant={settings.is_active ? "default" : "secondary"} className="text-[9px] ml-auto">
          {settings.is_active ? "Aktiv" : "Inaktiv"}
        </Badge>
      </div>

      {/* Availability */}
      <Card>
        <CardContent className="p-3 space-y-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <FolderKanban className="h-3 w-3" /> Tilgjengelighet
          </p>
          {AVAILABILITY_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            return (
              <div key={opt.key} className="flex items-center gap-2">
                <Checkbox
                  id={opt.key}
                  checked={settings[opt.key] as boolean}
                  onCheckedChange={() => toggle(opt.key)}
                />
                <Label htmlFor={opt.key} className="text-xs cursor-pointer flex items-center gap-1.5">
                  <Icon className="h-3 w-3 text-muted-foreground" />
                  {opt.label}
                </Label>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Roles */}
      <Card>
        <CardContent className="p-3 space-y-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Users className="h-3 w-3" /> Hvem kan fylle ut
          </p>
          {ROLE_OPTIONS.map((role) => (
            <div key={role.value} className="flex items-center gap-2">
              <Checkbox
                id={`role-${role.value}`}
                checked={settings.allowed_roles.includes(role.value)}
                onCheckedChange={() => toggleRole(role.value)}
              />
              <Label htmlFor={`role-${role.value}`} className="text-xs cursor-pointer">{role.label}</Label>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Rules */}
      <Card>
        <CardContent className="p-3 space-y-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <ShieldCheck className="h-3 w-3" /> Regler
          </p>
          <div className="flex items-center gap-2">
            <Checkbox
              id="is_required"
              checked={settings.is_required}
              onCheckedChange={() => toggle("is_required")}
            />
            <Label htmlFor="is_required" className="text-xs cursor-pointer">Obligatorisk skjema</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="required_before_completion"
              checked={settings.required_before_completion}
              onCheckedChange={() => toggle("required_before_completion")}
            />
            <Label htmlFor="required_before_completion" className="text-xs cursor-pointer">
              Krev før ferdigmelding
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="required_before_billing"
              checked={settings.required_before_billing}
              onCheckedChange={() => toggle("required_before_billing")}
            />
            <Label htmlFor="required_before_billing" className="text-xs cursor-pointer">
              Krev før fakturagrunnlag
            </Label>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
