import { Badge } from "@/components/ui/badge";
import { Plus, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import type { ContactTag } from "@/hooks/useContactTags";

const TAG_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#06b6d4",
];

interface Props {
  assignedTags: ContactTag[];
  allTags: ContactTag[];
  onAdd: (tagId: string) => void;
  onRemove: (tagId: string) => void;
  onCreate: (name: string, color: string) => void;
  editable?: boolean;
}

export function ContactTagBadges({ assignedTags, allTags, onAdd, onRemove, onCreate, editable = true }: Props) {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(TAG_COLORS[0]);

  const unassigned = allTags.filter((t) => !assignedTags.some((a) => a.id === t.id));

  const handleCreate = () => {
    if (!newName.trim()) return;
    onCreate(newName.trim(), newColor);
    setNewName("");
  };

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {assignedTags.map((tag) => (
        <Badge
          key={tag.id}
          className="text-[10px] rounded-lg gap-1 pl-2 pr-1"
          style={{ backgroundColor: tag.color + "20", color: tag.color, borderColor: tag.color + "40" }}
        >
          {tag.name}
          {editable && (
            <button onClick={() => onRemove(tag.id)} className="hover:opacity-70">
              <X className="h-3 w-3" />
            </button>
          )}
        </Badge>
      ))}
      {editable && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded-md border border-dashed border-border hover:border-foreground/30">
              <Plus className="h-3 w-3" /> Tag
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2 space-y-2" align="start">
            {unassigned.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">Eksisterende</p>
                {unassigned.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => { onAdd(tag.id); setOpen(false); }}
                    className="flex items-center gap-2 w-full px-2 py-1 rounded-md text-xs hover:bg-secondary transition-colors"
                  >
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                    {tag.name}
                  </button>
                ))}
              </div>
            )}
            <div className="border-t border-border pt-2 space-y-1.5">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">Ny tag</p>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Tagnavn..."
                className="h-7 text-xs"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
              <div className="flex items-center gap-1">
                {TAG_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    className="h-5 w-5 rounded-full border-2 transition-transform hover:scale-110"
                    style={{ backgroundColor: c, borderColor: newColor === c ? "hsl(var(--foreground))" : "transparent" }}
                  />
                ))}
              </div>
              <Button size="sm" className="w-full h-7 text-xs rounded-lg" onClick={handleCreate} disabled={!newName.trim()}>
                Opprett
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
