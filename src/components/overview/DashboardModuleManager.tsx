import { useState, useCallback } from "react";
import {
  X, GripVertical, FolderKanban, Clock, ListChecks, Activity, ShieldAlert,
  Columns2, LayoutGrid,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ModuleConfig, ModuleKey } from "@/hooks/useDashboardConfig";

const MODULE_META: Record<ModuleKey, { label: string; icon: React.ReactNode; description: string }> = {
  projects: { label: "Prosjekter", icon: <FolderKanban className="h-4 w-4" />, description: "Aktive prosjekter med statusinformasjon" },
  yourday: { label: "Din dag", icon: <Clock className="h-4 w-4" />, description: "Dagens planlagte jobber" },
  tasks: { label: "Mine oppgaver", icon: <ListChecks className="h-4 w-4" />, description: "Åpne oppgaver sortert etter frist" },
  activity: { label: "Aktivitet", icon: <Activity className="h-4 w-4" />, description: "Siste hendelser i systemet" },
  risk: { label: "Risiko", icon: <ShieldAlert className="h-4 w-4" />, description: "Varsler om uplanlagt, overbooking, avvik" },
};

interface Props {
  modules: ModuleConfig[];
  onSave: (modules: ModuleConfig[]) => void;
  onClose: () => void;
}

export function DashboardModuleManager({ modules: initialModules, onSave, onClose }: Props) {
  const [items, setItems] = useState<ModuleConfig[]>(() => {
    // Ensure all module keys exist
    const keys = Object.keys(MODULE_META) as ModuleKey[];
    const existing = [...initialModules];
    keys.forEach((k) => {
      if (!existing.some((m) => m.module_key === k)) {
        existing.push({
          module_key: k,
          enabled: false,
          sort_order: existing.length,
          column_placement: "full",
          density: "normal",
          filter_config: {},
        });
      }
    });
    return existing.sort((a, b) => a.sort_order - b.sort_order);
  });

  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const toggle = (key: ModuleKey) => {
    setItems((prev) =>
      prev.map((m) => (m.module_key === key ? { ...m, enabled: !m.enabled } : m))
    );
  };

  const setColumn = (key: ModuleKey, col: "left" | "right" | "full") => {
    setItems((prev) =>
      prev.map((m) => (m.module_key === key ? { ...m, column_placement: col } : m))
    );
  };

  const setDensity = (key: ModuleKey, d: "compact" | "normal" | "expanded") => {
    setItems((prev) =>
      prev.map((m) => (m.module_key === key ? { ...m, density: d } : m))
    );
  };

  const handleDragStart = (idx: number) => setDragIdx(idx);

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    const newItems = [...items];
    const [moved] = newItems.splice(dragIdx, 1);
    newItems.splice(idx, 0, moved);
    setDragIdx(idx);
    setItems(newItems.map((m, i) => ({ ...m, sort_order: i })));
  };

  const handleSave = () => {
    onSave(items.map((m, i) => ({ ...m, sort_order: i })));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-card rounded-2xl border-2 border-border shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-bold text-foreground">Tilpass dashboard</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Dra for å endre rekkefølge · Velg kolonneplassering</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Module list */}
        <div className="p-4 space-y-2 overflow-y-auto flex-1">
          {items.map((mod, idx) => {
            const meta = MODULE_META[mod.module_key];
            if (!meta) return null;
            return (
              <div
                key={mod.module_key}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragEnd={() => setDragIdx(null)}
                className={`rounded-xl border px-4 py-3 transition-all ${
                  dragIdx === idx
                    ? "border-primary bg-primary/5 shadow-md"
                    : "border-border/50 hover:bg-muted/30"
                } ${!mod.enabled ? "opacity-50" : ""}`}
              >
                <div className="flex items-center gap-3">
                  <GripVertical className="h-4 w-4 text-muted-foreground/30 cursor-grab shrink-0" />
                  <div className="text-muted-foreground shrink-0">{meta.icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{meta.label}</p>
                    <p className="text-[11px] text-muted-foreground">{meta.description}</p>
                  </div>
                  <Switch checked={mod.enabled} onCheckedChange={() => toggle(mod.module_key)} />
                </div>

                {/* Column + density selectors (only when enabled) */}
                {mod.enabled && (
                  <div className="flex items-center gap-3 mt-3 ml-11">
                    <div className="flex items-center gap-1.5">
                      <Columns2 className="h-3 w-3 text-muted-foreground/50" />
                      <Select
                        value={mod.column_placement}
                        onValueChange={(v) => setColumn(mod.module_key, v as any)}
                      >
                        <SelectTrigger className="h-7 text-[11px] w-[90px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="full">Full bredde</SelectItem>
                          <SelectItem value="left">Venstre</SelectItem>
                          <SelectItem value="right">Høyre</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <LayoutGrid className="h-3 w-3 text-muted-foreground/50" />
                      <Select
                        value={mod.density}
                        onValueChange={(v) => setDensity(mod.module_key, v as any)}
                      >
                        <SelectTrigger className="h-7 text-[11px] w-[80px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="compact">Kompakt</SelectItem>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="expanded">Utvidet</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border shrink-0">
          <Button variant="ghost" size="sm" onClick={onClose}>Avbryt</Button>
          <Button size="sm" onClick={handleSave}>Lagre oppsett</Button>
        </div>
      </div>
    </div>
  );
}
