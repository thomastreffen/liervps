import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow, differenceInDays } from "date-fns";
import { nb } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { fetchActiveLeads } from "@/lib/lead-queries";
import { useAuth } from "@/hooks/useAuth";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LeadActionPanel, type ActionPanelTab } from "@/components/activity/LeadActionPanel";
import { PIPELINE_STAGES, LEAD_STATUS_CONFIG, type PipelineStage, type LeadStatus } from "@/lib/lead-status";
import { Loader2, AlertTriangle, StickyNote, CalendarPlus, Mail } from "lucide-react";
import { toast } from "sonner";

interface PipelineCard {
  id: string;
  leadId: string;
  title: string;
  subtitle: string;
  email: string | null;
  leadRefCode: string | null;
  value: number;
  probability: number;
  stage: PipelineStage;
  lastActivity: string | null;
  hasCalc: boolean;
  hasOffer: boolean;
  refCode: string | null;
  daysSinceActivity: number;
}

const STALE_DAYS = 7;

export default function PipelinePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeCompanyId } = useCompanyContext();
  const [cards, setCards] = useState<PipelineCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState<PipelineStage | null>(null);

  // Quick action panel
  const [quickLead, setQuickLead] = useState<PipelineCard | null>(null);
  const [quickTab, setQuickTab] = useState<ActionPanelTab>("note");
  const [quickOpen, setQuickOpen] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: leads } = await fetchActiveLeads();
      const activeLeads = (leads || []).filter((l: any) => l.status !== "lost");

      const leadIds = activeLeads.map((l: any) => l.id);

      const [calcsRes, offersRes, activityRes] = await Promise.all([
        leadIds.length > 0
          ? supabase.from("calculations").select("id, lead_id").in("lead_id", leadIds).is("deleted_at", null)
          : Promise.resolve({ data: [] }),
        leadIds.length > 0
          ? supabase.from("offers").select("id, lead_id").in("lead_id", leadIds).is("deleted_at", null)
          : Promise.resolve({ data: [] }),
        leadIds.length > 0
          ? supabase.from("activity_log").select("entity_id, created_at").eq("entity_type", "lead").in("entity_id", leadIds).order("created_at", { ascending: false })
          : Promise.resolve({ data: [] }),
      ]);

      const calcLeadIds = new Set((calcsRes.data || []).map((c: any) => c.lead_id));
      const offerLeadIds = new Set((offersRes.data || []).map((o: any) => o.lead_id));

      const activityMap = new Map<string, string>();
      for (const a of (activityRes.data || []) as any[]) {
        if (!activityMap.has(a.entity_id)) activityMap.set(a.entity_id, a.created_at);
      }

      const items: PipelineCard[] = activeLeads.map((lead: any) => {
        const lastAct = activityMap.get(lead.id) || lead.created_at;
        return {
          id: lead.id, leadId: lead.id,
          title: lead.company_name,
          subtitle: lead.contact_name || lead.email || "",
          email: lead.email || null,
          leadRefCode: lead.lead_ref_code || null,
          value: Number(lead.estimated_value) || 0,
          probability: Number(lead.probability) || 50,
          stage: lead.status as PipelineStage,
          lastActivity: lastAct,
          hasCalc: calcLeadIds.has(lead.id),
          hasOffer: offerLeadIds.has(lead.id),
          refCode: lead.lead_ref_code || null,
          daysSinceActivity: differenceInDays(new Date(), new Date(lastAct)),
        };
      });

      setCards(items);
      setLoading(false);
    })();
  }, []);

  const handleDragStart = (cardId: string) => setDragging(cardId);
  const handleDragEnd = () => setDragging(null);

  const handleDrop = async (targetStage: PipelineStage) => {
    if (!dragging) return;
    const card = cards.find((c) => c.id === dragging);
    if (!card || card.stage === targetStage) { setDragging(null); return; }

    await supabase.from("leads").update({ status: targetStage as LeadStatus }).eq("id", card.leadId);
    await supabase.from("activity_log").insert({
      entity_type: "lead", entity_id: card.leadId, action: "status_changed",
      description: `Pipeline: ${LEAD_STATUS_CONFIG[targetStage].label}`, performed_by: user?.id,
    });
    setCards((prev) => prev.map((c) => c.id === dragging ? { ...c, stage: targetStage } : c));
    toast.success(`Lead flyttet til ${LEAD_STATUS_CONFIG[targetStage].label}`);
    setDragging(null);
  };

  const openQuickAction = (card: PipelineCard, tab: ActionPanelTab, e: React.MouseEvent) => {
    e.stopPropagation();
    setQuickLead(card);
    setQuickTab(tab);
    setQuickOpen(true);
  };

  const activeStages = PIPELINE_STAGES.filter(s => s.key !== "won" && s.key !== "lost");
  const filteredStages = stageFilter ? activeStages.filter(s => s.key === stageFilter) : activeStages;
  const stageCards = (stage: PipelineStage) => cards.filter((c) => c.stage === stage);

  if (loading) return <div className="flex items-center justify-center p-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Ordrepipeline</h1>
          <p className="text-sm text-muted-foreground/70">{cards.length} aktive henvendelser</p>
        </div>
      </div>

      {/* Stage filter chips */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          onClick={() => setStageFilter(null)}
          className={`text-[11px] px-3 py-1.5 rounded-lg font-medium transition-all ${
            !stageFilter ? "bg-primary/10 text-primary shadow-sm" : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/60"
          }`}
        >
          Alle
        </button>
        {activeStages.map(stage => (
          <button
            key={stage.key}
            onClick={() => setStageFilter(stageFilter === stage.key ? null : stage.key)}
            className={`text-[11px] px-3 py-1.5 rounded-lg font-medium transition-all inline-flex items-center gap-1.5 ${
              stageFilter === stage.key ? "bg-primary/10 text-primary shadow-sm" : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/60"
            }`}
          >
            <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
            {stage.label}
            <span className="text-[10px] text-muted-foreground/40 font-mono">{stageCards(stage.key).length}</span>
          </button>
        ))}
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: "70vh" }}>
        {filteredStages.map((stage) => {
          const sc = stageCards(stage.key);
          return (
            <div
              key={stage.key}
              className={`flex-shrink-0 w-[280px] bg-secondary/15 rounded-2xl flex flex-col border border-border/20 ${dragging ? "ring-1 ring-primary/10" : ""}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(stage.key)}
            >
              <div className="px-4 py-3 border-b border-border/10 flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
                <span className="text-xs font-semibold text-foreground uppercase tracking-wider">{stage.label}</span>
                <span className="text-[10px] text-muted-foreground/50 font-mono ml-auto">{sc.length}</span>
              </div>

              <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                {sc.map((card) => {
                  const isStale = card.daysSinceActivity > STALE_DAYS;
                  return (
                    <div
                      key={card.id}
                      draggable
                      onDragStart={() => handleDragStart(card.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => navigate(`/sales/leads/${card.leadId}`)}
                      className={`bg-card rounded-xl border border-border/40 p-3 cursor-pointer hover:shadow-md hover:border-border/60 transition-all group ${dragging === card.id ? "opacity-50" : ""} ${isStale ? "border-l-destructive/50" : ""}`}
                      style={{ borderLeft: isStale ? "3px solid hsl(0, 72%, 51%)" : `3px solid ${stage.color}` }}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate leading-tight">{card.title}</p>
                          {card.refCode && <p className="text-[9px] text-muted-foreground/40 font-mono mt-0.5">{card.refCode}</p>}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {isStale && (
                            <Tooltip>
                              <TooltipTrigger>
                                <AlertTriangle className="h-3.5 w-3.5 text-destructive/70" />
                              </TooltipTrigger>
                              <TooltipContent>Ingen aktivitet på {card.daysSinceActivity} dager</TooltipContent>
                            </Tooltip>
                          )}
                          {card.hasCalc && <Badge variant="outline" className="text-[8px] h-4 px-1 rounded-md">Kalkyle</Badge>}
                          {card.hasOffer && <Badge variant="outline" className="text-[8px] h-4 px-1 rounded-md">Tilbud</Badge>}
                        </div>
                      </div>
                      {card.value > 0 && (
                        <p className="mt-2 text-xs text-muted-foreground font-mono">
                          kr {card.value.toLocaleString("nb-NO", { maximumFractionDigits: 0 })}
                          <span className="text-muted-foreground/40 ml-1">({card.probability}%)</span>
                        </p>
                      )}
                      {card.lastActivity && (
                        <p className="mt-1 text-[10px] text-muted-foreground/40">
                          {formatDistanceToNow(new Date(card.lastActivity), { addSuffix: true, locale: nb })}
                        </p>
                      )}

                      {/* Quick actions on hover */}
                      <div className="flex items-center gap-0.5 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={e => openQuickAction(card, "note", e)}>
                              <StickyNote className="h-3 w-3 text-muted-foreground" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Logg aktivitet</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={e => openQuickAction(card, "meeting", e)}>
                              <CalendarPlus className="h-3 w-3 text-muted-foreground" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Opprett møte</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={e => openQuickAction(card, "email", e)}>
                              <Mail className="h-3 w-3 text-muted-foreground" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Send e-post</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  );
                })}
                {sc.length === 0 && (
                  <p className="text-[11px] text-muted-foreground/40 text-center py-8">Ingen henvendelser</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick action panel */}
      {quickLead && (
        <LeadActionPanel
          open={quickOpen}
          onOpenChange={setQuickOpen}
          defaultTab={quickTab}
          lead={{
            id: quickLead.leadId,
            company_name: quickLead.title,
            email: quickLead.email,
            lead_ref_code: quickLead.leadRefCode,
          }}
          onActivityCreated={() => window.location.reload()}
        />
      )}
    </div>
  );
}
