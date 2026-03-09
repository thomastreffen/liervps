import { useNavigate } from "react-router-dom";
import { AlertCircle, ArrowRight, CheckCircle2, Clock, Send, CalendarX, ListX, Sparkles } from "lucide-react";

export interface ActionItem {
  key: string;
  label: string;
  count: number;
  severity: "high" | "medium";
  href: string;
  icon: React.ReactNode;
}

interface Props {
  actions: ActionItem[];
  loading?: boolean;
}

const OK_ROWS = [
  "Alle leads er fulgt opp",
  "Ingen ventende tilbud",
  "Neste steg er satt for alle aktive leads",
];

export function SalesActionRequired({ actions, loading }: Props) {
  const nav = useNavigate();

  if (loading) {
    return (
      <div className="rounded-2xl bg-card border border-border/40 shadow-sm p-4 animate-pulse">
        <div className="h-4 w-32 bg-muted/40 rounded mb-3" />
        {[1, 2, 3].map(i => <div key={i} className="h-10 bg-muted/30 rounded-lg mb-1.5" />)}
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-card border border-border/40 shadow-sm overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-destructive/60 to-amber-400/60 rounded-t-2xl" style={{ position: "relative" }} />
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 text-destructive/60" />
            Krever handling
          </h3>
          {actions.length > 0 && (
            <span className="text-[10px] font-mono font-medium text-destructive/50 bg-destructive/5 px-2 py-0.5 rounded-full">
              {actions.reduce((s, a) => s + a.count, 0)} totalt
            </span>
          )}
        </div>

        {actions.length > 0 ? (
          <div className="space-y-0.5">
            {actions.map(a => (
              <button
                key={a.key}
                onClick={() => nav(a.href)}
                className="flex items-center gap-2.5 py-2.5 px-2.5 w-full text-left
                           rounded-xl hover:bg-secondary/40 hover:translate-x-0.5
                           active:scale-[0.99] transition-all duration-150 cursor-pointer group"
              >
                <span className="text-muted-foreground/40 group-hover:text-foreground/60 transition-colors shrink-0">
                  {a.icon}
                </span>
                <span className="text-[12px] text-foreground/70 flex-1 truncate group-hover:text-foreground transition-colors">
                  {a.label}
                </span>
                <span className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded-lg shrink-0
                  ${a.severity === "high"
                    ? "text-destructive bg-destructive/8 border border-destructive/15"
                    : "text-amber-700 bg-amber-50 border border-amber-200/40 dark:text-amber-300 dark:bg-amber-900/20 dark:border-amber-800/40"
                  }`}>
                  {a.count}
                </span>
                <ArrowRight className="h-3 w-3 text-muted-foreground/0 group-hover:text-primary/50 transition-all shrink-0" />
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            <div className="flex items-center gap-2 py-2 px-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500/60" />
              <span className="text-sm text-muted-foreground/60">Alt er under kontroll</span>
            </div>
            {OK_ROWS.map((txt, i) => (
              <div key={i} className="flex items-center gap-2 py-1.5 px-2 opacity-40">
                <div className="h-1.5 w-1.5 rounded-full shrink-0 bg-emerald-400/50" />
                <span className="text-[11px] text-muted-foreground/50">{txt}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Build action items from raw sales data */
export function buildActionItems(data: {
  inactiveLeads: number;
  offersWithoutFollowup: number;
  leadsWithoutNextStep: number;
  calcsWithoutOffer: number;
  befaringWithoutFollowup: number;
}): ActionItem[] {
  const items: ActionItem[] = [];

  if (data.inactiveLeads > 0)
    items.push({
      key: "inactive",
      label: "Leads uten aktivitet > 7 dager",
      count: data.inactiveLeads,
      severity: data.inactiveLeads > 5 ? "high" : "medium",
      href: "/sales/leads?filter=inactive_7d",
      icon: <Clock className="h-3.5 w-3.5" />,
    });

  if (data.offersWithoutFollowup > 0)
    items.push({
      key: "offers_nofollowup",
      label: "Tilbud uten oppfølging",
      count: data.offersWithoutFollowup,
      severity: data.offersWithoutFollowup > 3 ? "high" : "medium",
      href: "/sales/offers?filter=no_followup",
      icon: <Send className="h-3.5 w-3.5" />,
    });

  if (data.leadsWithoutNextStep > 0)
    items.push({
      key: "no_next_step",
      label: "Leads uten neste steg",
      count: data.leadsWithoutNextStep,
      severity: data.leadsWithoutNextStep > 3 ? "high" : "medium",
      href: "/sales/leads?filter=no_next_step",
      icon: <ListX className="h-3.5 w-3.5" />,
    });

  if (data.befaringWithoutFollowup > 0)
    items.push({
      key: "befaring_nofollowup",
      label: "Befaringer uten oppfølging",
      count: data.befaringWithoutFollowup,
      severity: "medium",
      href: "/sales/leads?status=befaring&filter=inactive_7d",
      icon: <CalendarX className="h-3.5 w-3.5" />,
    });

  if (data.calcsWithoutOffer > 0)
    items.push({
      key: "calc_no_offer",
      label: "Kalkyle ferdig, mangler tilbud",
      count: data.calcsWithoutOffer,
      severity: "medium",
      href: "/sales/calculations?filter=ready_no_offer",
      icon: <Send className="h-3.5 w-3.5" />,
    });

  return items.slice(0, 6);
}
