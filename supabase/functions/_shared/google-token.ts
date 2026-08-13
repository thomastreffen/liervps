// Shared Google OAuth token helpers for edge functions (per-user tokens).

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID") ?? "";
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET") ?? "";

export const SCOPE_GMAIL_SEND = "https://www.googleapis.com/auth/gmail.send";
export const SCOPE_DRIVE_FILE = "https://www.googleapis.com/auth/drive.file";

function hasScope(row: any, scopes: string[]) {
  const granted: string[] = row?.granted_scopes ?? [];
  return scopes.some((s) => granted.includes(s));
}

/** Newest google token row for a user that granted one of the given scopes. */
export async function loadUserToken(admin: any, userId: string, scopes: string[]) {
  const { data } = await admin
    .from("user_integration_tokens")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "google")
    .order("updated_at", { ascending: false });
  return (data ?? []).find((t: any) => hasScope(t, scopes)) ?? null;
}

/**
 * Any internal token that granted the scope — used for system notifications
 * triggered by anonymous website visitors (no signed-in user).
 */
export async function loadAnyInternalToken(admin: any, scopes: string[]) {
  const { data } = await admin
    .from("user_integration_tokens")
    .select("*")
    .eq("provider", "google")
    .order("updated_at", { ascending: false });
  return (data ?? []).find((t: any) => hasScope(t, scopes)) ?? null;
}

export async function ensureFreshAccessToken(admin: any, tokenRow: any): Promise<string | null> {
  if (!tokenRow) return null;
  const now = Date.now();
  const expiresAt = tokenRow.expires_at ? new Date(tokenRow.expires_at).getTime() : 0;
  if (tokenRow.access_token && expiresAt - now > 60_000) return tokenRow.access_token;
  if (!tokenRow.refresh_token) return tokenRow.access_token ?? null;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return null;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: tokenRow.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    console.error("[google-token] refresh failed", data);
    return null;
  }
  const newExpiresAt = new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString();
  await admin
    .from("user_integration_tokens")
    .update({ access_token: data.access_token, expires_at: newExpiresAt })
    .eq("id", tokenRow.id);
  return data.access_token;
}

function toBase64Url(str: string): string {
  const utf8 = new TextEncoder().encode(str);
  let bin = "";
  for (const b of utf8) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Sends a plain-text mail via Gmail. Returns Gmail message id, throws on API error. */
export async function gmailSendText(
  accessToken: string,
  from: string,
  to: string[],
  subject: string,
  text: string,
): Promise<string> {
  const rfc2822 = [
    `To: ${to.join(", ")}`,
    `From: ${from}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    text,
  ].join("\r\n");

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: toBase64Url(rfc2822) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`gmail ${res.status}: ${data?.error?.message ?? "unknown"}`);
  return data.id as string;
}
