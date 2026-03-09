import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  useOfferActivity,
  OFFER_EVENT_CONFIG,
  type OfferActivityEvent,
} from "@/hooks/useOfferActivity";
import {
  Eye, FileText, Mail, Send, Link2, CheckCircle2, XCircle,
  Clock, PenLine, Activity,
} from "lucide-react";

const EVENT_ICONS: Record<string, React.ReactNode> = {
  offer_created: <PenLine className="h-3.5 w-3.5 text-muted-foreground" />,
  offer_sent_email: <Send className="h-3.5 w-3.5 text-primary" />,
  offer_sent_link: <Link2 className="h-3.5 w-3.5 text-primary" />,
  offer_viewed: <Eye className="h-3.5 w-3.5 text-green-600" />,
  offer_pdf_downloaded: <FileText className="h-3.5 w-3.5 text-blue-600" />,
  offer_email_opened: <Mail className="h-3.5 w-3.5 text-blue-500" />,
  offer_link_clicked: <Link2 className="h-3.5 w-3.5 text-purple-600" />,
  offer_accepted: <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />,
  offer_rejected: <XCircle className="h-3.5 w-3.5 text-destructive" />,
  offer_expired: <Clock className="h-3.5 w-3.5 text-amber-600" />,
};

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Akkurat nå";
  if (mins < 60) return `${mins} min siden`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}t siden`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "I går";
  if (days < 7) return `${days} dager siden`;
  return format(new Date(dateStr), "d. MMM yyyy HH:mm", { locale: nb });
}

function getActivityStatus(events: OfferActivityEvent[]): {
  label: string;
  className: string;
  icon: string;
} {
  const customerEvents = events.filter((e) => e.actor_type === "customer");
  if (customerEvents.length === 0) {
    return { label: "Ingen kundeaktivitet ennå", className: "bg-muted text-muted-foreground", icon: "⚪" };
  }
  const latest = customerEvents[0];
  const diffMs = Date.now() - new Date(latest.event_at).getTime();
  if (diffMs < 15 * 60 * 1000) {
    return { label: "Kunde aktiv nå", className: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300", icon: "🟢" };
  }
  if (diffMs < 24 * 60 * 60 * 1000) {
    return { label: "Kunde aktiv i dag", className: "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400", icon: "🟢" };
  }
  return { label: `Sist aktiv ${relativeTime(latest.event_at)}`, className: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", icon: "🟡" };
}

interface OfferActivityTimelineProps {
  offerId: string;
}

export function OfferActivityTimeline({ offerId }: OfferActivityTimelineProps) {
  const { events, loading } = useOfferActivity(offerId);

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  const status = getActivityStatus(events);

  return (
    <div className="rounded-2xl border border-border/40 bg-card shadow-sm overflow-hidden">
      <div className="p-4 pb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold text-foreground">Kundeaktivitet</h4>
          </div>
          <Badge className={`${status.className} rounded-lg text-[10px] px-2 py-0.5`}>
            {status.icon} {status.label}
          </Badge>
        </div>
      </div>

      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground/60 text-center py-6 px-4">
          Ingen aktivitet registrert ennå
        </p>
      ) : (
        <div className="divide-y divide-border/20 max-h-[320px] overflow-y-auto">
          {events.map((evt) => {
            const cfg = OFFER_EVENT_CONFIG[evt.event_type];
            return (
              <div key={evt.id} className="flex items-start gap-3 px-4 py-2.5">
                <div className="pt-0.5 shrink-0">
                  {EVENT_ICONS[evt.event_type] || <Activity className="h-3.5 w-3.5 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{cfg?.label || evt.event_type}</p>
                  <p className="text-xs text-muted-foreground/50">{relativeTime(evt.event_at)}</p>
                </div>
                {evt.actor_type === "customer" && (
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 rounded-md shrink-0">
                    Kunde
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Compact activity badge for table/list views */
export function OfferActivityBadge({
  lastEvent,
  viewCount,
  isActiveNow,
}: {
  lastEvent: OfferActivityEvent | null;
  viewCount: number;
  isActiveNow: boolean;
}) {
  if (!lastEvent) {
    return <span className="text-xs text-muted-foreground/40">Ingen respons</span>;
  }

  return (
    <div className="flex items-center gap-1.5">
      {isActiveNow ? (
        <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
          Aktiv nå
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">
          {OFFER_EVENT_CONFIG[lastEvent.event_type]?.icon}{" "}
          {relativeTime(lastEvent.event_at)}
        </span>
      )}
      {viewCount > 1 && (
        <span className="text-[10px] text-muted-foreground/50">({viewCount}×)</span>
      )}
    </div>
  );
}
