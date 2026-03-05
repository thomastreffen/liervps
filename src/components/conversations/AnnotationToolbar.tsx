import { cn } from "@/lib/utils";
import {
  ArrowUpRight, Circle, Pencil, Type, Eraser, Undo2,
} from "lucide-react";

export type AnnotationTool = "arrow" | "circle" | "freehand" | "text" | "eraser";

interface AnnotationToolbarProps {
  activeTool: AnnotationTool;
  onToolChange: (tool: AnnotationTool) => void;
  onUndo: () => void;
  canUndo: boolean;
  activeColor: string;
  onColorChange: (color: string) => void;
}

const TOOLS: { id: AnnotationTool; icon: typeof ArrowUpRight; label: string }[] = [
  { id: "arrow", icon: ArrowUpRight, label: "Pil" },
  { id: "circle", icon: Circle, label: "Sirkel" },
  { id: "freehand", icon: Pencil, label: "Frihånd" },
  { id: "text", icon: Type, label: "Tekst" },
  { id: "eraser", icon: Eraser, label: "Viskelær" },
];

const COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#ffffff"];

export function AnnotationToolbar({
  activeTool, onToolChange, onUndo, canUndo, activeColor, onColorChange,
}: AnnotationToolbarProps) {
  return (
    <div className="flex items-center gap-1 bg-black/70 backdrop-blur-sm rounded-xl px-2 py-1.5">
      {TOOLS.map(t => {
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            onClick={() => onToolChange(t.id)}
            title={t.label}
            className={cn(
              "h-9 w-9 rounded-lg flex items-center justify-center transition-colors cursor-pointer",
              activeTool === t.id
                ? "bg-white/20 text-white"
                : "text-white/60 hover:text-white hover:bg-white/10"
            )}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}

      <div className="w-px h-6 bg-white/20 mx-1" />

      {COLORS.map(c => (
        <button
          key={c}
          onClick={() => onColorChange(c)}
          className={cn(
            "h-6 w-6 rounded-full border-2 transition-transform cursor-pointer",
            activeColor === c ? "border-white scale-110" : "border-transparent hover:scale-105"
          )}
          style={{ backgroundColor: c }}
        />
      ))}

      <div className="w-px h-6 bg-white/20 mx-1" />

      <button
        onClick={onUndo}
        disabled={!canUndo}
        title="Angre"
        className={cn(
          "h-9 w-9 rounded-lg flex items-center justify-center transition-colors cursor-pointer",
          canUndo ? "text-white/60 hover:text-white hover:bg-white/10" : "text-white/20 cursor-not-allowed"
        )}
      >
        <Undo2 className="h-4 w-4" />
      </button>
    </div>
  );
}
