import { format, formatDistanceToNowStrict } from "date-fns";
import { nb } from "date-fns/locale";
import { Check, CheckCheck, Eye, User } from "lucide-react";
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
  // Split expected readers into internal vs customer.
  // - Internal messages: only internal_user / technician participants are expected readers.
  // - Shared messages: customer participant is also expected.
  // - Always exclude the sender from "missing" calculation.
  const activeParticipants = participants.filter((p) => p.is_active);

  const internalExpected = activeParticipants.filter((p) => {
    if (p.participant_type === "customer") return false;
    if (senderType === "internal" && senderUserId && p.user_id === senderUserId) return false;
    return true;
  });

  const customerParticipant = isSharedWithCustomer
    ? activeParticipants.find((p) => p.participant_type === "customer" && (senderType !== "customer"))
    : undefined;

  const reads = readsForMessage || [];
  const readSet = new Map<string, MessageRead>();
  for (const r of reads) readSet.set(r.participant_id, r);

  const internalReaders = internalExpected.filter((p) => readSet.has(p.id));
  const internalMissing = internalExpected.filter((p) => !readSet.has(p.id));
  const customerRead = customerParticipant ? readSet.get(customerParticipant.id) : undefined;
  const customerHasRead = !!customerRead;

  // Nothing to show
  if (internalExpected.length === 0 && !customerParticipant) return null;

  // Build compact label.
  let label: string;
  let Icon: typeof Check = Check;
  let tone: "muted" | "ok" = "muted";

  const allInternalRead = internalExpected.length > 0 && internalMissing.length === 0;
  const someInternalRead = internalReaders.length > 0;

  if (senderType === "customer") {
    // Customer's own message — only internal readers matter.
    if (internalExpected.length === 0) {
      label = "Sendt";
      Icon = Check;
      tone = "muted";
    } else if (!someInternalRead) {
      label = "Ikke lest av Lier VPS";
      Icon = Check;
      tone = "muted";
    } else if (allInternalRead) {
      label = internalReaders.length === 1
        ? `Lest av ${internalReaders[0].display_name || internalReaders[0].name}`
        : "Lest av Lier VPS";
      Icon = CheckCheck;
      tone = "ok";
    } else if (internalReaders.length <= 2) {
      label = `Lest av ${internalReaders.map((p) => p.display_name || p.name).join(", ")}`;
      Icon = CheckCheck;
      tone = "ok";
    } else {
      label = `Lest av ${internalReaders.length} av ${internalExpected.length} interne`;
      Icon = CheckCheck;
      tone = "ok";
    }
  } else {
    // Internal sender
    const internalPart = !someInternalRead
      ? (internalExpected.length === 0 ? null : "Ikke lest internt")
      : allInternalRead
        ? "Lest av alle interne"
        : internalReaders.length <= 2
          ? `Lest av ${internalReaders.map((p) => p.display_name || p.name).join(", ")}`
          : `Lest av ${internalReaders.length}/${internalExpected.length} interne`;

    const customerPart = customerParticipant
      ? (customerHasRead ? "Kunde har lest" : "Kunde ikke lest")
      : null;

    if (internalPart && customerPart) {
      // Combine — prefer compact form when both fully read.
      if (allInternalRead && customerHasRead) {
        label = "Lest av kunde og alle interne";
        Icon = CheckCheck;
        tone = "ok";
      } else {
        label = `${internalPart} · ${customerPart}`;
        Icon = customerHasRead || someInternalRead ? CheckCheck : Check;
        tone = customerHasRead || someInternalRead ? "ok" : "muted";
      }
    } else if (customerPart) {
      label = customerPart;
      Icon = customerHasRead ? CheckCheck : Check;
      tone = customerHasRead ? "ok" : "muted";
    } else if (internalPart) {
      label = internalPart;
      Icon = someInternalRead ? CheckCheck : Check;
      tone = someInternalRead ? "ok" : "muted";
    } else {
      return null;
    }
  }

  if (typeof window !== "undefined") {
    // eslint-disable-next-line no-console
    console.info("[message-read-status-debug]", {
      messageId,
      senderType,
      isSharedWithCustomer,
      participants: participants.map((p) => ({
        id: p.id,
        type: p.participant_type,
        display_name: p.display_name,
        is_active: p.is_active,
        last_seen_message_id: p.last_seen_message_id,
      })),
      reads: reads.map((r) => ({ participant_id: r.participant_id, read_at: r.read_at })),
      computedLabel: label,
    });
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
      <PopoverContent align="end" className="w-72 p-3 space-y-2 text-xs">
        {customerParticipant && (
          <div className="pb-2 border-b">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Kunde</p>
            <div className="flex items-center gap-2">
              {customerHasRead ? (
                <CheckCheck className="h-3 w-3 text-primary shrink-0" />
              ) : (
                <User className="h-3 w-3 text-muted-foreground shrink-0" />
              )}
              <span className="flex-1 truncate">
                {customerParticipant.display_name || customerParticipant.name}
              </span>
              <span className="text-[10px] text-muted-foreground shrink-0">
                {customerHasRead && customerRead ? relativeTime(customerRead.read_at) : "Ikke lest"}
              </span>
            </div>
          </div>
        )}

        {internalExpected.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
              Interne ({internalReaders.length}/{internalExpected.length})
            </p>
            {internalReaders.length === 0 ? (
              <p className="text-muted-foreground italic">Ingen ennå</p>
            ) : (
              <ul className="space-y-1">
                {internalReaders.map((p) => {
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

            {internalMissing.length > 0 && (
              <ul className="space-y-1 mt-2 pt-2 border-t">
                {internalMissing.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 text-muted-foreground">
                    <Eye className="h-3 w-3 shrink-0" />
                    <span className="flex-1 truncate">{p.display_name || p.name}</span>
                    <span className="text-[10px] shrink-0">Ikke lest</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
