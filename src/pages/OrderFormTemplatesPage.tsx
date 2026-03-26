import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { useAuth } from "@/hooks/useAuth";
import { Plus, FileText, MoreHorizontal, Pencil, Tag, Settings2, Eye, EyeOff, Globe, Lock, Link as LinkIcon, Trash2, ArchiveRestore } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { CategoryManager } from "@/components/orders/admin/CategoryManager";
import { CatalogSettingsDialog } from "@/components/orders/admin/CatalogSettingsDialog";

export default function OrderFormTemplatesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { activeCompanyId } = useCompanyContext();
  const { user } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [catManagerOpen, setCatManagerOpen] = useState(false);
  const [catalogSettingsOpen, setCatalogSettingsOpen] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: "",
    slug: "",
    description: "",
    audience_type: "both",
    category_id: "",
    default_status: "new",
    default_priority: "normal",
    default_handling_rule: "queue",
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["order-form-categories", activeCompanyId],
    enabled: !!activeCompanyId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("order_form_categories")
        .select("*")
        .eq("company_id", activeCompanyId!)
        .order("sort_order");
      return data || [];
    },
  });

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["order-form-templates", activeCompanyId],
    enabled: !!activeCompanyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_form_templates")
        .select("*")
        .eq("company_id", activeCompanyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const slug = newTemplate.slug || newTemplate.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const catName = categories.find((c: any) => c.id === newTemplate.category_id)?.name || null;
      const { data, error } = await supabase
        .from("order_form_templates")
        .insert({
          company_id: activeCompanyId!,
          name: newTemplate.name,
          slug,
          description: newTemplate.description || null,
          audience_type: newTemplate.audience_type,
          category: catName,
          category_id: newTemplate.category_id || null,
          default_status: newTemplate.default_status,
          default_priority: newTemplate.default_priority,
          default_handling_rule: newTemplate.default_handling_rule,
          created_by: user?.id,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["order-form-templates"] });
      setCreateOpen(false);
      setNewTemplate({ name: "", slug: "", description: "", audience_type: "both", category_id: "", default_status: "new", default_priority: "normal", default_handling_rule: "queue" });
      toast.success("Mal opprettet");
      navigate(`/admin/order-forms/${data.id}`);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("order_form_templates")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order-form-templates"] });
      toast.success("Status oppdatert");
    },
  });

  const toggleCatalog = useMutation({
    mutationFn: async ({ id, show_in_catalog }: { id: string; show_in_catalog: boolean }) => {
      const { error } = await supabase
        .from("order_form_templates")
        .update({ show_in_catalog })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order-form-templates"] });
      toast.success("Synlighet oppdatert");
    },
  });

  // Compute visibility status for each template
  const getVisibilityInfo = (tmpl: any) => {
    const cat = categories.find((c: any) => c.id === tmpl.category_id);
    const issues: string[] = [];

    if (!tmpl.is_active) issues.push("Inaktiv");
    if (!tmpl.show_in_catalog) issues.push("Kun direkte lenke");
    if (!tmpl.category_id) issues.push("Mangler kategori");
    if (cat && !cat.is_active) issues.push("Kategori inaktiv");
    if (cat && !cat.show_in_catalog) issues.push("Kategori skjult");

    const visible = tmpl.is_active && tmpl.show_in_catalog && tmpl.category_id && cat?.is_active && cat?.show_in_catalog;
    return { visible, issues, cat };
  };

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bestillingsskjema-maler</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Opprett og administrer bestillingsskjema og kategorier
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCatalogSettingsOpen(true)}>
            <Settings2 className="h-4 w-4 mr-1" />
            Portalinnstillinger
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCatManagerOpen(true)}>
            <Tag className="h-4 w-4 mr-1" />
            Kategorier
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Ny mal
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Laster...</div>
      ) : templates.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground font-medium">Ingen maler opprettet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Opprett din første bestillingsmal for å komme i gang
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map((tmpl: any) => {
            const vis = getVisibilityInfo(tmpl);
            return (
              <Card key={tmpl.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex items-center justify-between">
                  <div
                    className="flex items-center gap-3 min-w-0 cursor-pointer flex-1"
                    onClick={() => navigate(`/admin/order-forms/${tmpl.id}`)}
                  >
                    <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold">{tmpl.name}</span>
                        {/* Active/inactive */}
                        <Badge variant={tmpl.is_active ? "default" : "secondary"} className="text-[10px]">
                          {tmpl.is_active ? "Aktiv" : "Inaktiv"}
                        </Badge>
                        {/* Category */}
                        {vis.cat ? (
                          <Badge variant="outline" className="text-[10px] gap-1">
                            <Tag className="h-2.5 w-2.5" />
                            {vis.cat.name}
                            {!vis.cat.is_active && <span className="text-destructive ml-0.5">●</span>}
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px]">Ingen kategori</Badge>
                        )}
                        {/* Audience */}
                        <Badge variant="outline" className="text-[10px]">
                          {tmpl.audience_type === "internal" ? "Intern" : tmpl.audience_type === "external" ? "Ekstern" : "Begge"}
                        </Badge>
                        {/* Catalog visibility */}
                        {vis.visible ? (
                          <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200 gap-1">
                            <Globe className="h-2.5 w-2.5" />
                            Synlig på /bestilling
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 gap-1">
                            {tmpl.show_in_catalog ? <EyeOff className="h-2.5 w-2.5" /> : <LinkIcon className="h-2.5 w-2.5" />}
                            {vis.issues[0] || "Skjult"}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {tmpl.description || `/${tmpl.slug}`}
                        {!tmpl.requires_login && " · Åpent uten innlogging"}
                      </p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => navigate(`/admin/order-forms/${tmpl.id}`)}>
                        <Pencil className="h-3.5 w-3.5 mr-2" />
                        Rediger
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggleActive.mutate({ id: tmpl.id, is_active: !tmpl.is_active })}>
                        {tmpl.is_active ? "Deaktiver" : "Aktiver"}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => toggleCatalog.mutate({ id: tmpl.id, show_in_catalog: !tmpl.show_in_catalog })}>
                        {tmpl.show_in_catalog ? (
                          <><EyeOff className="h-3.5 w-3.5 mr-2" /> Skjul fra katalog</>
                        ) : (
                          <><Eye className="h-3.5 w-3.5 mr-2" /> Vis i katalog</>
                        )}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ny bestillingsmal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Navn *</Label>
              <Input
                value={newTemplate.name}
                onChange={(e) => setNewTemplate((p) => ({ ...p, name: e.target.value }))}
                placeholder="F.eks. Bestill service"
              />
            </div>
            <div>
              <Label>Slug</Label>
              <Input
                value={newTemplate.slug}
                onChange={(e) => setNewTemplate((p) => ({ ...p, slug: e.target.value }))}
                placeholder="bestill-service (genereres automatisk)"
              />
            </div>
            <div>
              <Label>Kategori *</Label>
              <Select
                value={newTemplate.category_id}
                onValueChange={(v) => setNewTemplate((p) => ({ ...p, category_id: v }))}
              >
                <SelectTrigger><SelectValue placeholder="Velg kategori" /></SelectTrigger>
                <SelectContent>
                  {categories.filter((c: any) => c.is_active).map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {categories.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">Opprett en kategori først via Kategorier-knappen</p>
              )}
            </div>
            <div>
              <Label>Beskrivelse</Label>
              <Textarea
                value={newTemplate.description}
                onChange={(e) => setNewTemplate((p) => ({ ...p, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Målgruppe</Label>
                <Select
                  value={newTemplate.audience_type}
                  onValueChange={(v) => setNewTemplate((p) => ({ ...p, audience_type: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internal">Intern</SelectItem>
                    <SelectItem value="external">Ekstern</SelectItem>
                    <SelectItem value="both">Begge</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Standard prioritet</Label>
                <Select
                  value={newTemplate.default_priority}
                  onValueChange={(v) => setNewTemplate((p) => ({ ...p, default_priority: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">Kritisk</SelectItem>
                    <SelectItem value="high">Høy</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="low">Lav</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Håndteringsregel ved innsending</Label>
              <Select
                value={newTemplate.default_handling_rule}
                onValueChange={(v) => setNewTemplate((p) => ({ ...p, default_handling_rule: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="queue">Legg i kø</SelectItem>
                  <SelectItem value="create_case">Opprett sak automatisk</SelectItem>
                  <SelectItem value="create_task">Opprett oppgave automatisk</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Avbryt</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!newTemplate.name || !newTemplate.category_id}
            >
              Opprett
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CategoryManager
        open={catManagerOpen}
        onOpenChange={setCatManagerOpen}
        companyId={activeCompanyId}
      />
      <CatalogSettingsDialog
        open={catalogSettingsOpen}
        onOpenChange={setCatalogSettingsOpen}
        companyId={activeCompanyId}
      />
    </div>
  );
}
