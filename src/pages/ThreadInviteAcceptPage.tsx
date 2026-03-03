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
    if (!invite || !user) return;
    setAccepting(true);

    try {
      const thread = Array.isArray(invite.conversation_threads)
        ? invite.conversation_threads[0]
        : invite.conversation_threads;

      if (!thread) throw new Error("Thread not found");

      // Get user's account id
      const { data: ua } = await supabase
        .from("user_accounts")
        .select("id")
        .eq("auth_user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      // Create participant
      await (supabase as any)
        .from("conversation_thread_participants")
        .insert({
          thread_id: thread.id,
          company_id: thread.company_id,
          project_id: thread.project_id,
          participant_type: ua ? "internal" : "external",
          user_account_id: ua?.id || null,
          email: invite.invited_email,
          display_name: invite.invited_name || invite.invited_email,
          added_by: invite.invited_by_participant_id,
        });

      // Ensure thread is participants_only so invited user only sees this thread
      await (supabase as any)
        .from("conversation_threads")
        .update({ participants_only: true })
        .eq("id", thread.id);

      // Mark invite as accepted
      await (supabase as any)
        .from("conversation_thread_invites")
        .update({ status: "accepted" })
        .eq("id", invite.id);

      toast.success("Invitasjon godtatt!");
      navigate(`/projects/${thread.project_id}/conversations/${thread.id}`);
    } catch (err: any) {
      toast.error(err.message || "Kunne ikke godta invitasjonen");
    } finally {
      setAccepting(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F6F7F9]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F6F7F9]">
        <div className="bg-card rounded-2xl border border-border/40 p-8 max-w-md w-full text-center shadow-sm space-y-4">
          <XCircle className="h-12 w-12 text-destructive mx-auto" />
          <h1 className="text-lg font-bold text-foreground">Invitasjon ugyldig</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={() => navigate("/login")}>
            Gå til innlogging
          </Button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F6F7F9]">
        <div className="bg-card rounded-2xl border border-border/40 p-8 max-w-md w-full text-center shadow-sm space-y-4">
          <Clock className="h-12 w-12 text-primary mx-auto" />
          <h1 className="text-lg font-bold text-foreground">Logg inn for å godta</h1>
          <p className="text-sm text-muted-foreground">
            Du må logge inn for å godta invitasjonen til samtalen
            <strong> "{invite?.conversation_threads?.title}"</strong>.
          </p>
          <Button onClick={() => navigate(`/login?redirect=/invite/thread/${token}`)}>
            Logg inn med Microsoft
          </Button>
        </div>
      </div>
    );
  }

  const thread = Array.isArray(invite?.conversation_threads)
    ? invite.conversation_threads[0]
    : invite?.conversation_threads;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F6F7F9]">
      <div className="bg-card rounded-2xl border border-border/40 p-8 max-w-md w-full text-center shadow-sm space-y-4">
        <CheckCircle className="h-12 w-12 text-primary mx-auto" />
        <h1 className="text-lg font-bold text-foreground">Godta invitasjon</h1>
        <p className="text-sm text-muted-foreground">
          Du er invitert til samtalen <strong>"{thread?.title}"</strong>.
          <br />
          Du vil kun få tilgang til denne samtalen.
        </p>
        <Button onClick={handleAccept} disabled={accepting} className="w-full">
          {accepting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Godta invitasjon
        </Button>
      </div>
    </div>
  );
}
