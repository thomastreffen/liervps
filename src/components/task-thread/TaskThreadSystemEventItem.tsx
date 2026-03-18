import { format } from "date-fns";
import { nb } from "date-fns/locale";
import {
  Clock, UserPlus, Paperclip, CheckCircle2, AlertTriangle,
  CalendarPlus, ArrowRightLeft, Info,
} from "lucide-react";
import type { TaskMessage } from "@/hooks/useTaskThread";

interface Props {
  message: TaskMessage;
}

const EVENT_ICONS: Record<string, typeof Info> = {
  task_created: CalendarPlus,
  time_changed: Clock,
  technician_changed: UserPlus,
  attachment_uploaded: Paperclip,
  message_sent: Info,
  task_completed: CheckCircle2,
  task_moved: ArrowRightLeft,
  deviation_created: AlertTriangle,
};

const EVENT_LABELS: Record<string, string> = {
  task_created: "Oppgave opprettet",
  time_changed: "Tidspunkt endret",
  technician_changed: "Montør endret",
  attachment_uploaded: "Vedlegg lastet opp",
  message_sent: "Melding sendt",
  task_completed: "Oppgave ferdigstilt",
  task_moved: "Oppgave flyttet",
  deviation_created: "Avvik opprettet",
};

export function TaskThreadSystemEventItem({ message }: Props) {
  const eventType = (message.metadata as any)?.event_type || "unknown";
  const Icon = EVENT_ICONS[eventType] || Info;
  const label = EVENT_LABELS[eventType] || eventType;
  const time = format(new Date(message.created_at), "d. MMM HH:mm", { locale: nb });
  const details = (message.metadata as any)?.details;

  return (
    <div className="flex items-center gap-2 py-1.5 px-3">
      <div className="h-px flex-1 bg-border/50" />
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground shrink-0">
        <Icon className="h-3 w-3" />
        <span>{label}</span>
        {details && <span className="font-medium text-foreground">· {details}</span>}
        <span>· {time}</span>
      </div>
      <div className="h-px flex-1 bg-border/50" />
    </div>
  );
}
