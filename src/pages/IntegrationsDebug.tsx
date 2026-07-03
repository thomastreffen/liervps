import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { CheckCircle2, XCircle, RefreshCw, Loader2, Calendar, Mail, Plug } from "lucide-react";
import { startGoogleLogin, isGoogleConfigured } from "@/lib/integrations/google-oauth";

type ScopeState = { connected: boolean; email: string | null; grantedAt: string | null };

const CAL_SCOPE = "https://www.googleapis.com/auth/calendar";
const MAIL_SCOPE = "https://www.googleapis.com/auth/gmail.send";

export default function IntegrationsDebug() {
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [calendar, setCalendar] = useState<ScopeState>({ connected: false, email: null, grantedAt: null });
  const [mail, setMail] = useState<ScopeState>({ connected: false, email: null, grantedAt: null });
  const [oauthConfigured, setOauthConfigured] = useState<boolean | null>(null);

  const refresh = async () => {
    if (!session?.user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_integration_tokens")
        .select("scope, granted_scopes, provider_account_email, updated_at")
        .eq("user_id", session.user.id)
        .eq("provider", "google");
      if (error) throw error;
      const rows = data ?? [];
      const hasScope = (scope: string) =>
        rows.find((r: any) => (r.granted_scopes ?? []).includes(scope));
      const cal = hasScope(CAL_SCOPE);
      const gm = hasScope(MAIL_SCOPE);
      setCalendar({
        connected: !!cal,
        email: cal?.provider_account_email ?? null,
        grantedAt: cal?.updated_at ?? null,
      });
      setMail({
        connected: !!gm,
        email: gm?.provider_account_email ?? null,
        grantedAt: gm?.updated_at ?? null,
      });
    } catch (e: any) {
      toast.error("Kunne ikke hente integrasjonsstatus", { description: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, [session?.user?.id]);
  useEffect(() => { isGoogleConfigured().then(setOauthConfigured); }, []);

  const connect = async (bundle: "calendar" | "mail" | "full") => {
    try {
      await startGoogleLogin({ scopeBundle: bundle, intendedPath: "/settings/integrations" });
    } catch (e: any) {
      toast.error("Kunne ikke starte Google-tilkobling", { description: e.message });
    }
  };

  const disconnect = async () => {
    if (!session?.user?.id) return;
    if (!window.confirm("Koble fra alle Google-tjenester (kalender og e-post)? Du kan koble til igjen når som helst.")) return;
    const { error } = await supabase
      .from("user_integration_tokens")
      .delete()
      .eq("user_id", session.user.id)
      .eq("provider", "google");
    if (error) toast.error("Kunne ikke koble fra", { description: error.message });
    else {
      toast.success("Google Workspace koblet fra");
      refresh();
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Integrasjoner</h1>
        <p className="text-sm text-muted-foreground">
          Google Workspace — kalender og e-post for {session?.user?.email ?? "din bruker"}
        </p>
      </div>

      {oauthConfigured === false && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="pt-4 text-sm text-destructive">
            Google OAuth er ikke konfigurert på serveren. Kontakt admin for å sette GOOGLE_OAUTH_CLIENT_ID / SECRET.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" /> Google Kalender
          </CardTitle>
          <StatusBadge connected={calendar.connected} />
        </CardHeader>
        <CardContent className="space-y-3">
          <Row label="Konto" value={calendar.email ?? "Ikke tilkoblet"} />
          <Row label="Sist oppdatert" value={calendar.grantedAt ? new Date(calendar.grantedAt).toLocaleString("nb-NO") : "—"} />
          <Separator />
          <p className="text-xs text-muted-foreground">
            Når tilkoblet blir aktiviteter i Ressursplan automatisk lagt til i din Google Kalender.
            Montører som er tildelt legges som deltakere (attendees).
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => connect("calendar")} disabled={!oauthConfigured} className="gap-1.5">
              <Plug className="h-3.5 w-3.5" />
              {calendar.connected ? "Koble til på nytt" : "Koble til Google Kalender"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" /> Gmail (send e-post)
          </CardTitle>
          <StatusBadge connected={mail.connected} />
        </CardHeader>
        <CardContent className="space-y-3">
          <Row label="Konto" value={mail.email ?? "Ikke tilkoblet"} />
          <Row label="Sist oppdatert" value={mail.grantedAt ? new Date(mail.grantedAt).toLocaleString("nb-NO") : "—"} />
          <Separator />
          <p className="text-xs text-muted-foreground">
            Brukes kun når du eksplisitt huker av «Send e-postvarsel» ved planlegging.
            Vi sender aldri e-post automatisk.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => connect("mail")} disabled={!oauthConfigured} className="gap-1.5">
              <Plug className="h-3.5 w-3.5" />
              {mail.connected ? "Koble til på nytt" : "Koble til Gmail"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading} className="gap-1.5">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Oppdater
        </Button>
        <Button variant="outline" size="sm" onClick={() => connect("full")} disabled={!oauthConfigured} className="gap-1.5">
          <Plug className="h-3.5 w-3.5" /> Koble til alt (kalender + e-post)
        </Button>
        {(calendar.connected || mail.connected) && (
          <Button variant="ghost" size="sm" onClick={disconnect} className="text-destructive hover:text-destructive">
            Koble fra Google
          </Button>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ connected }: { connected: boolean }) {
  return connected ? (
    <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" /> Tilkoblet</Badge>
  ) : (
    <Badge variant="secondary" className="gap-1"><XCircle className="h-3 w-3" /> Ikke tilkoblet</Badge>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
