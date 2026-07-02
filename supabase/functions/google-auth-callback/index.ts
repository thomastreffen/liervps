/**
 * Google OAuth callback (per-user).
 *
 * Flow:
 *   1. Frontend redirects to Google authorize URL.
 *   2. Google redirects back to /auth/google/callback?code=...
 *   3. Frontend calls this function with { code, redirect_uri, scope_bundle }.
 *   4. This function exchanges the code for tokens, fetches userinfo,
 *      upserts a Supabase user, stores tokens in user_integration_tokens,
 *      and returns a Supabase session.
 *
 * scope_bundle values:
 *   - "sso"       → openid email profile
 *   - "calendar"  → + calendar
 *   - "mail"      → + gmail.modify gmail.send
 *   - "files"     → + drive.file
 *   - "full"      → everything
 */
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID") ?? "";
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET") ?? "";

const SCOPE_BUNDLES: Record<string, string[]> = {
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
};

interface Payload {
  code: string;
  redirect_uri: string;
  scope_bundle?: keyof typeof SCOPE_BUNDLES;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return jsonResponse(
      { error: "Google OAuth is not configured on the server (missing GOOGLE_OAUTH_CLIENT_ID/SECRET)." },
      503,
    );
  }

  let body: Payload;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { code, redirect_uri, scope_bundle = "sso" } = body;
  if (!code || !redirect_uri) {
    return jsonResponse({ error: "code and redirect_uri are required" }, 400);
  }

  // 1. Exchange authorization code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri,
      grant_type: "authorization_code",
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok) {
    console.error("[google-auth-callback] token exchange failed", tokenData);
    return jsonResponse(
      { error: tokenData.error_description || tokenData.error || "Token exchange failed" },
      400,
    );
  }

  const {
    access_token,
    refresh_token,
    expires_in,
    scope: granted_scope_string,
    id_token,
  } = tokenData as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
    id_token?: string;
  };

  // 2. Fetch userinfo (email, name, picture)
  const userinfoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  const userinfo = await userinfoRes.json();
  if (!userinfoRes.ok || !userinfo.email) {
    console.error("[google-auth-callback] userinfo failed", userinfo);
    return jsonResponse({ error: "Could not fetch Google userinfo" }, 400);
  }

  const email = String(userinfo.email).toLowerCase();
  const fullName = userinfo.name || email;

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 3. Find or create the Supabase auth user
  let userId: string | null = null;

  const { data: existingList, error: listErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listErr) {
    console.error("[google-auth-callback] listUsers failed", listErr);
    return jsonResponse({ error: "User lookup failed" }, 500);
  }
  const existing = existingList.users.find(
    (u) => (u.email ?? "").toLowerCase() === email,
  );

  if (existing) {
    userId = existing.id;
    // Refresh metadata name/picture
    await admin.auth.admin.updateUserById(existing.id, {
      user_metadata: {
        ...existing.user_metadata,
        full_name: fullName,
        avatar_url: userinfo.picture,
        provider: "google",
      },
    });
  } else {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        avatar_url: userinfo.picture,
        provider: "google",
        app_role: "montør",
      },
    });
    if (createErr || !created.user) {
      console.error("[google-auth-callback] createUser failed", createErr);
      return jsonResponse({ error: "Could not create user" }, 500);
    }
    userId = created.user.id;
  }

  // 4. Store tokens (skip for pure SSO if no refresh token — we don't need long-lived access)
  const grantedScopes = (granted_scope_string ?? "").split(" ").filter(Boolean);
  const hasNonBasicScope = grantedScopes.some(
    (s) => s.startsWith("https://www.googleapis.com/auth/"),
  );

  if (hasNonBasicScope || refresh_token) {
    const expiresAt = new Date(Date.now() + (expires_in ?? 3600) * 1000).toISOString();
    const { error: upsertErr } = await admin.from("user_integration_tokens").upsert(
      {
        user_id: userId!,
        provider: "google",
        scope: scope_bundle,
        access_token,
        refresh_token: refresh_token ?? null,
        expires_at: expiresAt,
        granted_scopes: grantedScopes,
        provider_account_email: email,
        metadata: { id_token_present: !!id_token },
      },
      { onConflict: "user_id,provider,scope" },
    );
    if (upsertErr) {
      console.error("[google-auth-callback] token upsert failed", upsertErr);
    }
  }

  // 5. Mint a Supabase session via magic link (admin.generateLink)
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkErr || !linkData) {
    console.error("[google-auth-callback] generateLink failed", linkErr);
    return jsonResponse({ error: "Could not create session" }, 500);
  }

  // The generateLink response includes `properties.hashed_token` + `email_otp`.
  // We verify the OTP server-side to obtain a real session, then return it.
  const otp = (linkData.properties as any)?.email_otp;
  if (!otp) {
    return jsonResponse({ error: "OTP not returned from generateLink" }, 500);
  }

  const anon = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: verified, error: verifyErr } = await anon.auth.verifyOtp({
    email,
    token: otp,
    type: "email",
  });
  if (verifyErr || !verified.session) {
    console.error("[google-auth-callback] verifyOtp failed", verifyErr);
    return jsonResponse({ error: "Could not verify session" }, 500);
  }

  return jsonResponse({
    session: {
      access_token: verified.session.access_token,
      refresh_token: verified.session.refresh_token,
    },
    user: {
      id: userId,
      email,
      name: fullName,
    },
    granted_scopes: grantedScopes,
  });
});
