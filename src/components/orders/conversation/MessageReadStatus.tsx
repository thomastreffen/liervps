import { format, formatDistanceToNowStrict } from "date-fns";
import { nb } from "date-fns/locale";
import { Check, CheckCheck, Eye } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { ConversationParticipant, MessageRead } from "@/hooks/useConversationReads";

interface Props {
  messageId: string;
  /** Sender's auth user id (for internal sender) or null when sender is customer/system. */
  senderUserId?: string | null;
  senderType: "internal" | "customer" | "system";
  /** Whether this message is shared with customer. Drives which participants are expected to have read it. */
  isSharedWithCustomer: boolean;
  isLastInThread?: boolean;
  participants: ConversationParticipant[];
  readsForMessage: MessageRead[] | undefined;
  className?: string;
}

function relativeTime(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 60_000) return "nå nettopp";
  if (diffMs < 24 * 3600_000) return `kl. ${format(d, "HH:mm")}`;
  if (diffMs < 7 * 24 * 3600_000) {
    return `${formatDistanceToNowStrict(d, { locale: nb, addSuffix: false })} siden`;
  }
  return format(d, "d. MMM HH:mm", { locale: nb });
}

export function MessageReadStatus({
  messageId,
  senderUserId,
  senderType,
  isSharedWithCustomer,
  isLastInThread,
  participants,
  readsForMessage,
  className,
}: Props) {
  // Expected readers: active participants minus the sender.
  // Internal messages: only internal_user + technician should read.
  // Shared messages: include customer too.
  const expected = participants.filter((p) => {
    if (!p.is_active) return false;
    if (senderType === "internal" && senderUserId && p.user_id === senderUserId) return false;
    if (!isSharedWithCustomer && p.participant_type === "customer") return false;
    // never count system "senders"
    if (senderType === "customer" && p.participant_type === "customer") return false;
    return true;
  });

  if (expected.length === 0) return null;

  const reads = readsForMessage || [];
  const readSet = new Map<string, MessageRead>();
  for (const r of reads) readSet.set(r.participant_id, r);

  const readers: ConversationParticipant[] = [];
  const missing: ConversationParticipant[] = [];
  for (const p of expected) {
    if (readSet.has(p.id)) readers.push(p);
    else missing.push(p);
  }

  const allRead = missing.length === 0;
  const noneRead = readers.length === 0;

  // Compact label
  let label: string;
  let Icon = Check;
  let tone: "muted" | "ok" = "muted";

  if (noneRead) {
    label = isLastInThread ? "Ikke lest ennå" : "Ikke lest";
    Icon = Check;
    tone = "muted";
  } else if (allRead) {
    label = isLastInThread ? "Lest av alle" : `Lest av ${readers.length}`;
    Icon = CheckCheck;
    tone = "ok";
  } else if (readers.length <= 2) {
    label = `Lest av ${readers.map((p) => p.display_name || p.name).join(", ")}`;
    Icon = CheckCheck;
    tone = "ok";
  } else {
    label = `Lest av ${readers.length} av ${expected.length}`;
    Icon = CheckCheck;
    tone = "ok";
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1 text-[10px] rounded-full px-1.5 py-0.5 transition-colors",
            tone === "ok" && "text-primary hover:bg-primary/10",
            tone === "muted" && "text-muted-foreground hover:bg-muted",
            className,
          )}
        >
          <Icon className="h-3 w-3" />
          <span>{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3 space-y-2 text-xs">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
            Lest av ({readers.length}/{expected.length})
          </p>
          {readers.length === 0 ? (
            <p className="text-muted-foreground italic">Ingen ennå</p>
          ) : (
            <ul className="space-y-1">
              {readers.map((p) => {
                const r = readSet.get(p.id)!;
                return (
                  <li key={p.id} className="flex items-center gap-2">
                    <CheckCheck className="h-3 w-3 text-primary shrink-0" />
                    <span className="flex-1 truncate">{p.display_name || p.name}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">{relativeTime(r.read_at)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {missing.length > 0 && (
          <div className="border-t pt-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
              Mangler ({missing.length})
            </p>
            <ul className="space-y-1">
              {missing.map((p) => (
                <li key={p.id} className="flex items-center gap-2 text-muted-foreground">
                  <Eye className="h-3 w-3 shrink-0" />
                  <span className="flex-1 truncate">{p.display_name || p.name}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
