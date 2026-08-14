/**
 * Varsel til admin/superadmin når Google Workspace må kobles til på nytt.
 * Vises aldri for offentlige besøkende — hooken leser en admin-beskyttet tabell.
 */
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2, Plug } from "lucide-react";
import { toast } from "sonner";
import { startGoogleLogin } from "@/lib/integrations/google-oauth";
import { GOOGLE_SERVICE_LABEL, useGoogleHealth } from "@/hooks/useGoogleHealth";

export function GoogleReconnectButton({ size = "sm" }: { size?: "sm" | "default" }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size={size}
      variant="default"
      className="gap-1.5"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          // Ber om Gmail-, Kalender- og Drive-tilgang i én runde.
          await startGoogleLogin({ scopeBundle: "full", intendedPath: window.location.pathname });
        } catch (e) {
          setBusy(false);
          toast.error("Kunne ikke starte Google-tilkobling", {
            description: e instanceof Error ? e.message : undefined,
          });
        }
      }}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plug className="h-3.5 w-3.5" />}
      Koble til Google på nytt
    </Button>
  );
}

export function GoogleReconnectBanner({ compact = false }: { compact?: boolean }) {
  const { canSee, loading, needsReconnect, failing } = useGoogleHealth();
  if (!canSee || loading || !needsReconnect) return null;

  const affected = failing.map((f) => GOOGLE_SERVICE_LABEL[f.service]).join(", ");

  return (
    <Alert variant="destructive" className={compact ? "py-3" : undefined}>
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Google Workspace må kobles til på nytt</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>Varsler, kalender og Drive-lagring kjører ikke før dette er gjort.</p>
        {affected && <p className="text-xs opacity-80">Berørte tjenester: {affected}</p>}
        <div className="pt-1">
          <GoogleReconnectButton />
        </div>
      </AlertDescription>
    </Alert>
  );
}
