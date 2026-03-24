import { useState, useRef, useEffect } from "react";
import {
  GripVertical, Plus, ChevronDown, ChevronRight, Eye, EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Info } from "lucide-react";
import { ORDER_FIELD_TYPE_LABELS, type OrderFormFieldType } from "@/types/order-forms";
import { FIELD_ICONS } from "./OrderFieldPalette";

interface PresetData {
  label: string;
  fieldKey: string;
  helpText?: string;
  options?: string[];
  isRequired?: boolean;
  fieldWidth?: string;
}

interface BuilderCanvasProps {
  sections: any[];
  selectedFieldId: string | null;
  selectedSectionId: string | null;
  onSelectField: (fieldId: string | null, sectionId: string) => void;
  onSelectSection: (sectionId: string) => void;
  onAddSection: () => void;
  onToggleFieldRequired: (fieldId: string, required: boolean) => void;
  onToggleFieldActive: (fieldId: string, active: boolean) => void;
  onToggleSectionActive: (sectionId: string, active: boolean) => void;
  onMoveSection: (fromIdx: number, toIdx: number) => void;
  onMoveField: (fieldId: string, fromSectionId: string, toSectionId: string, toIndex: number) => void;
  onDropNewField: (type: OrderFormFieldType, sectionId: string, index: number, preset?: PresetData) => void;
  templateTitle: string;
}

// Group fields into visual rows based on field_width
function groupFieldsIntoRows(fields: any[]) {
  const rows: { fields: any[]; startIndex: number }[] = [];
  let currentRow: any[] = [];
  let currentRowWidth = 0;
  let rowStartIndex = 0;

  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    const w = field.field_width || "full";
    const fraction = w === "half" ? 0.5 : w === "third" ? 0.33 : w === "two_thirds" ? 0.66 : 1;

    if (currentRowWidth + fraction > 1.01 && currentRow.length > 0) {
      rows.push({ fields: currentRow, startIndex: rowStartIndex });
      currentRow = [];
      currentRowWidth = 0;
      rowStartIndex = i;
    }
    currentRow.push(field);
    currentRowWidth += fraction;

    if (currentRowWidth >= 0.99) {
      rows.push({ fields: currentRow, startIndex: rowStartIndex });
      currentRow = [];
      currentRowWidth = 0;
      rowStartIndex = i + 1;
    }
  }
  if (currentRow.length > 0) rows.push({ fields: currentRow, startIndex: rowStartIndex });
  return rows;
}

function getWidthClass(w: string) {
  switch (w) {
    case "half": return "w-[calc(50%-6px)]";
    case "third": return "w-[calc(33.333%-8px)]";
    case "two_thirds": return "w-[calc(66.666%-4px)]";
    default: return "w-full";
  }
}

// Inline WYSIWYG field preview
function FieldPreviewInline({ field }: { field: any }) {
  const options: string[] = Array.isArray(field.options)
    ? field.options.map((o: any) => typeof o === "string" ? o : o.label || o.value)
    : [];

  if (field.field_type === "section_header") {
    return <h4 className="text-sm font-semibold text-foreground">{field.label}</h4>;
  }

  if (field.field_type === "info_box") {
    return (
      <div className="rounded-lg bg-blue-50 border border-blue-200/50 p-2.5 flex items-start gap-2">
        <Info className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
        <p className="text-[11px] text-blue-700">{field.help_text || field.label}</p>
      </div>
    );
  }

  const renderInput = () => {
    switch (field.field_type as OrderFormFieldType) {
      case "short_text": case "email": case "phone": case "address": case "org_number":
        return <Input placeholder={field.placeholder || field.help_text || ""} disabled className="h-8 text-xs bg-background" />;
      case "long_text":
        return <Textarea placeholder={field.placeholder || field.help_text || ""} disabled className="text-xs min-h-[56px] bg-background" />;
      case "number":
        return <Input type="number" placeholder={field.placeholder || ""} disabled className="h-8 text-xs bg-background" />;
      case "date":
        return <Input type="date" disabled className="h-8 text-xs bg-background" />;
      case "time": case "time_window":
        return <Input type="time" disabled className="h-8 text-xs bg-background" />;
      case "dropdown":
        return (
          <Select disabled>
            <SelectTrigger className="h-8 text-xs bg-background"><SelectValue placeholder={field.placeholder || "Velg..."} /></SelectTrigger>
            <SelectContent>{options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
          </Select>
        );
      case "radio":
        return (
          <RadioGroup disabled className="flex flex-wrap gap-x-4 gap-y-1">
            {options.map((o) => (
              <div key={o} className="flex items-center gap-1.5">
                <RadioGroupItem value={o} disabled className="h-3.5 w-3.5" />
                <span className="text-[11px]">{o}</span>
              </div>
            ))}
          </RadioGroup>
        );
      case "yes_no":
        return (
          <div className="flex gap-4">
            <div className="flex items-center gap-1.5"><RadioGroupItem value="ja" disabled className="h-3.5 w-3.5" /><span className="text-[11px]">Ja</span></div>
            <div className="flex items-center gap-1.5"><RadioGroupItem value="nei" disabled className="h-3.5 w-3.5" /><span className="text-[11px]">Nei</span></div>
          </div>
        );
      case "checkbox_list": case "multi_select":
        return (
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {options.map((o) => (
              <div key={o} className="flex items-center gap-1.5">
                <Checkbox disabled className="h-3.5 w-3.5" />
                <span className="text-[11px]">{o}</span>
              </div>
            ))}
          </div>
        );
      case "file_upload": case "image_upload":
        return (
          <div className="rounded-lg border-2 border-dashed border-border/40 p-3 text-center bg-muted/20">
            <Upload className="h-4 w-4 text-muted-foreground/40 mx-auto mb-0.5" />
            <p className="text-[10px] text-muted-foreground">
              {field.field_type === "image_upload" ? "Last opp bilde" : "Last opp fil"}
            </p>
          </div>
        );
      case "customer_lookup": case "project_lookup": case "user_lookup":
        return (
          <Select disabled>
            <SelectTrigger className="h-8 text-xs bg-background">
              <SelectValue placeholder={
                field.field_type === "customer_lookup" ? "Søk kunde..." :
                field.field_type === "project_lookup" ? "Søk prosjekt..." : "Søk bruker..."
              } />
            </SelectTrigger>
          </Select>
        );
      default:
        return <Input disabled className="h-8 text-xs bg-background" />;
    }
  };

  return (
    <div>
      <Label className="text-[11px] font-medium mb-1 flex items-center gap-1 text-foreground">
        {field.label}
        {field.is_required && <span className="text-destructive text-xs">*</span>}
      </Label>
      {field.help_text && (
        <p className="text-[10px] text-muted-foreground mb-1">{field.help_text}</p>
      )}
      {renderInput()}
    </div>
  );
}

export function BuilderCanvas({
  sections, selectedFieldId, selectedSectionId,
  onSelectField, onSelectSection, onAddSection,
  onToggleFieldRequired, onToggleFieldActive, onToggleSectionActive,
  onMoveSection, onMoveField, onDropNewField, templateTitle,
}: BuilderCanvasProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(sections.map((s) => s.id))
  );
  const [dropTarget, setDropTarget] = useState<{ sectionId: string; index: number } | null>(null);
  const [draggingFieldId, setDraggingFieldId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      sections.forEach(s => next.add(s.id));
      return next;
    });
  }, [sections.length]);

  const toggleExpand = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleAutoScroll = (clientY: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const edgeSize = 60;
    if (clientY - rect.top < edgeSize) el.scrollTop -= 8;
    else if (rect.bottom - clientY < edgeSize) el.scrollTop += 8;
  };

  const computeDropIndex = (e: React.DragEvent, fields: any[]): number => {
    const fieldEls = e.currentTarget.querySelectorAll('[data-field-index]');
    for (let i = 0; i < fieldEls.length; i++) {
      const rect = fieldEls[i].getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      if (e.clientY < midY) return i;
    }
    return fields.length;
  };

  const handleSectionDragOver = (e: React.DragEvent, sectionId: string, fields: any[]) => {
    e.preventDefault();
    e.stopPropagation();
    handleAutoScroll(e.clientY);
    const isNew = e.dataTransfer.types.includes("order-field-type");
    const isMove = e.dataTransfer.types.includes("move-field");
    if (!isNew && !isMove) return;
    e.dataTransfer.dropEffect = isNew ? "copy" : "move";
    const idx = computeDropIndex(e, fields);
    setDropTarget({ sectionId, index: idx });
  };

  const handleDrop = (e: React.DragEvent, sectionId: string, fields: any[]) => {
    e.preventDefault();
    e.stopPropagation();
    const idx = dropTarget?.sectionId === sectionId ? dropTarget.index : fields.length;
    setDropTarget(null);

    const newType = e.dataTransfer.getData("order-field-type") as OrderFormFieldType;
    if (newType) {
      const presetRaw = e.dataTransfer.getData("order-preset-data");
      const preset: PresetData | undefined = presetRaw ? JSON.parse(presetRaw) : undefined;
      onDropNewField(newType, sectionId, idx, preset);
      return;
    }

    const moveData = e.dataTransfer.getData("move-field");
    if (moveData) {
      const { fieldId, fromSectionId } = JSON.parse(moveData);
      onMoveField(fieldId, fromSectionId, sectionId, idx);
    }
  };

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto bg-muted/20">
      {/* Form header */}
      <div className="max-w-3xl mx-auto pt-6 px-6">
        <div className="text-center mb-6">
          <h2 className="text-lg font-bold text-foreground">{templateTitle || "Nytt skjema"}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{sections.length} seksjoner · {sections.reduce((n: number, s: any) => n + (s.fields?.length || 0), 0)} felt</p>
        </div>
      </div>

      {/* Sections as cards */}
      <div className="max-w-3xl mx-auto px-6 pb-6 space-y-4">
        {sections.map((section, sIdx) => {
          const isExpanded = expandedSections.has(section.id);
          const isSelected = selectedSectionId === section.id && !selectedFieldId;
          const fields = section.fields || [];

          return (
            <div
              key={section.id}
              className={`rounded-2xl border bg-card shadow-sm transition-all ${
                isSelected ? "border-primary ring-2 ring-primary/10" : "border-border/40"
              } ${!section.is_active ? "opacity-40" : ""}`}
              onClick={(e) => { e.stopPropagation(); onSelectSection(section.id); }}
            >
              {/* Section header */}
              <div className="flex items-center gap-2 px-5 py-3 border-b border-border/30">
                <button
                  onClick={(e) => { e.stopPropagation(); toggleExpand(section.id); }}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
                <h3 className="text-sm font-semibold flex-1 truncate">{section.title}</h3>
                <Badge variant="outline" className="text-[10px] font-normal">{fields.length} felt</Badge>
                <Switch
                  checked={section.is_active !== false}
                  onCheckedChange={(v) => onToggleSectionActive(section.id, v)}
                  className="scale-75"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              {/* Fields area - WYSIWYG */}
              {isExpanded && (
                <div
                  className={`p-5 transition-colors ${
                    dropTarget?.sectionId === section.id ? "bg-primary/[0.02]" : ""
                  }`}
                  onDragOver={(e) => handleSectionDragOver(e, section.id, fields)}
                  onDrop={(e) => handleDrop(e, section.id, fields)}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTarget(null);
                  }}
                  style={{ minHeight: fields.length === 0 ? 100 : undefined }}
                >
                  {fields.length === 0 ? (
                    <div
                      className={`rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
                        dropTarget?.sectionId === section.id
                          ? "border-primary bg-primary/5"
                          : "border-border/30"
                      }`}
                    >
                      <Plus className="h-5 w-5 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">
                        Dra felt hit fra biblioteket, eller klikk på et felt
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {groupFieldsIntoRows(fields).map((row, rIdx) => (
                        <div key={rIdx}>
                          {/* Drop indicator before row */}
                          <div
                            className={`transition-all rounded-full ${
                              dropTarget?.sectionId === section.id && dropTarget.index === row.startIndex && draggingFieldId !== row.fields[0]?.id
                                ? "h-1 bg-primary mx-2 mb-2"
                                : "h-0"
                            }`}
                          />
                          <div className="flex flex-wrap gap-3">
                            {row.fields.map((field: any, fIdxInRow: number) => {
                              const globalIdx = row.startIndex + fIdxInRow;
                              const isFieldSelected = selectedFieldId === field.id;
                              const fw = field.field_width || "full";

                              return (
                                <div
                                  key={field.id}
                                  data-field-index={globalIdx}
                                  className={getWidthClass(fw)}
                                  style={{ minWidth: 0 }}
                                >
                                  <div
                                    draggable
                                    onDragStart={(e) => {
                                      e.dataTransfer.setData("move-field", JSON.stringify({ fieldId: field.id, fromSectionId: section.id }));
                                      setDraggingFieldId(field.id);
                                    }}
                                    onDragEnd={() => { setDraggingFieldId(null); setDropTarget(null); }}
                                    onClick={(e) => { e.stopPropagation(); onSelectField(field.id, section.id); }}
                                    className={`relative rounded-xl p-3 cursor-grab active:cursor-grabbing transition-all group ${
                                      isFieldSelected
                                        ? "ring-2 ring-primary/30 bg-primary/[0.03] border border-primary/20"
                                        : "border border-transparent hover:border-border/60 hover:bg-muted/20"
                                    } ${!field.is_active ? "opacity-30" : ""} ${
                                      draggingFieldId === field.id ? "opacity-20 scale-95" : ""
                                    }`}
                                  >
                                    {/* Drag handle + actions overlay */}
                                    <div className={`absolute top-1 right-1 flex items-center gap-0.5 transition-opacity ${
                                      isFieldSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                                    }`}>
                                      <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40" />
                                      {fw !== "full" && (
                                        <Badge variant="outline" className="text-[8px] px-1 py-0 text-muted-foreground font-normal">
                                          {fw === "half" ? "50%" : fw === "third" ? "33%" : "66%"}
                                        </Badge>
                                      )}
                                      <button
                                        className="p-0.5 hover:bg-muted rounded"
                                        onClick={(e) => { e.stopPropagation(); onToggleFieldActive(field.id, !field.is_active); }}
                                      >
                                        {field.is_active !== false
                                          ? <Eye className="h-3 w-3 text-muted-foreground/50" />
                                          : <EyeOff className="h-3 w-3 text-muted-foreground/50" />
                                        }
                                      </button>
                                    </div>

                                    {/* WYSIWYG field rendering */}
                                    <FieldPreviewInline field={field} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}

                      {/* Drop indicator after last field */}
                      <div
                        className={`transition-all rounded-full ${
                          dropTarget?.sectionId === section.id && dropTarget.index >= fields.length
                            ? "h-1 bg-primary mx-2 mt-2"
                            : "h-0"
                        }`}
                      />

                      {/* Bottom drop zone */}
                      <div
                        className={`min-h-[24px] rounded-xl transition-colors ${
                          dropTarget?.sectionId === section.id && dropTarget.index >= fields.length
                            ? "border-2 border-dashed border-primary/20 bg-primary/[0.02]"
                            : ""
                        }`}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        <Button variant="outline" size="sm" className="w-full text-xs h-10 rounded-xl border-dashed border-2 border-border/40 text-muted-foreground hover:border-primary/30 hover:text-primary" onClick={onAddSection}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Legg til seksjon
        </Button>
      </div>
    </div>
  );
}
