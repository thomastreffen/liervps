/**
 * Enkel intern statuspanel for lansering (kun admin/superadmin).
 * Viser om offentlige skjemaer, Google-tjenester og RLS er i orden.
 */
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, CircleSlash, Loader2, RefreshCw, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { GOOGLE_SERVICE_LABEL, useGoogleHealth } from "@/hooks/useGoogleHealth";
import { GoogleReconnectButton } from "@/components/integrations/GoogleReconnectBanner";

type State = "ok" | "warn" | "fail" | "unknown";

function Row({ label, state, note }: { label: string; state: State; note?: string }) {
  const Icon = state === "ok" ? CheckCircle2 : state === "fail" ? XCircle : CircleSlash;
  const color =
    state === "ok"
      ? "text-emerald-600"
      : state === "fail"
        ? "text-destructive"
        : state === "warn"
          ? "text-amber-600"
          : "text-muted-foreground";
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${color}`} />
      <span className="text-foreground">{label}</span>
      {note && <span className="text-xs text-muted-foreground">· {note}</span>}
    </div>
  );
}

export function ReleaseStatusPanel() {
  const { canSee, loading, services, needsReconnect, refresh } = useGoogleHealth();
  const [formsState, setFormsState] = useState<State>("unknown");
  const [rlsState, setRlsState] = useState<State>("unknown");
  const [checking, setChecking] = useState(false);

  const runChecks = async () => {
    setChecking(true);
    // Offentlige skjemaer: kan vi lese innkomne henvendelser (og finnes rutinen)?
    const { error: plErr } = await supabase.from("public_leads").select("id", { count: "exact", head: true });
    setFormsState(plErr ? "fail" : "ok");

    // RLS: tabellene som holder henvendelser skal være beskyttet.
    const { error: leadErr } = await supabase.from("leads").select("id", { count: "exact", head: true });
    setRlsState(leadErr ? "warn" : "ok");
    setChecking(false);
  };

  useEffect(() => {
    if (canSee) void runChecks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSee]);

  if (!canSee) return null;

  const serviceState = (status: string): State =>
    status === "ok" ? "ok" : status === "needs_reconnect" ? "fail" : "unknown";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Klar for lansering</CardTitle>
        <Button
          size="sm"
          variant="ghost"
          className="gap-1.5"
          disabled={checking || loading}
          onClick={() => {
            void runChecks();
            void refresh();
          }}
        >
          {checking || loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Oppdater
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        <Row
          label={formsState === "ok" ? "Offentlige skjemaer fungerer" : "Offentlige skjemaer svarer ikke"}
          state={formsState}
        />
        <Row
          label={needsReconnect ? "Google Workspace må kobles til på nytt" : "Google Workspace tilkoblet"}
          state={needsReconnect ? "fail" : loading ? "unknown" : "ok"}
        />
        {services.map((s) => (
          <Row
            key={s.service}
            label={`${GOOGLE_SERVICE_LABEL[s.service]}: ${
              s.status === "ok" ? "tilkoblet" : s.status === "needs_reconnect" ? "må kobles til på nytt" : "ikke testet"
            }`}
            state={serviceState(s.status)}
            note={s.status === "needs_reconnect" ? (s.errorCode ?? undefined) : undefined}
          />
        ))}
        <Row
          label={rlsState === "ok" ? "Tilgangskontroll (RLS) OK" : "Tilgangskontroll: sjekk tilganger"}
          state={rlsState}
        />
        {needsReconnect && (
          <div className="pt-2">
            <GoogleReconnectButton />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
