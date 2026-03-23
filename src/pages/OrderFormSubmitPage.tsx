import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Check, AlertCircle, Upload, Info } from "lucide-react";
import type { OrderFormField, ConditionalLogic } from "@/types/order-forms";

export default function OrderFormSubmitPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { activeCompanyId } = useCompanyContext();
  const { user } = useAuth();

  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [attachments, setAttachments] = useState<{ fieldKey: string; file: File; category?: string }[]>([]);

  // Load template with sections and fields
  const { data: template, isLoading } = useQuery({
    queryKey: ["order-form-template-full", slug, activeCompanyId],
    enabled: !!slug && !!activeCompanyId,
    queryFn: async () => {
      const { data: tmpl, error } = await supabase
        .from("order_form_templates")
        .select("*")
        .eq("company_id", activeCompanyId!)
        .eq("slug", slug!)
        .eq("is_active", true)
        .single();
      if (error || !tmpl) throw new Error("Mal ikke funnet");

      const { data: secs } = await supabase
        .from("order_form_template_sections")
        .select("*")
        .eq("template_id", tmpl.id)
        .eq("is_active", true)
        .order("sort_order");

      const { data: fields } = await supabase
        .from("order_form_template_fields")
        .select("*")
        .eq("template_id", tmpl.id)
        .eq("is_active", true)
        .order("sort_order");

      return {
        ...tmpl,
        sections: (secs || []).map((s: any) => ({
          ...s,
          fields: (fields || []).filter((f: any) => f.section_id === s.id),
        })),
      };
    },
  });

  // Evaluate conditional logic
  const isFieldVisible = (field: any): boolean => {
    if (!field.conditional_logic) return true;
    const logic = field.conditional_logic as ConditionalLogic;
    if (!logic.rules || logic.rules.length === 0) return true;

    const results = logic.rules.map((rule) => {
      const val = formData[rule.field_key];
      switch (rule.operator) {
        case "equals": return String(val) === String(rule.value);
        case "not_equals": return String(val) !== String(rule.value);
        case "contains": return String(val || "").includes(String(rule.value));
        case "is_empty": return !val || val === "";
        case "is_not_empty": return !!val && val !== "";
        default: return true;
      }
    });

    const match = logic.logic === "or" ? results.some(Boolean) : results.every(Boolean);
    return logic.action === "show" ? match : logic.action === "hide" ? !match : true;
  };

  const isSectionVisible = (section: any): boolean => {
    if (!section.visibility_rules || !Array.isArray(section.visibility_rules) || section.visibility_rules.length === 0)
      return true;
    return section.visibility_rules.every((rule: ConditionalLogic) => {
      const results = rule.rules.map((r) => {
        const val = formData[r.field_key];
        switch (r.operator) {
          case "equals": return String(val) === String(r.value);
          case "not_equals": return String(val) !== String(r.value);
          default: return true;
        }
      });
      const match = rule.logic === "or" ? results.some(Boolean) : results.every(Boolean);
      return rule.action === "show" ? match : !match;
    });
  };

  const isFieldRequired = (field: any): boolean => {
    if (field.is_required) return true;
    if (!field.conditional_logic) return false;
    const logic = field.conditional_logic as ConditionalLogic;
    if (logic.action !== "require") return false;
    const results = logic.rules.map((r) => {
      const val = formData[r.field_key];
      switch (r.operator) {
        case "equals": return String(val) === String(r.value);
        default: return true;
      }
    });
    return logic.logic === "or" ? results.some(Boolean) : results.every(Boolean);
  };

  const setValue = (key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!template) return false;

    template.sections.forEach((section: any) => {
      if (!isSectionVisible(section)) return;
      section.fields.forEach((field: any) => {
        if (!isFieldVisible(field)) return;
        const req = isFieldRequired(field);
        if (req) {
          const val = formData[field.field_key];
          if (val == null || val === "" || (Array.isArray(val) && val.length === 0)) {
            newErrors[field.field_key] = `${field.label} er påkrevd`;
          }
        }
      });
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate() || !template || !activeCompanyId) return;
    setSubmitting(true);

    try {
      const submissionId = crypto.randomUUID();

      // Build summary from key fields
      const summary: Record<string, any> = {};
      const summaryKeys = ["oppdragstittel", "kundenavn", "bestillingstype", "hastegrad", "bestiller_navn"];
      summaryKeys.forEach((k) => { if (formData[k]) summary[k] = formData[k]; });

      // Determine priority from hastegrad
      const hastegradMap: Record<string, string> = {
        "Kritisk stopp": "critical",
        "Høy": "high",
        "Normal": "normal",
        "Lav": "low",
      };
      const priority = hastegradMap[formData.hastegrad] || "normal";

      // Insert submission
      const { error: subErr } = await supabase.from("order_form_submissions").insert({
        id: submissionId,
        company_id: activeCompanyId,
        template_id: template.id,
        status: "new",
        source: "internal",
        requester_type: formData.bestillingstype === "intern" ? "internal" : "external",
        submitted_by: user?.id,
        priority,
        summary,
      });
      if (subErr) throw subErr;

      // Insert field values
      const valueRows = Object.entries(formData)
        .filter(([, v]) => v != null && v !== "")
        .map(([key, val]) => ({
          submission_id: submissionId,
          field_key: key,
          value: val,
        }));

      if (valueRows.length > 0) {
        const { error: valErr } = await supabase
          .from("order_form_submission_values")
          .insert(valueRows);
        if (valErr) throw valErr;
      }

      // Upload attachments
      for (const att of attachments) {
        const path = `${activeCompanyId}/${submissionId}/${Date.now()}_${att.file.name}`;
        const { error: uploadErr } = await supabase.storage
          .from("order-form-attachments")
          .upload(path, att.file);
        if (uploadErr) {
          console.error("Upload failed:", uploadErr);
          continue;
        }
        await supabase.from("order_form_submission_attachments").insert({
          submission_id: submissionId,
          field_key: att.fieldKey,
          category: att.category || null,
          file_name: att.file.name,
          file_path: path,
          mime_type: att.file.type,
          file_size: att.file.size,
          uploaded_by: user?.id,
        });
      }

      // Activity log
      await supabase.from("order_form_activity_log").insert({
        submission_id: submissionId,
        event_type: "submitted",
        payload: { source: "internal", priority },
        created_by: user?.id,
      });

      setSubmitted(true);
      toast.success("Bestilling sendt inn");
    } catch (err: any) {
      console.error(err);
      toast.error("Feil ved innsending: " + (err.message || "Ukjent feil"));
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) return <div className="p-6 text-center text-muted-foreground">Laster skjema...</div>;
  if (!template) return <div className="p-6 text-center text-muted-foreground">Skjemamal ikke funnet</div>;

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto p-6 text-center space-y-4 mt-20">
        <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
          <Check className="h-8 w-8 text-green-600" />
        </div>
        <h2 className="text-xl font-bold">Bestilling mottatt!</h2>
        <p className="text-sm text-muted-foreground">
          {template.confirmation_text || "Bestillingen din er registrert og vil bli behandlet."}
        </p>
        <div className="flex gap-2 justify-center">
          <Button variant="outline" onClick={() => navigate("/orders")}>
            Se bestillinger
          </Button>
          <Button onClick={() => { setSubmitted(false); setFormData({}); setAttachments([]); }}>
            Send ny bestilling
          </Button>
        </div>
      </div>
    );
  }

  const errorCount = Object.keys(errors).length;

  return (
    <div className="space-y-6 p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/orders")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {template.internal_title || template.name}
          </h1>
          {template.description && (
            <p className="text-sm text-muted-foreground mt-0.5">{template.description}</p>
          )}
        </div>
      </div>

      {/* Error summary */}
      {errorCount > 0 && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-destructive">
              {errorCount} felt mangler utfylling
            </p>
            <ul className="text-xs text-destructive/80 mt-1 space-y-0.5">
              {Object.values(errors).slice(0, 5).map((e, i) => (
                <li key={i}>• {e}</li>
              ))}
              {errorCount > 5 && <li>• ...og {errorCount - 5} til</li>}
            </ul>
          </div>
        </div>
      )}

      {/* Sections */}
      {template.sections.map((section: any) => {
        if (!isSectionVisible(section)) return null;
        const visibleFields = section.fields.filter(isFieldVisible);
        if (visibleFields.length === 0) return null;

        return (
          <Card key={section.id}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{section.title}</CardTitle>
              {section.description && (
                <p className="text-xs text-muted-foreground">{section.description}</p>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {visibleFields.map((field: any) => (
                  <FieldRenderer
                    key={field.id}
                    field={field}
                    value={formData[field.field_key]}
                    onChange={(val) => setValue(field.field_key, val)}
                    error={errors[field.field_key]}
                    required={isFieldRequired(field)}
                    onFileAdd={(file, category) =>
                      setAttachments((prev) => [...prev, { fieldKey: field.field_key, file, category }])
                    }
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Submit */}
      <div className="flex justify-end gap-3 pb-8">
        <Button variant="outline" onClick={() => navigate("/orders")}>
          Avbryt
        </Button>
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Sender..." : "Send bestilling"}
        </Button>
      </div>
    </div>
  );
}

// ── Field Renderer ──

interface FieldRendererProps {
  field: any;
  value: any;
  onChange: (val: any) => void;
  error?: string;
  required: boolean;
  onFileAdd: (file: File, category?: string) => void;
}

function FieldRenderer({ field, value, onChange, error, required, onFileAdd }: FieldRendererProps) {
  const options: string[] = Array.isArray(field.options)
    ? field.options.map((o: any) => (typeof o === "string" ? o : o.label || o.value))
    : [];

  const renderInput = () => {
    switch (field.field_type) {
      case "short_text":
      case "email":
      case "phone":
      case "org_number":
      case "address":
        return (
          <Input
            type={field.field_type === "email" ? "email" : field.field_type === "phone" ? "tel" : "text"}
            placeholder={field.placeholder || ""}
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
          />
        );

      case "long_text":
        return (
          <Textarea
            placeholder={field.placeholder || ""}
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            className="min-h-[80px]"
          />
        );

      case "number":
        return (
          <Input
            type="number"
            placeholder={field.placeholder || ""}
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
          />
        );

      case "date":
        return (
          <Input
            type="date"
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
          />
        );

      case "time":
      case "time_window":
        return (
          <Input
            type="time"
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
          />
        );

      case "dropdown":
        return (
          <Select value={value || ""} onValueChange={onChange}>
            <SelectTrigger>
              <SelectValue placeholder={field.placeholder || "Velg..."} />
            </SelectTrigger>
            <SelectContent>
              {options.map((opt) => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "radio":
        return (
          <RadioGroup value={value || ""} onValueChange={onChange} className="space-y-2">
            {options.map((opt) => (
              <div key={opt} className="flex items-center gap-2">
                <RadioGroupItem value={opt} id={`${field.field_key}-${opt}`} />
                <Label htmlFor={`${field.field_key}-${opt}`} className="text-sm font-normal cursor-pointer">
                  {opt}
                </Label>
              </div>
            ))}
          </RadioGroup>
        );

      case "yes_no":
        return (
          <RadioGroup value={value === true ? "ja" : value === false ? "nei" : ""} onValueChange={(v) => onChange(v === "ja")} className="flex gap-4">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="ja" id={`${field.field_key}-ja`} />
              <Label htmlFor={`${field.field_key}-ja`} className="text-sm font-normal cursor-pointer">Ja</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="nei" id={`${field.field_key}-nei`} />
              <Label htmlFor={`${field.field_key}-nei`} className="text-sm font-normal cursor-pointer">Nei</Label>
            </div>
          </RadioGroup>
        );

      case "checkbox_list":
      case "multi_select":
        const selected: string[] = Array.isArray(value) ? value : [];
        return (
          <div className="space-y-2">
            {options.map((opt) => (
              <div key={opt} className="flex items-center gap-2">
                <Checkbox
                  checked={selected.includes(opt)}
                  onCheckedChange={(checked) => {
                    const next = checked
                      ? [...selected, opt]
                      : selected.filter((s) => s !== opt);
                    onChange(next);
                  }}
                  id={`${field.field_key}-${opt}`}
                />
                <Label htmlFor={`${field.field_key}-${opt}`} className="text-sm font-normal cursor-pointer">
                  {opt}
                </Label>
              </div>
            ))}
          </div>
        );

      case "file_upload":
      case "image_upload":
        return (
          <div>
            <label className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/40 transition-colors">
              <Upload className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {field.field_type === "image_upload" ? "Last opp bilde" : "Last opp fil"}
              </span>
              <input
                type="file"
                className="hidden"
                accept={field.field_type === "image_upload" ? "image/*" : undefined}
                multiple
                onChange={(e) => {
                  const files = e.target.files;
                  if (files) {
                    Array.from(files).forEach((f) => onFileAdd(f));
                    onChange(`${(value ? Number(value) : 0) + files.length} filer`);
                  }
                }}
              />
            </label>
          </div>
        );

      case "info_box":
        return (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground">{field.help_text || field.label}</p>
          </div>
        );

      case "section_header":
        return null;

      default:
        return (
          <Input
            placeholder={field.placeholder || ""}
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
          />
        );
    }
  };

  if (field.field_type === "info_box" || field.field_type === "section_header") {
    return renderInput();
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-sm">
        {field.label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {field.help_text && field.field_type !== "info_box" && (
        <p className="text-xs text-muted-foreground">{field.help_text}</p>
      )}
      {renderInput()}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
