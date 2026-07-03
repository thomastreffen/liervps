/**
 * Google Calendar sync (per-user).
 *
 * Body: { action: "create" | "update" | "delete", event_id: string }
 *
 * Returns:
 *   { status: "created" | "updated" | "deleted" | "no_token" | "not_found" | "error", ... }
 *
 * "no_token" means the current user has not connected Google Calendar yet
 * — the caller should show a non-blocking toast, not treat it as failure.
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

async function getUserFromAuthHeader(req: Request) {
  const auth = req.headers.get("Authorization") ?? "";
  const jwt = auth.replace(/^Bearer\s+/i, "");
  if (!jwt) return null;
  const client = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.getUser(jwt);
  if (error || !data.user) return null;
  return data.user;
}

async function loadCalendarToken(admin: any, userId: string) {
  // Try richer bundles first, fall back to any bundle that granted calendar scope.
  const { data } = await admin
    .from("user_integration_tokens")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "google")
    .order("updated_at", { ascending: false });
  if (!data || data.length === 0) return null;
  return data.find((t: any) =>
    (t.granted_scopes ?? []).some((s: string) =>
      s === "https://www.googleapis.com/auth/calendar" ||
      s === "https://www.googleapis.com/auth/calendar.events",
    ),
  ) ?? null;
}

async function ensureFreshAccessToken(admin: any, tokenRow: any): Promise<string | null> {
  const now = Date.now();
  const expiresAt = tokenRow.expires_at ? new Date(tokenRow.expires_at).getTime() : 0;
  if (tokenRow.access_token && expiresAt - now > 60_000) return tokenRow.access_token;
  if (!tokenRow.refresh_token) return tokenRow.access_token ?? null;

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
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    console.error("[google-calendar-sync] refresh failed", data);
    return null;
  }
  const newExpiresAt = new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString();
  await admin
    .from("user_integration_tokens")
    .update({ access_token: data.access_token, expires_at: newExpiresAt })
    .eq("id", tokenRow.id);
  return data.access_token;
}

function buildGoogleEventBody(ev: any, attendeeEmails: string[]) {
  const descParts: string[] = [];
  if (ev.description) descParts.push(ev.description);
  const meta: string[] = [];
  if (ev.customer) meta.push(`Kunde: ${ev.customer}`);
  const addr = [ev.address, ev.postal_code, ev.city].filter(Boolean).join(", ");
  if (addr) meta.push(`Adresse: ${addr}`);
  if (ev.site_contact_name || ev.site_contact_phone) {
    meta.push(`Kontakt: ${[ev.site_contact_name, ev.site_contact_phone].filter(Boolean).join(" · ")}`);
  }
  if (meta.length) descParts.push(meta.join("\n"));
  return {
    summary: ev.title || "Lier VPS aktivitet",
    description: descParts.join("\n\n"),
    location: addr || undefined,
    start: { dateTime: new Date(ev.start_time).toISOString() },
    end: { dateTime: new Date(ev.end_time ?? ev.start_time).toISOString() },
    attendees: attendeeEmails.map((email) => ({ email })),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return json({ status: "error", code: "not_configured" }, 200);
  }

  const user = await getUserFromAuthHeader(req);
  if (!user) return json({ status: "error", code: "unauthenticated" }, 401);

  let body: { action?: string; event_id?: string };
  try { body = await req.json(); } catch { return json({ status: "error", code: "bad_json" }, 400); }
  const { action, event_id } = body;
  if (!action || !event_id) return json({ status: "error", code: "missing_params" }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const tokenRow = await loadCalendarToken(admin, user.id);
  if (!tokenRow) return json({ status: "no_token" });

  const accessToken = await ensureFreshAccessToken(admin, tokenRow);
  if (!accessToken) return json({ status: "no_token" });

  const { data: ev, error: evErr } = await admin
    .from("events")
    .select("id,title,description,customer,address,postal_code,city,site_contact_name,site_contact_phone,start_time,end_time,google_calendar_event_id,google_calendar_id")
    .eq("id", event_id)
    .maybeSingle();
  if (evErr || !ev) return json({ status: "error", code: "event_not_found" }, 404);

  // Gather attendee emails from event_technicians
  const { data: techs } = await admin
    .from("event_technicians")
    .select("technician_id, technicians!inner(user_id)")
    .eq("event_id", event_id);
  const userIds = (techs ?? [])
    .map((t: any) => t.technicians?.user_id)
    .filter(Boolean);
  const attendeeEmails: string[] = [];
  for (const uid of userIds) {
    const { data: u } = await admin.auth.admin.getUserById(uid);
    if (u?.user?.email) attendeeEmails.push(u.user.email);
  }

  const calendarId = ev.google_calendar_id || "primary";
  const gEventBody = buildGoogleEventBody(ev, attendeeEmails);

  if (action === "delete") {
    if (!ev.google_calendar_event_id) return json({ status: "not_found" });
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(ev.google_calendar_event_id)}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (res.status === 404 || res.status === 410) {
      await admin.from("events").update({ google_calendar_event_id: null }).eq("id", event_id);
      return json({ status: "deleted" });
    }
    if (!res.ok) {
      const errText = await res.text();
      console.error("[google-calendar-sync] delete failed", res.status, errText);
      return json({ status: "error", code: res.status, detail: errText });
    }
    await admin.from("events").update({ google_calendar_event_id: null }).eq("id", event_id);
    return json({ status: "deleted" });
  }

  const isUpdate = action === "update" && !!ev.google_calendar_event_id;
  const url = isUpdate
    ? `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(ev.google_calendar_event_id!)}`
    : `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=none`;

  const res = await fetch(url, {
    method: isUpdate ? "PATCH" : "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(gEventBody),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error("[google-calendar-sync] write failed", res.status, data);
    return json({ status: "error", code: res.status, detail: data?.error?.message ?? "unknown" });
  }

  await admin
    .from("events")
    .update({
      google_calendar_event_id: data.id,
      google_calendar_id: calendarId,
      google_calendar_synced_at: new Date().toISOString(),
    })
    .eq("id", event_id);

  return json({
    status: isUpdate ? "updated" : "created",
    google_event_id: data.id,
    html_link: data.htmlLink,
  });
});
