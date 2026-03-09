import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { nb } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Phone, Mail, Calendar } from "lucide-react";
import { OFFER_STATUS_CONFIG, type OfferStatus } from "@/lib/offer-status";
import { PIPELINE_STAGES, LEAD_STATUS_CONFIG, type LeadStatus } from "@/lib/lead-status";

export interface RecentOffer {
  id: string;
  offer_number: string;
  status: OfferStatus;
  total_inc_vat: number;
  customer: string;
  created_at: string;
}

export interface RecentLead {
  id: string;
  company_name: string;
  status: LeadStatus;
  ref_code: string | null;
  updated_at: string;
}

interface OffersProps {
  offers: RecentOffer[];
  loading: boolean;
}

interface LeadsProps {
  leads: RecentLead[];
  loading: boolean;
}

export function RecentOffersList({ offers, loading }: OffersProps) {
  const nav = useNavigate();

  return (
    <div className="relative rounded-2xl bg-card border border-border/40 shadow-sm overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-primary to-info" />
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">Siste tilbud</h4>
          <button
            onClick={() => nav("/sales/offers")}
            className="inline-flex items-center gap-1.5 text-xs font-medium
                       text-muted-foreground px-3 py-1.5 rounded-xl
                       border border-border/30
                       hover:bg-secondary/50 hover:text-foreground
                       active:scale-[0.97] transition-all duration-150 cursor-pointer"
          >
            Se alle <ArrowRight className="h-3 w-3" />
          </button>
        </div>
        {loading ? (
          <div className="space-y-2 animate-pulse">
            {[1, 2, 3].map(i => <div key={i} className="h-12 bg-muted/40 rounded-xl" />)}
          </div>
        ) : offers.length === 0 ? (
          <div className="flex flex-col items-center py-8 gap-3">
            <p className="text-sm text-muted-foreground/60">Ingen tilbud ennå</p>
            <button
              onClick={() => nav("/sales/offers")}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary
                         px-4 py-2.5 rounded-xl border border-primary/20
                         hover:bg-primary/10 active:scale-[0.97] transition-all cursor-pointer"
            >
              Opprett tilbud <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="space-y-0.5">
            {offers.map(offer => (
              <button
                key={offer.id}
                onClick={() => nav(`/sales/offers/${offer.id}`)}
                className="flex items-center gap-3 py-3 px-3 w-full text-left
                           rounded-xl hover:bg-secondary/40 active:scale-[0.99]
                           transition-all duration-150 cursor-pointer group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate font-mono">{offer.offer_number}</p>
                  <p className="text-[11px] text-muted-foreground/60 truncate">{offer.customer}</p>
                </div>
                <span className="text-xs font-mono text-muted-foreground/70 shrink-0">
                  kr {offer.total_inc_vat.toLocaleString("nb-NO", { maximumFractionDigits: 0 })}
                </span>
                <Badge className={OFFER_STATUS_CONFIG[offer.status]?.className + " text-[9px] shrink-0"}>
                  {OFFER_STATUS_CONFIG[offer.status]?.label}
                </Badge>
                {/* Quick action: mail */}
                <span
                  onClick={e => { e.stopPropagation(); nav(`/sales/offers/${offer.id}`); }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  title="Følg opp"
                >
                  <Mail className="h-3.5 w-3.5 text-muted-foreground/40 hover:text-primary" />
                </span>
                <ArrowRight className="h-3 w-3 text-muted-foreground/0 group-hover:text-primary/50 transition-all shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function RecentLeadsList({ leads, loading }: LeadsProps) {
  const nav = useNavigate();

  return (
    <div className="relative rounded-2xl bg-card border border-border/40 shadow-sm overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-emerald-500/60 to-accent/60" />
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">Siste leads</h4>
          <button
            onClick={() => nav("/sales/leads")}
            className="inline-flex items-center gap-1.5 text-xs font-medium
                       text-muted-foreground px-3 py-1.5 rounded-xl
                       border border-border/30
                       hover:bg-secondary/50 hover:text-foreground
                       active:scale-[0.97] transition-all duration-150 cursor-pointer"
          >
            Se alle <ArrowRight className="h-3 w-3" />
          </button>
        </div>
        {loading ? (
          <div className="space-y-2 animate-pulse">
            {[1, 2, 3].map(i => <div key={i} className="h-12 bg-muted/40 rounded-xl" />)}
          </div>
        ) : leads.length === 0 ? (
          <div className="flex flex-col items-center py-8 gap-3">
            <p className="text-sm text-muted-foreground/60">Ingen leads ennå</p>
            <button
              onClick={() => nav("/sales/leads/new")}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary
                         px-4 py-2.5 rounded-xl border border-primary/20
                         hover:bg-primary/10 active:scale-[0.97] transition-all cursor-pointer"
            >
              Opprett første lead <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="space-y-0.5">
            {leads.map(lead => {
              const stageColor = PIPELINE_STAGES.find(s => s.key === lead.status)?.color || "hsl(210, 10%, 60%)";
              return (
                <button
                  key={lead.id}
                  onClick={() => nav(`/sales/leads/${lead.id}`)}
                  className="flex items-center gap-3 py-3 px-3 w-full text-left
                             rounded-xl hover:bg-secondary/40 active:scale-[0.99]
                             transition-all duration-150 cursor-pointer group"
                >
                  <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: stageColor }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{lead.company_name}</p>
                    {lead.ref_code && <p className="text-[10px] text-muted-foreground/40 font-mono">{lead.ref_code}</p>}
                  </div>
                  <Badge className={LEAD_STATUS_CONFIG[lead.status]?.className + " text-[9px] shrink-0"}>
                    {LEAD_STATUS_CONFIG[lead.status]?.label}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground/50 shrink-0 whitespace-nowrap">
                    {formatDistanceToNow(new Date(lead.updated_at), { addSuffix: true, locale: nb })}
                  </span>
                  {/* Quick actions on hover */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <span title="Ring" onClick={e => { e.stopPropagation(); }}>
                      <Phone className="h-3.5 w-3.5 text-muted-foreground/40 hover:text-primary cursor-pointer" />
                    </span>
                    <span title="E-post" onClick={e => { e.stopPropagation(); }}>
                      <Mail className="h-3.5 w-3.5 text-muted-foreground/40 hover:text-primary cursor-pointer" />
                    </span>
                  </div>
                  <ArrowRight className="h-3 w-3 text-muted-foreground/0 group-hover:text-primary/50 transition-all shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
