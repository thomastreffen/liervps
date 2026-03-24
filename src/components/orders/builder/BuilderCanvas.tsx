import { useState, useRef, useEffect } from "react";
import {
  GripVertical, Plus, ChevronDown, ChevronRight, Eye, EyeOff,
  Columns2, Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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

const WIDTH_LABELS: Record<string, string> = {
  full: "100%",
  half: "50%",
  third: "33%",
  two_thirds: "66%",
};

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

  // Keep new sections expanded
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

  // Auto-scroll when dragging near edges
  const handleAutoScroll = (clientY: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const edgeSize = 60;
    if (clientY - rect.top < edgeSize) {
      el.scrollTop -= 8;
    } else if (rect.bottom - clientY < edgeSize) {
      el.scrollTop += 8;
    }
  };

  const computeDropIndex = (e: React.DragEvent, fields: any[]): number => {
    const container = e.currentTarget as HTMLElement;
    const fieldEls = container.querySelectorAll('[data-field-index]');
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

  // Group fields into visual rows based on field_width
  const groupFieldsIntoRows = (fields: any[]) => {
    const rows: any[][] = [];
    let currentRow: any[] = [];
    let currentRowWidth = 0;

    for (const field of fields) {
      const w = field.field_width || "full";
      const fraction = w === "half" ? 0.5 : w === "third" ? 0.33 : w === "two_thirds" ? 0.66 : 1;

      if (currentRowWidth + fraction > 1.01 && currentRow.length > 0) {
        rows.push(currentRow);
        currentRow = [];
        currentRowWidth = 0;
      }
      currentRow.push(field);
      currentRowWidth += fraction;

      if (currentRowWidth >= 0.99) {
        rows.push(currentRow);
        currentRow = [];
        currentRowWidth = 0;
      }
    }
    if (currentRow.length > 0) rows.push(currentRow);
    return rows;
  };

  const getWidthClass = (w: string) => {
    switch (w) {
      case "half": return "w-1/2";
      case "third": return "w-1/3";
      case "two_thirds": return "w-2/3";
      default: return "w-full";
    }
  };

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto">
      <div className="p-4 border-b border-border bg-muted/20">
        <h2 className="text-base font-bold text-foreground">{templateTitle || "Nytt skjema"}</h2>
        <p className="text-[10px] text-muted-foreground mt-0.5">{sections.length} seksjoner</p>
      </div>

      <div className="p-4 space-y-3">
        {sections.map((section, sIdx) => {
          const isExpanded = expandedSections.has(section.id);
          const isSelected = selectedSectionId === section.id && !selectedFieldId;
          const fields = section.fields || [];

          return (
            <div
              key={section.id}
              className={`rounded-xl border transition-all ${
                isSelected ? "border-primary ring-1 ring-primary/20" : "border-border"
              } ${!section.is_active ? "opacity-50" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                onSelectSection(section.id);
              }}
            >
              {/* Section header */}
              <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/30 rounded-t-xl">
                <button
                  onClick={(e) => { e.stopPropagation(); toggleExpand(section.id); }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </button>
                <span className="text-sm font-semibold flex-1 truncate">{section.title}</span>
                <Badge variant="outline" className="text-[9px]">{fields.length} felt</Badge>
                <Switch
                  checked={section.is_active !== false}
                  onCheckedChange={(v) => { onToggleSectionActive(section.id, v); }}
                  className="scale-75"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              {/* Fields area */}
              {isExpanded && (
                <div
                  className={`px-3 py-2 transition-colors ${
                    dropTarget?.sectionId === section.id ? "bg-primary/[0.03]" : ""
                  }`}
                  onDragOver={(e) => handleSectionDragOver(e, section.id, fields)}
                  onDrop={(e) => handleDrop(e, section.id, fields)}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      setDropTarget(null);
                    }
                  }}
                  style={{ minHeight: fields.length === 0 ? 80 : undefined }}
                >
                  {fields.length === 0 ? (
                    <div
                      className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                        dropTarget?.sectionId === section.id
                          ? "border-primary bg-primary/5"
                          : "border-border/50"
                      }`}
                    >
                      <p className="text-xs text-muted-foreground">
                        Dra felt hit fra biblioteket, eller klikk på et felt
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-0">
                      {fields.map((field: any, fIdx: number) => {
                        const Icon = FIELD_ICONS[field.field_type as OrderFormFieldType] || GripVertical;
                        const isFieldSelected = selectedFieldId === field.id;
                        const showDropBefore = dropTarget?.sectionId === section.id && dropTarget.index === fIdx && draggingFieldId !== field.id;
                        const fw = field.field_width || "full";
                        const widthBadge = fw !== "full" ? WIDTH_LABELS[fw] : null;

                        return (
                          <div key={field.id} data-field-index={fIdx}>
                            {/* Drop indicator */}
                            <div
                              className={`transition-all rounded-full ${
                                showDropBefore ? "h-1.5 bg-primary mx-1 my-1.5" : "h-0"
                              }`}
                            />
                            <div
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData("move-field", JSON.stringify({ fieldId: field.id, fromSectionId: section.id }));
                                setDraggingFieldId(field.id);
                              }}
                              onDragEnd={() => { setDraggingFieldId(null); setDropTarget(null); }}
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectField(field.id, section.id);
                              }}
                              className={`flex items-center gap-2 px-2.5 py-2.5 rounded-lg text-sm cursor-grab active:cursor-grabbing transition-all ${
                                isFieldSelected
                                  ? "bg-primary/5 border border-primary/30 ring-1 ring-primary/10"
                                  : "border border-transparent hover:bg-muted/40"
                              } ${!field.is_active ? "opacity-40" : ""} ${
                                draggingFieldId === field.id ? "opacity-30" : ""
                              }`}
                            >
                              <GripVertical className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                              <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="flex-1 font-medium truncate text-xs">{field.label}</span>
                              {widthBadge && (
                                <Badge variant="outline" className="text-[8px] px-1 py-0 shrink-0 text-muted-foreground">
                                  {widthBadge}
                                </Badge>
                              )}
                              {field.is_required && (
                                <span className="text-destructive text-[10px] font-bold">*</span>
                              )}
                              <button
                                className="text-[10px] text-muted-foreground hover:text-foreground px-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToggleFieldRequired(field.id, !field.is_required);
                                }}
                              >
                                {field.is_required ? "Påkrevd" : "Valgfritt"}
                              </button>
                              <button
                                className="p-0.5 hover:bg-muted rounded"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToggleFieldActive(field.id, !field.is_active);
                                }}
                              >
                                {field.is_active !== false ? (
                                  <Eye className="h-3 w-3 text-muted-foreground" />
                                ) : (
                                  <EyeOff className="h-3 w-3 text-muted-foreground" />
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      {/* Drop indicator after last field */}
                      <div
                        className={`transition-all rounded-full ${
                          dropTarget?.sectionId === section.id && dropTarget.index === fields.length && draggingFieldId !== fields[fields.length - 1]?.id
                            ? "h-1.5 bg-primary mx-1 my-1.5"
                            : "h-0"
                        }`}
                      />

                      {/* Bottom drop zone */}
                      <div
                        className={`min-h-[32px] rounded-lg transition-colors ${
                          dropTarget?.sectionId === section.id && dropTarget.index === fields.length
                            ? "border-2 border-dashed border-primary/30 bg-primary/[0.03]"
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

        <Button variant="outline" size="sm" className="w-full text-xs" onClick={onAddSection}>
          <Plus className="h-3 w-3 mr-1" />
          Legg til seksjon
        </Button>
      </div>
    </div>
  );
}
