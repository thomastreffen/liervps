/**
 * Google OAuth helpers (frontend).
 * Builds authorize URLs and initiates redirects.
 */

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
 * Client ID is a public value — safe to expose in the frontend.
 * Configure it either as VITE_GOOGLE_OAUTH_CLIENT_ID at build time,
 * or leave blank; the login button will show a friendly "not configured" message.
 */
export const GOOGLE_CLIENT_ID: string =
  (import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID as string | undefined) ?? "";

export function isGoogleConfigured(): boolean {
  return !!GOOGLE_CLIENT_ID;
}

export function startGoogleLogin(options?: {
  scopeBundle?: GoogleScopeBundle;
  hostedDomain?: string;
  loginHint?: string;
  intendedPath?: string;
}) {
  const bundle = options?.scopeBundle ?? "sso";
  const redirectUri = `${window.location.origin}/auth/google/callback`;
  const scopes = GOOGLE_SCOPE_BUNDLES[bundle].join(" ");

  // Persist the scope bundle and intended post-login path so the callback
  // page can use them without relying on OAuth state (which Google truncates).
  sessionStorage.setItem(
    "google-oauth-pending",
    JSON.stringify({
      scope_bundle: bundle,
      intended_path: options?.intendedPath ?? "/",
      started_at: Date.now(),
    }),
  );

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes,
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent select_account",
  });
  if (options?.hostedDomain) params.set("hd", options.hostedDomain);
  if (options?.loginHint) params.set("login_hint", options.loginHint);

  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
