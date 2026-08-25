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

/**
 * Én tjeneste av gangen — innlogging (SSO) ber aldri om Kalender/Gmail/Drive.
 * Ekstra scopes autoriseres kun her, som separat consent-flow.
 */
const SERVICE_BUNDLE = {
  calendar: "calendar",
  gmail: "mail",
  drive: "files",
} as const;

export function GoogleReconnectButton({
  size = "sm",
  service = "calendar",
  label,
}: {
  size?: "sm" | "default";
  service?: keyof typeof SERVICE_BUNDLE;
  label?: string;
}) {
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
          await startGoogleLogin({
            scopeBundle: SERVICE_BUNDLE[service],
            intendedPath: window.location.pathname,
          });
        } catch (e) {
          setBusy(false);
          toast.error("Kunne ikke starte Google-tilkobling", {
            description: e instanceof Error ? e.message : undefined,
          });
        }
      }}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plug className="h-3.5 w-3.5" />}
      {label ?? `Koble til ${GOOGLE_SERVICE_LABEL[service]} på nytt`}
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
        <p>Hver tjeneste godkjennes separat. Innlogging (SSO) berøres ikke.</p>
        {affected && <p className="text-xs opacity-80">Berørte tjenester: {affected}</p>}
        <div className="flex flex-wrap gap-2 pt-1">
          {failing.map((f) => (
            <GoogleReconnectButton key={f.service} service={f.service} />
          ))}
        </div>
      </AlertDescription>
    </Alert>
  );
}
