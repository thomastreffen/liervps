// Public attachment fetch for the order tracking page (anonymous customers).
// Validates a tracking_token + attachment_id pair via SECURITY DEFINER RPC,
// then returns a short-lived signed URL using the service role.
//
// Visibility rules (enforced in get_attachment_by_token):
//   - submission must not be soft-deleted
//   - attachment must not be soft-deleted
//   - if attachment is linked to a message, that message must be
//     is_visible_to_customer = true

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "order-form-attachments";

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|heic|heif|bmp|avif)$/i;

function folderOf(path: string) {
  const idx = path.lastIndexOf("/");
  return idx > 0 ? path.slice(0, idx) : "";
}

function imageStem(name: string) {
  return name
    .replace(/\.[^.]+$/i, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

async function findLegacyImagePath(admin: ReturnType<typeof createClient>, filePath: string, fileName: string) {
  const folder = folderOf(filePath);
  if (!folder) return null;
  const wanted = imageStem(fileName);
  if (!wanted) return null;

  const { data, error } = await admin.storage.from(BUCKET).list(folder, { limit: 100, sortBy: { column: "name", order: "desc" } });
  if (error || !data) {
    console.error("legacy image list failed", error);
    return null;
  }

  const match = data.find((obj) => IMAGE_EXT.test(obj.name) && imageStem(obj.name).includes(wanted));
  return match ? `${folder}/${match.name}` : null;
}

function json(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  let body: { tracking_token?: string; attachment_id?: string; expires_in?: number };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const token = (body.tracking_token || "").trim();
  const attachmentId = (body.attachment_id || "").trim();
  const expiresIn = Math.min(Math.max(body.expires_in ?? 600, 60), 3600);

  if (!token || !attachmentId) {
    return json(400, { error: "tracking_token og attachment_id kreves" });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin.rpc("get_attachment_by_token", {
    _token: token,
    _attachment_id: attachmentId,
  });

  if (error) {
    console.error("get_attachment_by_token failed", error);
    return json(500, { error: "Kunne ikke slå opp vedlegg" });
  }

  const att = Array.isArray(data) ? data[0] : data;
  if (!att?.file_path) {
    return json(404, { error: "Vedlegget finnes ikke eller er ikke tilgjengelig" });
  }

  let pathToSign = att.file_path;
  let { data: signed, error: signErr } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(pathToSign, expiresIn);

  if (signErr || !signed?.signedUrl) {
    const fallbackPath = await findLegacyImagePath(admin, att.file_path, att.file_name || "");
    if (fallbackPath && fallbackPath !== pathToSign) {
      pathToSign = fallbackPath;
      const fallback = await admin.storage.from(BUCKET).createSignedUrl(pathToSign, expiresIn);
      signed = fallback.data;
      signErr = fallback.error;
    }
  }

  if (signErr || !signed?.signedUrl) {
    console.error("signed url failed", signErr);
    return json(500, { error: "Kunne ikke generere lenke" });
  }

  return json(200, {
    ok: true,
    signed_url: signed.signedUrl,
    file_name: att.file_name,
    mime_type: att.mime_type,
    file_size: att.file_size,
    resolved_path: pathToSign,
    expires_in: expiresIn,
  });
});
