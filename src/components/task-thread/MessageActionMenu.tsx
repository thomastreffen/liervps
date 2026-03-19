import { MoreHorizontal, AlertTriangle, PlusCircle, Clipboard, FileText } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TaskMessage } from "@/hooks/useTaskThread";
import type { WorkPackageType } from "@/lib/work-package-types";

export type ActionType = "deviation" | "additional_work" | "internal_task" | "offer";

interface Props {
  message: TaskMessage;
  onCreateAction: (type: ActionType, message: TaskMessage) => void;
}

const ACTION_OPTIONS: { type: ActionType; label: string; icon: typeof AlertTriangle; className: string }[] = [
  { type: "additional_work", label: "Tillegg", icon: PlusCircle, className: "text-warning" },
  { type: "deviation", label: "Avvik", icon: AlertTriangle, className: "text-destructive" },
  { type: "internal_task", label: "Oppgave", icon: Clipboard, className: "text-muted-foreground" },
  { type: "offer", label: "Tilbud", icon: FileText, className: "text-info" },
];

export function MessageActionMenu({ message, onCreateAction }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="inline-flex items-center justify-center h-6 w-6 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel className="text-[10px] text-muted-foreground font-normal">Opprett fra melding</DropdownMenuLabel>
        {ACTION_OPTIONS.map(opt => {
          const Icon = opt.icon;
          return (
            <DropdownMenuItem
              key={opt.type}
              onClick={() => onCreateAction(opt.type, message)}
              className="gap-2 text-xs"
            >
              <Icon className={`h-3.5 w-3.5 ${opt.className}`} />
              {opt.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
