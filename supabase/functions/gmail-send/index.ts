/**
 * Gmail send (per-user).
 *
 * Body: { to: string | string[], subject: string, text: string, html?: string }
 *
 * Returns:
 *   { status: "sent" | "no_token" | "error", ... }
 */
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID") ?? "";
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET") ?? "";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getUser(req: Request) {
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return null;
  const c = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data } = await c.auth.getUser(jwt);
  return data?.user ?? null;
}

async function loadMailToken(admin: any, userId: string) {
  const { data } = await admin
    .from("user_integration_tokens")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "google")
    .order("updated_at", { ascending: false });
  if (!data?.length) return null;
  return data.find((t: any) =>
    (t.granted_scopes ?? []).some((s: string) => s === "https://www.googleapis.com/auth/gmail.send"),
  ) ?? null;
}

async function refresh(admin: any, tokenRow: any): Promise<string | null> {
  const now = Date.now();
  const exp = tokenRow.expires_at ? new Date(tokenRow.expires_at).getTime() : 0;
  if (tokenRow.access_token && exp - now > 60_000) return tokenRow.access_token;
  if (!tokenRow.refresh_token) return tokenRow.access_token ?? null;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: tokenRow.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const d = await r.json();
  if (!r.ok || !d.access_token) return null;
  const newExp = new Date(Date.now() + (d.expires_in ?? 3600) * 1000).toISOString();
  await admin.from("user_integration_tokens")
    .update({ access_token: d.access_token, expires_at: newExp })
    .eq("id", tokenRow.id);
  return d.access_token;
}

function toBase64Url(str: string): string {
  // Deno supports btoa on latin1 strings; encode UTF-8 first
  const utf8 = new TextEncoder().encode(str);
  let bin = "";
  for (const b of utf8) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return json({ status: "error", code: "not_configured" });

  const user = await getUser(req);
  if (!user) return json({ status: "error", code: "unauthenticated" }, 401);

  let body: { to?: string | string[]; event_id?: string; subject?: string; text?: string; html?: string };
  try { body = await req.json(); } catch { return json({ status: "error", code: "bad_json" }, 400); }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Resolve recipients
  let rcpts: string[] = Array.isArray(body.to) ? body.to : body.to ? [body.to] : [];
  if (rcpts.length === 0 && body.event_id) {
    const { data: techs } = await admin
      .from("event_technicians")
      .select("technician_id, technicians!inner(user_id)")
      .eq("event_id", body.event_id);
    const userIds = (techs ?? [])
      .map((t: any) => t.technicians?.user_id)
      .filter(Boolean);
    for (const uid of userIds) {
      const { data: u } = await admin.auth.admin.getUserById(uid);
      if (u?.user?.email) rcpts.push(u.user.email);
    }
  }
  if (!rcpts.length || !body.subject || (!body.text && !body.html)) {
    return json({ status: rcpts.length === 0 ? "no_recipients" : "error", code: "missing_fields" }, 200);
  }


  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const tokenRow = await loadMailToken(admin, user.id);
  if (!tokenRow) return json({ status: "no_token" });
  const accessToken = await refresh(admin, tokenRow);
  if (!accessToken) return json({ status: "no_token" });

  const senderEmail = tokenRow.provider_account_email || user.email || "me";
  const contentType = body.html ? 'text/html; charset="UTF-8"' : 'text/plain; charset="UTF-8"';
  const bodyContent = body.html ?? body.text ?? "";
  const rfc2822 = [
    `To: ${rcpts.join(", ")}`,
    `From: ${senderEmail}`,
    `Subject: ${body.subject}`,
    "MIME-Version: 1.0",
    `Content-Type: ${contentType}`,
    "",
    bodyContent,
  ].join("\r\n");

  const raw = toBase64Url(rfc2822);
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error("[gmail-send] failed", res.status, data);
    return json({ status: "error", code: res.status, detail: data?.error?.message ?? "unknown" });
  }
  return json({ status: "sent", message_id: data.id });
});
