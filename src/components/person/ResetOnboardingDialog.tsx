import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personId: string;
  personName: string;
  personEmail: string;
  onReset: () => void;
}

export function ResetOnboardingDialog({ open, onOpenChange, personId, personName, personEmail, onReset }: Props) {
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-person", {
        body: { person_id: personId, action: "reset_onboarding" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(data?.invite_resent ? "Onboarding nullstilt og ny invitasjon sendt" : "Onboarding nullstilt");
      onOpenChange(false);
      onReset();
    } catch (err: any) {
      toast.error("Feil", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-primary" />
            Nullstill onboarding
          </AlertDialogTitle>
          <AlertDialogDescription>
            Dette nullstiller <strong>{personName}</strong> ({personEmail}) sin innloggingsstatus
            og sender en ny velkomst-e-post. Brukeren må gå gjennom aktiveringsflyten på nytt.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="rounded-md border p-3 text-xs text-muted-foreground space-y-1">
          <p>• E-postbekreftelse tilbakestilles</p>
          <p>• Ny aktiveringslenke sendes</p>
          <p>• Eksisterende data og rettigheter beholdes</p>
          <p>• Brukeren må sette nytt passord</p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Avbryt</AlertDialogCancel>
          <Button onClick={handleReset} disabled={loading} className="gap-1.5">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            Nullstill og send invitasjon
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
