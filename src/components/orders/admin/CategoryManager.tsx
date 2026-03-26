import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string | null;
}

export function CategoryManager({ open, onOpenChange, companyId }: Props) {
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");

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

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("order_form_categories")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order-form-categories"] });
      toast.success("Kategori slettet");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
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
              {categories.map((cat: any) => (
                <div key={cat.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/40">
                  <GripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                  <span className="text-sm flex-1">{cat.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      if (confirm(`Slette kategorien "${cat.name}"?`)) {
                        deleteMutation.mutate(cat.id);
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
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
  );
}
