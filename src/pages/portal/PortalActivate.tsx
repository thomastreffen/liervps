import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PortalActivate() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const activate = async () => {
      try {
        // Wait for Supabase to process the magic link token from URL
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) throw error;

        if (!session) {
          // Try to exchange token from URL hash
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const accessToken = hashParams.get("access_token");
          const refreshToken = hashParams.get("refresh_token");

          if (accessToken && refreshToken) {
            const { error: setErr } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (setErr) throw setErr;
          } else {
            // Wait a moment for auth state to settle
            await new Promise((r) => setTimeout(r, 1500));
            const { data: { session: retrySession } } = await supabase.auth.getSession();
            if (!retrySession) {
              throw new Error("Kunne ikke aktivere kontoen. Lenken kan ha utløpt.");
            }
          }
        }

        // Get current session after potential exchange
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (!currentSession?.user) {
          throw new Error("Ingen aktiv sesjon funnet.");
        }

        const userId = currentSession.user.id;
        const userEmail = currentSession.user.email;

        // Activate portal user record
        const { error: updateErr } = await supabase
          .from("customer_portal_users")
          .update({
            status: "active",
            activated_at: new Date().toISOString(),
            auth_user_id: userId,
            last_login_at: new Date().toISOString(),
          })
          .eq("email", userEmail?.toLowerCase());

        if (updateErr) {
          console.warn("Portal user update:", updateErr.message);
        }

        setStatus("success");

        // Redirect to portal after brief success display
        setTimeout(() => navigate("/portal", { replace: true }), 1500);
      } catch (err: any) {
        console.error("Activation error:", err);
        setErrorMsg(err.message || "En feil oppstod");
        setStatus("error");
      }
    };

    activate();
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-6 rounded-xl border bg-card p-8 shadow-sm text-center">
          {status === "loading" && (
            <>
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <div>
                <h2 className="text-lg font-semibold text-card-foreground">
                  Aktiverer tilgang...
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Vennligst vent mens vi setter opp kontoen din.
                </p>
              </div>
            </>
          )}

          {status === "success" && (
            <>
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <CheckCircle className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-card-foreground">
                  Velkommen!
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Din tilgang er aktivert. Du blir nå videresendt til kundeportalen.
                </p>
              </div>
            </>
          )}

          {status === "error" && (
            <>
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-card-foreground">
                  Noe gikk galt
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {errorMsg}
                </p>
              </div>
              <Button onClick={() => navigate("/portal/login")} className="mt-2">
                Tilbake til innlogging
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
