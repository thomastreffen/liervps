import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const GOOGLE_OAUTH_PENDING_KEY = "google-oauth-pending";
const GOOGLE_OAUTH_PENDING_PREFIX = "google-oauth-pending:";

function sanitizeIntendedPath(path?: string) {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return "/";
  return path;
}

function notifyOpener(payload: { flow_id?: string | null; ok: boolean; error?: string; intended_path?: string }) {
  if (!window.opener) return false;
  window.opener.postMessage({ type: "google-workspace-oauth-complete", ...payload }, window.location.origin);
  window.close();
  return true;
}

export default function GoogleAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const processingRef = useRef(false);

  useEffect(() => {
    if (processingRef.current) return;
    processingRef.current = true;

    const code = searchParams.get("code");
    const error = searchParams.get("error");
    const state = searchParams.get("state");

    const pendingKey = state ? `${GOOGLE_OAUTH_PENDING_PREFIX}${state}` : GOOGLE_OAUTH_PENDING_KEY;

    if (error) {
      if (notifyOpener({ flow_id: state, ok: false, error })) return;
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
      const pending = sessionStorage.getItem(GOOGLE_OAUTH_PENDING_KEY) || localStorage.getItem(pendingKey);
      if (pending) {
        const parsed = JSON.parse(pending);
        intendedPath = sanitizeIntendedPath(parsed.intended_path);
        scopeBundle = parsed.scope_bundle || "sso";
      }
    } catch { /* ignore */ }
    sessionStorage.removeItem(GOOGLE_OAUTH_PENDING_KEY);
    if (state) localStorage.removeItem(pendingKey);

    const redirectUri = `${window.location.origin}/auth/google/callback`;

    supabase.functions
      .invoke("google-auth-callback", {
        body: { code, redirect_uri: redirectUri, scope_bundle: scopeBundle },
      })
      .then(async ({ data, error: fnError }) => {
        if (fnError || !data?.session) {
          console.error("[GoogleAuthCallback]", fnError, data);
          if (notifyOpener({ flow_id: state, ok: false, error: data?.error || fnError?.message || "Kunne ikke logge inn." })) return;
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
        if (notifyOpener({ flow_id: state, ok: true, intended_path: intendedPath })) return;
        navigate(intendedPath, { replace: true });
      })
      .catch((err) => {
        console.error("[GoogleAuthCallback] exception", err);
        if (notifyOpener({ flow_id: state, ok: false, error: err instanceof Error ? err.message : "Google-tilkoblingen feilet." })) return;
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
