import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, ClipboardList, AlertTriangle, Mail, MailX, ArrowRight, Download, Trash2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
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
import { QualityDot } from "@/components/orders/QualityBadge";
import type { QualityLevel } from "@/lib/order-quality";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [qualityFilter, setQualityFilter] = useState<string>("all");
  const [extraFilter, setExtraFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<string>("newest");

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ["order-form-submissions", activeCompanyId, statusFilter],
    enabled: !!activeCompanyId,
    queryFn: async () => {
      let query = supabase
        .from("order_form_submissions")
        .select("*, order_form_templates(name, slug)")
        .eq("company_id", activeCompanyId!)
        .is("deleted_at", null)
        .order("submitted_at", { ascending: false })
        .limit(500);

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

  const filtered = useMemo(() => {
    let result = submissions.filter((s: any) => {
      if (search) {
        const q = search.toLowerCase();
        const match =
          s.submission_no?.toLowerCase().includes(q) ||
          (s as any).order_form_templates?.name?.toLowerCase().includes(q) ||
          s.summary?.oppdragstittel?.toLowerCase().includes(q) ||
          s.summary?.kundenavn?.toLowerCase().includes(q);
        if (!match) return false;
      }
      if (qualityFilter !== "all" && s.quality_score !== qualityFilter) return false;
      
      // Extra filters
      if (extraFilter === "not_notified" && s.notification_sent_at) return false;
      if (extraFilter === "not_converted" && s.converted_to_type) return false;
      if (extraFilter === "exported" && !s.converted_to_type) {
        // check activity log - simplified: show those already converted
        return false;
      }
      if (extraFilter === "needs_action") {
        const isNew = s.status === "new";
        const isMissing = s.status === "missing_info";
        const isRed = s.quality_score === "red";
        if (!isNew && !isMissing && !isRed) return false;
      }
      
      return true;
    });

    if (sortBy === "priority") {
      const priorityOrder: Record<string, number> = { critical: 0, high: 1, normal: 2, low: 3 };
      result = [...result].sort((a: any, b: any) =>
        (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2)
      );
    } else if (sortBy === "quality") {
      const qualityOrder: Record<string, number> = { red: 0, yellow: 1, green: 2 };
      result = [...result].sort((a: any, b: any) =>
        (qualityOrder[a.quality_score] ?? 2) - (qualityOrder[b.quality_score] ?? 2)
      );
    }

    return result;
  }, [submissions, search, qualityFilter, sortBy, extraFilter]);

  // Soft delete handler
  const handleSoftDelete = async (e: React.MouseEvent, sub: any) => {
    e.stopPropagation();
    if (!confirm(`Flytte ${sub.submission_no} til papirkurven?`)) return;
    setDeletingId(sub.id);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("order_form_submissions").update({
      deleted_at: new Date().toISOString(),
      deleted_by: user?.id,
    } as any).eq("id", sub.id);
    queryClient.invalidateQueries({ queryKey: ["order-form-submissions"] });
    setDeletingId(null);
  };

  // Status counts
  const statusCounts: Record<string, number> = {};
  submissions.forEach((s: any) => {
    statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;
  });

  // Needs action count
  const needsActionCount = submissions.filter((s: any) =>
    s.status === "new" || s.status === "missing_info" || s.quality_score === "red"
  ).length;

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bestillinger</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {submissions.length} bestillinger totalt
            {needsActionCount > 0 && (
              <span className="text-amber-600 font-medium"> · {needsActionCount} krever handling</span>
            )}
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

      {/* Filters row */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Søk bestillingsnummer, kunde, oppdrag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={qualityFilter} onValueChange={setQualityFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Kvalitet" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle kvaliteter</SelectItem>
            <SelectItem value="red">🔴 Utilstrekkelig</SelectItem>
            <SelectItem value="yellow">🟡 Noe mangler</SelectItem>
            <SelectItem value="green">🟢 Komplett</SelectItem>
          </SelectContent>
        </Select>
        <Select value={extraFilter} onValueChange={setExtraFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Vis" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle</SelectItem>
            <SelectItem value="needs_action">Krever handling</SelectItem>
            <SelectItem value="not_notified">Ikke varslet</SelectItem>
            <SelectItem value="not_converted">Ikke konvertert</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Sortering" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Nyeste først</SelectItem>
            <SelectItem value="priority">Hastegrad</SelectItem>
            <SelectItem value="quality">Kvalitet</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Laster...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <ClipboardList className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground font-medium">Ingen bestillinger funnet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((sub: any) => {
            const statusConfig = ORDER_STATUS_CONFIG[sub.status as OrderFormSubmissionStatus];
            const priorityConfig = ORDER_PRIORITY_CONFIG[sub.priority];
            const qs = (sub.quality_score || "green") as QualityLevel;
            return (
              <Card
                key={sub.id}
                className="hover:shadow-md transition-shadow cursor-pointer group"
                onClick={() => navigate(`/orders/${sub.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <QualityDot score={qs} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
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
                          {sub.requester_type === "internal" && (
                            <Badge variant="outline" className="text-[10px]">Intern</Badge>
                          )}
                          {sub.status === "missing_info" && (
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {sub.summary?.kundenavn && `${sub.summary.kundenavn} · `}
                          {sub.summary?.oppdragstittel || "Ingen tittel"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Status indicators */}
                      {sub.notification_sent_at && (
                        <Mail className="h-3.5 w-3.5 text-green-500" />
                      )}
                      {sub.notification_error && !sub.notification_sent_at && (
                        <MailX className="h-3.5 w-3.5 text-red-500" />
                      )}
                      {sub.converted_to_type && (
                        <ArrowRight className="h-3.5 w-3.5 text-green-500" />
                      )}
                      <Badge className={`text-[10px] ${statusConfig?.color || ""}`}>
                        {statusConfig?.label || sub.status}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {format(new Date(sub.submitted_at), "d. MMM yyyy", { locale: nb })}
                      </span>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => handleSoftDelete(e, sub)}
                          disabled={deletingId === sub.id}
                          title="Flytt til papirkurv"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
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
