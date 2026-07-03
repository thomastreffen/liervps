import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  CheckCircle2, XCircle, RefreshCw, Loader2, Calendar, Mail, Plug, HardDrive,
  Video, AlertTriangle, Copy, ExternalLink, ShieldAlert,
} from "lucide-react";
import { startGoogleLogin, isGoogleConfigured } from "@/lib/integrations/google-oauth";

type ScopeState = { connected: boolean; email: string | null; grantedAt: string | null };

const CAL_SCOPE = "https://www.googleapis.com/auth/calendar";
const MAIL_SCOPE = "https://www.googleapis.com/auth/gmail.send";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

const APP_ORIGIN = typeof window !== "undefined" ? window.location.origin : "https://liervps.lovable.app";
const REDIRECT_URI = `${APP_ORIGIN}/auth/google/callback`;

function CopyBtn({ value }: { value: string }) {
  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-7 px-2"
      onClick={() => {
        navigator.clipboard.writeText(value);
        toast.success("Kopiert");
      }}
    >
      <Copy className="h-3 w-3" />
    </Button>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <code className="text-xs px-2 py-1 rounded bg-muted font-mono break-all">{children}</code>
  );
}

export default function IntegrationsDebug() {
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [calendar, setCalendar] = useState<ScopeState>({ connected: false, email: null, grantedAt: null });
  const [mail, setMail] = useState<ScopeState>({ connected: false, email: null, grantedAt: null });
  const [drive, setDrive] = useState<ScopeState>({ connected: false, email: null, grantedAt: null });
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
      const set = (s: any) => ({
        connected: !!s,
        email: s?.provider_account_email ?? null,
        grantedAt: s?.updated_at ?? null,
      });
      setCalendar(set(hasScope(CAL_SCOPE)));
      setMail(set(hasScope(MAIL_SCOPE)));
      setDrive(set(hasScope(DRIVE_SCOPE)));
    } catch (e: any) {
      toast.error("Kunne ikke hente integrasjonsstatus", { description: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, [session?.user?.id]);
  useEffect(() => { isGoogleConfigured().then(setOauthConfigured); }, []);

  const connect = async (bundle: "calendar" | "mail" | "files" | "full") => {
    try {
      await startGoogleLogin({ scopeBundle: bundle, intendedPath: "/settings/integrations" });
    } catch (e: any) {
      toast.error("Kunne ikke starte Google-tilkobling", { description: e.message });
    }
  };

  const disconnect = async () => {
    if (!session?.user?.id) return;
    if (!window.confirm("Koble fra alle Google-tjenester? Du kan koble til igjen når som helst.")) return;
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
    <div className="space-y-6 p-4 md:p-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Google Workspace</h1>
        <p className="text-sm text-muted-foreground">
          Kalender, e-post, Drive og Meet for {session?.user?.email ?? "din bruker"}
        </p>
      </div>

      {/* Setup checklist — always visible so admin kan feilsøke Google Cloud oppsett */}
      <Alert className="border-amber-500/40 bg-amber-500/5">
        <ShieldAlert className="h-4 w-4 text-amber-600" />
        <AlertTitle className="text-amber-900 dark:text-amber-200">
          Får du "Tilgangen er blokkert" fra Google? Sjekk oppsett i Google Cloud.
        </AlertTitle>
        <AlertDescription className="text-amber-900/90 dark:text-amber-100/90">
          Google blokkerer OAuth til appen din er verifisert eller kontoen er lagt til som testbruker.
          Bruk sjekklisten under.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Google Cloud – sjekkliste for Lier VPS</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">1. Nåværende origin</div>
            <div className="flex items-center gap-2">
              <Mono>{APP_ORIGIN}</Mono>
              <CopyBtn value={APP_ORIGIN} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">2. Godkjent redirect URI</div>
            <div className="flex items-center gap-2">
              <Mono>{REDIRECT_URI}</Mono>
              <CopyBtn value={REDIRECT_URI} />
            </div>
            <p className="text-xs text-muted-foreground">
              Legg til denne under <b>APIs &amp; Services → Credentials → OAuth 2.0 Client ID → Authorized redirect URIs</b>.
            </p>
          </div>

          <Accordion type="multiple" className="w-full">
            <AccordionItem value="consent">
              <AccordionTrigger className="text-sm">3. OAuth samtykkeskjerm (Consent screen)</AccordionTrigger>
              <AccordionContent className="space-y-2 text-sm text-muted-foreground">
                <ul className="list-disc pl-5 space-y-1">
                  <li><b>Publishing status:</b> «Testing» er OK nå.</li>
                  <li>
                    Legg til Google-kontoen din som <b>Test user</b> under
                    <em> Audience → Test users</em>. Uten dette får du 403 <code>access_denied</code>.
                  </li>
                  <li>Legg til nødvendige scopes (se punkt 5).</li>
                  <li>Publiser og verifiser appen før produksjonsbruk.</li>
                </ul>
                <Button size="sm" variant="outline" asChild className="mt-2">
                  <a href="https://console.cloud.google.com/apis/credentials/consent" target="_blank" rel="noreferrer">
                    Åpne OAuth consent screen <ExternalLink className="h-3 w-3 ml-1.5" />
                  </a>
                </Button>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="apis">
              <AccordionTrigger className="text-sm">4. Aktiver Google APIs</AccordionTrigger>
              <AccordionContent className="space-y-2 text-sm text-muted-foreground">
                <ul className="list-disc pl-5 space-y-1">
                  <li>Google Calendar API</li>
                  <li>Gmail API</li>
                  <li>Google Drive API</li>
                </ul>
                <p className="text-xs">Google Meet-lenker opprettes via Calendar API (<code>conferenceData</code>) — ingen egen Meet-API kreves.</p>
                <Button size="sm" variant="outline" asChild className="mt-2">
                  <a href="https://console.cloud.google.com/apis/library" target="_blank" rel="noreferrer">
                    Åpne API Library <ExternalLink className="h-3 w-3 ml-1.5" />
                  </a>
                </Button>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="scopes">
              <AccordionTrigger className="text-sm">5. OAuth scopes</AccordionTrigger>
              <AccordionContent className="space-y-3 text-sm">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Innlogging</div>
                  <div className="flex flex-wrap gap-1.5">
                    <Mono>openid</Mono><Mono>email</Mono><Mono>profile</Mono>
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Kalender</div>
                  <Mono>https://www.googleapis.com/auth/calendar</Mono>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Gmail (send)</div>
                  <Mono>https://www.googleapis.com/auth/gmail.send</Mono>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Drive (app-filer)</div>
                  <Mono>https://www.googleapis.com/auth/drive.file</Mono>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Meet</div>
                  <p className="text-xs text-muted-foreground">
                    Ingen egen scope. Meet-lenker opprettes gjennom Calendar-hendelser med <code>conferenceData</code>.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {oauthConfigured === false && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Google OAuth er ikke konfigurert på serveren</AlertTitle>
          <AlertDescription>
            Kontakt admin for å sette <code>GOOGLE_OAUTH_CLIENT_ID</code> og <code>GOOGLE_OAUTH_CLIENT_SECRET</code>.
          </AlertDescription>
        </Alert>
      )}

      {/* Service status cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <ServiceCard
          title="Google Kalender"
          icon={<Calendar className="h-4 w-4" />}
          state={calendar}
          onConnect={() => connect("calendar")}
          disabled={!oauthConfigured}
          helpText="Aktiviteter i Ressursplan legges automatisk i din Google Kalender. Tildelte montører legges som deltakere."
        />
        <ServiceCard
          title="Gmail"
          icon={<Mail className="h-4 w-4" />}
          state={mail}
          onConnect={() => connect("mail")}
          disabled={!oauthConfigured}
          helpText="Brukes kun når du eksplisitt huker av «Send e-postvarsel». Aldri automatisk."
        />
        <ServiceCard
          title="Google Drive"
          icon={<HardDrive className="h-4 w-4" />}
          state={drive}
          onConnect={() => connect("files")}
          disabled={!oauthConfigured}
          helpText="Erstatter tidligere SharePoint/OneDrive. App-filer lagres med scope drive.file."
          comingSoon
        />
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Video className="h-4 w-4" /> Google Meet
            </CardTitle>
            <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Via Kalender</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Meet-lenker genereres automatisk når en kalenderhendelse markeres som videomøte.
              Krever at Google Kalender er tilkoblet. Ingen egen tilkobling nødvendig.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading} className="gap-1.5">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Oppdater status
        </Button>
        <Button variant="outline" size="sm" onClick={() => connect("full")} disabled={!oauthConfigured} className="gap-1.5">
          <Plug className="h-3.5 w-3.5" /> Koble til alt (Kalender + Gmail + Drive)
        </Button>
        {(calendar.connected || mail.connected || drive.connected) && (
          <Button variant="ghost" size="sm" onClick={disconnect} className="text-destructive hover:text-destructive">
            Koble fra Google
          </Button>
        )}
      </div>
    </div>
  );
}

function ServiceCard({
  title, icon, state, onConnect, disabled, helpText, comingSoon,
}: {
  title: string; icon: React.ReactNode; state: ScopeState;
  onConnect: () => void; disabled?: boolean; helpText: string; comingSoon?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">{icon} {title}</CardTitle>
        {state.connected ? (
          <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" /> Tilkoblet</Badge>
        ) : (
          <Badge variant="secondary" className="gap-1"><XCircle className="h-3 w-3" /> Ikke tilkoblet</Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-3 text-sm">
          <span className="text-muted-foreground">Konto</span>
          <span className="font-medium text-right">{state.email ?? "—"}</span>
        </div>
        <div className="flex items-start justify-between gap-3 text-sm">
          <span className="text-muted-foreground">Sist oppdatert</span>
          <span className="font-medium text-right">
            {state.grantedAt ? new Date(state.grantedAt).toLocaleString("nb-NO") : "—"}
          </span>
        </div>
        <Separator />
        <p className="text-xs text-muted-foreground">{helpText}</p>
        {comingSoon && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Filsynkronisering til Drive er planlagt — knappen kobler kun til tilgang foreløpig.
          </p>
        )}
        <Button size="sm" onClick={onConnect} disabled={disabled} className="gap-1.5">
          <Plug className="h-3.5 w-3.5" />
          {state.connected ? "Koble til på nytt" : `Koble til ${title}`}
        </Button>
      </CardContent>
    </Card>
  );
}
