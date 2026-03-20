/**
 * supplier-integration – Backend for grossist FTP/sFTP integration.
 *
 * Actions: save-password, test-connection, list-files, run-sync, mark-stale-job
 * Internal: process-sync, process-sync-chunk
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { parseFile, rebuildPriceCache, decodeRawBytes, type ImportStats } from "../_shared/parser.ts";

// ===== CORS =====
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonOk(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify({ success: true, ...data }), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(message: string, error_code: string, status = 400): Response {
  return new Response(
    JSON.stringify({ success: false, message, error_code }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

// ===== Types =====
interface IntegrationConfig {
  id: string; company_id: string; supplier_id: string;
  protocol: "ftp" | "ftps" | "sftp"; host: string; port: number; username: string;
  remote_base_path: string | null;
  catalog_file_pattern: string | null; price_file_pattern: string | null;
  discount_file_pattern: string | null; invoice_file_pattern: string | null;
  sync_enabled: boolean; sync_frequency: string;
}

interface RemoteFile {
  name: string; size: number; modified_at: string | null; type: "file" | "directory";
}

interface ConnectionAdapter {
  connect(): Promise<void>;
  list(path: string): Promise<RemoteFile[]>;
  download(path: string): Promise<string>;
  downloadRaw(path: string): Promise<Uint8Array>;
  disconnect(): Promise<void>;
}

interface SyncFileInfo {
  path: string;
  type: string;
  fileName: string;
  totalChunks: number;
}

// ===== Auth Guard =====
class AuthError extends Error { constructor(msg: string) { super(msg); this.name = "AuthError"; } }

async function authenticateSupplierAdmin(req: Request, supabaseAdmin: ReturnType<typeof createClient>): Promise<{ userId: string }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new AuthError("Mangler autorisasjon");

  const supabaseUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
  if (userErr || !user) throw new AuthError("Ugyldig token");

  const { data: canManage } = await supabaseAdmin.rpc("can_manage_supplier_integrations", { _auth_user_id: user.id });
  if (!canManage) throw new AuthError("Krever rettigheten 'purchasing.manage_integrations' eller admin-tilgang");
  return { userId: user.id };
}

async function validateCompanyMembership(supabaseAdmin: ReturnType<typeof createClient>, userId: string, companyId: string): Promise<void> {
  const { data: isMember } = await supabaseAdmin.rpc("is_company_member", { _auth_user_id: userId, _company_id: companyId });
  if (!isMember) {
    const { data: hasAllScope } = await supabaseAdmin.rpc("check_permission_v2", { _auth_user_id: userId, _perm: "scope.view.all" });
    if (!hasAllScope) throw new AuthError("Ingen tilgang til dette selskapet");
  }
}

async function logAudit(supabaseAdmin: ReturnType<typeof createClient>, userId: string, action: string, targetId: string | null, targetType: string, metadata: Record<string, unknown> = {}) {
  try {
    await supabaseAdmin.from("audit_log").insert({
      actor_user_account_id: null,
      action, target_id: targetId, target_type: targetType,
      metadata: { ...metadata, auth_user_id: userId },
    });
  } catch (e) { console.error("[audit] Failed:", (e as Error).message); }
}

// ===== Config & Secret Loaders =====
async function loadIntegrationConfig(supabaseAdmin: ReturnType<typeof createClient>, companyId: string, supplierId: string): Promise<IntegrationConfig> {
  const { data, error } = await supabaseAdmin.from("supplier_integrations").select("*")
    .eq("company_id", companyId).eq("supplier_id", supplierId).maybeSingle();
  if (error) throw new Error(`Feil ved lasting av konfigurasjon: ${error.message}`);
  if (!data) throw new Error("Ingen integrasjonskonfigurasjon funnet for denne leverandøren");
  return data as IntegrationConfig;
}

async function loadPassword(supabaseAdmin: ReturnType<typeof createClient>, integrationId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.from("supplier_secrets").select("encrypted_value")
    .eq("integration_id", integrationId).maybeSingle();
  if (error) { console.error("[secret-resolver] Load error:", error.message); return null; }
  return data?.encrypted_value ?? null;
}

async function updateConnectionStatus(supabaseAdmin: ReturnType<typeof createClient>, integrationId: string, status: "ok" | "warning" | "error", message: string) {
  await supabaseAdmin.from("supplier_integrations").update({
    last_connection_status: status, last_connection_message: message, last_connected_at: new Date().toISOString(),
  }).eq("id", integrationId);
}

// ===== Pattern Matching =====
function matchPattern(pattern: string, filename: string): { match: boolean; method: string } {
  const p = pattern.trim();
  const f = filename.trim();
  if (!p || !f) return { match: false, method: "empty" };

  const hasWildcard = p.includes("*") || p.includes("?");
  if (!hasWildcard) {
    const exact = p === f;
    if (!exact && p.toLowerCase() === f.toLowerCase()) {
      console.warn(`[pattern-match] Case mismatch: pattern="${p}" filename="${f}"`);
    }
    return { match: exact, method: "exact" };
  }

  const escaped = p.replace(/([.+^${}()|[\]\\])/g, "\\$1").replace(/\*/g, ".*").replace(/\?/g, ".");
  try {
    return { match: new RegExp(`^${escaped}$`).test(f), method: "glob" };
  } catch {
    return { match: false, method: "invalid_glob" };
  }
}

function categorizeFiles(files: RemoteFile[], config: IntegrationConfig) {
  const onlyFiles = files.filter((f) => f.type === "file");
  const matched = { catalog: [] as RemoteFile[], price: [] as RemoteFile[], discount: [] as RemoteFile[], invoice: [] as RemoteFile[] };
  const warnings: string[] = [];
  const matchLog: Array<{ file: string; category: string; result: boolean; method: string }> = [];

  const patterns: Record<string, string | null> = {
    catalog: config.catalog_file_pattern?.trim() || null,
    price: config.price_file_pattern?.trim() || null,
    discount: config.discount_file_pattern?.trim() || null,
    invoice: config.invoice_file_pattern?.trim() || null,
  };

  console.log(`[categorize] Patterns from DB:`, JSON.stringify(patterns));
  console.log(`[categorize] Files (${onlyFiles.length}):`, onlyFiles.map(f => f.name));

  const entries: Array<{ key: string; pattern: string; bucket: RemoteFile[] }> = [];
  if (patterns.catalog) entries.push({ key: "catalog", pattern: patterns.catalog, bucket: matched.catalog });
  if (patterns.price) entries.push({ key: "price", pattern: patterns.price, bucket: matched.price });
  if (patterns.discount) entries.push({ key: "discount", pattern: patterns.discount, bucket: matched.discount });
  if (patterns.invoice) entries.push({ key: "invoice", pattern: patterns.invoice, bucket: matched.invoice });

  const tagged = onlyFiles.map((f) => {
    const categories: string[] = [];
    for (const entry of entries) {
      const r = matchPattern(entry.pattern, f.name);
      matchLog.push({ file: f.name, category: entry.key, result: r.match, method: r.method });
      if (r.match) { entry.bucket.push(f); categories.push(entry.key); }
    }
    return { ...f, categories };
  });

  if (patterns.catalog && matched.catalog.length === 0) warnings.push(`Ingen filer matchet katalogmønsteret: ${patterns.catalog}`);
  if (patterns.price && matched.price.length === 0) warnings.push(`Ingen filer matchet prismønsteret: ${patterns.price}`);
  if (patterns.discount && matched.discount.length === 0) warnings.push(`Ingen filer matchet rabattmønsteret: ${patterns.discount}`);
  if (patterns.invoice && matched.invoice.length === 0) warnings.push(`Ingen filer matchet fakturamønsteret: ${patterns.invoice}`);

  console.log(`[categorize] Results: catalog=${matched.catalog.length}, price=${matched.price.length}, discount=${matched.discount.length}, invoice=${matched.invoice.length}`);
  if (matchLog.length <= 50) console.log(`[categorize] Match log:`, JSON.stringify(matchLog));

  return { all_files: tagged, matched, warnings, debug: { patterns, file_names: onlyFiles.map(f => f.name), match_log: matchLog } };
}

// ===== Timeout helper =====
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: number;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} tidsavbrutt etter ${ms / 1000}s`)), ms); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// ===== Connection Adapters =====
async function createFtpAdapter(config: IntegrationConfig, password: string): Promise<ConnectionAdapter> {
  const mod = await import("npm:basic-ftp@5.0.5");
  const client = new mod.Client();
  client.ftp.verbose = false;
  async function downloadToBuffer(remotePath: string): Promise<Uint8Array> {
    const { Writable } = await import("node:stream");
    const chunks: Uint8Array[] = [];
    const writable = new Writable({ write(chunk: any, _enc: string, cb: () => void) { chunks.push(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk)); cb(); } });
    await client.downloadTo(writable, remotePath);
    const raw = new Uint8Array(chunks.reduce((a, c) => a + c.length, 0));
    let offset = 0;
    for (const c of chunks) { raw.set(c, offset); offset += c.length; }
    return raw;
  }
  return {
    async connect() {
      await client.access({ host: config.host, port: config.port, user: config.username, password,
        secure: config.protocol === "ftps", secureOptions: config.protocol === "ftps" ? { rejectUnauthorized: false } : undefined });
    },
    async list(path: string): Promise<RemoteFile[]> {
      const items = await client.list(path);
      return items.map((item: any) => ({ name: item.name, size: item.size ?? 0,
        modified_at: item.modifiedAt ? new Date(item.modifiedAt).toISOString() : null,
        type: item.isDirectory ? "directory" as const : "file" as const }));
    },
    async download(remotePath: string): Promise<string> {
      return decodeRawBytes(await downloadToBuffer(remotePath));
    },
    async downloadRaw(remotePath: string): Promise<Uint8Array> {
      return downloadToBuffer(remotePath);
    },
    async disconnect() { client.close(); },
  };
}

async function createSftpAdapter(config: IntegrationConfig, password: string): Promise<ConnectionAdapter> {
  const mod = await import("npm:ssh2-sftp-client@11.0.0");
  const client = new mod.default();
  async function getRaw(remotePath: string): Promise<Uint8Array> {
    const buffer = await client.get(remotePath);
    if (typeof buffer === "string") return new TextEncoder().encode(buffer);
    return buffer instanceof Uint8Array ? buffer : (typeof Buffer !== "undefined" && buffer instanceof Buffer) ? new Uint8Array(buffer) : new TextEncoder().encode(String(buffer));
  }
  return {
    async connect() {
      await client.connect({ host: config.host, port: config.port, username: config.username, password,
        readyTimeout: 15000, retries: 1,
        algorithms: { kex: ["ecdh-sha2-nistp256","ecdh-sha2-nistp384","ecdh-sha2-nistp521","diffie-hellman-group14-sha256","diffie-hellman-group14-sha1","diffie-hellman-group-exchange-sha256"] },
      });
    },
    async list(path: string): Promise<RemoteFile[]> {
      const items = await client.list(path);
      return items.map((item: any) => ({ name: item.name, size: item.size ?? 0,
        modified_at: item.modifyTime ? new Date(item.modifyTime).toISOString() : null,
        type: item.type === "d" ? "directory" as const : "file" as const }));
    },
    async download(remotePath: string): Promise<string> {
      return decodeRawBytes(await getRaw(remotePath));
    },
    async downloadRaw(remotePath: string): Promise<Uint8Array> {
      return getRaw(remotePath);
    },
    async disconnect() { await client.end(); },
  };
}

async function createAdapter(config: IntegrationConfig, password: string): Promise<ConnectionAdapter> {
  switch (config.protocol) {
    case "ftp": case "ftps": return createFtpAdapter(config, password);
    case "sftp": return createSftpAdapter(config, password);
    default: throw new Error(`Ustøttet protokoll: ${(config as any).protocol}`);
  }
}

// ===== Error Classification =====
function classifyConnectionError(errMsg: string, config: IntegrationConfig): { userMessage: string; errorCode: string } {
  if (errMsg.includes("tidsavbrutt") || errMsg.includes("timeout") || errMsg.includes("ETIMEDOUT")) return { userMessage: `Tidsavbrudd mot ${config.host}:${config.port}`, errorCode: "timeout" };
  if (errMsg.includes("ENOTFOUND") || errMsg.includes("getaddrinfo")) return { userMessage: `Vertsnavn "${config.host}" ikke funnet`, errorCode: "host_not_found" };
  if (errMsg.includes("ECONNREFUSED")) return { userMessage: `Tilkobling nektet på ${config.host}:${config.port}`, errorCode: "connection_refused" };
  if (errMsg.includes("ECONNRESET") || errMsg.includes("socket hang up")) return { userMessage: `Forbindelsen avbrutt av serveren`, errorCode: "connection_reset" };
  if (errMsg.includes("Auth") || errMsg.includes("auth") || errMsg.includes("login") || errMsg.includes("530")) return { userMessage: "Autentisering feilet", errorCode: "auth_failed" };
  return { userMessage: `Tilkoblingsfeil: ${errMsg.substring(0, 200)}`, errorCode: "connection_error" };
}

// ===== Action Handlers =====

async function handleSavePassword(supabaseAdmin: ReturnType<typeof createClient>, companyId: string, body: Record<string, unknown>): Promise<Response> {
  const integrationId = body.integration_id as string;
  const password = body.password as string;
  if (!integrationId || !password) return jsonError("Mangler integration_id eller password", "missing_params");

  const { data: integration } = await supabaseAdmin.from("supplier_integrations").select("id, company_id")
    .eq("id", integrationId).eq("company_id", companyId).maybeSingle();
  if (!integration) return jsonError("Integrasjon ikke funnet", "not_found", 404);

  const { error } = await supabaseAdmin.from("supplier_secrets").upsert({
    integration_id: integrationId, company_id: companyId, encrypted_value: password, updated_at: new Date().toISOString(),
  }, { onConflict: "integration_id" });
  if (error) throw new Error(`Feil ved lagring: ${error.message}`);

  await supabaseAdmin.from("supplier_integrations").update({ password_secret_ref: `secret:${integrationId}` }).eq("id", integrationId);
  return jsonOk({ message: "Passord lagret sikkert" });
}

async function handleTestConnection(supabaseAdmin: ReturnType<typeof createClient>, companyId: string, supplierId: string): Promise<Response> {
  let config: IntegrationConfig;
  try { config = await loadIntegrationConfig(supabaseAdmin, companyId, supplierId); } catch (e) { return jsonError((e as Error).message, "config_error"); }

  const password = await loadPassword(supabaseAdmin, config.id);
  if (!password) {
    await updateConnectionStatus(supabaseAdmin, config.id, "error", "Passord ikke konfigurert");
    return jsonOk({ status: "error", message: "Passord er ikke lagret. Lagre passord først.", error_code: "no_password", tested_at: new Date().toISOString(), path_exists: false, sample_files: [] });
  }

  let adapter: ConnectionAdapter | null = null;
  try {
    adapter = await createAdapter(config, password);
    await withTimeout(adapter.connect(), 20_000, "Tilkobling");
    const basePath = config.remote_base_path || "/";
    let sampleFiles: RemoteFile[] = [];
    let pathExists = true;
    try { sampleFiles = await withTimeout(adapter.list(basePath), 15_000, "Filoppslag"); } catch { pathExists = false; }

    if (pathExists) {
      const fileCount = sampleFiles.filter((f) => f.type === "file").length;
      const dirCount = sampleFiles.filter((f) => f.type === "directory").length;
      const { matched, warnings } = categorizeFiles(sampleFiles, config);
      const matchedTotal = matched.catalog.length + matched.price.length + matched.discount.length + matched.invoice.length;
      const hasPatterns = !!(config.catalog_file_pattern || config.price_file_pattern || config.discount_file_pattern || config.invoice_file_pattern);
      const statusLevel = hasPatterns && matchedTotal === 0 && fileCount > 0 ? "warning" as const : "ok" as const;
      const msg = statusLevel === "ok" ? `Tilkobling OK. ${fileCount} filer, ${dirCount} mapper` + (matchedTotal > 0 ? `. ${matchedTotal} matchet.` : "") : `Tilkoblet, men ingen filer matchet (${fileCount} filer)`;
      await updateConnectionStatus(supabaseAdmin, config.id, statusLevel, msg);
      return jsonOk({ status: statusLevel, message: msg, tested_at: new Date().toISOString(), path_exists: true,
        sample_files: sampleFiles.slice(0, 20).map((f) => ({ name: f.name, size: f.size, type: f.type })),
        matched: { catalog: matched.catalog.map(f => ({ name: f.name, size: f.size })), price: matched.price.map(f => ({ name: f.name, size: f.size })),
          discount: matched.discount.map(f => ({ name: f.name, size: f.size })), invoice: matched.invoice.map(f => ({ name: f.name, size: f.size })) },
        pattern_warnings: warnings });
    } else {
      const msg = `Tilkoblet, men sti "${basePath}" er utilgjengelig`;
      await updateConnectionStatus(supabaseAdmin, config.id, "warning", msg);
      return jsonOk({ status: "warning", message: msg, tested_at: new Date().toISOString(), path_exists: false, sample_files: [], matched: { catalog: [], price: [], discount: [], invoice: [] }, pattern_warnings: [] });
    }
  } catch (err) {
    const errMsg = (err as Error).message;
    const { userMessage, errorCode } = classifyConnectionError(errMsg, config);
    await updateConnectionStatus(supabaseAdmin, config.id, "error", userMessage);
    return jsonOk({ status: "error", message: userMessage, error_code: errorCode, tested_at: new Date().toISOString(), path_exists: false, sample_files: [] });
  } finally { try { if (adapter) await adapter.disconnect(); } catch {} }
}

async function handleListFiles(supabaseAdmin: ReturnType<typeof createClient>, companyId: string, supplierId: string): Promise<Response> {
  console.log(`[list-files] Starting for supplier ${supplierId}, company ${companyId}`);
  let config: IntegrationConfig;
  try {
    config = await loadIntegrationConfig(supabaseAdmin, companyId, supplierId);
    console.log(`[list-files] Config: price="${config.price_file_pattern}", discount="${config.discount_file_pattern}", catalog="${config.catalog_file_pattern}"`);
  } catch (e) { return jsonError((e as Error).message, "config_error"); }

  const password = await loadPassword(supabaseAdmin, config.id);
  if (!password) return jsonError("Passord ikke konfigurert", "no_password");

  let adapter: ConnectionAdapter | null = null;
  try {
    adapter = await createAdapter(config, password);
    await withTimeout(adapter.connect(), 20_000, "Tilkobling");
    const basePath = config.remote_base_path || "/";
    let allFiles: RemoteFile[] = [];
    try { allFiles = await withTimeout(adapter.list(basePath), 15_000, "Filoppslag"); } catch (pathErr) {
      return jsonError(`Kunne ikke lese "${basePath}": ${(pathErr as Error).message}`, "path_error");
    }

    const subdirs = allFiles.filter((f) => f.type === "directory");
    const fileCount = allFiles.filter((f) => f.type === "file").length;
    if (subdirs.length > 0 && fileCount < 3) {
      for (const dir of subdirs.slice(0, 5)) {
        try {
          const subPath = `${basePath.replace(/\/$/, "")}/${dir.name}`;
          const subFiles = await withTimeout(adapter.list(subPath), 10_000, `Undermappe ${dir.name}`);
          for (const sf of subFiles) allFiles.push({ ...sf, name: `${dir.name}/${sf.name}` });
        } catch {}
      }
    }

    const result = categorizeFiles(allFiles, config);
    await updateConnectionStatus(supabaseAdmin, config.id, "ok", `Filliste hentet: ${result.all_files.length} filer`);
    return jsonOk({ status: "ok", message: `${result.all_files.length} filer funnet`, data: result });
  } catch (err) {
    const errMsg = (err as Error).message;
    const { userMessage, errorCode } = classifyConnectionError(errMsg, config);
    return jsonError(userMessage, errorCode, 500);
  } finally { try { if (adapter) await adapter.disconnect(); } catch {} }
}

// ===== Import Job Helpers =====
async function createImportJob(supabaseAdmin: ReturnType<typeof createClient>, companyId: string, supplierId: string, jobType: string, triggeredBy: string): Promise<string> {
  const { data, error } = await supabaseAdmin.from("product_import_jobs").insert({
    company_id: companyId, supplier_id: supplierId, job_type: jobType, status: "queued", triggered_by: triggeredBy,
    files_found: [], rows_processed: 0, rows_inserted: 0, rows_updated: 0, rows_failed: 0, error_log: [],
  }).select("id").single();
  if (error) throw new Error(`Import jobb feil: ${error.message}`);
  return data.id;
}

async function updateImportJob(supabaseAdmin: ReturnType<typeof createClient>, jobId: string, updates: Record<string, unknown>) {
  await supabaseAdmin.from("product_import_jobs").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", jobId);
}

// ===== Sync Orchestration =====

const SYNC_TEMP_BUCKET = "job-attachments";

/**
 * Dispatch next step via self-invocation using service_role key.
 *
 * CRITICAL: We do NOT await the HTTP response from the target function.
 * The target function may run for 60-90+ seconds (e.g. downloading files),
 * which causes the Supabase gateway to return HTTP 504.
 * Instead we fire the request and wait just long enough for it to leave
 * the network stack (~1 s), then return immediately.
 *
 * The target function runs independently in its own worker.
 */
async function dispatchNextChunk(
  body: Record<string, unknown>,
  supabaseAdmin: ReturnType<typeof createClient>,
): Promise<boolean> {
  const processUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/supplier-integration`;
  const jobId = body.job_id as string;
  const globalChunk = body.global_chunk ?? "init";

  console.log(`[chain] job=${jobId} DISPATCH next: action=${body.action}, file_index=${body.file_index}, chunk_start=${body.chunk_start}, global_chunk=${globalChunk}`);

  try {
    // Fire the request — do NOT await the response.
    // We only need the HTTP request to reach the Supabase gateway.
    const fetchPromise = fetch(processUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify(body),
    });

    // Consume response in background to avoid resource leaks, but don't block on it
    fetchPromise
      .then(resp => {
        console.log(`[chain] job=${jobId} DISPATCH response (background): HTTP ${resp.status}`);
        resp.body?.cancel().catch(() => {});
      })
      .catch(err => {
        console.error(`[chain] job=${jobId} DISPATCH background error: ${(err as Error).message}`);
      });

    // Give the request time to leave the network stack
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log(`[chain] job=${jobId} DISPATCH fired for global_chunk=${globalChunk}, action=${body.action}`);
    return true;
  } catch (err) {
    console.error(`[chain] job=${jobId} DISPATCH FAILED (sync): ${(err as Error).message}`);
    await updateImportJob(supabaseAdmin, jobId, {
      status: "failed",
      finished_at: new Date().toISOString(),
      failed_step: `dispatch_batch_${globalChunk}`,
      error_log: [`Chunk-dispatch feilet: ${(err as Error).message}`],
      last_heartbeat_at: new Date().toISOString(),
    });
    return false;
  }
}

function countFileRows(content: string): number {
  const rawLines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
  const isEfonelfo = rawLines.slice(0, 5).some(l => {
    const rt = l.split(";")[0]?.toUpperCase().trim();
    return ["VH", "PH", "RH", "IH"].includes(rt);
  });
  if (isEfonelfo) {
    const skuSet = new Set<string>();
    for (const line of rawLines) {
      const fields = line.split(";");
      if (fields[0]?.toUpperCase().trim() === "VL") {
        const sku = fields[2]?.trim();
        if (sku && !skuSet.has(sku)) skuSet.add(sku);
      }
    }
    return skuSet.size;
  }
  return Math.max(0, rawLines.length - 1);
}

/**
 * Phase 1: Download files from FTP, store in Supabase storage, count chunks, kick off chunk processing.
 */
async function handleProcessSync(supabaseAdmin: ReturnType<typeof createClient>, body: Record<string, unknown>): Promise<Response> {
  const jobId = body.job_id as string;
  const companyId = body.company_id as string;
  const supplierId = body.supplier_id as string;
  const supplierCode = (body.supplier_code as string) || null;
  const syncType = (body.sync_type as string) || "full_sync";

  if (!jobId || !companyId || !supplierId) return jsonError("Mangler påkrevde felt", "missing_params");

  try {
    const config = await loadIntegrationConfig(supabaseAdmin, companyId, supplierId);
    const password = await loadPassword(supabaseAdmin, config.id);
    if (!password) {
      await updateImportJob(supabaseAdmin, jobId, { status: "failed", finished_at: new Date().toISOString(), error_log: ["Passord ikke konfigurert"], failed_step: "password" });
      return jsonOk({ status: "failed" });
    }

    const now = new Date().toISOString();
    await updateImportJob(supabaseAdmin, jobId, { status: "running", started_at: now, last_heartbeat_at: now });

    // Connect to FTP
    let adapter: ConnectionAdapter;
    try {
      adapter = await createAdapter(config, password);
      await withTimeout(adapter.connect(), 20_000, "Tilkobling");
    } catch (e) {
      await updateImportJob(supabaseAdmin, jobId, { status: "failed", finished_at: new Date().toISOString(), error_log: [(e as Error).message], failed_step: "connect" });
      await updateConnectionStatus(supabaseAdmin, config.id, "error", (e as Error).message);
      return jsonOk({ status: "failed" });
    }

    const basePath = config.remote_base_path || "/";
    let allFiles: RemoteFile[];
    try {
      allFiles = await withTimeout(adapter.list(basePath), 15_000, "Filoppslag");
    } catch (e) {
      try { await adapter.disconnect(); } catch {}
      await updateImportJob(supabaseAdmin, jobId, { status: "failed", finished_at: new Date().toISOString(), error_log: [(e as Error).message], failed_step: "list-files" });
      return jsonOk({ status: "failed" });
    }

    const categorized = categorizeFiles(allFiles, config);
    const groups: { type: string; files: RemoteFile[] }[] = [];
    if (syncType === "full_sync" || syncType === "catalog_sync") groups.push({ type: "catalog", files: categorized.matched.catalog });
    if (syncType === "full_sync" || syncType === "price_sync") groups.push({ type: "price", files: categorized.matched.price });
    if (syncType === "full_sync" || syncType === "discount_sync") groups.push({ type: "discount", files: categorized.matched.discount });

    // Prioritize full catalog files over test files: sort by size descending
    for (const g of groups) {
      if (g.files.length > 1) {
        g.files.sort((a, b) => b.size - a.size);
        const fullFile = g.files[0];
        const skipped = g.files.slice(1);
        console.log(`[sync] ⚠️ ${g.type}: PRIORITIZING full file "${fullFile.name}" (${(fullFile.size / 1024 / 1024).toFixed(1)} MB) over test files: ${skipped.map(f => `"${f.name}" (${(f.size/1024/1024).toFixed(1)} MB)`).join(", ")}`);
        g.files = [fullFile];
      } else if (g.files.length === 1) {
        const f = g.files[0];
        const isTest = f.name.toLowerCase().includes('test');
        console.log(`[sync] ${g.type}: Using "${f.name}" (${(f.size / 1024 / 1024).toFixed(1)} MB) [${isTest ? '⚠️ TEST FILE' : '✅ FULL FILE'}]`);
      }
    }

    const filesFound: string[] = [];
    const storageFiles: SyncFileInfo[] = [];
    const DOWNLOAD_TIMEOUT_MS = 600_000; // 10 minutes

    for (const g of groups) {
      for (const f of g.files) {
        const filePath = `${basePath.replace(/\/$/, "")}/${f.name}`;
        const dlStart = Date.now();
        try {
          console.log(`[sync] Downloading ${f.name} (expected ~${(f.size / 1024 / 1024).toFixed(1)} MB, type=${g.type})...`);
          const rawBytes = await withTimeout(adapter.downloadRaw(filePath), DOWNLOAD_TIMEOUT_MS, `Nedlasting ${f.name}`);
          const dlDuration = ((Date.now() - dlStart) / 1000).toFixed(1);
          const fileSizeMB = (rawBytes.length / 1024 / 1024).toFixed(2);
          console.log(`[sync] ✅ Downloaded ${f.name}: ${rawBytes.length} bytes (${fileSizeMB} MB) in ${dlDuration}s`);

          // Upload raw bytes to storage
          const storagePath = `sync-temp/${jobId}/${g.type}__${f.name}`;
          const blob = new Blob([rawBytes], { type: "application/octet-stream" });
          const { error: uploadErr } = await supabaseAdmin.storage.from(SYNC_TEMP_BUCKET).upload(storagePath, blob, { upsert: true });
          if (uploadErr) throw new Error(`Storage upload: ${uploadErr.message}`);
          console.log(`[sync] Stored ${f.name} to storage (${storagePath})`);

          // Decode for row counting using consistent decode function
          const text = decodeRawBytes(rawBytes);
          const rowCount = countFileRows(text);
          const totalChunks = Math.ceil(rowCount / 1000);
          filesFound.push(f.name);
          storageFiles.push({ path: storagePath, type: g.type, fileName: f.name, totalChunks });

          const isTest = f.name.toLowerCase().includes('test');
          console.log(`[sync] ${f.name}: ${rowCount} products, ${totalChunks} chunks [${isTest ? 'TEST' : 'FULL'}], download=${dlDuration}s, size=${fileSizeMB}MB`);

          // Log encoding sample
          const sampleLines = text.split(/\r?\n/).slice(0, 3);
          for (const sl of sampleLines) {
            if (/[ÆØÅæøå]/.test(sl)) {
              console.log(`[sync] ENCODING_SAMPLE: "${sl.substring(0, 80)}"`);
              break;
            }
          }
        } catch (fileErr) {
          const dlDuration = ((Date.now() - dlStart) / 1000).toFixed(1);
          console.error(`[sync] ❌ FAILED to download ${f.name} after ${dlDuration}s: ${(fileErr as Error).message}`);
          await updateImportJob(supabaseAdmin, jobId, {
            last_heartbeat_at: new Date().toISOString(),
            error_log: [`Nedlasting feilet: ${f.name} – ${(fileErr as Error).message}`],
          });
        }
      }
    }

    try { await adapter.disconnect(); } catch {}

    if (filesFound.length === 0) {
      await updateImportJob(supabaseAdmin, jobId, { status: "success", finished_at: new Date().toISOString(), error_log: ["Ingen matchende filer"], progress_percent: 100 });
      return jsonOk({ status: "success" });
    }

    const totalGlobalChunks = storageFiles.reduce((sum, f) => sum + f.totalChunks, 0);
    console.log(`[sync] Job ${jobId}: ${filesFound.length} files, ${totalGlobalChunks} total chunks — starting chunk chain (server-side only, no frontend dependency)`);

    await updateImportJob(supabaseAdmin, jobId, {
      files_found: filesFound,
      total_chunks: totalGlobalChunks,
      last_heartbeat_at: new Date().toISOString(),
    });

    console.log(`[sync] job=${jobId} CREATED: total_rows=${storageFiles.reduce((s, f) => s + f.totalChunks * 1000, 0)}, total_chunks=${totalGlobalChunks}, dispatching first chunk...`);

    // Kick off chunk processing chain — AWAIT dispatch to ensure it's sent before worker exits
    const dispatched = await dispatchNextChunk({
      action: "process-sync-chunk",
      job_id: jobId,
      company_id: companyId,
      supplier_id: supplierId,
      supplier_code: supplierCode,
      file_index: 0,
      chunk_start: 0,
      storage_files: storageFiles,
      cum_stats: { rows_processed: 0, rows_inserted: 0, rows_updated: 0, rows_failed: 0, rows_skipped: 0, rows_needs_review: 0, errors: [], prices_inserted: 0, prices_unchanged: 0, prices_no_price: 0, prices_preserved: 0 },
      global_chunk: 0,
      total_global_chunks: totalGlobalChunks,
    }, supabaseAdmin);

    if (dispatched) {
      console.log(`[sync] job=${jobId} first chunk dispatched successfully`);
    } else {
      console.error(`[sync] job=${jobId} FAILED to dispatch first chunk — job marked as failed`);
    }

    return jsonOk({ status: "processing" });
  } catch (err) {
    console.error(`[sync] process-sync fatal: ${(err as Error).message}`);
    await updateImportJob(supabaseAdmin, jobId, { status: "failed", finished_at: new Date().toISOString(), error_log: [(err as Error).message], failed_step: "download" });
    return jsonOk({ status: "failed" });
  }
}

/**
 * Phase 2: Process CHUNKS_PER_INVOCATION chunks, then self-invoke for the next batch.
 * Each invocation is independent – no frontend/polling dependency.
 * The chain continues purely server-side via HTTP self-invocation.
 *
 * Processing multiple chunks per invocation amortizes the cost of
 * file download + parse across more work, dramatically improving throughput.
 */
const CHUNKS_PER_INVOCATION = 1;

async function handleProcessSyncChunk(supabaseAdmin: ReturnType<typeof createClient>, body: Record<string, unknown>): Promise<Response> {
  const jobId = body.job_id as string;
  const companyId = body.company_id as string;
  const supplierId = body.supplier_id as string;
  const supplierCode = (body.supplier_code as string) || null;
  let fileIndex = body.file_index as number;
  let chunkStart = body.chunk_start as number;
  const storageFiles = body.storage_files as SyncFileInfo[];
  const cumStats = body.cum_stats as { rows_processed: number; rows_inserted: number; rows_updated: number; rows_failed: number; rows_skipped: number; rows_needs_review: number; errors: string[] };
  let globalChunk = body.global_chunk as number;
  const totalGlobalChunks = body.total_global_chunks as number;

  console.log(`[chain] job=${jobId} CHUNK_STARTED: global=${globalChunk + 1}/${totalGlobalChunks}, file=${fileIndex}/${storageFiles.length}, chunk=${chunkStart}, chunksPerInvocation=${CHUNKS_PER_INVOCATION}`);

  // Update heartbeat immediately on entry
  await updateImportJob(supabaseAdmin, jobId, { last_heartbeat_at: new Date().toISOString() });

  // Check if job was externally cancelled/failed
  const { data: jobStatus } = await supabaseAdmin.from("product_import_jobs")
    .select("status").eq("id", jobId).maybeSingle();
  if (jobStatus && jobStatus.status !== "running") {
    console.log(`[chain] job=${jobId} ABORT: status is "${jobStatus.status}", stopping chain`);
    return jsonOk({ status: "aborted" });
  }

  // All files processed → finalize
  const currentFile = storageFiles[fileIndex];
  if (!currentFile) {
    console.log(`[chain] job=${jobId} ALL FILES COMPLETE, finalizing...`);

    try {
      const { data: linkedProducts } = await supabaseAdmin
        .from("supplier_products")
        .select("product_id")
        .eq("company_id", companyId)
        .eq("supplier_id", supplierId)
        .not("product_id", "is", null)
        .limit(1000);
      const productIds = [...new Set((linkedProducts ?? []).map((p: any) => p.product_id).filter(Boolean))];
      if (productIds.length > 0) {
        console.log(`[chain] Rebuilding price cache for ${productIds.length} products`);
        await rebuildPriceCache(supabaseAdmin, companyId, productIds);
      }
    } catch (e) {
      console.error(`[chain] Price cache rebuild error: ${(e as Error).message}`);
      cumStats.errors.push(`Price cache: ${(e as Error).message}`);
    }

    const finalStatus = cumStats.rows_failed > 0 && (cumStats.rows_inserted + cumStats.rows_updated) > 0
      ? "partial_success" : cumStats.rows_failed > 0 ? "failed" : "success";

    await updateImportJob(supabaseAdmin, jobId, {
      status: finalStatus, finished_at: new Date().toISOString(),
      rows_processed: cumStats.rows_processed, rows_inserted: cumStats.rows_inserted,
      rows_updated: cumStats.rows_updated, rows_failed: cumStats.rows_failed,
      error_log: cumStats.errors.slice(0, 100),
      current_chunk: totalGlobalChunks, progress_percent: 100,
      last_heartbeat_at: new Date().toISOString(),
    });

    // Clean up temp storage
    try {
      const { data: files } = await supabaseAdmin.storage.from(SYNC_TEMP_BUCKET).list(`sync-temp/${jobId}`);
      if (files?.length) {
        await supabaseAdmin.storage.from(SYNC_TEMP_BUCKET).remove(files.map((f: any) => `sync-temp/${jobId}/${f.name}`));
      }
    } catch {}

    // Update last_sync_at
    try {
      const { data: integ } = await supabaseAdmin.from("supplier_integrations").select("id")
        .eq("company_id", companyId).eq("supplier_id", supplierId).maybeSingle();
      if (integ && finalStatus !== "failed") {
        await supabaseAdmin.from("supplier_integrations").update({ last_sync_at: new Date().toISOString() }).eq("id", integ.id);
      }
    } catch {}

    console.log(`[chain] job=${jobId} FINALIZED: ${finalStatus}, inserted=${cumStats.rows_inserted}, updated=${cumStats.rows_updated}, failed=${cumStats.rows_failed}`);
    return jsonOk({ status: finalStatus });
  }

  // Process up to CHUNKS_PER_INVOCATION chunks across current (and possibly next) files
  const invocationStartTime = Date.now();
  let chunksProcessedThisInvocation = 0;

  try {
    // Download and parse file ONCE for all chunks we'll process from it
    let currentFileContent: string | null = null;
    let currentFileIndex = fileIndex;

    while (chunksProcessedThisInvocation < CHUNKS_PER_INVOCATION) {
      const thisFile = storageFiles[fileIndex];
      if (!thisFile) break; // all files done, will finalize on next dispatch

      // Download file only when switching to a new file
      if (currentFileContent === null || fileIndex !== currentFileIndex) {
        const tDl = Date.now();
        const { data: fileData, error: dlErr } = await supabaseAdmin.storage.from(SYNC_TEMP_BUCKET).download(thisFile.path);
        if (dlErr) throw new Error(`Storage read failed: ${dlErr.message}`);
        const arrayBuffer = await fileData.arrayBuffer();
        const rawBytes = new Uint8Array(arrayBuffer);
        currentFileContent = decodeRawBytes(rawBytes);
        currentFileIndex = fileIndex;
        console.log(`[chain] job=${jobId} file download+decode: ${Date.now() - tDl}ms (${(rawBytes.length / 1024 / 1024).toFixed(1)}MB)`);
      }

      // Determine how many chunks to process from this file in this iteration
      const remainingChunksInFile = thisFile.totalChunks - chunkStart;
      const remainingBudget = CHUNKS_PER_INVOCATION - chunksProcessedThisInvocation;
      const chunksToProcess = Math.min(remainingChunksInFile, remainingBudget);
      const chunkEnd = chunkStart + chunksToProcess;

      console.log(`[chain] job=${jobId} PROCESSING batch ${globalChunk + 1}-${globalChunk + chunksToProcess}/${totalGlobalChunks} – file "${thisFile.fileName}" chunks ${chunkStart}-${chunkEnd - 1}/${thisFile.totalChunks}`);

      const result = await parseFile({
        supabaseAdmin, supplierId, supplierCode,
        companyId, importJobId: jobId, fileType: thisFile.type,
        fileName: thisFile.fileName, fileContent: currentFileContent!,
        chunkRange: { start: chunkStart, end: chunkEnd },
        skipPriceCache: true,
      });

      // Accumulate stats
      cumStats.rows_processed += result.rows_processed;
      cumStats.rows_inserted += result.rows_inserted;
      cumStats.rows_updated += result.rows_updated;
      cumStats.rows_failed += result.rows_failed;
      cumStats.rows_skipped += result.rows_skipped;
      cumStats.rows_needs_review += result.rows_needs_review;
      if (result.errors.length > 0) cumStats.errors.push(...result.errors.slice(0, 10));
      if (cumStats.errors.length > 50) cumStats.errors = cumStats.errors.slice(0, 50);

      globalChunk += chunksToProcess;
      chunksProcessedThisInvocation += chunksToProcess;

      // Move to next file if this one is done
      if (chunkEnd >= thisFile.totalChunks) {
        console.log(`[chain] job=${jobId} FILE_COMPLETE: "${thisFile.fileName}", moving to file ${fileIndex + 2}/${storageFiles.length}`);
        fileIndex += 1;
        chunkStart = 0;
        currentFileContent = null; // force re-download for next file
      } else {
        chunkStart = chunkEnd;
      }

      // Heartbeat mid-invocation
      await updateImportJob(supabaseAdmin, jobId, { last_heartbeat_at: new Date().toISOString() });
    }

    const progressPercent = totalGlobalChunks > 0 ? Math.round((globalChunk / totalGlobalChunks) * 100) : 0;
    const invocationDuration = ((Date.now() - invocationStartTime) / 1000).toFixed(1);

    await updateImportJob(supabaseAdmin, jobId, {
      current_chunk: globalChunk,
      progress_percent: progressPercent,
      rows_processed: cumStats.rows_processed,
      rows_inserted: cumStats.rows_inserted,
      rows_updated: cumStats.rows_updated,
      rows_failed: cumStats.rows_failed,
      last_heartbeat_at: new Date().toISOString(),
    });

    console.log(`[chain] job=${jobId} INVOCATION_COMPLETED: batches ${globalChunk - chunksProcessedThisInvocation + 1}-${globalChunk}/${totalGlobalChunks} (${progressPercent}%) in ${invocationDuration}s, ins=${cumStats.rows_inserted} upd=${cumStats.rows_updated}`);

    // Chain next invocation
    console.log(`[chain] job=${jobId} END invocation (processed ${chunksProcessedThisInvocation} chunks)`);

    const dispatched = await dispatchNextChunk({
      action: "process-sync-chunk",
      job_id: jobId,
      company_id: companyId,
      supplier_id: supplierId,
      supplier_code: supplierCode,
      file_index: fileIndex,
      chunk_start: chunkStart,
      storage_files: storageFiles,
      cum_stats: cumStats,
      global_chunk: globalChunk,
      total_global_chunks: totalGlobalChunks,
    }, supabaseAdmin);

    if (dispatched) {
      console.log(`[chain] job=${jobId} DISPATCH next batch ${globalChunk + 1}/${totalGlobalChunks} OK`);
    }
    return jsonOk({ status: "processing", global_chunk: globalChunk, progress_percent: progressPercent });
  } catch (err) {
    const batchLabel = `batch_${globalChunk + 1}`;
    console.error(`[chain] job=${jobId} ${batchLabel} FAILED: ${(err as Error).message}`);
    await updateImportJob(supabaseAdmin, jobId, {
      status: "failed", finished_at: new Date().toISOString(),
      error_log: [...cumStats.errors, (err as Error).message].slice(0, 100),
      failed_step: batchLabel,
      rows_processed: cumStats.rows_processed, rows_inserted: cumStats.rows_inserted,
      rows_updated: cumStats.rows_updated, rows_failed: cumStats.rows_failed,
      last_heartbeat_at: new Date().toISOString(),
    });

    // Clean up temp storage on failure
    try {
      const { data: files } = await supabaseAdmin.storage.from(SYNC_TEMP_BUCKET).list(`sync-temp/${jobId}`);
      if (files?.length) {
        await supabaseAdmin.storage.from(SYNC_TEMP_BUCKET).remove(files.map((f: any) => `sync-temp/${jobId}/${f.name}`));
      }
    } catch {}

    return jsonOk({ status: "failed" });
  }
}

// ===== Mark Stale Job =====
// IMPORTANT: Stale timeout increased to 10 minutes since chunks can take several minutes each.
const STALE_JOB_MS = 10 * 60 * 1000;

async function handleMarkStaleJob(supabaseAdmin: ReturnType<typeof createClient>, jobId: string): Promise<Response> {
  const { data: job } = await supabaseAdmin.from("product_import_jobs")
    .select("status, last_heartbeat_at, updated_at").eq("id", jobId).maybeSingle();

  if (job?.status === "running") {
    const heartbeat = job.last_heartbeat_at ?? job.updated_at;
    const heartbeatAge = Date.now() - new Date(heartbeat).getTime();

    if (heartbeatAge < STALE_JOB_MS) {
      console.log(`[stale] Job ${jobId}: heartbeat ${Math.round(heartbeatAge / 1000)}s ago – NOT stale (threshold ${STALE_JOB_MS / 1000}s)`);
      return jsonOk({ status: "not_stale", heartbeat_age_s: Math.round(heartbeatAge / 1000) });
    }

    await updateImportJob(supabaseAdmin, jobId, {
      status: "failed",
      finished_at: new Date().toISOString(),
      failed_step: "stalled",
      error_log: [`Jobben stoppet opp (ingen aktivitet på over ${STALE_JOB_MS / 60000} minutter)`],
    });
    console.log(`[stale] Job ${jobId} marked as stalled (heartbeat ${Math.round(heartbeatAge / 1000)}s ago)`);
  }
  return jsonOk({ status: "marked" });
}

// ===== Run Sync (user-facing) =====
async function handleRunSync(supabaseAdmin: ReturnType<typeof createClient>, companyId: string, supplierId: string, body: Record<string, unknown>): Promise<Response> {
  const syncType = (body.sync_type as string) || "full_sync";
  const userId = body.user_id as string;
  if (!["full_sync", "catalog_sync", "price_sync", "discount_sync"].includes(syncType)) return jsonError(`Ugyldig sync_type: ${syncType}`, "invalid_sync_type");

  // ── Guard: prevent parallel sync jobs for same company + supplier ──
  const { data: activeJobs } = await supabaseAdmin
    .from("product_import_jobs")
    .select("id, status, progress_percent, current_chunk, total_chunks, last_heartbeat_at, created_at")
    .eq("company_id", companyId)
    .eq("supplier_id", supplierId)
    .in("status", ["queued", "running", "finalizing"])
    .order("created_at", { ascending: false })
    .limit(1);

  if (activeJobs && activeJobs.length > 0) {
    const existing = activeJobs[0];
    // Check if the job is truly stale (no heartbeat for 10+ minutes)
    const heartbeat = existing.last_heartbeat_at ? new Date(existing.last_heartbeat_at).getTime() : new Date(existing.created_at).getTime();
    const staleMs = 10 * 60 * 1000; // 10 minutes
    const isStale = Date.now() - heartbeat > staleMs;

    if (!isStale) {
      console.log(`[run-sync] BLOCKED: active job ${existing.id} (status=${existing.status}) already running for company=${companyId} supplier=${supplierId}`);
      return jsonOk({
        status: "already_running",
        message: "En synkronisering kjører allerede for denne leverandøren",
        data: {
          job_id: existing.id,
          job_status: existing.status,
          progress_percent: existing.progress_percent,
          current_chunk: existing.current_chunk,
          total_chunks: existing.total_chunks,
        },
      });
    } else {
      // Mark stale job as failed so a new one can start
      console.log(`[run-sync] Marking stale job ${existing.id} as failed (last heartbeat ${Math.round((Date.now() - heartbeat) / 1000)}s ago)`);
      await supabaseAdmin.from("product_import_jobs").update({
        status: "failed",
        error_message: "Automatisk avsluttet: ingen aktivitet på over 10 minutter",
        failed_step: "stale_guard",
      }).eq("id", existing.id);
    }
  }
  // ── End guard ──

  let config: IntegrationConfig;
  try { config = await loadIntegrationConfig(supabaseAdmin, companyId, supplierId); } catch (e) { return jsonError((e as Error).message, "config_error"); }

  const password = await loadPassword(supabaseAdmin, config.id);
  if (!password) return jsonError("Passord ikke konfigurert", "no_password");

  let supplierCode: string | null = null;
  try { const { data } = await supabaseAdmin.from("suppliers").select("code").eq("id", supplierId).maybeSingle(); supplierCode = data?.code ?? null; } catch {}

  let jobId: string;
  try { jobId = await createImportJob(supabaseAdmin, companyId, supplierId, syncType, userId || "admin"); } catch (e) { return jsonError((e as Error).message, "job_create_error", 500); }

  console.log(`[run-sync] job=${jobId} CREATED, dispatching process-sync...`);

  // Trigger process-sync — AWAIT dispatch to ensure request is sent before worker exits
  const dispatched = await dispatchNextChunk({
    action: "process-sync",
    job_id: jobId,
    company_id: companyId,
    supplier_id: supplierId,
    supplier_code: supplierCode,
    sync_type: syncType,
  }, supabaseAdmin);

  if (dispatched) {
    console.log(`[run-sync] job=${jobId} process-sync dispatched successfully`);
  } else {
    console.error(`[run-sync] job=${jobId} FAILED to dispatch process-sync — job marked as failed`);
    return jsonOk({ status: "failed", message: "Kunne ikke starte synkronisering", data: { job_id: jobId } });
  }

  return jsonOk({
    status: "started",
    message: "Synkronisering startet – følg fremdrift i importloggen",
    data: { job_id: jobId },
  });
}

// ===== Main Router =====
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json().catch(() => ({}));
    const action = body.action as string;
    const companyId = body.company_id as string;

    // INTERNAL actions: process-sync and process-sync-chunk – called via self-invocation with service_role key
    if (action === "process-sync" || action === "process-sync-chunk") {
      const authHeader = req.headers.get("Authorization");
      const token = authHeader?.replace("Bearer ", "");
      if (token !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
        return jsonError("Kun intern tilgang", "auth_error", 403);
      }
      if (action === "process-sync") return await handleProcessSync(supabaseAdmin, body);
      return await handleProcessSyncChunk(supabaseAdmin, body);
    }

    // SECURITY: Authenticate + check supplier management permission
    let userId: string;
    try { const auth = await authenticateSupplierAdmin(req, supabaseAdmin); userId = auth.userId; }
    catch (e) { if (e instanceof AuthError) return jsonError(e.message, "auth_error", 401); throw e; }

    const supplierId = body.supplier_id as string;
    if (!companyId) return jsonError("company_id er påkrevd", "missing_company_id");

    // SECURITY: Validate user belongs to the requested company
    try { await validateCompanyMembership(supabaseAdmin, userId, companyId); }
    catch (e) { if (e instanceof AuthError) return jsonError(e.message, "auth_error", 403); throw e; }

    // AUDIT: Log every action
    await logAudit(supabaseAdmin, userId, `supplier.${action}`, supplierId || companyId, "supplier_integration", {
      company_id: companyId, supplier_id: supplierId, action,
    });

    switch (action) {
      case "save-password": return await handleSavePassword(supabaseAdmin, companyId, body);
      case "test-connection": if (!supplierId) return jsonError("supplier_id påkrevd", "missing_supplier_id"); return await handleTestConnection(supabaseAdmin, companyId, supplierId);
      case "list-files": if (!supplierId) return jsonError("supplier_id påkrevd", "missing_supplier_id"); return await handleListFiles(supabaseAdmin, companyId, supplierId);
      case "run-sync": if (!supplierId) return jsonError("supplier_id påkrevd", "missing_supplier_id"); return await handleRunSync(supabaseAdmin, companyId, supplierId, { ...body, user_id: userId });
      case "mark-stale-job": {
        const jobId = body.job_id as string;
        if (!jobId) return jsonError("job_id påkrevd", "missing_job_id");
        return await handleMarkStaleJob(supabaseAdmin, jobId);
      }
      default: return jsonError(`Ukjent action: ${action}`, "unknown_action");
    }
  } catch (err) {
    console.error("[router] Unhandled:", (err as Error).message);
    return jsonError("En uventet feil oppstod", "internal_error", 500);
  }
});
