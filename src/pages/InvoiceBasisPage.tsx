import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  FileText, CheckCircle, Clock, Users, AlertTriangle,
  Send, Receipt, ArrowRight, Loader2, Filter, ClipboardCheck, Package
} from "lucide-react";
import { WP_TYPE_CONFIG, type WorkPackageType } from "@/lib/work-package-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { toast } from "sonner";
import { checkRequiredForms } from "@/components/forms/ProjectFormsSection";

interface InvoiceBasisRow {
  id: string;
  project_id: string;
  service_journal_id: string | null;
  customer_name: string;
  approved_at: string;
  approved_by_name: string | null;
  approved_version: number | null;
  total_hours: number;
  technician_names: string[];
  technician_count: number;
  report_count: number;
  deviation_count: number;
  deviation_notes: string | null;
  status: string;
  sent_to_billing_at: string | null;
  notes: string | null;
  created_at: string;
  // joined
  project_title?: string;
  project_address?: string;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  ready: { label: "Klar for fakturering", variant: "default" },
  sent_to_billing: { label: "Sendt til økonomi", variant: "secondary" },
  billed: { label: "Fakturert", variant: "outline" },
  disputed: { label: "Tvist", variant: "destructive" },
};

export default function InvoiceBasisPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<InvoiceBasisRow[]>([]);
  const [wpRows, setWpRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [missingBillingForms, setMissingBillingForms] = useState<Record<string, string[]>>({});

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("invoice_basis")
        .select("*")
        .order("approved_at", { ascending: false });

      if (data && data.length > 0) {
        // Fetch project titles
        const projectIds = [...new Set(data.map((r: any) => r.project_id))];
        const { data: projects } = await supabase
          .from("events")
          .select("id, title, address")
          .in("id", projectIds);

        const projMap = new Map((projects || []).map((p: any) => [p.id, p]));

        const enriched = data.map((r: any) => ({
          ...r,
          project_title: projMap.get(r.project_id)?.title || "Ukjent oppdrag",
          project_address: projMap.get(r.project_id)?.address,
        }));

        setRows(enriched);

        // Check billing form requirements per project
        const billingChecks: Record<string, string[]> = {};
        await Promise.all(
          projectIds.map(async (pid: string) => {
            const { canComplete, missingForms } = await checkRequiredForms(pid, "required_before_billing");
            if (!canComplete) billingChecks[pid] = missingForms;
          })
        );
        setMissingBillingForms(billingChecks);
      }
      setLoading(false);

      // Fetch approved work packages for billing
      const { data: wpData } = await (supabase as any)
        .from("events")
        .select("id, title, work_package_type, customer_approval_status, customer_approved_by, customer_approved_at, parent_project_id, status")
        .in("customer_approval_status", ["approved", "ready_for_billing"])
        .not("work_package_type", "is", null)
        .is("deleted_at", null)
        .order("customer_approved_at", { ascending: false });

      if (wpData && wpData.length > 0) {
        const wpProjectIds = [...new Set(wpData.map((w: any) => w.parent_project_id))];
        const { data: wpProjects } = await supabase.from("events").select("id, title, customer, address").in("id", wpProjectIds);
        const wpProjMap = new Map((wpProjects || []).map((p: any) => [p.id, p]));
        setWpRows(wpData.map((w: any) => ({ ...w, project: wpProjMap.get(w.parent_project_id) })));
      }
    };
    load();
  }, []);

  const markAsSent = async (id: string) => {
    const row = rows.find((r) => r.id === id);
    if (!row) return;

    // Check required-before-billing forms
    const { canComplete, missingForms } = await checkRequiredForms(row.project_id, "required_before_billing");
    if (!canComplete) {
      toast.error("Obligatoriske skjema mangler", {
        description: `Fullfør: ${missingForms.join(", ")}`,
        duration: 5000,
      });
      return;
    }

    setUpdating(id);
    const { error } = await supabase
      .from("invoice_basis")
      .update({
        status: "sent_to_billing",
        sent_to_billing_at: new Date().toISOString(),
        sent_to_billing_by: user?.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      toast.error("Kunne ikke oppdatere status");
    } else {
      toast.success("Markert som sendt til økonomi");
      setRows((prev) =>
        prev.map((r) =>
          r.id === id
            ? { ...r, status: "sent_to_billing", sent_to_billing_at: new Date().toISOString() }
            : r
        )
      );

      // Log activity
      const row = rows.find((r) => r.id === id);
      if (row) {
        await supabase.from("activity_log").insert({
          entity_type: "project",
          entity_id: row.project_id,
          action: "billing_status_changed",
          description: `Fakturagrunnlag sendt til økonomi`,
          type: "system",
          visibility: "internal",
          performed_by: user?.id,
          metadata: { invoice_basis_id: id, new_status: "sent_to_billing" },
        });
      }
    }
    setUpdating(null);
  };

  const ready = rows.filter((r) => r.status === "ready");
  const sent = rows.filter((r) => r.status === "sent_to_billing");
  const billed = rows.filter((r) => r.status === "billed");

  const renderRow = (row: InvoiceBasisRow) => (
    <Card key={row.id} className="transition-all hover:shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-card-foreground truncate">{row.project_title}</p>
            {row.project_address && (
              <p className="text-xs text-muted-foreground truncate">{row.project_address}</p>
            )}
          </div>
          <Badge variant={statusConfig[row.status]?.variant || "secondary"} className="text-[10px] shrink-0">
            {statusConfig[row.status]?.label || row.status}
          </Badge>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-3">
          <div>
            <p className="text-muted-foreground">Kunde</p>
            <p className="font-medium text-card-foreground">{row.customer_name}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Godkjent</p>
            <p className="font-medium text-card-foreground">
              {format(new Date(row.approved_at), "d. MMM yyyy", { locale: nb })}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Timer</p>
            <p className="font-medium text-card-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" /> {row.total_hours.toFixed(1)}t
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Montører</p>
            <p className="font-medium text-card-foreground flex items-center gap-1">
              <Users className="h-3 w-3" /> {row.technician_count}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs mb-3">
          <span className="flex items-center gap-1 text-muted-foreground">
            <FileText className="h-3 w-3" /> {row.report_count} rapport{row.report_count !== 1 ? "er" : ""}
          </span>
          {row.deviation_count > 0 && (
            <span className="flex items-center gap-1 text-warning">
              <AlertTriangle className="h-3 w-3" /> {row.deviation_count} avvik
            </span>
          )}
          {row.approved_by_name && (
            <span className="text-muted-foreground">
              Godkjent av: {row.approved_by_name}
            </span>
          )}
          {row.approved_version && (
            <span className="text-muted-foreground">
              v{row.approved_version}
            </span>
          )}
        </div>

        {row.technician_names.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {row.technician_names.map((name, i) => (
              <Badge key={i} variant="secondary" className="text-[10px]">{name}</Badge>
            ))}
          </div>
        )}

        {/* Missing billing forms warning */}
        {missingBillingForms[row.project_id] && (
          <div className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/5 p-2.5 mb-3 text-xs text-warning">
            <ClipboardCheck className="h-3.5 w-3.5 shrink-0" />
            <span>Obligatoriske skjema mangler: {missingBillingForms[row.project_id].join(", ")}</span>
          </div>
        )}

        {row.status === "ready" && (
          <div className="flex gap-2 pt-2 border-t">
            <Button
              size="sm"
              variant="default"
              className="gap-1.5 text-xs"
              disabled={updating === row.id}
              onClick={() => markAsSent(row.id)}
            >
              {updating === row.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Send til økonomi
            </Button>
          </div>
        )}

        {row.sent_to_billing_at && (
          <p className="text-[10px] text-muted-foreground/70 pt-2 border-t">
            Sendt til økonomi: {format(new Date(row.sent_to_billing_at), "d. MMM yyyy 'kl.' HH:mm", { locale: nb })}
          </p>
        )}
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Fakturagrunnlag</h1>
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-40 rounded-2xl bg-muted" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Fakturagrunnlag</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Kundegodkjente oppdrag klare for fakturering
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2">
            <Receipt className="h-4 w-4 text-primary" />
            <div className="text-right">
              <p className="text-lg font-bold text-card-foreground">{ready.length}</p>
              <p className="text-[10px] text-muted-foreground">Klare</p>
            </div>
          </div>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid gap-4 grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <CheckCircle className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xl font-bold text-card-foreground">{ready.length}</p>
              <p className="text-[11px] text-muted-foreground">Klar for fakturering</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-info/10">
              <Send className="h-5 w-5 text-info" />
            </div>
            <div>
              <p className="text-xl font-bold text-card-foreground">{sent.length}</p>
              <p className="text-[11px] text-muted-foreground">Sendt til økonomi</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success/10">
              <Receipt className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-xl font-bold text-card-foreground">{billed.length}</p>
              <p className="text-[11px] text-muted-foreground">Fakturert</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="ready">
        <TabsList>
          <TabsTrigger value="ready">Klare ({ready.length})</TabsTrigger>
          <TabsTrigger value="sent">Sendt ({sent.length})</TabsTrigger>
          <TabsTrigger value="billed">Fakturert ({billed.length})</TabsTrigger>
          <TabsTrigger value="all">Alle ({rows.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="ready" className="mt-4 space-y-3">
          {ready.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12">
              <CheckCircle className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Ingen oppdrag klare for fakturering.</p>
              <p className="text-xs text-muted-foreground/70">Grunnlag opprettes automatisk ved kundegodkjenning.</p>
            </div>
          ) : ready.map(renderRow)}
        </TabsContent>
        <TabsContent value="sent" className="mt-4 space-y-3">
          {sent.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12">
              <Send className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Ingen sendt til økonomi ennå.</p>
            </div>
          ) : sent.map(renderRow)}
        </TabsContent>
        <TabsContent value="billed" className="mt-4 space-y-3">
          {billed.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12">
              <Receipt className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Ingen fakturerte oppdrag ennå.</p>
            </div>
          ) : billed.map(renderRow)}
        </TabsContent>
        <TabsContent value="all" className="mt-4 space-y-3">
          {rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12">
              <Receipt className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Ingen fakturagrunnlag ennå.</p>
            </div>
          ) : rows.map(renderRow)}
        </TabsContent>
      </Tabs>
    </div>
  );
}
