import { useState } from "react";
import { X, GripVertical, FolderKanban, Clock, ListChecks, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

type ModuleKey = "projects" | "yourday" | "tasks" | "activity";

const ALL_MODULES: { key: ModuleKey; label: string; icon: React.ReactNode; description: string }[] = [
  { key: "projects", label: "Prosjekter", icon: <FolderKanban className="h-4 w-4" />, description: "Aktive prosjekter med statusinformasjon" },
  { key: "yourday", label: "Din dag", icon: <Clock className="h-4 w-4" />, description: "Dagens planlagte jobber" },
  { key: "tasks", label: "Mine oppgaver", icon: <ListChecks className="h-4 w-4" />, description: "Åpne oppgaver sortert etter frist" },
  { key: "activity", label: "Aktivitet", icon: <Activity className="h-4 w-4" />, description: "Siste hendelser i systemet" },
];

interface Props {
  enabledModules: ModuleKey[];
  onSave: (modules: ModuleKey[]) => void;
  onClose: () => void;
}

export function DashboardModuleManager({ enabledModules, onSave, onClose }: Props) {
  const [selected, setSelected] = useState<Set<ModuleKey>>(new Set(enabledModules));

  const toggle = (key: ModuleKey) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-card rounded-2xl border-2 border-border shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-bold text-foreground">Tilpass dashboard</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 space-y-2">
          {ALL_MODULES.map((mod) => (
            <div
              key={mod.key}
              className="flex items-center gap-3 rounded-xl border border-border/50 px-4 py-3 hover:bg-muted/30 transition-colors"
            >
              <div className="text-muted-foreground">{mod.icon}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{mod.label}</p>
                <p className="text-[11px] text-muted-foreground">{mod.description}</p>
              </div>
              <Switch
                checked={selected.has(mod.key)}
                onCheckedChange={() => toggle(mod.key)}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
          <Button variant="ghost" size="sm" onClick={onClose}>Avbryt</Button>
          <Button size="sm" onClick={() => onSave(Array.from(selected))}>Lagre</Button>
        </div>
      </div>
    </div>
  );
}
