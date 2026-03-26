import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, GripVertical, Pencil, Eye, EyeOff, Check, X, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string | null;
}

export function CategoryManager({ open, onOpenChange, companyId }: Props) {
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleteAction, setDeleteAction] = useState<string>("uncategorize");
  const [moveToId, setMoveToId] = useState<string>("");

  const { data: categories = [] } = useQuery({
    queryKey: ["order-form-categories", companyId],
    enabled: !!companyId && open,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("order_form_categories")
        .select("*")
        .eq("company_id", companyId!)
        .order("sort_order");
      return data || [];
    },
  });

  // Count templates per category
  const { data: templateCounts = {} } = useQuery({
    queryKey: ["category-template-counts", companyId],
    enabled: !!companyId && open,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("order_form_templates")
        .select("category_id")
        .eq("company_id", companyId!);
      const counts: Record<string, number> = {};
      (data || []).forEach((t: any) => {
        if (t.category_id) counts[t.category_id] = (counts[t.category_id] || 0) + 1;
      });
      return counts;
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const slug = newName.toLowerCase().replace(/[^a-z0-9æøå]+/g, "-").replace(/(^-|-$)/g, "");
      const { error } = await (supabase as any)
        .from("order_form_categories")
        .insert({
          company_id: companyId!,
          name: newName,
          slug,
          sort_order: categories.length,
          show_in_catalog: true,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order-form-categories"] });
      setNewName("");
      toast.success("Kategori opprettet");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, any> }) => {
      const { error } = await (supabase as any)
        .from("order_form_categories")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order-form-categories"] });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async ({ id, direction }: { id: string; direction: "up" | "down" }) => {
      const idx = categories.findIndex((c: any) => c.id === id);
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= categories.length) return;
      const cat = categories[idx];
      const swap = categories[swapIdx];
      await Promise.all([
        (supabase as any).from("order_form_categories").update({ sort_order: swap.sort_order }).eq("id", cat.id),
        (supabase as any).from("order_form_categories").update({ sort_order: cat.sort_order }).eq("id", swap.id),
      ]);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["order-form-categories"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deleteTarget) return;
      const catId = deleteTarget.id;
      const count = (templateCounts as any)[catId] || 0;

      if (count > 0) {
        if (deleteAction === "move" && moveToId) {
          const moveCatName = categories.find((c: any) => c.id === moveToId)?.name || null;
          await (supabase as any)
            .from("order_form_templates")
            .update({ category_id: moveToId, category: moveCatName })
            .eq("category_id", catId);
        } else {
          // uncategorize
          await (supabase as any)
            .from("order_form_templates")
            .update({ category_id: null, category: null })
            .eq("category_id", catId);
        }
      }

      const { error } = await (supabase as any)
        .from("order_form_categories")
        .delete()
        .eq("id", catId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order-form-categories"] });
      qc.invalidateQueries({ queryKey: ["order-form-templates"] });
      setDeleteTarget(null);
      toast.success("Kategori slettet");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const startEdit = (cat: any) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditDesc(cat.description || "");
  };

  const saveEdit = () => {
    if (!editingId || !editName.trim()) return;
    updateMutation.mutate({
      id: editingId,
      updates: { name: editName.trim(), description: editDesc.trim() || null },
    });
    // Also update the category name on any linked templates
    (supabase as any)
      .from("order_form_templates")
      .update({ category: editName.trim() })
      .eq("category_id", editingId)
      .then(() => qc.invalidateQueries({ queryKey: ["order-form-templates"] }));
    setEditingId(null);
    toast.success("Kategori oppdatert");
  };

  const templateCount = (id: string) => (templateCounts as any)[id] || 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Kategorier</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {categories.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Ingen kategorier opprettet ennå
              </p>
            ) : (
              <div className="space-y-1.5">
                {categories.map((cat: any, idx: number) => (
                  <div key={cat.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/40 group">
                    {/* Sort arrows */}
                    <div className="flex flex-col shrink-0">
                      <button
                        className="h-3.5 text-muted-foreground/50 hover:text-foreground disabled:opacity-20"
                        disabled={idx === 0}
                        onClick={() => reorderMutation.mutate({ id: cat.id, direction: "up" })}
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="h-3.5 text-muted-foreground/50 hover:text-foreground disabled:opacity-20"
                        disabled={idx === categories.length - 1}
                        onClick={() => reorderMutation.mutate({ id: cat.id, direction: "down" })}
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {editingId === cat.id ? (
                      <div className="flex-1 space-y-1.5">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-8 text-sm"
                          autoFocus
                        />
                        <Input
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          placeholder="Beskrivelse (valgfritt)"
                          className="h-8 text-sm"
                        />
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-7" onClick={saveEdit}>
                            <Check className="h-3.5 w-3.5 mr-1" /> Lagre
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditingId(null)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{cat.name}</span>
                            <Badge variant="outline" className="text-[9px]">
                              {templateCount(cat.id)} skjema
                            </Badge>
                            {!cat.is_active && (
                              <Badge variant="secondary" className="text-[9px]">Inaktiv</Badge>
                            )}
                            {!cat.show_in_catalog && (
                              <Badge variant="secondary" className="text-[9px]">Skjult</Badge>
                            )}
                          </div>
                          {cat.description && (
                            <p className="text-[11px] text-muted-foreground truncate">{cat.description}</p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7"
                            onClick={() => updateMutation.mutate({
                              id: cat.id,
                              updates: { show_in_catalog: !cat.show_in_catalog },
                            })}
                            title={cat.show_in_catalog ? "Skjul i katalog" : "Vis i katalog"}
                          >
                            {cat.show_in_catalog ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7"
                            onClick={() => updateMutation.mutate({
                              id: cat.id,
                              updates: { is_active: !cat.is_active },
                            })}
                            title={cat.is_active ? "Deaktiver" : "Aktiver"}
                          >
                            <div className={`h-2.5 w-2.5 rounded-full ${cat.is_active ? "bg-green-500" : "bg-muted-foreground/30"}`} />
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7"
                            onClick={() => startEdit(cat)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => {
                              setDeleteTarget(cat);
                              setDeleteAction("uncategorize");
                              setMoveToId("");
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                placeholder="Ny kategori..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && newName && addMutation.mutate()}
              />
              <Button
                size="sm"
                disabled={!newName}
                onClick={() => addMutation.mutate()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Safe delete dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slett kategori «{deleteTarget?.name}»?</AlertDialogTitle>
            <AlertDialogDescription>
              {templateCount(deleteTarget?.id) > 0 ? (
                <>
                  Denne kategorien har {templateCount(deleteTarget?.id)} skjema knyttet til seg.
                  Velg hva som skal skje med dem:
                </>
              ) : (
                "Kategorien har ingen skjema og kan slettes trygt."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {templateCount(deleteTarget?.id) > 0 && (
            <div className="space-y-3 py-2">
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  id="uncategorize"
                  checked={deleteAction === "uncategorize"}
                  onChange={() => setDeleteAction("uncategorize")}
                />
                <label htmlFor="uncategorize" className="text-sm">Fjern kategori fra skjemaene (ukategorisert)</label>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  id="move"
                  checked={deleteAction === "move"}
                  onChange={() => setDeleteAction("move")}
                />
                <label htmlFor="move" className="text-sm">Flytt til annen kategori:</label>
              </div>
              {deleteAction === "move" && (
                <Select value={moveToId} onValueChange={setMoveToId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Velg kategori" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories
                      .filter((c: any) => c.id !== deleteTarget?.id)
                      .map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              disabled={deleteAction === "move" && !moveToId}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Slett kategori
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
