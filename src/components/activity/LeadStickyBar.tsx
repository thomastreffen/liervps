import {
  CalendarPlus, CheckCircle2, Mail, StickyNote, Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ActionPanelTab } from "./LeadActionPanel";

interface LeadStickyBarProps {
  onAction: (tab: ActionPanelTab) => void;
}

export function LeadStickyBar({ onAction }: LeadStickyBarProps) {
  const actions: { tab: ActionPanelTab; label: string; icon: React.ReactNode }[] = [
    { tab: "note", label: "Aktivitet", icon: <StickyNote className="h-3.5 w-3.5" /> },
    { tab: "meeting", label: "Møte", icon: <CalendarPlus className="h-3.5 w-3.5" /> },
    { tab: "task", label: "Oppgave", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
    { tab: "email", label: "E-post", icon: <Mail className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-lg border-b border-border/30 px-4 py-2">
      <div className="mx-auto max-w-5xl flex items-center gap-2">
        {actions.map(a => (
          <Button
            key={a.tab}
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs h-8 rounded-xl"
            onClick={() => onAction(a.tab)}
          >
            {a.icon}
            {a.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
