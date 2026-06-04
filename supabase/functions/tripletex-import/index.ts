// Tripletex project import — preview + apply.
// Idempotent: bruker tripletex_project_mappings + dedup-signaler mot events.
// Oppretter ALDRI prosjekter automatisk for "needs_review"; venter på brukerens valg.
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

type ActionKey = "create" | "update" | "unchanged" | "needs_review" | "skipped" | "error";

interface RawRow {
  // Klient sender allerede normaliserte felter
  rowKey: string;                  // stabil ID per importrad (fra klient, f.eks. tripletex_project_id eller hash av CSV-rad)
  tripletex_project_id: string;
  tripletex_project_number?: string | null;
  title?: string | null;
  customer?: string | null;
  address?: string | null;
  status?: string | null;
}

interface Decision {
  action: "create" | "update" | "ignore";
  matchedMcsProjectId?: string | null;
}

interface Body {
  mode: "preview" | "apply";
  companyId: string;
  rows: RawRow[];
  sourceFilename?: string | null;
  decisions?: Record<string, Decision>;
  runId?: string;
}

interface PreviewItem {
  rowKey: string;
  action: ActionKey;
  reason: string;
  matchedMcsProjectId: string | null;
  matchBasis: string | null;
  matchedTitle: string | null;
  matchedProjectNumber: string | null;
  candidates: Array<{ id: string; title: string; project_number: string | null; basis: string; confidence: number }>;
  payloadHash: string;
  row: RawRow;
}

function normalize(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9æøå ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function stablePayload(row: RawRow): string {
  return JSON.stringify({
    id: row.tripletex_project_id,
    n: row.tripletex_project_number ?? null,
    t: (row.title ?? "").trim(),
    c: (row.customer ?? "").trim(),
    a: (row.address ?? "").trim(),
    s: (row.status ?? "").trim(),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Authn
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userId = userData.user.id;

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!body?.companyId || !body?.mode || !Array.isArray(body.rows)) {
    return new Response(JSON.stringify({ error: "missing_fields" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (body.rows.length > 5000) {
    return new Response(JSON.stringify({ error: "too_many_rows", max: 5000 }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Authz: må være medlem av company eller super_admin
  const { data: isSuper } = await admin.rpc("has_role", {
    _user_id: userId,
    _role: "super_admin",
  });
  if (!isSuper) {
    const { count } = await admin
      .from("user_memberships")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("company_id", body.companyId);
    if (!count) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // Forhåndshent: alle mappings for company
  const { data: mappings } = await admin
    .from("tripletex_project_mappings")
    .select("tripletex_project_id, tripletex_project_number, mcs_project_id, last_payload_hash")
    .eq("company_id", body.companyId);
  const mappingByTtId = new Map<string, { mcs_project_id: string; hash: string | null }>();
  const mappingByTtNum = new Map<string, { mcs_project_id: string; hash: string | null }>();
  for (const m of mappings ?? []) {
    mappingByTtId.set(String(m.tripletex_project_id), {
      mcs_project_id: m.mcs_project_id,
      hash: m.last_payload_hash,
    });
    if (m.tripletex_project_number) {
      mappingByTtNum.set(String(m.tripletex_project_number), {
        mcs_project_id: m.mcs_project_id,
        hash: m.last_payload_hash,
      });
    }
  }

  // Forhåndshent: kandidater fra events (begrenset til company, prosjekter, ikke slettet)
  const { data: existing } = await admin
    .from("events")
    .select("id, title, project_number, internal_number, customer, normalized_name, external_tripletex_id, external_project_id, external_system")
    .eq("company_id", body.companyId)
    .eq("project_type", "project")
    .is("parent_project_id", null)
    .is("deleted_at", null);

  const byExtTt = new Map<string, typeof existing[number]>();
  const byExtProj = new Map<string, typeof existing[number]>();
  const byProjNum = new Map<string, typeof existing[number]>();
  const byNorm = new Map<string, typeof existing[number]>();
  for (const e of existing ?? []) {
    if (e.external_tripletex_id) byExtTt.set(String(e.external_tripletex_id), e);
    if (e.external_system === "tripletex" && e.external_project_id) byExtProj.set(String(e.external_project_id), e);
    const n = e.project_number || e.internal_number;
    if (n) byProjNum.set(String(n), e);
    if (e.normalized_name) byNorm.set(String(e.normalized_name), e);
  }

  // Bygg preview
  const items: PreviewItem[] = [];
  for (const row of body.rows) {
    const payloadHash = await sha256(stablePayload(row));
    let action: ActionKey = "create";
    let reason = "Ingen eksisterende match funnet";
    let matchedMcsProjectId: string | null = null;
    let matchBasis: string | null = null;
    let matchedTitle: string | null = null;
    let matchedProjectNumber: string | null = null;
    const candidates: PreviewItem["candidates"] = [];

    // 1) Direkte mapping?
    const mapHit =
      mappingByTtId.get(row.tripletex_project_id) ||
      (row.tripletex_project_number ? mappingByTtNum.get(row.tripletex_project_number) : undefined);

    if (mapHit) {
      matchedMcsProjectId = mapHit.mcs_project_id;
      matchBasis = "mapping";
      if (mapHit.hash && mapHit.hash === payloadHash) {
        action = "unchanged";
        reason = "Ingen endringer siden forrige import";
      } else {
        action = "update";
        reason = "Tidligere importert — oppdateres";
      }
    } else {
      // 2) Trygge match-signaler i events
      const extHit = byExtTt.get(row.tripletex_project_id) ||
        byExtProj.get(row.tripletex_project_id);
      const numHit = row.tripletex_project_number ? byProjNum.get(row.tripletex_project_number) : undefined;
      const normTitleCustomer = normalize(`${row.title ?? ""} ${row.customer ?? ""}`);
      const normHit = normTitleCustomer ? byNorm.get(normTitleCustomer) : undefined;

      if (extHit) {
        matchedMcsProjectId = extHit.id;
        matchBasis = "external_id";
        matchedTitle = extHit.title;
        matchedProjectNumber = extHit.project_number ?? extHit.internal_number ?? null;
        action = "update";
        reason = "Match på Tripletex external_id";
      } else if (numHit) {
        matchedMcsProjectId = numHit.id;
        matchBasis = "project_number";
        matchedTitle = numHit.title;
        matchedProjectNumber = numHit.project_number ?? numHit.internal_number ?? null;
        action = "update";
        reason = "Match på prosjektnummer";
      } else if (normHit) {
        // Tittel+kunde regnes som usikker — krever review.
        matchedMcsProjectId = normHit.id;
        matchBasis = "title_customer";
        matchedTitle = normHit.title;
        matchedProjectNumber = normHit.project_number ?? normHit.internal_number ?? null;
        action = "needs_review";
        reason = "Mulig duplikat — samme tittel + kunde";
        candidates.push({
          id: normHit.id,
          title: normHit.title,
          project_number: normHit.project_number ?? normHit.internal_number ?? null,
          basis: "title_customer",
          confidence: 0.7,
        });
      }
    }

    items.push({
      rowKey: row.rowKey,
      action,
      reason,
      matchedMcsProjectId,
      matchBasis,
      matchedTitle,
      matchedProjectNumber,
      candidates,
      payloadHash,
      row,
    });
  }

  const counts: Record<ActionKey, number> = {
    create: 0, update: 0, unchanged: 0, needs_review: 0, skipped: 0, error: 0,
  };
  for (const it of items) counts[it.action]++;

  if (body.mode === "preview") {
    const { data: run, error: runErr } = await admin
      .from("tripletex_import_runs")
      .insert({
        company_id: body.companyId,
        started_by: userId,
        mode: "preview",
        status: "completed",
        source_filename: body.sourceFilename ?? null,
        total_rows: body.rows.length,
        counts,
        preview_payload: { items },
        finished_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (runErr) {
      return new Response(JSON.stringify({ error: "run_insert_failed", detail: runErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ runId: run.id, counts, items }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // APPLY ====================================================================
  const decisions = body.decisions ?? {};
  const applyCounts = { created: 0, updated: 0, unchanged: 0, skipped: 0, errors: 0 };
  const log: Array<{ rowKey: string; outcome: string; mcs_project_id?: string; error?: string }> = [];

  // Insert kjøre-rad først så vi har id ved feil
  const { data: runRow, error: runErr2 } = await admin
    .from("tripletex_import_runs")
    .insert({
      company_id: body.companyId,
      started_by: userId,
      mode: "apply",
      status: "running",
      source_filename: body.sourceFilename ?? null,
      total_rows: body.rows.length,
      counts: {},
    })
    .select("id")
    .single();
  if (runErr2) {
    return new Response(JSON.stringify({ error: "run_insert_failed", detail: runErr2.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const runId: string = runRow.id;

  for (const it of items) {
    try {
      const dec = decisions[it.rowKey];
      // Effektiv handling: bruk decision hvis satt, ellers preview-action.
      let effective: "create" | "update" | "ignore" | "unchanged" = "ignore";
      let targetId: string | null = it.matchedMcsProjectId;

      if (dec?.action === "ignore") {
        effective = "ignore";
      } else if (dec?.action === "create") {
        effective = "create";
        targetId = null;
      } else if (dec?.action === "update") {
        effective = "update";
        targetId = dec.matchedMcsProjectId ?? it.matchedMcsProjectId;
      } else {
        // Standard fra preview
        if (it.action === "create") effective = "create";
        else if (it.action === "update") effective = "update";
        else if (it.action === "unchanged") effective = "unchanged";
        else if (it.action === "needs_review") effective = "ignore"; // krever eksplisitt valg
        else effective = "ignore";
      }

      if (effective === "ignore") {
        applyCounts.skipped++;
        log.push({ rowKey: it.rowKey, outcome: "skipped" });
        continue;
      }
      if (effective === "unchanged") {
        applyCounts.unchanged++;
        log.push({ rowKey: it.rowKey, outcome: "unchanged", mcs_project_id: targetId ?? undefined });
        // Oppdater last_imported_at uten å røre prosjektet
        if (targetId) {
          await admin.from("tripletex_project_mappings").upsert(
            {
              company_id: body.companyId,
              tripletex_project_id: it.row.tripletex_project_id,
              tripletex_project_number: it.row.tripletex_project_number ?? null,
              mcs_project_id: targetId,
              last_imported_at: new Date().toISOString(),
              last_payload_hash: it.payloadHash,
            },
            { onConflict: "company_id,tripletex_project_id" },
          );
        }
        continue;
      }

      // Felter vi importerer fra Tripletex. Tomme/blanke verdier overskriver IKKE eksisterende.
      const baseFields: Record<string, unknown> = {
        external_system: "tripletex",
        external_tripletex_id: it.row.tripletex_project_id,
        external_project_id: it.row.tripletex_project_id,
      };
      if (it.row.title && it.row.title.trim()) baseFields.title = it.row.title.trim();
      if (it.row.customer && it.row.customer.trim()) baseFields.customer = it.row.customer.trim();
      if (it.row.address && it.row.address.trim()) baseFields.address = it.row.address.trim();
      if (it.row.tripletex_project_number && it.row.tripletex_project_number.trim()) {
        baseFields.project_number = it.row.tripletex_project_number.trim();
      }

      if (effective === "create") {
        const insertPayload = {
          ...baseFields,
          title: baseFields.title ?? "(uten tittel)",
          project_type: "project",
          parent_project_id: null,
          company_id: body.companyId,
          status: "planned",
        };
        const { data: created, error: insErr } = await admin
          .from("events")
          .insert(insertPayload)
          .select("id")
          .single();
        if (insErr || !created) throw new Error(insErr?.message ?? "insert_failed");
        targetId = created.id;
        applyCounts.created++;
        log.push({ rowKey: it.rowKey, outcome: "created", mcs_project_id: targetId });
      } else if (effective === "update") {
        if (!targetId) throw new Error("missing_target");
        const { error: updErr } = await admin
          .from("events")
          .update(baseFields)
          .eq("id", targetId);
        if (updErr) throw new Error(updErr.message);
        applyCounts.updated++;
        log.push({ rowKey: it.rowKey, outcome: "updated", mcs_project_id: targetId });
      }

      if (targetId) {
        await admin.from("tripletex_project_mappings").upsert(
          {
            company_id: body.companyId,
            tripletex_project_id: it.row.tripletex_project_id,
            tripletex_project_number: it.row.tripletex_project_number ?? null,
            mcs_project_id: targetId,
            last_imported_at: new Date().toISOString(),
            last_payload_hash: it.payloadHash,
            created_by: userId,
          },
          { onConflict: "company_id,tripletex_project_id" },
        );
      }
    } catch (e) {
      applyCounts.errors++;
      log.push({ rowKey: it.rowKey, outcome: "error", error: e instanceof Error ? e.message : String(e) });
    }
  }

  await admin
    .from("tripletex_import_runs")
    .update({
      status: applyCounts.errors > 0 ? "completed" : "completed",
      counts: applyCounts,
      preview_payload: { log },
      finished_at: new Date().toISOString(),
    })
    .eq("id", runId);

  return new Response(JSON.stringify({ runId, counts: applyCounts, log }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
