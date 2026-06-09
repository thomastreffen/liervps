import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Package, ExternalLink, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface LeadLike {
  id: string;
  company_id: string | null;
  company_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
}

interface Props {
  lead: LeadLike;
  logActivity?: (args: any) => Promise<any> | any;
}

interface TemplateRow {
  id: string;
  name: string;
  audience_type: string;
}

interface LinkedSubmission {
  id: string;
  submission_no: string;
  status: string;
  created_at: string;
}

export function CreateOrderFromLeadCard({ lead, logActivity }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [linked, setLinked] = useState<LinkedSubmission[]>([]);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [linkedRes, tplRes] = await Promise.all([
        supabase
          .from("order_form_submissions")
          .select("id, submission_no, status, created_at")
          .eq("source_lead_id" as any, lead.id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false }),
        lead.company_id
          ? supabase
              .from("order_form_templates")
              .select("id, name, audience_type")
              .eq("company_id", lead.company_id)
              .eq("is_active", true)
              .order("name", { ascending: true })
          : Promise.resolve({ data: [] as any[], error: null }),
      ]);
      if (cancelled) return;
      setLinked((linkedRes.data as any) || []);
      setTemplates((tplRes.data as any) || []);
      if (((tplRes.data as any) || []).length === 1) {
        setSelectedTemplateId((tplRes.data as any)[0].id);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [lead.id, lead.company_id]);

  const buildSummary = (): string => {
    const lines = [
      `Kunde: ${lead.company_name}`,
      lead.contact_name ? `Kontaktperson: ${lead.contact_name}` : null,
      lead.email ? `E-post: ${lead.email}` : null,
      lead.phone ? `Telefon: ${lead.phone}` : null,
      "",
      "Fra lead i CRM.",
      lead.notes ? `\nNotat:\n${lead.notes}` : null,
    ].filter(Boolean);
    return lines.join("\n");
  };

  const handleCreate = async () => {
    if (!selectedTemplateId) {
      toast.error("Velg en mal først");
      return;
    }
    if (!lead.company_id) {
      toast.error("Lead mangler selskap — kan ikke opprette bestilling");
      return;
    }
    setCreating(true);
    try {
      const requesterType = lead.email || lead.contact_name ? "external" : "internal";
      const payload: any = {
        company_id: lead.company_id,
        template_id: selectedTemplateId,
        source: "lead",
        requester_type: requesterType,
        status: "new",
        priority: "normal",
        submitter_name: lead.contact_name || lead.company_name || null,
        submitter_email: lead.email || null,
        submitted_by: user?.id || null,
        summary: buildSummary(),
        source_lead_id: lead.id,
      };

      const { data, error } = await supabase
        .from("order_form_submissions")
        .insert(payload)
        .select("id, submission_no")
        .single();
      if (error) throw error;

      // Log activity on lead
      try {
        await logActivity?.({
          action: "order_created",
          description: `Bestilling ${data.submission_no} opprettet fra lead`,
          type: "system",
          performedBy: user?.id,
          metadata: { order_form_submission_id: data.id, submission_no: data.submission_no },
        });
      } catch (e) {
        console.warn("[CreateOrderFromLead] activity log failed", e);
      }
      try {
        await supabase.from("lead_history").insert({
          lead_id: lead.id,
          action: "order_created",
          description: `Bestilling ${data.submission_no} opprettet fra lead`,
          performed_by: user?.id,
          metadata: { order_form_submission_id: data.id },
        } as any);
      } catch (e) {
        console.warn("[CreateOrderFromLead] history insert failed", e);
      }

      toast.success("Bestilling opprettet fra lead");
      navigate(`/orders/${data.id}`);
    } catch (err: any) {
      console.error("[CreateOrderFromLead] insert error:", err);
      toast.error("Kunne ikke opprette bestilling: " + (err.message || ""));
    } finally {
      setCreating(false);
      setDialogOpen(false);
    }
  };

  if (loading) return null;

  return (
    <>
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" />
            Bestilling
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {linked.length > 0 ? (
            <>
              {linked.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      Koblet til bestilling {s.submission_no}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">{s.status}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 rounded-xl"
                    onClick={() => navigate(`/orders/${s.id}`)}
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Åpne
                  </Button>
                </div>
              ))}
              <Button
                size="sm"
                variant="ghost"
                className="w-full text-xs text-muted-foreground"
                onClick={() => setDialogOpen(true)}
              >
                Opprett ny bestilling likevel
              </Button>
            </>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Gjør leadet om til en bestilling. Lead-data fylles inn automatisk.
              </p>
              <Button
                size="sm"
                className="gap-1.5 rounded-xl"
                onClick={() => setDialogOpen(true)}
                disabled={templates.length === 0}
              >
                <Package className="h-4 w-4" /> Opprett bestilling
              </Button>
              {templates.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Ingen aktive bestillingsmaler funnet for selskapet.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Opprett bestilling fra lead</DialogTitle>
            <DialogDescription>
              Bestillingen kobles tilbake til dette leadet. Kontaktinfo og notater
              kopieres inn automatisk.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {linked.length > 0 && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  Dette leadet har allerede {linked.length} koblet bestilling
                  {linked.length === 1 ? "" : "er"}. Er du sikker på at du vil
                  opprette en ny?
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Bestillingsmal</label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Velg mal" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                      <Badge variant="outline" className="ml-2 text-[10px]">
                        {t.audience_type}
                      </Badge>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-xl border border-border/50 bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
              <div>
                <span className="font-medium text-foreground">Kunde:</span>{" "}
                {lead.company_name}
              </div>
              {lead.contact_name && (
                <div>
                  <span className="font-medium text-foreground">Kontakt:</span>{" "}
                  {lead.contact_name}
                </div>
              )}
              {lead.email && (
                <div>
                  <span className="font-medium text-foreground">E-post:</span>{" "}
                  {lead.email}
                </div>
              )}
              {lead.phone && (
                <div>
                  <span className="font-medium text-foreground">Telefon:</span>{" "}
                  {lead.phone}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={creating}>
              Avbryt
            </Button>
            <Button onClick={handleCreate} disabled={creating || !selectedTemplateId}>
              {creating && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Opprett bestilling
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
