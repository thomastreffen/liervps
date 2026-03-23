import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Filter, ClipboardList } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  ORDER_STATUS_CONFIG,
  ORDER_PRIORITY_CONFIG,
  type OrderFormSubmissionStatus,
} from "@/types/order-forms";
import { format } from "date-fns";
import { nb } from "date-fns/locale";

const STATUS_TABS: { key: OrderFormSubmissionStatus | "all"; label: string }[] = [
  { key: "all", label: "Alle" },
  { key: "new", label: "Ny" },
  { key: "missing_info", label: "Mangler info" },
  { key: "ready_for_review", label: "Klar for vurdering" },
  { key: "in_progress", label: "Under behandling" },
  { key: "planned", label: "Planlagt" },
  { key: "converted", label: "Konvertert" },
  { key: "rejected", label: "Avvist" },
  { key: "closed", label: "Lukket" },
];

export default function OrderFormsPage() {
  const navigate = useNavigate();
  const { activeCompanyId } = useCompanyContext();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ["order-form-submissions", activeCompanyId, statusFilter],
    enabled: !!activeCompanyId,
    queryFn: async () => {
      let query = supabase
        .from("order_form_submissions")
        .select("*, order_form_templates(name, slug)")
        .eq("company_id", activeCompanyId!)
        .order("submitted_at", { ascending: false })
        .limit(200);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["order-form-templates-active", activeCompanyId],
    enabled: !!activeCompanyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_form_templates")
        .select("id, name, slug")
        .eq("company_id", activeCompanyId!)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = submissions.filter((s: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.submission_no?.toLowerCase().includes(q) ||
      (s as any).order_form_templates?.name?.toLowerCase().includes(q) ||
      s.summary?.oppdragstittel?.toLowerCase().includes(q) ||
      s.summary?.kundenavn?.toLowerCase().includes(q)
    );
  });

  // Status counts
  const statusCounts: Record<string, number> = {};
  submissions.forEach((s: any) => {
    statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;
  });

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bestillinger</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Oversikt over innsendte bestillinger
          </p>
        </div>
        <div className="flex items-center gap-2">
          {templates.length > 0 && (
            <Button onClick={() => navigate(`/orders/new/${templates[0].slug}`)}>
              <Plus className="h-4 w-4 mr-1" />
              Ny bestilling
            </Button>
          )}
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex flex-wrap gap-1.5">
        {STATUS_TABS.map((tab) => {
          const count = tab.key === "all" ? submissions.length : statusCounts[tab.key] || 0;
          const active = statusFilter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted"
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span className={`ml-1.5 ${active ? "opacity-80" : "opacity-60"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Søk bestillingsnummer, kunde, oppdrag..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Laster...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <ClipboardList className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground font-medium">Ingen bestillinger ennå</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            {templates.length > 0
              ? "Opprett en ny bestilling for å komme i gang"
              : "Opprett en bestillingsmal først under Admin"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((sub: any) => {
            const statusConfig = ORDER_STATUS_CONFIG[sub.status as OrderFormSubmissionStatus];
            const priorityConfig = ORDER_PRIORITY_CONFIG[sub.priority];
            return (
              <Card
                key={sub.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/orders/${sub.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`h-2.5 w-2.5 rounded-full shrink-0 ${statusConfig?.dotClass || "bg-muted"}`}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">
                            {sub.submission_no}
                          </span>
                          <Badge variant="outline" className="text-[10px]">
                            {(sub as any).order_form_templates?.name || "Ukjent mal"}
                          </Badge>
                          {sub.priority !== "normal" && priorityConfig && (
                            <Badge className={`text-[10px] ${priorityConfig.color}`}>
                              {priorityConfig.label}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {sub.summary?.kundenavn && `${sub.summary.kundenavn} · `}
                          {sub.summary?.oppdragstittel || "Ingen tittel"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge className={`text-[10px] ${statusConfig?.color || ""}`}>
                        {statusConfig?.label || sub.status}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {format(new Date(sub.submitted_at), "d. MMM yyyy", { locale: nb })}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
