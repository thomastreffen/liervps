import { useState, useEffect } from "react";
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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, Trash2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personId: string;
  personName: string;
  personEmail: string;
  onDeleted: () => void;
}

interface DepCheck {
  person: { id: string; full_name: string; email: string };
  has_auth_account: boolean;
  has_user_account: boolean;
  dependencies: Record<string, number>;
  can_hard_delete: boolean;
  heavy_references: number;
}

const DEP_LABELS: Record<string, string> = {
  employment_profiles: "Ansattprofiler",
  roles: "Roller (v2)",
  scopes: "Tilgangsomfang",
  permission_overrides: "Rettighetsoverstyringer",
  project_memberships: "Prosjektmedlemskap",
  conversation_posts: "Samtalemeldinger",
  activity_log: "Aktivitetslogg",
  legacy_memberships: "Selskapsmedlemskap",
  legacy_role_assignments: "Rolletildelinger",
  audit_log: "Revisjonslogg",
};

export function HardDeleteDialog({ open, onOpenChange, personId, personName, personEmail, onDeleted }: Props) {
  const [checking, setChecking] = useState(false);
  const [depCheck, setDepCheck] = useState<DepCheck | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (open && personId) {
      runCheck();
    }
    if (!open) {
      setDepCheck(null);
      setConfirmText("");
    }
  }, [open, personId]);

  const runCheck = async () => {
    setChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-person", {
        body: { person_id: personId, action: "check" },
      });
      if (error) throw error;
      setDepCheck(data);
    } catch (err: any) {
      toast.error("Feil ved sjekk", { description: err.message });
    } finally {
      setChecking(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-person", {
        body: { person_id: personId, action: "delete" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Bruker slettet permanent");
      onOpenChange(false);
      onDeleted();
    } catch (err: any) {
      toast.error("Sletting feilet", { description: err.message });
    } finally {
      setDeleting(false);
    }
  };

  const canConfirm = confirmText === "SLETT";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Slett bruker permanent
          </AlertDialogTitle>
          <AlertDialogDescription>
            Du er i ferd med å permanent slette <strong>{personName}</strong> ({personEmail}).
            Denne handlingen kan <strong>ikke</strong> angres.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {checking ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Sjekker avhengigheter…</span>
          </div>
        ) : depCheck ? (
          <div className="space-y-4">
            {/* Account status */}
            <div className="flex flex-wrap gap-2">
              <Badge variant={depCheck.has_auth_account ? "secondary" : "outline"} className="text-[10px]">
                {depCheck.has_auth_account ? "Auth-konto" : "Ingen auth-konto"}
              </Badge>
              <Badge variant={depCheck.has_user_account ? "secondary" : "outline"} className="text-[10px]">
                {depCheck.has_user_account ? "Brukerkonto" : "Ingen brukerkonto"}
              </Badge>
            </div>

            {/* Dependencies */}
            <div className="rounded-md border p-3 space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground mb-2">Tilknyttede data</p>
              {Object.entries(depCheck.dependencies).map(([key, count]) => (
                <div key={key} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{DEP_LABELS[key] || key}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs">{count}</span>
                    {count === 0 ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-amber-500" />
                    )}
                  </div>
                </div>
              ))}
            </div>

            {!depCheck.can_hard_delete ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-sm font-medium text-destructive">Kan ikke slettes permanent</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Brukeren har {depCheck.heavy_references} viktige referanser (prosjektmedlemskap, meldinger eller aktivitetslogg).
                  Bruk arkivering i stedet.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                  <p className="text-xs text-muted-foreground">
                    Følgende slettes permanent: person-profil, ansattprofiler, brukerkonto, auth-konto, roller, tilganger og medlemskap.
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Skriv <strong>SLETT</strong> for å bekrefte
                  </label>
                  <Input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="SLETT"
                    className="mt-1 font-mono"
                  />
                </div>
              </div>
            )}
          </div>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel>Avbryt</AlertDialogCancel>
          {depCheck?.can_hard_delete && (
            <Button
              variant="destructive"
              disabled={!canConfirm || deleting}
              onClick={handleDelete}
              className="gap-1.5"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Slett permanent
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
