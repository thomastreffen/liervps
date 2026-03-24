import { useState } from "react";
import {
  GripVertical, Plus, ChevronDown, ChevronRight, Eye, EyeOff, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ORDER_FIELD_TYPE_LABELS, type OrderFormFieldType } from "@/types/order-forms";
import { FIELD_ICONS } from "./OrderFieldPalette";

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
  onDropNewField: (type: OrderFormFieldType, sectionId: string, index: number) => void;
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
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);
  const [draggingFieldId, setDraggingFieldId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleDragOver = (e: React.DragEvent, target: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = e.dataTransfer.types.includes("order-field-type") ? "copy" : "move";
    setDragOverTarget(target);
  };

  const handleDrop = (e: React.DragEvent, sectionId: string, fieldIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTarget(null);

    const newType = e.dataTransfer.getData("order-field-type") as OrderFormFieldType;
    if (newType) {
      onDropNewField(newType, sectionId, fieldIndex);
      return;
    }

    const moveData = e.dataTransfer.getData("move-field");
    if (moveData) {
      const { fieldId, fromSectionId } = JSON.parse(moveData);
      onMoveField(fieldId, fromSectionId, sectionId, fieldIndex);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
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

              {/* Fields */}
              {isExpanded && (
                <div
                  className="px-3 py-2 space-y-1"
                  onDragOver={(e) => handleDragOver(e, `section-${section.id}`)}
                  onDrop={(e) => handleDrop(e, section.id, fields.length)}
                  onDragLeave={() => setDragOverTarget(null)}
                >
                  {fields.length === 0 ? (
                    <div
                      className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
                        dragOverTarget === `section-${section.id}` ? "border-primary bg-primary/5" : "border-border/50"
                      }`}
                    >
                      <p className="text-[11px] text-muted-foreground">
                        Dra felt hit eller klikk i feltbiblioteket
                      </p>
                    </div>
                  ) : (
                    fields.map((field: any, fIdx: number) => {
                      const Icon = FIELD_ICONS[field.field_type as OrderFormFieldType] || GripVertical;
                      const isFieldSelected = selectedFieldId === field.id;
                      const dropTarget = `field-${field.id}`;

                      return (
                        <div key={field.id}>
                          {dragOverTarget === dropTarget && draggingFieldId !== field.id && (
                            <div className="h-0.5 bg-primary rounded-full mx-2 my-0.5" />
                          )}
                          <div
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData("move-field", JSON.stringify({ fieldId: field.id, fromSectionId: section.id }));
                              setDraggingFieldId(field.id);
                            }}
                            onDragEnd={() => setDraggingFieldId(null)}
                            onDragOver={(e) => handleDragOver(e, dropTarget)}
                            onDrop={(e) => handleDrop(e, section.id, fIdx)}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectField(field.id, section.id);
                            }}
                            className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm cursor-grab active:cursor-grabbing transition-all ${
                              isFieldSelected
                                ? "bg-primary/5 border border-primary/30 ring-1 ring-primary/10"
                                : "border border-transparent hover:bg-muted/40"
                            } ${!field.is_active ? "opacity-40" : ""}`}
                          >
                            <GripVertical className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                            <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="flex-1 font-medium truncate text-xs">{field.label}</span>
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
                    })
                  )}

                  {/* Bottom drop zone */}
                  {dragOverTarget === `section-${section.id}` && fields.length > 0 && (
                    <div className="h-0.5 bg-primary rounded-full mx-2" />
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
