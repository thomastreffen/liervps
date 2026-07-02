import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function GoogleAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const processingRef = useRef(false);

  useEffect(() => {
    if (processingRef.current) return;
    processingRef.current = true;

    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
      toast.error("Google-innlogging feilet", { description: error });
      navigate("/login", { replace: true });
      return;
    }
    if (!code) {
      navigate("/login", { replace: true });
      return;
    }

    let intendedPath = "/";
    let scopeBundle = "sso";
    try {
      const pending = sessionStorage.getItem("google-oauth-pending");
      if (pending) {
        const parsed = JSON.parse(pending);
        intendedPath = parsed.intended_path || "/";
        scopeBundle = parsed.scope_bundle || "sso";
      }
    } catch { /* ignore */ }
    sessionStorage.removeItem("google-oauth-pending");

    const redirectUri = `${window.location.origin}/auth/google/callback`;

    supabase.functions
      .invoke("google-auth-callback", {
        body: { code, redirect_uri: redirectUri, scope_bundle: scopeBundle },
      })
      .then(async ({ data, error: fnError }) => {
        if (fnError || !data?.session) {
          console.error("[GoogleAuthCallback]", fnError, data);
          toast.error("Google-innlogging feilet", {
            description: data?.error || fnError?.message || "Kunne ikke logge inn.",
          });
          navigate("/login", { replace: true });
          return;
        }
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
        toast.success("Innlogget", { description: `Velkommen, ${data.user?.name || ""}!` });
        navigate(intendedPath, { replace: true });
      })
      .catch((err) => {
        console.error("[GoogleAuthCallback] exception", err);
        toast.error("Google-innlogging feilet");
        navigate("/login", { replace: true });
      });
  }, [searchParams, navigate]);

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Logger inn med Google...</p>
      </div>
    </div>
  );
}
