import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/* ── Token helper ── */
async function ensureValidMsToken(
  supabaseAdmin: any,
  userId: string
): Promise<string | null> {
  const { data: userData, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error || !userData?.user) return null;

  const meta = userData.user.user_metadata || {};
  const accessToken = meta.ms_access_token;
  const refreshToken = meta.ms_refresh_token;
  const expiresAt = meta.ms_expires_at;

  if (!accessToken) return null;

  if (expiresAt && new Date(expiresAt).getTime() > Date.now() + 5 * 60 * 1000) {
    return accessToken;
  }

  if (!refreshToken) return null;

  console.log("[calendar-write-sync] Refreshing MS token for", userId);

  const tokenRes = await fetch(
    `https://login.microsoftonline.com/${Deno.env.get("AZURE_TENANT_ID")}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: Deno.env.get("AZURE_CLIENT_ID")!,
        client_secret: Deno.env.get("AZURE_CLIENT_SECRET")!,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        scope: "https://graph.microsoft.com/.default offline_access",
      }),
    }
  );

  if (!tokenRes.ok) {
    console.error("[calendar-write-sync] Token refresh failed:", await tokenRes.text());
    return null;
  }

  const tokenData = await tokenRes.json();
  const newExpires = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

  await supabaseAdmin.auth.admin.updateUserById(userId, {
    user_metadata: {
      ...meta,
      ms_access_token: tokenData.access_token,
      ms_refresh_token: tokenData.refresh_token || refreshToken,
      ms_expires_at: newExpires,
    },
  });

  return tokenData.access_token;
}

/* ── Strip UTC offset so Graph uses the explicit timeZone property ── */
function toLocalDateTimeString(isoString: string): string {
  const d = new Date(isoString);
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find(p => p.type === t)?.value || "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`;
}

/* ── Human-readable project type labels ── */
const PROJECT_TYPE_LABELS: Record<string, string> = {
  service: "Service",
  inspection: "Befaring",
  maintenance: "Vedlikehold",
  fdv: "FDV",
  installation: "Installasjon",
  project: "Prosjekt",
  repair: "Reparasjon",
  consultation: "Rådgivning",
  emergency: "Akutt",
  task: "Oppgave",
};

/* ── Format time for display ── */
function formatTimeRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const fmt = new Intl.DateTimeFormat("nb-NO", {
    timeZone: "Europe/Oslo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const dateFmt = new Intl.DateTimeFormat("nb-NO", {
    timeZone: "Europe/Oslo",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return `${dateFmt.format(start)}\n${fmt.format(start)} – ${fmt.format(end)}`;
}

/* ── Build Google Maps link ── */
function mapsLink(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

/* ── Normalize overnight: ensure end > start ── */
function normalizeEventTimes(event: any): { startTime: string; endTime: string } {
  const start = new Date(event.start_time);
  let end = new Date(event.end_time);
  if (end.getTime() <= start.getTime()) {
    end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
    console.log(`[calendar-write-sync] Overnight normalization: ${event.start_time} → ${end.toISOString()}`);
  }
  return { startTime: start.toISOString(), endTime: end.toISOString() };
}

/* ── Build Graph event body ── */
function buildGraphBody(
  event: any,
  customer?: any,
  assignment?: { eventTechnicianId?: string | null; technicianId?: string | null; techName?: string | null }
) {
  const { startTime: normalizedStart, endTime: normalizedEnd } = normalizeEventTimes(event);

  const typeLabel = PROJECT_TYPE_LABELS[event.project_type] || event.project_type || "Arbeid";
  const customerName = event.customer || customer?.name || "";
  const locationShort = event.address?.split(",")[0]?.trim() || "";

  const subjectParts = [customerName, typeLabel, locationShort].filter(Boolean);
  const subject = subjectParts.length >= 2
    ? subjectParts.join(" – ")
    : event.title || "Oppdrag";

  const timeDisplay = formatTimeRange(normalizedStart, normalizedEnd);
  const addressDisplay = event.address || "Ikke angitt";
  const mapsUrl = event.address ? mapsLink(event.address) : "";

  const startD = new Date(normalizedStart);
  const endD = new Date(normalizedEnd);
  const isOvernight = startD.toDateString() !== endD.toDateString();

  let html = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #1a1a1a;">`;

  html += `<p style="margin: 0 0 4px; font-size: 13px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Oppdrag</p>`;
  html += `<p style="margin: 0 0 ${event.assignment_notes ? "8" : "16"}px; font-size: 15px;">${event.title || typeLabel}${event.description ? `<br/><span style="color: #6b7280;">${event.description}</span>` : ""}${isOvernight ? '<br/><span style="color: #7c3aed;">🌙 Nattoppdrag</span>' : ""}</p>`;

  if (assignment?.techName) {
    html += `<p style="margin: 0 0 4px; font-size: 13px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Tildelt montør</p>`;
    html += `<p style="margin: 0 0 16px; font-size: 15px; color: #1a1a1a;">${assignment.techName}</p>`;
  }

  if (event.assignment_notes) {
    html += `<p style="margin: 0 0 4px; font-size: 13px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Instruks for denne tildelingen</p>`;
    html += `<p style="margin: 0 0 16px; font-size: 15px; color: #1a1a1a;">${event.assignment_notes}</p>`;
  }

  html += `<p style="margin: 0 0 4px; font-size: 13px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Tidspunkt</p>`;
  html += `<p style="margin: 0 0 16px; font-size: 15px; white-space: pre-line;">${timeDisplay}</p>`;

  html += `<p style="margin: 0 0 4px; font-size: 13px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Sted</p>`;
  html += `<p style="margin: 0 0 4px; font-size: 15px;">${addressDisplay}</p>`;
  if (mapsUrl) {
    html += `<p style="margin: 0 0 16px;"><a href="${mapsUrl}" style="color: #2563eb; text-decoration: none;">📍 Åpne i kart</a></p>`;
  } else {
    html += `<p style="margin: 0 0 16px;"></p>`;
  }

  if (customerName || customer?.main_phone || customer?.main_email) {
    html += `<p style="margin: 0 0 4px; font-size: 13px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Kontakt</p>`;
    const contactParts: string[] = [];
    if (customerName) contactParts.push(customerName);
    if (customer?.main_phone) contactParts.push(`📞 <a href="tel:${customer.main_phone}" style="color: #2563eb; text-decoration: none;">${customer.main_phone}</a>`);
    if (customer?.main_email) contactParts.push(`✉️ ${customer.main_email}`);
    html += `<p style="margin: 0 0 16px; font-size: 15px;">${contactParts.join("<br/>")}</p>`;
  }

  const attachments = Array.isArray(event.attachments) ? event.attachments : [];
  if (attachments.length > 0) {
    html += `<p style="margin: 0 0 4px; font-size: 13px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Vedlegg</p>`;
    html += `<ul style="margin: 0 0 16px; padding-left: 20px;">`;
    for (const att of attachments) {
      const name = att.name || "Vedlegg";
      const url = att.url || "#";
      html += `<li style="margin-bottom: 4px;"><a href="${url}" style="color: #2563eb; text-decoration: none;">📎 ${name}</a></li>`;
    }
    html += `</ul>`;
  }

  const jobUrl = `https://mcsressurs.lovable.app/jobs/${event.id}`;
  html += `<p style="margin: 16px 0 0;"><a href="${jobUrl}" style="color: #2563eb; text-decoration: none; font-size: 13px;">🔗 Åpne i MCS Ressurs</a></p>`;

  html += `<!-- MCS_SOURCE:true MCS_EVENT_ID:${event.id}${assignment?.eventTechnicianId ? ` MCS_ASSIGNMENT_ID:${assignment.eventTechnicianId}` : ""}${assignment?.technicianId ? ` MCS_TECHNICIAN_ID:${assignment.technicianId}` : ""} -->`;

  html += `</div>`;

  const body: any = {
    subject: isOvernight ? `🌙 ${subject}` : subject,
    body: { contentType: "HTML", content: html },
    start: { dateTime: toLocalDateTimeString(normalizedStart), timeZone: "Europe/Oslo" },
    end: { dateTime: toLocalDateTimeString(normalizedEnd), timeZone: "Europe/Oslo" },
    showAs: "busy",
    isReminderOn: true,
    reminderMinutesBeforeStart: 15,
    categories: ["MCS"],
  };

  if (event.address) {
    body.location = {
      displayName: event.address,
      address: { street: event.address },
    };
  }

  return body;
}

/* ── Resolve caller user_id from token ── */
async function resolveCallerUserId(req: Request, supabaseAdmin: any): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.replace("Bearer ", "");
  const anonClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data, error } = await anonClient.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user.id;
}

/* ── Per-technician calendar sync helper ── */
async function syncForTechnician(
  supabaseAdmin: any,
  tech: any,
  eventTechRow: any,
  event: any,
  customer: any,
  graphBody: any,
  action: string,
  callerUserId: string | null,
  logAction: (actionType: string, summary: string) => Promise<void>
): Promise<any> {
  const userId = tech.user_id;
  if (!userId) {
    return { techId: tech.id, techName: tech.name, status: "no_user_id" };
  }

  const msToken = await ensureValidMsToken(supabaseAdmin, userId);
  if (!msToken) {
    return { techId: tech.id, techName: tech.name, status: "no_token" };
  }

  const techEmail = tech.email;
  if (!techEmail) {
    return { techId: tech.id, techName: tech.name, status: "no_email" };
  }

  const existingCalEventId = eventTechRow.calendar_event_id as string | null;

  if (action === "create") {
    // Concurrency guard: claim the row before Graph POST to prevent duplicate events
    let pendingMarker: string | null = null;
    let claimed = false;

    if (existingCalEventId && !existingCalEventId.startsWith("pending:")) {
      return { techId: tech.id, techName: tech.name, status: "already_exists", calendarEventId: existingCalEventId };
    }

    if (!existingCalEventId) {
      pendingMarker = `pending:${crypto.randomUUID()}`;
      const { data: claimRow, error: claimErr } = await supabaseAdmin
        .from("event_technicians")
        .update({ calendar_event_id: pendingMarker })
        .eq("id", eventTechRow.id)
        .is("calendar_event_id", null)
        .select("id")
        .maybeSingle();

      if (claimErr) {
        console.error(`[calendar-write-sync] Claim failed for event_technician ${eventTechRow.id}:`, claimErr.message);
        return { techId: tech.id, techName: tech.name, status: "error", code: "claim_failed" };
      }

      if (!claimRow) {
        const { data: currentRow } = await supabaseAdmin
          .from("event_technicians")
          .select("calendar_event_id")
          .eq("id", eventTechRow.id)
          .maybeSingle();

        const currentId = currentRow?.calendar_event_id as string | null | undefined;
        if (currentId && !currentId.startsWith("pending:")) {
          return { techId: tech.id, techName: tech.name, status: "already_exists", calendarEventId: currentId };
        }

        return { techId: tech.id, techName: tech.name, status: "in_progress" };
      }

      claimed = true;
    } else {
      return { techId: tech.id, techName: tech.name, status: "in_progress" };
    }

    const res = await fetch(
      `https://graph.microsoft.com/v1.0/users/${techEmail}/events`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${msToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(graphBody),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[calendar-write-sync] Create failed for ${techEmail}:`, res.status, errText);

      if (claimed && pendingMarker) {
        await supabaseAdmin
          .from("event_technicians")
          .update({ calendar_event_id: null })
          .eq("id", eventTechRow.id)
          .eq("calendar_event_id", pendingMarker);
      }

      return { techId: tech.id, techName: tech.name, status: "error", code: res.status };
    }

    const data = await res.json();
    let saveQuery = supabaseAdmin
      .from("event_technicians")
      .update({ calendar_event_id: data.id })
      .eq("id", eventTechRow.id);

    if (claimed && pendingMarker) {
      saveQuery = saveQuery.eq("calendar_event_id", pendingMarker);
    }

    await saveQuery;

    await logAction("outlook_created", `Outlook-event opprettet for ${tech.name} (${techEmail})`);
    return { techId: tech.id, techName: tech.name, status: "created", calendarEventId: data.id };
  }

  if (action === "update" || action === "force_update") {
    if (existingCalEventId?.startsWith("pending:")) {
      return { techId: tech.id, techName: tech.name, status: "in_progress" };
    }

    if (!existingCalEventId) {
      // No existing calendar event → create instead
      const res = await fetch(
        `https://graph.microsoft.com/v1.0/users/${techEmail}/events`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${msToken}`, "Content-Type": "application/json" },
          body: JSON.stringify(graphBody),
        }
      );

      if (!res.ok) {
        const errText = await res.text();
        console.error(`[calendar-write-sync] Create (from update) failed for ${techEmail}:`, res.status, errText);
        return { techId: tech.id, techName: tech.name, status: "error", code: res.status };
      }

      const data = await res.json();
      await supabaseAdmin.from("event_technicians")
        .update({ calendar_event_id: data.id })
        .eq("id", eventTechRow.id);

      await logAction("outlook_created", `Outlook-event opprettet (fra oppdatering) for ${tech.name}`);
      return { techId: tech.id, techName: tech.name, status: "created", calendarEventId: data.id };
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${msToken}`,
      "Content-Type": "application/json",
    };
    // Only use If-Match for non-force updates
    if (action === "update" && event.microsoft_etag) {
      // Note: per-tech etags would be ideal, but for now skip If-Match for multi-tech
    }

    const res = await fetch(
      `https://graph.microsoft.com/v1.0/users/${techEmail}/events/${existingCalEventId}`,
      { method: "PATCH", headers, body: JSON.stringify(graphBody) }
    );

    if (res.status === 409 || res.status === 412) {
      await logAction("outlook_conflict", `Outlook-konflikt for ${tech.name} (${res.status})`);
      return { techId: tech.id, techName: tech.name, status: "conflict", code: res.status };
    }

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[calendar-write-sync] PATCH failed for ${techEmail}:`, res.status, errText);
      return { techId: tech.id, techName: tech.name, status: "error", code: res.status };
    }

    await logAction("outlook_updated", `Outlook-event oppdatert for ${tech.name}`);
    return { techId: tech.id, techName: tech.name, status: "updated" };
  }

  if (action === "delete") {
    if (!existingCalEventId) {
      return { techId: tech.id, techName: tech.name, status: "no_calendar_event" };
    }

    const res = await fetch(
      `https://graph.microsoft.com/v1.0/users/${techEmail}/events/${existingCalEventId}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${msToken}` } }
    );

    if (!res.ok && res.status !== 404) {
      console.error(`[calendar-write-sync] DELETE failed for ${techEmail}:`, res.status);
      return { techId: tech.id, techName: tech.name, status: "error", code: res.status };
    }

    await supabaseAdmin.from("event_technicians")
      .update({ calendar_event_id: null })
      .eq("id", eventTechRow.id);

    await logAction("outlook_deleted", `Outlook-event slettet for ${tech.name}`);
    return { techId: tech.id, techName: tech.name, status: "deleted" };
  }

  return { techId: tech.id, techName: tech.name, status: "unknown_action" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const callerUserId = await resolveCallerUserId(req, supabaseAdmin);

    // ── Server-side permission check ──
    if (callerUserId) {
      const { data: canWrite } = await supabaseAdmin.rpc("check_permission_v2", {
        _auth_user_id: callerUserId,
        _perm: "calendar.write_events",
      });
      if (!canWrite) {
        console.log(`[calendar-write-sync] DENIED: User ${callerUserId} lacks calendar.write_events`);
        return new Response(JSON.stringify({ error: "Mangler rettighet: calendar.write_events", error_code: "permission_denied" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = await req.json();
    const { action, event_id } = body;

    if (!action || !event_id) {
      return new Response(JSON.stringify({ error: "Missing action or event_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch event with technicians + customer
    const { data: event, error: eventErr } = await supabaseAdmin
      .from("events")
      .select(`
        *,
        event_technicians (
          id,
          technician_id,
          calendar_event_id,
          technicians ( id, name, email, user_id )
        ),
        customers ( id, name, main_phone, main_email )
      `)
      .eq("id", event_id)
      .single();

    if (eventErr || !event) {
      return new Response(JSON.stringify({ error: "Event not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Server-side overnight normalization: ensure end > start in DB
    const evStart = new Date(event.start_time);
    const evEnd = new Date(event.end_time);
    if (evEnd.getTime() <= evStart.getTime()) {
      const correctedEnd = new Date(evEnd.getTime() + 24 * 60 * 60 * 1000);
      console.log(`[calendar-write-sync] Correcting overnight: end ${event.end_time} → ${correctedEnd.toISOString()}`);
      await supabaseAdmin.from("events").update({
        end_time: correctedEnd.toISOString(),
      }).eq("id", event_id);
      event.end_time = correctedEnd.toISOString();
    }

    const customer = event.customers || null;

    // Get technicians with their event_technicians row info
    const techRows = (event.event_technicians ?? [])
      .filter((et: any) => et.technicians?.user_id)
      .map((et: any) => ({
        eventTechRow: { id: et.id, calendar_event_id: et.calendar_event_id },
        tech: et.technicians,
      }));

    if (techRows.length === 0) {
      console.log("[calendar-write-sync] No technicians with user_id for event", event_id);
      return new Response(JSON.stringify({ status: "no_token", message: "Ingen montører med bruker-kobling" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const logAction = async (actionType: string, summary: string) => {
      await supabaseAdmin.from("event_logs").insert({
        event_id,
        action_type: actionType,
        performed_by: callerUserId || null,
        change_summary: summary,
      });
    };

    // ── Sync for EACH technician independently ──
    const results: any[] = [];
    for (const { eventTechRow, tech } of techRows) {
      const graphBody = buildGraphBody(event, customer, {
        eventTechnicianId: eventTechRow.id,
        technicianId: tech.id,
        techName: tech.name,
      });
      const result = await syncForTechnician(
        supabaseAdmin, tech, eventTechRow, event, customer,
        graphBody, action, callerUserId, logAction
      );
      results.push(result);
    }

    // Determine overall status
    const hasCreated = results.some(r => r.status === "created");
    const hasUpdated = results.some(r => r.status === "updated");
    const hasDeleted = results.some(r => r.status === "deleted");
    const hasConflict = results.some(r => r.status === "conflict");
    const hasError = results.some(r => r.status === "error");
    const hasAlreadyExists = results.some(r => r.status === "already_exists");
    const hasInProgress = results.some(r => r.status === "in_progress");

    let overallStatus = "ok";
    if (action === "create" && (hasCreated || hasAlreadyExists || hasInProgress)) overallStatus = "created";
    else if (action === "update" && hasUpdated) overallStatus = "updated";
    else if (action === "force_update" && (hasUpdated || hasCreated)) overallStatus = "force_updated";
    else if (action === "delete" && hasDeleted) overallStatus = "deleted";
    else if (hasConflict) overallStatus = "conflict";
    else if (hasError) overallStatus = "error";
    else if (results.every(r => r.status === "no_token")) overallStatus = "no_token";

    // Update legacy microsoft_event_id on events table for backward compat
    const firstCreated = results.find(r => r.calendarEventId);
    if (firstCreated && !event.microsoft_event_id) {
      await supabaseAdmin.from("events").update({
        microsoft_event_id: firstCreated.calendarEventId,
        outlook_sync_status: "synced",
        outlook_last_synced_at: new Date().toISOString(),
      }).eq("id", event_id);
    }

    if (action === "delete") {
      await supabaseAdmin.from("events").update({
        microsoft_event_id: null,
        microsoft_etag: null,
        outlook_sync_status: "not_synced",
        outlook_last_synced_at: null,
      }).eq("id", event_id);
    }

    console.log(`[calendar-write-sync] ${action} for event ${event_id}: ${results.length} technicians, status: ${overallStatus}`);

    return new Response(JSON.stringify({ status: overallStatus, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[calendar-write-sync] Exception:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
