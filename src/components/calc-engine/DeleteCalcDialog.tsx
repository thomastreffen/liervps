import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export type DeleteTarget =
  | { kind: "calculation"; id: string; label: string }
  | { kind: "case"; id: string; label: string; subCount: number }
  | { kind: "draft"; id: string; label: string };

interface Props {
  target: DeleteTarget | null;
  onClose: () => void;
  onDeleted?: () => void;
}

export function DeleteCalcDialog({ target, onClose, onDeleted }: Props) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);

  if (!target) return null;

  const titles: Record<DeleteTarget["kind"], string> = {
    calculation: "Slette kalkyle?",
    case: "Slette hele kalkylesaken?",
    draft: "Slette AI-utkast?",
  };

  const descriptions: Record<DeleteTarget["kind"], string> = {
    calculation: `Kalkylen "${target.label}" flyttes til papirkurv og kan gjenopprettes derfra.`,
    case:
      target.kind === "case"
        ? `Kalkylesaken "${target.label}" og alle ${target.subCount} delkalkyler flyttes til papirkurv. Dette kan gjenopprettes.`
        : "",
    draft: `AI-utkastet "${target.label}" slettes. Allerede opprettede kalkyler beholdes.`,
  };

  async function handleDelete() {
    if (!target) return;
    setBusy(true);
    const now = new Date().toISOString();
    const meta = { deleted_at: now, deleted_by: user?.id } as any;

    try {
      if (target.kind === "calculation") {
        const { error } = await supabase.from("calculations").update(meta).eq("id", target.id);
        if (error) throw error;
      } else if (target.kind === "case") {
        // Soft-delete case + alle tilknyttede calculations
        const [c1, c2] = await Promise.all([
          supabase.from("calc_cases").update(meta).eq("id", target.id),
          supabase.from("calculations").update(meta).eq("case_id", target.id).is("deleted_at", null),
        ]);
        if (c1.error) throw c1.error;
        if (c2.error) throw c2.error;
      } else if (target.kind === "draft") {
        const { error } = await supabase.from("calc_ai_drafts").delete().eq("id", target.id);
        if (error) throw error;
      }
      toast.success("Slettet");
      onDeleted?.();
      onClose();
    } catch (err: any) {
      console.error("[DeleteCalcDialog]", err);
      toast.error(err?.message ?? "Kunne ikke slette");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{titles[target.kind]}</AlertDialogTitle>
          <AlertDialogDescription>{descriptions[target.kind]}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Avbryt</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); handleDelete(); }}
            disabled={busy}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-1.5"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Slett
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
