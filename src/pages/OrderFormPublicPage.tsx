import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Check, AlertCircle, Upload, Info, Loader2 } from "lucide-react";
import type { ConditionalLogic } from "@/types/order-forms";

export default function OrderFormPublicPage() {
  const { slug } = useParams<{ slug: string }>();
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submissionNo, setSubmissionNo] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<{ fieldKey: string; file: File }[]>([]);

  const { data: template, isLoading, error: loadError } = useQuery({
    queryKey: ["order-form-public", slug],
    enabled: !!slug,
    queryFn: async () => {
      // Find active template by slug (no company filter for public)
      const { data: tmpl, error } = await supabase
        .from("order_form_templates")
        .select("*")
        .eq("slug", slug!)
        .eq("is_active", true)
        .in("audience_type", ["external", "both"])
        .single();
      if (error || !tmpl) throw new Error("Skjema ikke funnet eller ikke tilgjengelig");

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
    if (!section.visibility_rules || !Array.isArray(section.visibility_rules) || section.visibility_rules.length === 0) return true;
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
      switch (r.operator) { case "equals": return String(val) === String(r.value); default: return true; }
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
        if (isFieldRequired(field)) {
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
    if (!validate() || !template) return;
    setSubmitting(true);
    try {
      const submissionId = crypto.randomUUID();
      const summary: Record<string, any> = {};
      ["oppdragstittel", "kundenavn", "firmanavn", "bestiller_navn"].forEach((k) => { if (formData[k]) summary[k] = formData[k]; });

      const { data: subData, error: subErr } = await supabase.from("order_form_submissions").insert({
        id: submissionId,
        company_id: template.company_id,
        template_id: template.id,
        status: "new",
        source: "external",
        requester_type: "external",
        priority: "normal",
        summary,
      } as any).select("submission_no").single();
      if (subErr) throw subErr;

      const valueRows = Object.entries(formData)
        .filter(([, v]) => v != null && v !== "")
        .map(([key, val]) => ({ submission_id: submissionId, field_key: key, value: val }));
      if (valueRows.length > 0) {
        await supabase.from("order_form_submission_values").insert(valueRows);
      }

      for (const att of attachments) {
        const path = `${template.company_id}/${submissionId}/${Date.now()}_${att.file.name}`;
        await supabase.storage.from("order-form-attachments").upload(path, att.file);
        await supabase.from("order_form_submission_attachments").insert({
          submission_id: submissionId, field_key: att.fieldKey,
          file_name: att.file.name, file_path: path,
          mime_type: att.file.type, file_size: att.file.size,
        });
      }

      await supabase.from("order_form_activity_log").insert({
        submission_id: submissionId, event_type: "submitted",
        payload: { source: "external" },
      });

      setSubmissionNo(subData?.submission_no || null);
      setSubmitted(true);
    } catch (err: any) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (loadError || !template) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <AlertCircle className="h-10 w-10 text-muted-foreground/40 mx-auto" />
          <p className="text-sm text-muted-foreground">Skjemaet finnes ikke eller er ikke tilgjengelig.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-md mx-auto text-center space-y-4 p-6">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Check className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Bestilling mottatt!</h2>
          {submissionNo && (
            <p className="text-sm font-medium text-foreground">Bestillingsnummer: {submissionNo}</p>
          )}
          <p className="text-sm text-muted-foreground">
            {template.confirmation_text || "Bestillingen din er registrert og vil bli behandlet. Du vil bli kontaktet ved behov."}
          </p>
          <Button onClick={() => { setSubmitted(false); setFormData({}); setAttachments([]); setSubmissionNo(null); }}>
            Send ny bestilling
          </Button>
        </div>
      </div>
    );
  }

  const errorCount = Object.keys(errors).length;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2 py-4">
          <h1 className="text-2xl font-bold text-foreground">
            {template.external_title || template.name}
          </h1>
          {template.description && (
            <p className="text-sm text-muted-foreground max-w-lg mx-auto">{template.description}</p>
          )}
        </div>

        {/* Errors */}
        {errorCount > 0 && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-destructive">{errorCount} felt mangler utfylling</p>
              <ul className="text-xs text-destructive/80 mt-1 space-y-0.5">
                {Object.values(errors).slice(0, 5).map((e, i) => <li key={i}>• {e}</li>)}
              </ul>
            </div>
          </div>
        )}

        {/* Sections with layout */}
        {template.sections.map((section: any) => {
          if (!isSectionVisible(section)) return null;
          const visibleFields = section.fields.filter(isFieldVisible);
          if (visibleFields.length === 0) return null;

          const rows: { fields: any[] }[] = [];
          let currentRow: any[] = [];
          let currentWidth = 0;
          for (const field of visibleFields) {
            const w = (field as any).field_width || "full";
            const frac = w === "half" ? 0.5 : w === "third" ? 0.33 : w === "two_thirds" ? 0.66 : 1;
            if (currentWidth + frac > 1.01 && currentRow.length > 0) {
              rows.push({ fields: currentRow });
              currentRow = [];
              currentWidth = 0;
            }
            currentRow.push(field);
            currentWidth += frac;
          }
          if (currentRow.length > 0) rows.push({ fields: currentRow });

          return (
            <Card key={section.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{section.title}</CardTitle>
                {section.description && <p className="text-xs text-muted-foreground">{section.description}</p>}
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {rows.map((row, ri) => (
                    <div key={ri} className={row.fields.length > 1 ? "flex gap-3" : ""}>
                      {row.fields.map((field: any) => {
                        const w = (field as any).field_width || "full";
                        const style: React.CSSProperties = row.fields.length > 1
                          ? { width: w === "half" ? "calc(50% - 6px)" : w === "third" ? "calc(33.33% - 8px)" : w === "two_thirds" ? "calc(66.66% - 4px)" : "100%" }
                          : {};
                        return (
                          <div key={field.id} style={style} className={row.fields.length > 1 ? "min-w-0" : ""}>
                            <PublicFieldRenderer
                              field={field}
                              value={formData[field.field_key]}
                              onChange={(val) => setValue(field.field_key, val)}
                              error={errors[field.field_key]}
                              required={isFieldRequired(field)}
                              onFileAdd={(file) => setAttachments((prev) => [...prev, { fieldKey: field.field_key, file }])}
                            />
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {/* Submit */}
        <div className="flex justify-center pb-12">
          <Button size="lg" className="min-w-[200px] text-base" onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sender...
              </>
            ) : (
              "Send inn bestilling"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Public Field Renderer ──

function PublicFieldRenderer({ field, value, onChange, error, required, onFileAdd }: {
  field: any; value: any; onChange: (v: any) => void; error?: string; required: boolean; onFileAdd: (f: File) => void;
}) {
  const options: string[] = Array.isArray(field.options)
    ? field.options.map((o: any) => (typeof o === "string" ? o : o.label || o.value))
    : [];

  const renderInput = () => {
    switch (field.field_type) {
      case "short_text": case "email": case "phone": case "org_number": case "address":
        return <Input type={field.field_type === "email" ? "email" : field.field_type === "phone" ? "tel" : "text"} placeholder={field.placeholder || ""} value={value || ""} onChange={(e) => onChange(e.target.value)} />;
      case "long_text":
        return <Textarea placeholder={field.placeholder || ""} value={value || ""} onChange={(e) => onChange(e.target.value)} className="min-h-[80px]" />;
      case "number":
        return <Input type="number" placeholder={field.placeholder || ""} value={value || ""} onChange={(e) => onChange(e.target.value)} />;
      case "date":
        return <Input type="date" value={value || ""} onChange={(e) => onChange(e.target.value)} />;
      case "time": case "time_window":
        return <Input type="time" value={value || ""} onChange={(e) => onChange(e.target.value)} />;
      case "dropdown":
        return (
          <Select value={value || ""} onValueChange={onChange}>
            <SelectTrigger><SelectValue placeholder={field.placeholder || "Velg..."} /></SelectTrigger>
            <SelectContent>{options.map((opt) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent>
          </Select>
        );
      case "radio":
        return (
          <RadioGroup value={value || ""} onValueChange={onChange} className="space-y-2">
            {options.map((opt) => (
              <div key={opt} className="flex items-center gap-2">
                <RadioGroupItem value={opt} id={`${field.field_key}-${opt}`} />
                <Label htmlFor={`${field.field_key}-${opt}`} className="text-sm font-normal cursor-pointer">{opt}</Label>
              </div>
            ))}
          </RadioGroup>
        );
      case "yes_no":
        return (
          <RadioGroup value={value === true ? "ja" : value === false ? "nei" : ""} onValueChange={(v) => onChange(v === "ja")} className="flex gap-4">
            <div className="flex items-center gap-2"><RadioGroupItem value="ja" id={`${field.field_key}-ja`} /><Label htmlFor={`${field.field_key}-ja`} className="text-sm font-normal cursor-pointer">Ja</Label></div>
            <div className="flex items-center gap-2"><RadioGroupItem value="nei" id={`${field.field_key}-nei`} /><Label htmlFor={`${field.field_key}-nei`} className="text-sm font-normal cursor-pointer">Nei</Label></div>
          </RadioGroup>
        );
      case "checkbox_list": case "multi_select": {
        const selected: string[] = Array.isArray(value) ? value : [];
        return (
          <div className="space-y-2">
            {options.map((opt) => (
              <div key={opt} className="flex items-center gap-2">
                <Checkbox checked={selected.includes(opt)} onCheckedChange={(checked) => onChange(checked ? [...selected, opt] : selected.filter((s) => s !== opt))} id={`${field.field_key}-${opt}`} />
                <Label htmlFor={`${field.field_key}-${opt}`} className="text-sm font-normal cursor-pointer">{opt}</Label>
              </div>
            ))}
          </div>
        );
      }
      case "file_upload": case "image_upload":
        return (
          <label className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/40 transition-colors">
            <Upload className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{field.field_type === "image_upload" ? "Last opp bilde" : "Last opp fil"}</span>
            <input type="file" className="hidden" accept={field.field_type === "image_upload" ? "image/*" : undefined} multiple onChange={(e) => { if (e.target.files) { Array.from(e.target.files).forEach((f) => onFileAdd(f)); onChange(`${(value ? Number(value) : 0) + e.target.files.length} filer`); } }} />
          </label>
        );
      case "info_box":
        return (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground">{field.help_text || field.label}</p>
          </div>
        );
      case "section_header": return null;
      default:
        return <Input placeholder={field.placeholder || ""} value={value || ""} onChange={(e) => onChange(e.target.value)} />;
    }
  };

  if (field.field_type === "info_box" || field.field_type === "section_header") return renderInput();

  return (
    <div className="space-y-1.5">
      <Label className="text-sm">
        {field.label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {field.help_text && field.field_type !== "info_box" && <p className="text-xs text-muted-foreground">{field.help_text}</p>}
      {renderInput()}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
