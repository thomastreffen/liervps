import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { useAuth } from "@/hooks/useAuth";
import { Plus, FileText, MoreHorizontal, Copy, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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

export default function OrderFormTemplatesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { activeCompanyId } = useCompanyContext();
  const { user } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: "",
    slug: "",
    description: "",
    audience_type: "both",
    category: "",
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
      const { data, error } = await supabase
        .from("order_form_templates")
        .insert({
          company_id: activeCompanyId!,
          name: newTemplate.name,
          slug,
          description: newTemplate.description || null,
          audience_type: newTemplate.audience_type,
          category: newTemplate.category || null,
          created_by: user?.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["order-form-templates"] });
      setCreateOpen(false);
      setNewTemplate({ name: "", slug: "", description: "", audience_type: "both", category: "" });
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

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bestillingsskjema-maler</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Opprett og administrer bestillingsskjema
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Ny mal
        </Button>
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
          {templates.map((tmpl: any) => (
            <Card key={tmpl.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex items-center justify-between">
                <div
                  className="flex items-center gap-3 min-w-0 cursor-pointer flex-1"
                  onClick={() => navigate(`/admin/order-forms/${tmpl.id}`)}
                >
                  <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{tmpl.name}</span>
                      <Badge variant={tmpl.is_active ? "default" : "secondary"} className="text-[10px]">
                        {tmpl.is_active ? "Aktiv" : "Inaktiv"}
                      </Badge>
                      {tmpl.category && (
                        <Badge variant="outline" className="text-[10px]">{tmpl.category}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {tmpl.description || `/${tmpl.slug}`}
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
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardContent>
            </Card>
          ))}
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
              <Label>Beskrivelse</Label>
              <Textarea
                value={newTemplate.description}
                onChange={(e) => setNewTemplate((p) => ({ ...p, description: e.target.value }))}
              />
            </div>
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
              <Label>Kategori</Label>
              <Input
                value={newTemplate.category}
                onChange={(e) => setNewTemplate((p) => ({ ...p, category: e.target.value }))}
                placeholder="Service, Reklamasjon..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Avbryt</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!newTemplate.name}>
              Opprett
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
