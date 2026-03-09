import { useNavigate } from "react-router-dom";
import { Lightbulb, ArrowRight, Phone, Calendar, Send, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface Recommendation {
  key: string;
  title: string;
  description: string;
  actionLabel: string;
  href: string;
  icon: React.ReactNode;
}

interface Props {
  recommendations: Recommendation[];
  loading?: boolean;
}

export function SalesRecommendations({ recommendations, loading }: Props) {
  const nav = useNavigate();

  if (loading) {
    return (
      <div className="rounded-2xl bg-card border border-border/40 shadow-sm p-4 animate-pulse">
        <div className="h-4 w-44 bg-muted/40 rounded mb-3" />
        {[1, 2].map(i => <div key={i} className="h-16 bg-muted/30 rounded-lg mb-1.5" />)}
      </div>
    );
  }

  if (recommendations.length === 0) return null;

  return (
    <div className="rounded-2xl bg-card border border-border/40 shadow-sm overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-primary/50 to-accent/50" />
      <div className="p-4">
        <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5 mb-3">
          <Lightbulb className="h-3.5 w-3.5 text-primary/60" />
          Anbefalte handlinger nå
        </h3>

        <div className="space-y-1">
          {recommendations.map(r => (
            <div
              key={r.key}
              className="flex items-center gap-3 py-3 px-3 rounded-xl hover:bg-secondary/30 transition-colors group"
            >
              <span className="text-muted-foreground/40 group-hover:text-primary/60 transition-colors shrink-0">
                {r.icon}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-foreground/80 truncate">{r.title}</p>
                <p className="text-[11px] text-muted-foreground/50 truncate">{r.description}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => nav(r.href)}
                className="text-[11px] h-7 px-3 gap-1 shrink-0"
              >
                {r.actionLabel} <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Build recommendations from raw data */
export function buildRecommendations(data: {
  inactiveLeads: number;
  newLeadsCount: number;
  befaringDoneCount: number;
  leadsWithoutNextStep: number;
  offersWithoutFollowup: number;
}): Recommendation[] {
  const recs: Recommendation[] = [];

  if (data.inactiveLeads > 0) {
    recs.push({
      key: "followup_inactive",
      title: "Følg opp inaktive leads",
      description: `${data.inactiveLeads} leads har ikke hatt aktivitet på over 7 dager`,
      actionLabel: "Vis leads",
      href: "/sales/leads?filter=inactive_7d",
      icon: <Phone className="h-4 w-4" />,
    });
  }

  if (data.newLeadsCount > 0) {
    recs.push({
      key: "plan_meetings",
      title: "Planlegg møte for nye henvendelser",
      description: `${data.newLeadsCount} nye leads venter på første kontakt`,
      actionLabel: "Vis nye",
      href: "/sales/leads?status=new",
      icon: <Calendar className="h-4 w-4" />,
    });
  }

  if (data.befaringDoneCount > 0) {
    recs.push({
      key: "send_offer_after_befaring",
      title: "Send tilbud etter befaring",
      description: `${data.befaringDoneCount} leads har gjennomført befaring`,
      actionLabel: "Vis",
      href: "/sales/leads?status=befaring",
      icon: <Send className="h-4 w-4" />,
    });
  }

  if (data.leadsWithoutNextStep > 0) {
    recs.push({
      key: "set_next_step",
      title: "Fullfør neste steg på aktive leads",
      description: `${data.leadsWithoutNextStep} leads mangler definert neste steg`,
      actionLabel: "Vis leads",
      href: "/sales/leads?filter=no_next_step",
      icon: <ListChecks className="h-4 w-4" />,
    });
  }

  if (data.offersWithoutFollowup > 0) {
    recs.push({
      key: "followup_offers",
      title: "Følg opp sendte tilbud",
      description: `${data.offersWithoutFollowup} tilbud venter på svar`,
      actionLabel: "Vis tilbud",
      href: "/sales/offers?filter=no_followup",
      icon: <Send className="h-4 w-4" />,
    });
  }

  return recs.slice(0, 4);
}
