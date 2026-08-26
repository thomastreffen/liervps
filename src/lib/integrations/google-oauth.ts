/**
 * Google OAuth helpers (frontend).
 * Builds authorize URLs and initiates redirects.
 */

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const GOOGLE_SCOPE_BUNDLES = {
  sso: ["openid", "email", "profile"],
  calendar: [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/calendar",
  ],
  mail: [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/gmail.send",
  ],
  files: [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/drive.file",
  ],
  full: [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/drive.file",
  ],
} as const;

export type GoogleScopeBundle = keyof typeof GOOGLE_SCOPE_BUNDLES;

/** Workspace-domenet. Brukes som standard `hd` slik at kun Lier VPS-brukere kan logge inn. */
export const GOOGLE_WORKSPACE_DOMAIN = "liervarmepumpeservice.no";

/**
 * Client ID is a public value — fetched at runtime from the
 * google-oauth-config edge function (which reads GOOGLE_OAUTH_CLIENT_ID).
 * Cached in-memory for the session.
 */
let _clientIdCache: { id: string; configured: boolean } | null = null;
const GOOGLE_OAUTH_PENDING_KEY = "google-oauth-pending";
const GOOGLE_OAUTH_PENDING_PREFIX = "google-oauth-pending:";

export function maskGoogleClientId(clientId: string) {
  if (!clientId) return "<empty>";
  if (clientId.length <= 18) return `${clientId.slice(0, 4)}…${clientId.slice(-4)}`;
  return `${clientId.slice(0, 8)}…${clientId.slice(-24)}`;
}

export async function getGoogleClientId(): Promise<{ id: string; configured: boolean }> {
  if (_clientIdCache) return _clientIdCache;
  try {
    const { data, error } = await supabase.functions.invoke("google-oauth-config");
    if (error || !data) {
      _clientIdCache = { id: "", configured: false };
    } else {
      _clientIdCache = {
        id: (data as { client_id?: string }).client_id ?? "",
        configured: !!(data as { configured?: boolean }).configured,
      };
    }
  } catch {
    _clientIdCache = { id: "", configured: false };
  }
  return _clientIdCache;
}

export async function isGoogleConfigured(): Promise<boolean> {
  const { configured } = await getGoogleClientId();
  return configured;
}

function sanitizeIntendedPath(path?: string) {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return "/";
  return path;
}

function createFlowId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function storePendingGoogleOAuth(flowId: string, scopeBundle: GoogleScopeBundle, intendedPath: string) {
  const payload = JSON.stringify({
    flow_id: flowId,
    scope_bundle: scopeBundle,
    intended_path: intendedPath,
    started_at: Date.now(),
  });
  sessionStorage.setItem(GOOGLE_OAUTH_PENDING_KEY, payload);
  localStorage.setItem(`${GOOGLE_OAUTH_PENDING_PREFIX}${flowId}`, payload);
}

function waitForGoogleWorkspacePopup(
  popup: Window,
  flowId: string,
  intendedPath: string,
  debug: Record<string, unknown>,
) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      settled = true;
      window.removeEventListener("message", onMessage);
      window.clearInterval(closedTimer);
      window.clearTimeout(timeoutTimer);
    };
    const finish = (fn: () => void) => {
      if (settled) return;
      cleanup();
      fn();
    };
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; flow_id?: string; ok?: boolean; error?: string; intended_path?: string } | null;
      if (data?.type !== "google-workspace-oauth-complete" || data.flow_id !== flowId) return;
      finish(() => {
        if (data.ok) {
          window.location.replace(sanitizeIntendedPath(data.intended_path || intendedPath));
          resolve(debug);
        } else {
          reject(new Error(data.error || "Google-tilkoblingen feilet."));
        }
      });
    };
    const closedTimer = window.setInterval(() => {
      if (popup.closed) {
        finish(() => reject(new Error("Google-vinduet ble lukket før tilkoblingen var ferdig.")));
      }
    }, 700);
    const timeoutTimer = window.setTimeout(() => {
      finish(() => reject(new Error("Google-tilkoblingen tok for lang tid. Prøv igjen.")));
    }, 5 * 60 * 1000);
    window.addEventListener("message", onMessage);
    popup.focus();
  });
}

export async function startGoogleLogin(options?: {
  scopeBundle?: GoogleScopeBundle;
  hostedDomain?: string;
  loginHint?: string;
  intendedPath?: string;
  mode?: "redirect" | "popup";
}) {
  const bundle = options?.scopeBundle ?? "sso";
  const intendedPath = sanitizeIntendedPath(options?.intendedPath);

  if (bundle === "sso") {
    sessionStorage.setItem(
      GOOGLE_OAUTH_PENDING_KEY,
      JSON.stringify({
        scope_bundle: bundle,
        intended_path: intendedPath,
        started_at: Date.now(),
      }),
    );

    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
      extraParams: {
        hd: options?.hostedDomain ?? GOOGLE_WORKSPACE_DOMAIN,
        prompt: "select_account",
        ...(options?.loginHint ? { login_hint: options.loginHint } : {}),
      },
    });

    if (result.error) {
      throw result.error;
    }

    if (result.redirected) {
      return {
        window_origin: window.location.origin,
        redirect_uri: window.location.origin,
        scope_bundle: bundle,
        scope: GOOGLE_SCOPE_BUNDLES[bundle].join(" "),
        provider: "lovable-managed-google",
      };
    }

    window.location.replace(intendedPath);
    return {
      window_origin: window.location.origin,
      redirect_uri: window.location.origin,
      scope_bundle: bundle,
      scope: GOOGLE_SCOPE_BUNDLES[bundle].join(" "),
      provider: "lovable-managed-google",
    };
  }

  const { id: clientId, configured } = await getGoogleClientId();
  if (!configured) {
    throw new Error("Google OAuth er ikke konfigurert enda.");
  }

  const redirectUri = `${window.location.origin}/auth/google/callback`;
  const scopes = GOOGLE_SCOPE_BUNDLES[bundle].join(" ");
  const flowId = createFlowId();

  storePendingGoogleOAuth(flowId, bundle, intendedPath);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes,
    access_type: "offline",
    prompt: "consent",
    state: flowId,
  });
  params.set("include_granted_scopes", "false");
  params.set("hd", options?.hostedDomain ?? GOOGLE_WORKSPACE_DOMAIN);
  if (options?.loginHint) params.set("login_hint", options.loginHint);

  const maskedClientId = maskGoogleClientId(clientId);
  const authorizationUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  const maskedAuthorizationUrl = authorizationUrl.replace(
    encodeURIComponent(clientId),
    encodeURIComponent(maskedClientId),
  );

  const debug = {
    window_origin: window.location.origin,
    redirect_uri: redirectUri,
    client_id_masked: maskedClientId,
    scope_bundle: bundle,
    scope: scopes,
    response_type: "code",
    access_type: params.get("access_type"),
    prompt: params.get("prompt"),
    state: flowId,
    authorization_url_masked: maskedAuthorizationUrl,
  };
  // eslint-disable-next-line no-console
  console.info("[Google OAuth] authorize →", debug);
  // eslint-disable-next-line no-console
  console.table(debug);

  if (options?.mode === "redirect") {
    window.location.href = authorizationUrl;
    return debug;
  }

  const popup = window.open(authorizationUrl, "google-workspace-oauth", "popup,width=560,height=760");
  if (!popup) {
    throw new Error("Nettleseren blokkerte Google-vinduet. Tillat popup for denne siden og prøv igjen.");
  }
  return waitForGoogleWorkspacePopup(popup, flowId, intendedPath, debug);
}
