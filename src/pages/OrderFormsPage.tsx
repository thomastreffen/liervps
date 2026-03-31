import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, ClipboardList, ArrowRight, Trash2, User, Clock, MessageSquare } from "lucide-react";
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
  CHANNEL_LABELS,
  EXTERNAL_STATUS_CONFIG,
  mapToExternalStatus,
  type OrderFormSubmissionStatus,
} from "@/types/order-forms";
import { format, formatDistanceToNow } from "date-fns";
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
  { key: "under_review", label: "Til vurdering" },
  { key: "missing_info", label: "Mangler info" },
  { key: "waiting_customer", label: "Venter kunde" },
  { key: "waiting_internal", label: "Venter internt" },
  { key: "ready_for_planning", label: "Klar for planlegging" },
  { key: "task_created", label: "Oppgave opprettet" },
  { key: "in_progress", label: "Under arbeid" },
  { key: "closed", label: "Lukket" },
  { key: "rejected", label: "Avvist" },
];

export default function OrderFormsPage() {
  const navigate = useNavigate();
  const { activeCompanyId } = useCompanyContext();
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<string>("newest");

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ["order-form-submissions", activeCompanyId, statusFilter],
    enabled: !!activeCompanyId,
    queryFn: async () => {
      let query = supabase
        .from("order_form_submissions")
        .select("*, order_form_templates(name, slug, category)")
        .eq("company_id", activeCompanyId!)
        .is("deleted_at", null)
        .order("submitted_at", { ascending: false })
        .limit(500);
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      const { data, error } = await query;
      if (error) throw error;

      // Resolve assignee names
      const assigneeIds = [...new Set((data || []).map((s: any) => s.assigned_to).filter(Boolean))];
      let assigneeMap = new Map<string, string>();
      if (assigneeIds.length > 0) {
        const { data: accounts } = await supabase
          .from("user_accounts")
          .select("auth_user_id, person:people(full_name)")
          .in("auth_user_id", assigneeIds)
          .eq("is_active", true);
        if (accounts) {
          (accounts as any[]).forEach(a => {
            if (a.person?.full_name) assigneeMap.set(a.auth_user_id, a.person.full_name);
          });
        }
      }

      return (data || []).map((s: any) => ({
        ...s,
        _assignee_name: assigneeMap.get(s.assigned_to) || null,
      }));
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

  const categoryOptions = useMemo(() => {
    const cats = new Set<string>();
    submissions.forEach((s: any) => {
      const cat = s.order_form_templates?.category;
      if (cat) cats.add(cat);
    });
    return Array.from(cats).sort();
  }, [submissions]);

  const filtered = useMemo(() => {
    let result = submissions.filter((s: any) => {
      if (search) {
        const q = search.toLowerCase();
        const match =
          s.submission_no?.toLowerCase().includes(q) ||
          s.order_form_templates?.name?.toLowerCase().includes(q) ||
          s.summary?.oppdragstittel?.toLowerCase().includes(q) ||
          s.summary?.kundenavn?.toLowerCase().includes(q) ||
          (s as any).submitter_name?.toLowerCase().includes(q) ||
          (s as any).submitter_email?.toLowerCase().includes(q);
        if (!match) return false;
      }
      if (categoryFilter !== "all" && s.order_form_templates?.category !== categoryFilter) return false;
      if (priorityFilter !== "all" && s.priority !== priorityFilter) return false;
      if (assigneeFilter === "unassigned" && s.assigned_to) return false;
      if (assigneeFilter === "assigned" && !s.assigned_to) return false;
      return true;
    });

    if (sortBy === "priority") {
      const priorityOrder: Record<string, number> = { critical: 0, high: 1, normal: 2, low: 3 };
      result = [...result].sort((a: any, b: any) =>
        (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2)
      );
    } else if (sortBy === "activity") {
      result = [...result].sort((a: any, b: any) =>
        new Date(b.last_activity_at || b.submitted_at).getTime() - new Date(a.last_activity_at || a.submitted_at).getTime()
      );
    }

    return result;
  }, [submissions, search, categoryFilter, priorityFilter, assigneeFilter, sortBy]);

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

  const statusCounts: Record<string, number> = {};
  submissions.forEach((s: any) => {
    statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;
  });

  const needsActionCount = submissions.filter((s: any) =>
    s.status === "new" || s.status === "missing_info" || s.status === "waiting_customer"
  ).length;

  return (
    <div className="space-y-5 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bestillinger</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {submissions.length} bestillinger
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
          if (tab.key !== "all" && count === 0) return null;
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
                <span className={`ml-1.5 ${active ? "opacity-80" : "opacity-60"}`}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Søk bestilling, kunde, innsender..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {categoryOptions.length > 0 && (
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Kategori" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle kategorier</SelectItem>
              {categoryOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Prioritet" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle prioriteter</SelectItem>
            <SelectItem value="critical">Kritisk</SelectItem>
            <SelectItem value="high">Høy</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="low">Lav</SelectItem>
          </SelectContent>
        </Select>
        <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Ansvarlig" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle</SelectItem>
            <SelectItem value="unassigned">Uten ansvarlig</SelectItem>
            <SelectItem value="assigned">Med ansvarlig</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Sortering" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Nyeste først</SelectItem>
            <SelectItem value="priority">Hastegrad</SelectItem>
            <SelectItem value="activity">Siste aktivitet</SelectItem>
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
        <div className="space-y-1.5">
          {filtered.map((sub: any) => {
            const sc = ORDER_STATUS_CONFIG[sub.status as OrderFormSubmissionStatus];
            const qs = (sub.quality_score || "green") as QualityLevel;
            const isWaiting = ["missing_info", "waiting_customer"].includes(sub.status);
            const isNew = sub.status === "new";
            const externalStatus = mapToExternalStatus(sub.status as OrderFormSubmissionStatus);
            const externalConfig = EXTERNAL_STATUS_CONFIG[externalStatus];

            // Build human-readable subtitle
            const name = sub.submitter_name || sub.summary?.kundenavn || sub.summary?.bestiller_navn;
            const oppdrag = sub.summary?.oppdragstittel;
            const sted = sub.summary?.oppdragssted;
            const subtitle = [name, oppdrag, sted].filter(Boolean).join(" · ") || sub.order_form_templates?.name || "–";

            return (
              <Card
                key={sub.id}
                className={`hover:shadow-md transition-shadow cursor-pointer group ${isNew ? "border-l-4 border-l-blue-500" : isWaiting ? "border-l-4 border-l-amber-400" : ""}`}
                onClick={() => navigate(`/orders/${sub.id}`)}
              >
                <CardContent className="p-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <QualityDot score={qs} />
                      <div className="min-w-0 flex-1">
                        {/* Primary line: ref + template */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-foreground">
                            {sub.submission_no}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {sub.order_form_templates?.name || "Ukjent"}
                          </span>
                          {sub.priority !== "normal" && (
                            <Badge variant="outline" className="text-[10px] font-semibold border-orange-200 text-orange-700 bg-orange-50">
                              {ORDER_PRIORITY_CONFIG[sub.priority]?.label || sub.priority}
                            </Badge>
                          )}
                        </div>
                        {/* Secondary line: human summary */}
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {subtitle}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Waiting indicator */}
                      {isWaiting && (
                        <span className="text-[10px] text-amber-600 flex items-center gap-0.5">
                          <Clock className="h-3 w-3" />
                          Venter svar
                        </span>
                      )}
                      {sub._assignee_name && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <User className="h-3 w-3" />
                          {sub._assignee_name}
                        </span>
                      )}
                      {sub.assigned_to && !sub._assignee_name && (
                        <User className="h-3 w-3 text-muted-foreground" />
                      )}
                      {sub.converted_to_type && (
                        <ArrowRight className="h-3 w-3 text-green-500" />
                      )}
                      {/* Status badge */}
                      <Badge className={`text-[10px] ${sc?.color || ""}`}>
                        {sc?.label || sub.status}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                        {format(new Date(sub.submitted_at), "d. MMM", { locale: nb })}
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
