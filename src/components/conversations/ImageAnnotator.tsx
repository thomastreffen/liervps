import { useState, useRef, useEffect, useCallback } from "react";
import { AnnotationToolbar, type AnnotationTool } from "./AnnotationToolbar";
import { ObjectLinkPanel } from "./ObjectLinkPanel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Save, X, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AnnotationShape {
  id: string;
  tool: AnnotationTool;
  color: string;
  points: { x: number; y: number }[];
  text?: string;
  linked_object_type?: string;
  linked_object_id?: string;
  linked_object_label?: string;
}

interface ImageAnnotatorProps {
  imageUrl: string;
  postId: string;
  fileId?: string;
  projectId: string;
  companyId: string;
  onSave: (annotatedUrl: string, annotations: AnnotationShape[], docType: string, objectLabel?: string, objectType?: string) => void;
  onClose: () => void;
}

const DOC_TYPES = [
  { id: "deviation", label: "Avvik" },
  { id: "fdv", label: "FDV" },
  { id: "control", label: "Kontroll" },
  { id: "before", label: "Før" },
  { id: "after", label: "Etter" },
];

export function ImageAnnotator({
  imageUrl, postId, fileId, projectId, companyId, onSave, onClose,
}: ImageAnnotatorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<AnnotationTool>("arrow");
  const [color, setColor] = useState("#ef4444");
  const [shapes, setShapes] = useState<AnnotationShape[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<{ x: number; y: number }[]>([]);
  const [docType, setDocType] = useState<string>("deviation");
  const [showObjectLink, setShowObjectLink] = useState(false);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [textInput, setTextInput] = useState("");
  const [textPos, setTextPos] = useState<{ x: number; y: number } | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      setImgLoaded(true);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // Draw canvas
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Fit to container
    const container = containerRef.current;
    if (!container) return;
    const maxW = container.clientWidth;
    const maxH = container.clientHeight - 120; // toolbar space
    const scale = Math.min(maxW / img.width, maxH / img.height, 1);
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Draw all shapes
    const allShapes = [...shapes];
    if (drawing && currentPoints.length > 0) {
      allShapes.push({ id: "temp", tool, color, points: currentPoints });
    }

    for (const shape of allShapes) {
      if (shape.tool === "eraser") continue;
      ctx.strokeStyle = shape.color;
      ctx.fillStyle = shape.color;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (shape.tool === "freehand" && shape.points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(shape.points[0].x, shape.points[0].y);
        for (let i = 1; i < shape.points.length; i++) {
          ctx.lineTo(shape.points[i].x, shape.points[i].y);
        }
        ctx.stroke();
      } else if (shape.tool === "arrow" && shape.points.length === 2) {
        const [start, end] = shape.points;
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        // Arrowhead
        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        const headLen = 15;
        ctx.beginPath();
        ctx.moveTo(end.x, end.y);
        ctx.lineTo(end.x - headLen * Math.cos(angle - Math.PI / 6), end.y - headLen * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(end.x, end.y);
        ctx.lineTo(end.x - headLen * Math.cos(angle + Math.PI / 6), end.y - headLen * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
      } else if (shape.tool === "circle" && shape.points.length === 2) {
        const [c, edge] = shape.points;
        const radius = Math.sqrt((edge.x - c.x) ** 2 + (edge.y - c.y) ** 2);
        ctx.beginPath();
        ctx.arc(c.x, c.y, radius, 0, Math.PI * 2);
        ctx.stroke();
      } else if (shape.tool === "text" && shape.text && shape.points.length > 0) {
        ctx.font = "bold 16px sans-serif";
        ctx.fillText(shape.text, shape.points[0].x, shape.points[0].y);
      }
    }
  }, [shapes, drawing, currentPoints, tool, color, imgLoaded]);

  useEffect(() => { redraw(); }, [redraw]);

  const getCanvasPos = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0]?.clientX ?? 0 : e.clientX;
    const clientY = "touches" in e ? e.touches[0]?.clientY ?? 0 : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (tool === "text") {
      setTextPos(getCanvasPos(e));
      return;
    }
    if (tool === "eraser") {
      // Find shape near click and remove it
      const pos = getCanvasPos(e);
      setShapes(prev => prev.filter(s => {
        return !s.points.some(p => Math.abs(p.x - pos.x) < 20 && Math.abs(p.y - pos.y) < 20);
      }));
      return;
    }
    setDrawing(true);
    setCurrentPoints([getCanvasPos(e)]);
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing) return;
    const pos = getCanvasPos(e);
    if (tool === "freehand") {
      setCurrentPoints(prev => [...prev, pos]);
    } else {
      setCurrentPoints(prev => [prev[0], pos]);
    }
  };

  const handlePointerUp = () => {
    if (!drawing || currentPoints.length === 0) return;
    setDrawing(false);
    const newShape: AnnotationShape = {
      id: crypto.randomUUID(),
      tool,
      color,
      points: [...currentPoints],
    };
    setShapes(prev => [...prev, newShape]);
    setCurrentPoints([]);
    // Show object link panel for new shape
    setSelectedShapeId(newShape.id);
    setShowObjectLink(true);
  };

  const handleTextSubmit = () => {
    if (!textInput.trim() || !textPos) return;
    const newShape: AnnotationShape = {
      id: crypto.randomUUID(),
      tool: "text",
      color,
      points: [textPos],
      text: textInput,
    };
    setShapes(prev => [...prev, newShape]);
    setTextInput("");
    setTextPos(null);
    setSelectedShapeId(newShape.id);
    setShowObjectLink(true);
  };

  const handleUndo = () => {
    setShapes(prev => prev.slice(0, -1));
  };

  const handleObjectLink = (objectType: string, objectLabel: string, objectId?: string) => {
    if (!selectedShapeId) return;
    setShapes(prev => prev.map(s =>
      s.id === selectedShapeId
        ? { ...s, linked_object_type: objectType, linked_object_label: objectLabel, linked_object_id: objectId }
        : s
    ));
    setShowObjectLink(false);
    setSelectedShapeId(null);
  };

  const handleSave = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSaving(true);

    try {
      // Export canvas as blob
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Kunne ikke eksportere bilde");

      // Upload annotated image
      const path = `${companyId}/${projectId}/annotations/${Date.now()}_annotated.png`;
      const { error: uploadErr } = await supabase.storage
        .from("conversation-files")
        .upload(path, blob, { contentType: "image/png" });
      if (uploadErr) throw uploadErr;

      // Get primary linked object from first annotated shape
      const linkedShape = shapes.find(s => s.linked_object_label);
      const objectLabel = linkedShape?.linked_object_label;
      const objectType = linkedShape?.linked_object_type;

      // Save annotation record
      const { error: dbErr } = await (supabase as any)
        .from("media_annotations")
        .insert({
          post_id: postId,
          file_id: fileId || null,
          annotated_file_id: path,
          annotation_json: { shapes, version: 1 },
          linked_object_type: objectType || null,
          linked_object_ref: linkedShape?.linked_object_id || null,
          linked_object_label: objectLabel || null,
          doc_type: docType,
        });
      if (dbErr) throw dbErr;

      const { data: signedData } = await supabase.storage
        .from("conversation-files")
        .createSignedUrl(path, 3600);

      onSave(signedData?.signedUrl || imageUrl, shapes, docType, objectLabel, objectType);
      toast.success("Annotering lagret");
    } catch (err: any) {
      toast.error(err.message || "Kunne ikke lagre annotering");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div ref={containerRef} className="fixed inset-0 z-[100] bg-black/95 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 border-b border-white/10">
        <div className="flex items-center gap-2">
          <h3 className="text-white text-sm font-medium">Annoter bilde</h3>
          <div className="flex gap-1 ml-3">
            {DOC_TYPES.map(dt => (
              <button
                key={dt.id}
                onClick={() => setDocType(dt.id)}
                className={cn(
                  "text-[10px] px-2 py-1 rounded-full transition-colors cursor-pointer",
                  docType === dt.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-white/10 text-white/60 hover:bg-white/20 hover:text-white"
                )}
              >
                {dt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            className="text-white/70 hover:text-white hover:bg-white/10 h-8 gap-1"
          >
            <X className="h-3.5 w-3.5" />
            Avbryt
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="h-8 gap-1"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? "Lagrer..." : "Lagre"}
          </Button>
        </div>
      </div>

      {/* Canvas area */}
      <div className="flex-1 flex items-center justify-center overflow-hidden p-4">
        <canvas
          ref={canvasRef}
          className="cursor-crosshair touch-none max-w-full max-h-full"
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
        />
      </div>

      {/* Text input popup */}
      {textPos && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card rounded-xl shadow-xl p-4 z-10 min-w-[250px]">
          <p className="text-xs font-medium mb-2 text-foreground">Skriv annotasjonstekst</p>
          <input
            autoFocus
            value={textInput}
            onChange={e => setTextInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleTextSubmit()}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground"
            placeholder="F.eks. Mangler jordforbindelse"
          />
          <div className="flex gap-2 mt-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => { setTextPos(null); setTextInput(""); }}>Avbryt</Button>
            <Button size="sm" onClick={handleTextSubmit}>Legg til</Button>
          </div>
        </div>
      )}

      {/* Object link panel */}
      {showObjectLink && (
        <ObjectLinkPanel
          projectId={projectId}
          onLink={handleObjectLink}
          onSkip={() => { setShowObjectLink(false); setSelectedShapeId(null); }}
        />
      )}

      {/* Toolbar at bottom */}
      <div className="flex justify-center pb-4 pt-2">
        <AnnotationToolbar
          activeTool={tool}
          onToolChange={setTool}
          onUndo={handleUndo}
          canUndo={shapes.length > 0}
          activeColor={color}
          onColorChange={setColor}
        />
      </div>
    </div>
  );
}
