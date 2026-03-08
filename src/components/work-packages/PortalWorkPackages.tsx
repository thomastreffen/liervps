import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Package, CheckCircle, Clock, ThumbsUp, ThumbsDown, Eye,
  Loader2, ChevronDown, ChevronUp, FileText, ShieldCheck,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { WP_TYPE_CONFIG, DOC_STATUS_CONFIG, type WorkPackageType } from "@/lib/work-package-types";
import { toast } from "sonner";

interface PortalWP {
  id: string;
  title: string;
  description: string | null;
  status: string;
  work_package_type: WorkPackageType;
  documentation_status: string;
  customer_approval_status: string | null;
  customer_approved_by: string | null;
  customer_approved_at: string | null;
  updated_at: string;
}

interface Props {
  projectId: string;
}

const APPROVAL_STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  awaiting_customer_approval: { label: "Venter på godkjenning", color: "bg-warning/10 text-warning", icon: Clock },
  approved: { label: "Godkjent", color: "bg-success/10 text-success", icon: ShieldCheck },
  ready_for_billing: { label: "Godkjent", color: "bg-success/10 text-success", icon: ShieldCheck },
  rejected: { label: "Avvist", color: "bg-destructive/10 text-destructive", icon: ThumbsDown },
};

export function PortalWorkPackages({ projectId }: Props) {
  const [packages, setPackages] = useState<PortalWP[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [approving, setApproving] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ id: string; action: "approve" | "reject" } | null>(null);

  const fetchPackages = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("events")
      .select("id, title, description, status, work_package_type, documentation_status, customer_approval_status, customer_approved_by, customer_approved_at, updated_at")
      .eq("parent_project_id", projectId)
      .eq("customer_visible", true)
      .not("work_package_type", "is", null)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (data) setPackages(data as any);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchPackages(); }, [fetchPackages]);

  const handleApproval = async (wpId: string, action: "approve" | "reject") => {
    setApproving(wpId);
    setConfirmAction(null);
    try {
      const { data, error } = await supabase.functions.invoke("portal-approve-work-package", {
        body: { work_package_id: wpId, action },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(action === "approve" ? "Arbeidspakke godkjent ✓" : "Arbeidspakke avvist");
      await fetchPackages();
    } catch (err: any) {
      toast.error("Kunne ikke behandle godkjenning", { description: err?.message });
    } finally {
      setApproving(null);
    }
  };

  if (loading || packages.length === 0) return null;

  const needsApproval = packages.filter(wp => wp.customer_approval_status === "awaiting_customer_approval");
  const others = packages.filter(wp => wp.customer_approval_status !== "awaiting_customer_approval");

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-bold">
            <Package className="h-4 w-4" />
            Arbeidsdetaljer
            {needsApproval.length > 0 && (
              <Badge className="text-[10px] h-5 bg-warning/10 text-warning border-0">
                {needsApproval.length} venter godkjenning
              </Badge>
            )}
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Oversikt over utført arbeid. Godkjenn tilleggsarbeid og endringer.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {/* Awaiting approval first */}
          {needsApproval.map(wp => renderWP(wp, true))}
          {needsApproval.length > 0 && others.length > 0 && <Separator className="my-2" />}
          {others.map(wp => renderWP(wp, false))}
        </CardContent>
      </Card>

      {/* Confirm dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.action === "approve" ? "Godkjenn arbeidspakke?" : "Avvis arbeidspakke?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.action === "approve"
                ? "Ved å godkjenne bekrefter du at arbeidet er akseptert. Dette kan brukes som grunnlag for fakturering."
                : "Ved å avvise markerer du at arbeidet ikke er akseptert. Prosjektleder vil bli varslet."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmAction && handleApproval(confirmAction.id, confirmAction.action)}
              className={confirmAction?.action === "reject" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
            >
              {confirmAction?.action === "approve" ? "Godkjenn" : "Avvis"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  function renderWP(wp: PortalWP, highlighted: boolean) {
    const cfg = WP_TYPE_CONFIG[wp.work_package_type];
    const Icon = cfg.icon;
    const isDone = wp.status === "completed" || wp.status === "ready_for_invoicing";
    const isDocumented = wp.documentation_status === "complete";
    const isExpanded = expandedId === wp.id;
    const approvalCfg = wp.customer_approval_status ? APPROVAL_STATUS_CONFIG[wp.customer_approval_status] : null;
    const ApprovalIcon = approvalCfg?.icon;
    const canApprove = wp.customer_approval_status === "awaiting_customer_approval";
    const isApproving = approving === wp.id;

    return (
      <div
        key={wp.id}
        className={cn(
          "rounded-xl border p-3 space-y-2 transition-all",
          highlighted ? "border-warning/40 bg-warning/5" : "border-border/40",
          canApprove && "ring-1 ring-warning/20"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center shrink-0", cfg.bgColor)}>
              <Icon className={cn("h-3.5 w-3.5", cfg.color)} />
            </div>
            <div className="min-w-0">
              <span className="text-sm font-semibold truncate block">{wp.title}</span>
              <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 border-0 mt-0.5", cfg.bgColor, cfg.color)}>
                {cfg.portalLabel}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {approvalCfg && ApprovalIcon && (
              <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", approvalCfg.color)}>
                <ApprovalIcon className="h-2.5 w-2.5" /> {approvalCfg.label}
              </span>
            )}
            {!approvalCfg && (
              isDone ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-success/20 bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
                  <CheckCircle className="h-2.5 w-2.5" /> Ferdig
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-warning/20 bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">
                  <Clock className="h-2.5 w-2.5" /> Pågår
                </span>
              )
            )}
          </div>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{format(new Date(wp.updated_at), "d. MMM yyyy", { locale: nb })}</span>
          {isDocumented && (
            <span className="text-success text-[10px] font-medium flex items-center gap-0.5">
              <FileText className="h-2.5 w-2.5" /> Dokumentert
            </span>
          )}
          {wp.customer_approved_by && wp.customer_approved_at && (
            <span className="text-[10px]">
              {wp.customer_approval_status === "approved" || wp.customer_approval_status === "ready_for_billing"
                ? "Godkjent" : "Behandlet"} av {wp.customer_approved_by}, {format(new Date(wp.customer_approved_at), "d. MMM", { locale: nb })}
            </span>
          )}
        </div>

        {/* Expandable detail */}
        {wp.description && (
          <button
            onClick={() => setExpandedId(isExpanded ? null : wp.id)}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
          >
            {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {isExpanded ? "Skjul detaljer" : "Vis detaljer"}
          </button>
        )}
        {isExpanded && wp.description && (
          <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3 whitespace-pre-wrap">
            {wp.description}
          </div>
        )}

        {/* Approval buttons */}
        {canApprove && (
          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              className="gap-1.5 text-xs rounded-xl flex-1"
              disabled={isApproving}
              onClick={() => setConfirmAction({ id: wp.id, action: "approve" })}
            >
              {isApproving ? <Loader2 className="h-3 w-3 animate-spin" /> : <ThumbsUp className="h-3 w-3" />}
              Godkjenn
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs rounded-xl"
              disabled={isApproving}
              onClick={() => setConfirmAction({ id: wp.id, action: "reject" })}
            >
              <ThumbsDown className="h-3 w-3" /> Avvis
            </Button>
          </div>
        )}
      </div>
    );
  }
}
