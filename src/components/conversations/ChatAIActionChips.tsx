import { Sparkles, X, ListTodo, AlertTriangle, FileText, Phone, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { type SuggestedMessageAction } from "@/hooks/useAIMessageActions";

const ACTION_CONFIG: Record<string, { icon: typeof ListTodo; label: string; color: string }> = {
  task: { icon: ListTodo, label: "Opprett oppgave", color: "violet" },
  deviation: { icon: AlertTriangle, label: "Registrer avvik", color: "amber" },
  fdv_note: { icon: FileText, label: "Lag FDV-notat", color: "blue" },
  call_customer: { icon: Phone, label: "Ring kunde", color: "emerald" },
  order_parts: { icon: Package, label: "Bestill deler", color: "orange" },
};

interface ChatAIActionChipsProps {
  actions: SuggestedMessageAction[];
  dismissed: boolean;
  isOwn: boolean;
  onClickAction: (action: SuggestedMessageAction) => void;
  onDismiss: () => void;
}

export function ChatAIActionChips({ actions, dismissed, isOwn, onClickAction, onDismiss }: ChatAIActionChipsProps) {
  if (dismissed || actions.length === 0) return null;

  return (
    <div className={cn("flex flex-col gap-1 mt-1", isOwn ? "items-end" : "items-start")}>
      <div className="flex items-center gap-1">
        <Sparkles className="h-2.5 w-2.5 text-violet-500" />
        <span className="text-[9px] font-medium text-violet-600 dark:text-violet-400">AI-forslag</span>
        <button
          onClick={onDismiss}
          className="text-muted-foreground/50 hover:text-muted-foreground ml-1 cursor-pointer"
          title="Skjul forslag"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      </div>
      <div className="flex flex-wrap gap-1">
        {actions.slice(0, 4).map((action, i) => {
          const config = ACTION_CONFIG[action.action_type] || ACTION_CONFIG.task;
          const Icon = config.icon;
          return (
            <button
              key={i}
              onClick={() => onClickAction(action)}
              className={cn(
                "inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full border transition-colors cursor-pointer",
                "border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/20",
                "text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-950/40"
              )}
              title={action.reasons.join(", ")}
            >
              <Icon className="h-3 w-3" />
              {config.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
