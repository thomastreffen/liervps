import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, CheckCircle, XCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function ThreadInviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [invite, setInvite] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) return;
    (async () => {
      const { data, error: err } = await (supabase as any)
        .from("conversation_thread_invites")
        .select("*, conversation_threads:thread_id(id, title, project_id, company_id)")
        .eq("invite_token", token)
        .maybeSingle();

      if (err || !data) {
        setError("Invitasjonen ble ikke funnet.");
      } else if (data.status === "accepted") {
        setError("Denne invitasjonen er allerede brukt.");
      } else if (data.status === "revoked") {
        setError("Denne invitasjonen er trukket tilbake.");
      } else if (new Date(data.expires_at) < new Date()) {
        setError("Denne invitasjonen har utløpt.");
      } else {
        setInvite(data);
      }
      setLoading(false);
    })();
  }, [token]);

  const handleAccept = async () => {
    if (!invite) return;
    setAccepting(true);

    try {
      // Call the accept edge function (works for both authenticated and unauthenticated)
      const { data, error: fnErr } = await supabase.functions.invoke("conversation-invite-accept", {
        body: { token },
      });

      if (fnErr) throw fnErr;
      if (data?.error) {
        const messages: Record<string, string> = {
          not_found: "Invitasjonen ble ikke funnet.",
          already_accepted: "Denne invitasjonen er allerede brukt.",
          revoked: "Denne invitasjonen er trukket tilbake.",
          expired: "Denne invitasjonen har utløpt.",
        };
        throw new Error(messages[data.error] || data.error);
      }

      toast.success("Invitasjon godtatt!");
      setDone(true);

      if (data?.project_id && data?.thread_id) {
        setTimeout(() => {
          navigate(`/projects/${data.project_id}/conversations/${data.thread_id}`);
        }, 1500);
      }
    } catch (err: any) {
      toast.error(err.message || "Kunne ikke godta invitasjonen");
    } finally {
      setAccepting(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="bg-card rounded-2xl border border-border/40 p-8 max-w-md w-full text-center shadow-sm space-y-4">
          <XCircle className="h-12 w-12 text-destructive mx-auto" />
          <h1 className="text-lg font-bold text-foreground">Invitasjon ugyldig</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={() => navigate("/")}>
            Gå til forsiden
          </Button>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="bg-card rounded-2xl border border-border/40 p-8 max-w-md w-full text-center shadow-sm space-y-4">
          <CheckCircle className="h-12 w-12 text-primary mx-auto" />
          <h1 className="text-lg font-bold text-foreground">Velkommen!</h1>
          <p className="text-sm text-muted-foreground">Du er nå deltaker i samtalen. Du blir viderekoblet…</p>
        </div>
      </div>
    );
  }

  const thread = Array.isArray(invite?.conversation_threads)
    ? invite.conversation_threads[0]
    : invite?.conversation_threads;

  // External users can accept without login
  const isExternalAccept = !user;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="bg-card rounded-2xl border border-border/40 p-8 max-w-md w-full text-center shadow-sm space-y-4">
        <CheckCircle className="h-12 w-12 text-primary mx-auto" />
        <h1 className="text-lg font-bold text-foreground">Godta invitasjon</h1>
        <p className="text-sm text-muted-foreground">
          Du er invitert til samtalen <strong>"{thread?.title}"</strong>.
          <br />
          Du vil kun få tilgang til denne samtalen.
        </p>
        {isExternalAccept && (
          <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-2">
            Du godtar som ekstern deltaker ({invite?.invited_email}).
          </p>
        )}
        <Button onClick={handleAccept} disabled={accepting} className="w-full">
          {accepting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Godta invitasjon
        </Button>
      </div>
    </div>
  );
}
