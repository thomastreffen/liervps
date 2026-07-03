/**
 * Google OAuth helpers (frontend).
 * Builds authorize URLs and initiates redirects.
 */

import { supabase } from "@/integrations/supabase/client";

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
    "https://www.googleapis.com/auth/gmail.modify",
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
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/drive.file",
  ],
} as const;

export type GoogleScopeBundle = keyof typeof GOOGLE_SCOPE_BUNDLES;

/**
 * Client ID is a public value — fetched at runtime from the
 * google-oauth-config edge function (which reads GOOGLE_OAUTH_CLIENT_ID).
 * Cached in-memory for the session.
 */
let _clientIdCache: { id: string; configured: boolean } | null = null;

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

export async function startGoogleLogin(options?: {
  scopeBundle?: GoogleScopeBundle;
  hostedDomain?: string;
  loginHint?: string;
  intendedPath?: string;
}) {
  const { id: clientId, configured } = await getGoogleClientId();
  if (!configured) {
    throw new Error("Google OAuth er ikke konfigurert enda.");
  }

  const bundle = options?.scopeBundle ?? "sso";
  const redirectUri = `${window.location.origin}/auth/google/callback`;
  const scopes = GOOGLE_SCOPE_BUNDLES[bundle].join(" ");

  sessionStorage.setItem(
    "google-oauth-pending",
    JSON.stringify({
      scope_bundle: bundle,
      intended_path: options?.intendedPath ?? "/",
      started_at: Date.now(),
    }),
  );

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes,
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent select_account",
  });
  if (options?.hostedDomain) params.set("hd", options.hostedDomain);
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
    access_type: "offline",
    prompt: params.get("prompt"),
    authorization_url_masked: maskedAuthorizationUrl,
  };
  // eslint-disable-next-line no-console
  console.info("[Google OAuth] authorize →", debug);
  // eslint-disable-next-line no-console
  console.table(debug);

  window.location.href = authorizationUrl;
  return debug;
}
