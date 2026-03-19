/**
 * supplier-integration – Backend for grossist FTP/sFTP integration.
 *
 * Actions:
 *   save-password      – Securely store integration password
 *   test-connection    – Test FTP/FTPS/SFTP connection
 *   list-files         – List remote files, match patterns
 *   run-sync           – Execute import sync job
 *
 * Priority: test-connection and list-files are hardened for production.
 * run-sync uses the same adapters but parser is still a stub.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// ===== CORS =====
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ===== Response helpers =====
function jsonOk(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify({ success: true, ...data }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
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
  id: string;
  company_id: string;
  supplier_id: string;
  protocol: "ftp" | "ftps" | "sftp";
  host: string;
  port: number;
  username: string;
  remote_base_path: string | null;
  catalog_file_pattern: string | null;
  price_file_pattern: string | null;
  discount_file_pattern: string | null;
  invoice_file_pattern: string | null;
  sync_enabled: boolean;
  sync_frequency: string;
}

interface RemoteFile {
  name: string;
  size: number;
  modified_at: string | null;
  type: "file" | "directory";
}

interface ConnectionAdapter {
  connect(): Promise<void>;
  list(path: string): Promise<RemoteFile[]>;
  download(path: string): Promise<string>;
  disconnect(): Promise<void>;
}

// ===== Auth Guard =====
class AuthError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "AuthError";
  }
}

async function authenticateAdmin(
  req: Request,
  supabaseAdmin: ReturnType<typeof createClient>,
): Promise<{ userId: string }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new AuthError("Mangler autorisasjon");
  }

  const supabaseUser = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
  if (userErr || !user) throw new AuthError("Ugyldig token");

  const userId = user.id;

  // Check admin permission via existing db function
  const { data: isAdmin } = await supabaseAdmin.rpc("check_permission_v2", {
    _auth_user_id: userId,
    _perm: "admin.manage_users",
  });
  if (!isAdmin) throw new AuthError("Krever admin-tilgang");

  return { userId };
}

// ===== Config Loader =====
async function loadIntegrationConfig(
  supabaseAdmin: ReturnType<typeof createClient>,
  companyId: string,
  supplierId: string,
): Promise<IntegrationConfig> {
  const { data, error } = await supabaseAdmin
    .from("supplier_integrations")
    .select("*")
    .eq("company_id", companyId)
    .eq("supplier_id", supplierId)
    .maybeSingle();

  if (error) throw new Error(`Feil ved lasting av konfigurasjon: ${error.message}`);
  if (!data) throw new Error("Ingen integrasjonskonfigurasjon funnet for denne leverandøren");

  return data as IntegrationConfig;
}

// ===== Secret Resolver =====
async function loadPassword(
  supabaseAdmin: ReturnType<typeof createClient>,
  integrationId: string,
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("supplier_secrets")
    .select("encrypted_value")
    .eq("integration_id", integrationId)
    .maybeSingle();

  if (error) {
    console.error("[secret-resolver] Load error:", error.message);
    return null;
  }
  return data?.encrypted_value ?? null;
}

async function savePasswordSecret(
  supabaseAdmin: ReturnType<typeof createClient>,
  integrationId: string,
  companyId: string,
  password: string,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("supplier_secrets")
    .upsert(
      {
        integration_id: integrationId,
        company_id: companyId,
        encrypted_value: password,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "integration_id" },
    );
  if (error) throw new Error(`Feil ved lagring av passord: ${error.message}`);
}

// ===== Connection Status Updater =====
async function updateConnectionStatus(
  supabaseAdmin: ReturnType<typeof createClient>,
  integrationId: string,
  status: "ok" | "warning" | "error",
  message: string,
) {
  await supabaseAdmin
    .from("supplier_integrations")
    .update({
      last_connection_status: status,
      last_connection_message: message,
      last_connected_at: new Date().toISOString(),
    })
    .eq("id", integrationId);
}

// ===== Pattern Matching =====
function matchGlob(pattern: string, filename: string): boolean {
  // Escape regex special chars, then convert glob * and ? to regex equivalents
  const escaped = pattern
    .replace(/([.+^${}()|[\]\\])/g, "\\$1")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  try {
    return new RegExp(`^${escaped}$`, "i").test(filename);
  } catch {
    console.warn(`[pattern-match] Invalid pattern "${pattern}", skipping`);
    return false;
  }
}

function categorizeFiles(
  files: RemoteFile[],
  config: IntegrationConfig,
): {
  all_files: RemoteFile[];
  matched: { catalog: RemoteFile[]; price: RemoteFile[]; discount: RemoteFile[]; invoice: RemoteFile[] };
  warnings: string[];
} {
  const onlyFiles = files.filter((f) => f.type === "file");
  const matched = {
    catalog: [] as RemoteFile[],
    price: [] as RemoteFile[],
    discount: [] as RemoteFile[],
    invoice: [] as RemoteFile[],
  };
  const warnings: string[] = [];

  for (const f of onlyFiles) {
    if (config.catalog_file_pattern && matchGlob(config.catalog_file_pattern, f.name)) {
      matched.catalog.push(f);
    }
    if (config.price_file_pattern && matchGlob(config.price_file_pattern, f.name)) {
      matched.price.push(f);
    }
    if (config.discount_file_pattern && matchGlob(config.discount_file_pattern, f.name)) {
      matched.discount.push(f);
    }
    if (config.invoice_file_pattern && matchGlob(config.invoice_file_pattern, f.name)) {
      matched.invoice.push(f);
    }
  }

  if (config.catalog_file_pattern && matched.catalog.length === 0) {
    warnings.push(`Ingen filer matchet katalogmønsteret: ${config.catalog_file_pattern}`);
  }
  if (config.price_file_pattern && matched.price.length === 0) {
    warnings.push(`Ingen filer matchet prismønsteret: ${config.price_file_pattern}`);
  }
  if (config.discount_file_pattern && matched.discount.length === 0) {
    warnings.push(`Ingen filer matchet rabattmønsteret: ${config.discount_file_pattern}`);
  }

  return { all_files: onlyFiles, matched, warnings };
}

// ===== Timeout helper =====
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: number;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} tidsavbrutt etter ${ms / 1000}s`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// ===== Connection Adapter Factory =====

async function createFtpAdapter(
  config: IntegrationConfig,
  password: string,
): Promise<ConnectionAdapter> {
  let Client: any;
  try {
    const mod = await import("npm:basic-ftp@5.0.5");
    Client = mod.Client;
  } catch (importErr) {
    console.error("[ftp-adapter] Failed to import basic-ftp:", (importErr as Error).message);
    throw new Error(
      `Kunne ikke laste FTP-bibliotek. Protokoll "${config.protocol}" er kanskje ikke støttet i dette miljøet.`,
    );
  }

  const client = new Client();
  client.ftp.verbose = false;

  return {
    async connect() {
      await client.access({
        host: config.host,
        port: config.port,
        user: config.username,
        password,
        secure: config.protocol === "ftps",
        secureOptions: config.protocol === "ftps" ? { rejectUnauthorized: false } : undefined,
      });
      console.log(`[ftp-adapter] Connected to ${config.host}:${config.port} (${config.protocol})`);
    },
    async list(path: string): Promise<RemoteFile[]> {
      const items = await client.list(path);
      return items.map((item: any) => ({
        name: item.name,
        size: item.size ?? 0,
        modified_at: item.modifiedAt ? new Date(item.modifiedAt).toISOString() : null,
        type: item.isDirectory ? ("directory" as const) : ("file" as const),
      }));
    },
    async download(remotePath: string): Promise<string> {
      // basic-ftp downloadTo needs a Node Writable stream
      const { Writable } = await import("node:stream");
      const chunks: Uint8Array[] = [];
      const writable = new Writable({
        write(chunk: any, _encoding: string, callback: () => void) {
          chunks.push(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk));
          callback();
        },
      });
      await client.downloadTo(writable, remotePath);
      const decoder = new TextDecoder("utf-8");
      return chunks.map((c) => decoder.decode(c, { stream: true })).join("") + decoder.decode();
    },
    async disconnect() {
      client.close();
    },
  };
}

async function createSftpAdapter(
  config: IntegrationConfig,
  password: string,
): Promise<ConnectionAdapter> {
  let SftpClient: any;
  try {
    const mod = await import("npm:ssh2-sftp-client@11.0.0");
    SftpClient = mod.default;
  } catch (importErr) {
    console.error("[sftp-adapter] Failed to import ssh2-sftp-client:", (importErr as Error).message);
    throw new Error(
      "Kunne ikke laste SFTP-bibliotek. Prøv FTP/FTPS-protokoll hvis SFTP ikke fungerer.",
    );
  }

  const client = new SftpClient();

  return {
    async connect() {
      await client.connect({
        host: config.host,
        port: config.port,
        username: config.username,
        password,
        readyTimeout: 15000,
        retries: 1,
        algorithms: {
          kex: [
            "ecdh-sha2-nistp256",
            "ecdh-sha2-nistp384",
            "ecdh-sha2-nistp521",
            "diffie-hellman-group14-sha256",
            "diffie-hellman-group14-sha1",
            "diffie-hellman-group-exchange-sha256",
          ],
        },
      });
      console.log(`[sftp-adapter] Connected to ${config.host}:${config.port}`);
    },
    async list(path: string): Promise<RemoteFile[]> {
      const items = await client.list(path);
      return items.map((item: any) => ({
        name: item.name,
        size: item.size ?? 0,
        modified_at: item.modifyTime ? new Date(item.modifyTime).toISOString() : null,
        type: item.type === "d" ? ("directory" as const) : ("file" as const),
      }));
    },
    async download(remotePath: string): Promise<string> {
      const buffer = await client.get(remotePath);
      if (typeof buffer === "string") return buffer;
      if (buffer instanceof Uint8Array || (typeof Buffer !== "undefined" && buffer instanceof Buffer)) {
        return new TextDecoder("utf-8").decode(buffer);
      }
      return String(buffer);
    },
    async disconnect() {
      await client.end();
    },
  };
}

async function createAdapter(
  config: IntegrationConfig,
  password: string,
): Promise<ConnectionAdapter> {
  console.log(`[adapter-factory] Creating ${config.protocol} adapter for ${config.host}:${config.port}`);
  switch (config.protocol) {
    case "ftp":
    case "ftps":
      return createFtpAdapter(config, password);
    case "sftp":
      return createSftpAdapter(config, password);
    default:
      throw new Error(`Ustøttet protokoll: ${(config as any).protocol}`);
  }
}

// ===== Error Classification =====
function classifyConnectionError(errMsg: string, config: IntegrationConfig): { userMessage: string; errorCode: string } {
  if (errMsg.includes("tidsavbrutt") || errMsg.includes("timeout") || errMsg.includes("ETIMEDOUT") || errMsg.includes("Timed out")) {
    return { userMessage: `Tidsavbrudd mot ${config.host}:${config.port} – sjekk vertsnavn og port`, errorCode: "timeout" };
  }
  if (errMsg.includes("ENOTFOUND") || errMsg.includes("getaddrinfo")) {
    return { userMessage: `Vertsnavn "${config.host}" ble ikke funnet (DNS-feil)`, errorCode: "host_not_found" };
  }
  if (errMsg.includes("ECONNREFUSED")) {
    return { userMessage: `Tilkobling nektet på ${config.host}:${config.port} – sjekk port og brannmur`, errorCode: "connection_refused" };
  }
  if (errMsg.includes("ECONNRESET") || errMsg.includes("socket hang up")) {
    return { userMessage: `Forbindelsen ble avbrutt av serveren – sjekk protokoll og port`, errorCode: "connection_reset" };
  }
  if (errMsg.includes("Auth") || errMsg.includes("auth") || errMsg.includes("login") || errMsg.includes("530") || errMsg.includes("permission denied")) {
    return { userMessage: "Autentisering feilet – sjekk brukernavn og passord", errorCode: "auth_failed" };
  }
  if (errMsg.includes("Kunne ikke laste")) {
    return { userMessage: errMsg, errorCode: "library_error" };
  }
  return { userMessage: `Tilkoblingsfeil: ${errMsg.substring(0, 200)}`, errorCode: "connection_error" };
}

// ===== Action Handlers =====

async function handleSavePassword(
  supabaseAdmin: ReturnType<typeof createClient>,
  companyId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const integrationId = body.integration_id as string;
  const password = body.password as string;

  if (!integrationId || !password) {
    return jsonError("Mangler integration_id eller password", "missing_params");
  }

  // Verify integration belongs to company
  const { data: integration } = await supabaseAdmin
    .from("supplier_integrations")
    .select("id, company_id")
    .eq("id", integrationId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (!integration) {
    return jsonError("Integrasjon ikke funnet for dette selskapet", "not_found", 404);
  }

  await savePasswordSecret(supabaseAdmin, integrationId, companyId, password);

  // Update reference column so UI knows password is set
  await supabaseAdmin
    .from("supplier_integrations")
    .update({ password_secret_ref: `secret:${integrationId}` })
    .eq("id", integrationId);

  return jsonOk({ message: "Passord lagret sikkert" });
}

async function handleTestConnection(
  supabaseAdmin: ReturnType<typeof createClient>,
  companyId: string,
  supplierId: string,
): Promise<Response> {
  console.log(`[test-connection] Starting for supplier ${supplierId}, company ${companyId}`);

  // Step 1: Load config
  let config: IntegrationConfig;
  try {
    config = await loadIntegrationConfig(supabaseAdmin, companyId, supplierId);
    console.log(`[test-connection] Config loaded: ${config.protocol}://${config.host}:${config.port}`);
  } catch (e) {
    console.error(`[test-connection] Config error: ${(e as Error).message}`);
    return jsonError((e as Error).message, "config_error");
  }

  // Step 2: Load password
  const password = await loadPassword(supabaseAdmin, config.id);
  if (!password) {
    console.warn(`[test-connection] No password for integration ${config.id}`);
    await updateConnectionStatus(supabaseAdmin, config.id, "error", "Passord ikke konfigurert");
    return jsonOk({
      status: "error",
      message: "Passord er ikke lagret for denne integrasjonen. Lagre passord først.",
      error_code: "no_password",
      tested_at: new Date().toISOString(),
      path_exists: false,
      sample_files: [],
    });
  }

  // Step 3: Create adapter + connect + list
  let adapter: ConnectionAdapter | null = null;
  try {
    adapter = await createAdapter(config, password);

    // Connect with 20s timeout
    await withTimeout(adapter.connect(), 20_000, "Tilkobling");

    // Verify path access
    const basePath = config.remote_base_path || "/";
    let sampleFiles: RemoteFile[] = [];
    let pathExists = true;

    try {
      sampleFiles = await withTimeout(adapter.list(basePath), 15_000, "Filoppslag");
    } catch (pathErr) {
      pathExists = false;
      console.warn(`[test-connection] Path "${basePath}" inaccessible: ${(pathErr as Error).message}`);
    }

    const testedAt = new Date().toISOString();

    if (pathExists) {
      const fileCount = sampleFiles.filter((f) => f.type === "file").length;
      const dirCount = sampleFiles.filter((f) => f.type === "directory").length;

      // Run pattern matching against configured patterns so test-connection
      // shows whether the expected files (e.g. "Priser_3027280.txt") exist.
      const { matched, warnings } = categorizeFiles(sampleFiles, config);
      const matchedTotal = matched.catalog.length + matched.price.length + matched.discount.length + matched.invoice.length;

      const hasPatterns = !!(config.catalog_file_pattern || config.price_file_pattern || config.discount_file_pattern || config.invoice_file_pattern);
      const statusLevel = hasPatterns && matchedTotal === 0 && fileCount > 0 ? "warning" as const : "ok" as const;

      const msg = statusLevel === "ok"
        ? `Tilkobling OK. ${fileCount} filer og ${dirCount} mapper i ${basePath}` + (matchedTotal > 0 ? `. ${matchedTotal} filer matchet konfigurerte mønstre.` : "")
        : `Tilkoblet, men ingen filer matchet konfigurerte mønstre (${fileCount} filer i mappen)`;

      await updateConnectionStatus(supabaseAdmin, config.id, statusLevel, msg);

      return jsonOk({
        status: statusLevel,
        message: msg,
        tested_at: testedAt,
        path_exists: true,
        sample_files: sampleFiles.slice(0, 20).map((f) => ({
          name: f.name,
          size: f.size,
          type: f.type,
        })),
        matched: {
          catalog: matched.catalog.map((f) => ({ name: f.name, size: f.size })),
          price: matched.price.map((f) => ({ name: f.name, size: f.size })),
          discount: matched.discount.map((f) => ({ name: f.name, size: f.size })),
          invoice: matched.invoice.map((f) => ({ name: f.name, size: f.size })),
        },
        pattern_warnings: warnings,
      });
    } else {
      const msg = `Tilkoblet, men sti "${basePath}" er utilgjengelig`;
      await updateConnectionStatus(supabaseAdmin, config.id, "warning", msg);

      return jsonOk({
        status: "warning",
        message: msg,
        tested_at: testedAt,
        path_exists: false,
        sample_files: [],
        matched: { catalog: [], price: [], discount: [], invoice: [] },
        pattern_warnings: [],
      });
    }
  } catch (err) {
    const errMsg = (err as Error).message;
    console.error(`[test-connection] Failed: ${errMsg}`);
    const { userMessage, errorCode } = classifyConnectionError(errMsg, config);
    await updateConnectionStatus(supabaseAdmin, config.id, "error", userMessage);

    return jsonOk({
      status: "error",
      message: userMessage,
      error_code: errorCode,
      tested_at: new Date().toISOString(),
      path_exists: false,
      sample_files: [],
    });
  } finally {
    try {
      if (adapter) await adapter.disconnect();
    } catch (e) {
      console.warn("[test-connection] Disconnect error (ignored):", (e as Error).message);
    }
  }
}

async function handleListFiles(
  supabaseAdmin: ReturnType<typeof createClient>,
  companyId: string,
  supplierId: string,
): Promise<Response> {
  console.log(`[list-files] Starting for supplier ${supplierId}`);

  let config: IntegrationConfig;
  try {
    config = await loadIntegrationConfig(supabaseAdmin, companyId, supplierId);
  } catch (e) {
    return jsonError((e as Error).message, "config_error");
  }

  const password = await loadPassword(supabaseAdmin, config.id);
  if (!password) {
    return jsonError("Passord ikke konfigurert – lagre passord først", "no_password");
  }

  let adapter: ConnectionAdapter | null = null;

  try {
    adapter = await createAdapter(config, password);
    await withTimeout(adapter.connect(), 20_000, "Tilkobling");

    const basePath = config.remote_base_path || "/";
    let allFiles: RemoteFile[] = [];

    try {
      allFiles = await withTimeout(adapter.list(basePath), 15_000, "Filoppslag");
      console.log(`[list-files] Found ${allFiles.length} items in ${basePath}`);
    } catch (pathErr) {
      return jsonError(
        `Kunne ikke lese filer fra "${basePath}": ${(pathErr as Error).message}`,
        "path_error",
      );
    }

    // Explore subdirectories if the base path has few files
    const subdirs = allFiles.filter((f) => f.type === "directory");
    const fileCount = allFiles.filter((f) => f.type === "file").length;
    if (subdirs.length > 0 && fileCount < 3) {
      console.log(`[list-files] Only ${fileCount} files in root, exploring ${subdirs.length} subdirs`);
      for (const dir of subdirs.slice(0, 5)) {
        try {
          const subPath = `${basePath.replace(/\/$/, "")}/${dir.name}`;
          const subFiles = await withTimeout(adapter.list(subPath), 10_000, `Undermappe ${dir.name}`);
          for (const sf of subFiles) {
            allFiles.push({ ...sf, name: `${dir.name}/${sf.name}` });
          }
        } catch {
          // Skip unreadable subdirectories silently
        }
      }
    }

    const result = categorizeFiles(allFiles, config);

    // Update connection status since we successfully connected
    await updateConnectionStatus(
      supabaseAdmin,
      config.id,
      "ok",
      `Filliste hentet: ${result.all_files.length} filer`,
    );

    return jsonOk({
      status: "ok",
      message: `${result.all_files.length} filer funnet`,
      data: result,
    });
  } catch (err) {
    const errMsg = (err as Error).message;
    console.error(`[list-files] Failed: ${errMsg}`);
    const { userMessage, errorCode } = classifyConnectionError(errMsg, config);
    return jsonError(userMessage, errorCode, 500);
  } finally {
    try {
      if (adapter) await adapter.disconnect();
    } catch (e) {
      console.warn("[list-files] Disconnect error (ignored):", (e as Error).message);
    }
  }
}

// ===== Import Job Helpers =====
async function createImportJob(
  supabaseAdmin: ReturnType<typeof createClient>,
  companyId: string,
  supplierId: string,
  jobType: string,
  triggeredBy: string,
): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("product_import_jobs")
    .insert({
      company_id: companyId,
      supplier_id: supplierId,
      job_type: jobType,
      status: "queued",
      triggered_by: triggeredBy,
      files_found: [],
      rows_processed: 0,
      rows_inserted: 0,
      rows_updated: 0,
      rows_failed: 0,
      error_log: [],
    })
    .select("id")
    .single();

  if (error) throw new Error(`Feil ved opprettelse av importjobb: ${error.message}`);
  return data.id;
}

async function updateImportJob(
  supabaseAdmin: ReturnType<typeof createClient>,
  jobId: string,
  updates: Record<string, unknown>,
) {
  await supabaseAdmin.from("product_import_jobs").update(updates).eq("id", jobId);
}

// =====================================================================
// ===== PARSER FRAMEWORK =====
// =====================================================================

// --- File sniffing & delimiter detection ---

const DELIMITERS = [";", "\t", ",", "|"] as const;

function detectDelimiter(lines: string[]): string {
  const sample = lines.slice(0, Math.min(10, lines.length));
  let best = ";";
  let bestScore = 0;

  for (const d of DELIMITERS) {
    const counts = sample.map((l) => l.split(d).length - 1);
    if (counts.length === 0) continue;
    const consistent = counts.every((c) => c === counts[0] && c > 0);
    const avgCount = counts.reduce((a, b) => a + b, 0) / counts.length;
    const score = consistent ? avgCount * 10 : avgCount;
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  console.log(`[parser] Detected delimiter: "${best === "\t" ? "TAB" : best}" (score: ${bestScore})`);
  return best;
}

function detectHeaderRow(lines: string[], delimiter: string): { headerIndex: number; headers: string[] } {
  // Heuristic: first row with mostly non-numeric text tokens is the header
  for (let i = 0; i < Math.min(3, lines.length); i++) {
    const cols = lines[i].split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ""));
    const nonNumericCount = cols.filter((c) => c.length > 0 && isNaN(Number(c.replace(",", ".")))).length;
    if (nonNumericCount > cols.length * 0.5) {
      return { headerIndex: i, headers: cols.map((h) => h.toLowerCase().trim()) };
    }
  }
  // Fallback: first line is header
  const cols = lines[0]?.split(delimiter).map((c) => c.trim().replace(/^"|"$/g, "").toLowerCase()) ?? [];
  return { headerIndex: 0, headers: cols };
}

// --- Value normalization ---

function parseNumber(raw: string | undefined | null): number | null {
  if (!raw || raw.trim() === "") return null;
  // Handle European format: "1.234,56" → "1234.56", also "1234,56" → "1234.56"
  let cleaned = raw.trim().replace(/\s/g, "");
  // If both . and , exist and comma is after dot → European: 1.234,56
  if (cleaned.includes(".") && cleaned.includes(",") && cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (cleaned.includes(",") && !cleaned.includes(".")) {
    cleaned = cleaned.replace(",", ".");
  }
  cleaned = cleaned.replace(/[^0-9.\-]/g, "");
  const val = parseFloat(cleaned);
  return isNaN(val) ? null : val;
}

function cleanString(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/^"|"$/g, "").trim();
  return cleaned.length > 0 ? cleaned : null;
}

// --- Supplier mapping profiles ---

interface ColumnMapping {
  supplier_sku?: string[];
  el_number?: string[];
  ean?: string[];
  product_name?: string[];
  description?: string[];
  brand?: string[];
  unit?: string[];
  category?: string[];
  list_price?: string[];
  discount_percent?: string[];
  net_price?: string[];
}

// Generic fallback mapping that tries common Norwegian + English header names
const GENERIC_MAPPING: ColumnMapping = {
  supplier_sku: ["artikkel", "artikkelkode", "artikkelnr", "artnr", "art.nr", "artikkel_nr", "sku", "item_number", "varenr", "varenummer"],
  el_number: ["elnummer", "el_nummer", "el.nr", "elnr", "el-nr", "el_nr", "el number"],
  ean: ["ean", "ean13", "ean_kode", "ean-kode", "gtin", "strekkode"],
  product_name: ["beskrivelse", "produktnavn", "artikkel_tekst", "artikkeltekst", "artikkelbeskrivelse", "name", "product_name", "tekst", "varetekst", "varenavn"],
  description: ["tilleggstekst", "detaljert_beskrivelse", "long_description", "tillegg", "description"],
  brand: ["merke", "brand", "produsent", "leverandør_merke", "manufacturer"],
  unit: ["enhet", "unit", "mål", "pakningsenhet", "mengde_enhet"],
  category: ["kategori", "category", "gruppe", "varegruppe", "produktgruppe", "hovedgruppe"],
  list_price: ["bruttopris", "brutto", "listepris", "liste_pris", "list_price", "gross_price", "pris", "veil.pris", "veiledende"],
  discount_percent: ["rabatt", "rabatt%", "rabatt_prosent", "discount", "discount_percent", "rabatt_pst"],
  net_price: ["nettopris", "netto", "netto_pris", "net_price", "din_pris", "innkjøpspris", "kjøpspris"],
};

// Onninen-specific profile
const ONNINEN_MAPPING: ColumnMapping = {
  supplier_sku: ["artikkelnr", "artikkel", "artnr", "varenr"],
  el_number: ["elnr", "el.nr", "elnummer", "el_nummer"],
  ean: ["ean", "ean13"],
  product_name: ["beskrivelse", "artikkeltekst", "produktnavn", "tekst", "varetekst"],
  brand: ["merke", "brand", "produsent"],
  unit: ["enhet", "unit"],
  category: ["gruppe", "varegruppe", "kategori"],
  list_price: ["bruttopris", "brutto", "listepris", "pris"],
  discount_percent: ["rabatt", "rabatt%", "rabatt_prosent"],
  net_price: ["nettopris", "netto", "netto_pris"],
};

function getSupplierMapping(supplierCode: string | null): ColumnMapping {
  if (supplierCode?.toUpperCase() === "ONNINEN") return ONNINEN_MAPPING;
  return GENERIC_MAPPING;
}

// --- Column resolver ---

function resolveColumn(headers: string[], candidates: string[]): number {
  for (const candidate of candidates) {
    const idx = headers.indexOf(candidate);
    if (idx !== -1) return idx;
  }
  // Fuzzy: check if header contains candidate
  for (const candidate of candidates) {
    const idx = headers.findIndex((h) => h.includes(candidate));
    if (idx !== -1) return idx;
  }
  return -1;
}

interface ResolvedColumns {
  supplier_sku: number;
  el_number: number;
  ean: number;
  product_name: number;
  description: number;
  brand: number;
  unit: number;
  category: number;
  list_price: number;
  discount_percent: number;
  net_price: number;
}

function resolveAllColumns(headers: string[], mapping: ColumnMapping): { columns: ResolvedColumns; missing: string[] } {
  const columns: ResolvedColumns = {
    supplier_sku: resolveColumn(headers, mapping.supplier_sku ?? GENERIC_MAPPING.supplier_sku!),
    el_number: resolveColumn(headers, mapping.el_number ?? GENERIC_MAPPING.el_number!),
    ean: resolveColumn(headers, mapping.ean ?? GENERIC_MAPPING.ean!),
    product_name: resolveColumn(headers, mapping.product_name ?? GENERIC_MAPPING.product_name!),
    description: resolveColumn(headers, mapping.description ?? GENERIC_MAPPING.description!),
    brand: resolveColumn(headers, mapping.brand ?? GENERIC_MAPPING.brand!),
    unit: resolveColumn(headers, mapping.unit ?? GENERIC_MAPPING.unit!),
    category: resolveColumn(headers, mapping.category ?? GENERIC_MAPPING.category!),
    list_price: resolveColumn(headers, mapping.list_price ?? GENERIC_MAPPING.list_price!),
    discount_percent: resolveColumn(headers, mapping.discount_percent ?? GENERIC_MAPPING.discount_percent!),
    net_price: resolveColumn(headers, mapping.net_price ?? GENERIC_MAPPING.net_price!),
  };

  const missing: string[] = [];
  if (columns.supplier_sku === -1) missing.push("supplier_sku");
  if (columns.product_name === -1) missing.push("product_name");
  // Price fields: at least one should exist
  if (columns.list_price === -1 && columns.net_price === -1) missing.push("list_price/net_price");

  return { columns, missing };
}

// --- Row parser ---

interface ParsedRow {
  supplier_sku: string | null;
  el_number: string | null;
  ean: string | null;
  product_name: string | null;
  description: string | null;
  brand: string | null;
  unit: string | null;
  category: string | null;
  list_price: number | null;
  discount_percent: number | null;
  net_price: number | null;
  raw_fields: Record<string, string>;
}

function parseRow(fields: string[], columns: ResolvedColumns, headers: string[]): ParsedRow {
  const get = (idx: number) => (idx >= 0 && idx < fields.length ? fields[idx]?.trim().replace(/^"|"$/g, "") : null);
  const rawFields: Record<string, string> = {};
  headers.forEach((h, i) => { if (i < fields.length) rawFields[h] = fields[i]?.trim() ?? ""; });

  let listPrice = parseNumber(get(columns.list_price));
  let discountPct = parseNumber(get(columns.discount_percent));
  let netPrice = parseNumber(get(columns.net_price));

  // Calculate net_price if missing
  if (netPrice === null && listPrice !== null && discountPct !== null) {
    netPrice = Math.round(listPrice * (1 - discountPct / 100) * 100) / 100;
  }

  return {
    supplier_sku: cleanString(get(columns.supplier_sku)),
    el_number: cleanString(get(columns.el_number)),
    ean: cleanString(get(columns.ean)),
    product_name: cleanString(get(columns.product_name)),
    description: cleanString(get(columns.description)),
    brand: cleanString(get(columns.brand)),
    unit: cleanString(get(columns.unit)),
    category: cleanString(get(columns.category)),
    list_price: listPrice,
    discount_percent: discountPct,
    net_price: netPrice,
    raw_fields: rawFields,
  };
}

// --- Import services ---

async function upsertSupplierProduct(
  supabaseAdmin: ReturnType<typeof createClient>,
  companyId: string,
  supplierId: string,
  row: ParsedRow,
): Promise<{ id: string; isNew: boolean }> {
  // Try to find existing
  const { data: existing } = await supabaseAdmin
    .from("supplier_products")
    .select("id")
    .eq("company_id", companyId)
    .eq("supplier_id", supplierId)
    .eq("supplier_sku", row.supplier_sku!)
    .maybeSingle();

  const now = new Date().toISOString();

  if (existing) {
    await supabaseAdmin.from("supplier_products").update({
      supplier_product_name: row.product_name,
      supplier_product_description: row.description,
      raw_category: row.category,
      raw_brand: row.brand,
      raw_unit: row.unit,
      raw_payload: row.raw_fields,
      last_seen_at: now,
      updated_at: now,
    }).eq("id", existing.id);
    return { id: existing.id, isNew: false };
  }

  const { data: inserted, error } = await supabaseAdmin.from("supplier_products").insert({
    company_id: companyId,
    supplier_id: supplierId,
    supplier_sku: row.supplier_sku!,
    supplier_product_name: row.product_name,
    supplier_product_description: row.description,
    raw_category: row.category,
    raw_brand: row.brand,
    raw_unit: row.unit,
    raw_payload: row.raw_fields,
    last_seen_at: now,
  }).select("id").single();

  if (error) throw new Error(`Upsert supplier_product: ${error.message}`);
  return { id: inserted.id, isNew: true };
}

async function matchCatalogProduct(
  supabaseAdmin: ReturnType<typeof createClient>,
  companyId: string,
  row: ParsedRow,
): Promise<string | null> {
  // 1. Match by el_number
  if (row.el_number) {
    const { data } = await supabaseAdmin
      .from("supplier_catalog_products")
      .select("id")
      .eq("company_id", companyId)
      .eq("el_number", row.el_number)
      .limit(1)
      .maybeSingle();
    if (data) return data.id;
  }
  // 2. Match by EAN
  if (row.ean) {
    const { data } = await supabaseAdmin
      .from("supplier_catalog_products")
      .select("id")
      .eq("company_id", companyId)
      .eq("ean", row.ean)
      .limit(1)
      .maybeSingle();
    if (data) return data.id;
  }
  return null;
}

async function autoCreateCatalogProduct(
  supabaseAdmin: ReturnType<typeof createClient>,
  companyId: string,
  row: ParsedRow,
): Promise<string | null> {
  // Require a clear name + at least one strong identifier
  if (!row.product_name) return null;
  if (!row.el_number && !row.ean) return null;

  const { data, error } = await supabaseAdmin.from("supplier_catalog_products").insert({
    company_id: companyId,
    name: row.product_name,
    el_number: row.el_number,
    ean: row.ean,
    brand: row.brand,
    unit: row.unit,
    category: row.category,
    description: row.description,
    is_active: true,
  }).select("id").single();

  if (error) {
    console.warn(`[catalog] Auto-create failed: ${error.message}`);
    return null;
  }
  return data.id;
}

async function upsertSupplierPrice(
  supabaseAdmin: ReturnType<typeof createClient>,
  companyId: string,
  supplierId: string,
  supplierProductId: string,
  row: ParsedRow,
  fileName: string,
): Promise<void> {
  const hasPriceData = row.list_price !== null || row.net_price !== null;
  if (!hasPriceData) return;

  await supabaseAdmin.from("supplier_prices").insert({
    company_id: companyId,
    supplier_id: supplierId,
    supplier_product_id: supplierProductId,
    list_price: row.list_price ?? 0,
    discount_percent: row.discount_percent,
    net_price: row.net_price,
    currency: "NOK",
    source_file_name: fileName,
    imported_at: new Date().toISOString(),
  });
}

// --- Price cache recalculation ---

async function rebuildPriceCache(
  supabaseAdmin: ReturnType<typeof createClient>,
  companyId: string,
  productIds: string[],
) {
  if (productIds.length === 0) return;
  const uniqueIds = [...new Set(productIds)];
  console.log(`[cache] Rebuilding price cache for ${uniqueIds.length} products`);

  for (const productId of uniqueIds) {
    // Find best price across all suppliers for this catalog product
    const { data: prices } = await supabaseAdmin
      .from("supplier_prices")
      .select("supplier_id, net_price, list_price, discount_percent")
      .eq("company_id", companyId)
      .in("supplier_product_id",
        // Get all supplier_products linked to this catalog product
        (await supabaseAdmin
          .from("supplier_products")
          .select("id")
          .eq("company_id", companyId)
          .eq("product_id", productId)
        ).data?.map((sp: any) => sp.id) ?? []
      )
      .order("imported_at", { ascending: false });

    if (!prices || prices.length === 0) continue;

    // Find best net price
    let bestPrice: number | null = null;
    let bestSupplierId: string | null = null;
    const snapshot: Record<string, unknown> = {};

    for (const p of prices) {
      const effective = p.net_price ?? p.list_price;
      if (effective !== null && (bestPrice === null || effective < bestPrice)) {
        bestPrice = effective;
        bestSupplierId = p.supplier_id;
      }
      if (!snapshot[p.supplier_id]) {
        snapshot[p.supplier_id] = { net_price: p.net_price, list_price: p.list_price, discount_percent: p.discount_percent };
      }
    }

    // Upsert cache
    const { data: existing } = await supabaseAdmin
      .from("product_price_cache")
      .select("id")
      .eq("company_id", companyId)
      .eq("product_id", productId)
      .maybeSingle();

    const cacheData = {
      company_id: companyId,
      product_id: productId,
      best_supplier_id: bestSupplierId,
      best_net_price: bestPrice,
      price_snapshot: snapshot,
      recalculated_at: new Date().toISOString(),
    };

    if (existing) {
      await supabaseAdmin.from("product_price_cache").update(cacheData).eq("id", existing.id);
    } else {
      await supabaseAdmin.from("product_price_cache").insert(cacheData);
    }
  }
}

// --- Import result summarizer ---

interface ImportStats {
  rows_processed: number;
  rows_inserted: number;
  rows_updated: number;
  rows_failed: number;
  rows_skipped: number;
  rows_needs_review: number;
  errors: string[];
  affected_product_ids: string[];
}

// ===== Full parseFile implementation =====

async function parseFile(params: {
  supabaseAdmin: ReturnType<typeof createClient>;
  supplierId: string;
  supplierCode: string | null;
  companyId: string;
  importJobId: string;
  fileType: string;
  fileName: string;
  fileContent: string;
}): Promise<ImportStats> {
  const { supabaseAdmin, supplierId, supplierCode, companyId, importJobId, fileType, fileName, fileContent } = params;

  const stats: ImportStats = {
    rows_processed: 0, rows_inserted: 0, rows_updated: 0, rows_failed: 0,
    rows_skipped: 0, rows_needs_review: 0, errors: [], affected_product_ids: [],
  };

  // Split into lines, filter empty
  const rawLines = fileContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (rawLines.length < 2) {
    stats.errors.push(`${fileName}: Filen har for få rader (${rawLines.length})`);
    return stats;
  }

  // Detect delimiter and header
  const delimiter = detectDelimiter(rawLines);
  const { headerIndex, headers } = detectHeaderRow(rawLines, delimiter);
  console.log(`[parser] ${fileName}: ${rawLines.length} rader, header index=${headerIndex}, ${headers.length} kolonner`);
  console.log(`[parser] Headers: ${headers.join(" | ")}`);

  // Resolve column mapping
  const mapping = getSupplierMapping(supplierCode);
  const { columns, missing } = resolveAllColumns(headers, mapping);

  if (columns.supplier_sku === -1) {
    stats.errors.push(`${fileName}: Kunne ikke finne artikkelkode-kolonne. Tilgjengelige kolonner: ${headers.join(", ")}`);
    return stats;
  }

  if (missing.length > 0) {
    console.warn(`[parser] ${fileName}: Missing columns: ${missing.join(", ")}`);
  }

  const dataLines = rawLines.slice(headerIndex + 1);
  const BATCH_SIZE = 50;

  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i];
    const rowNumber = i + headerIndex + 2; // 1-indexed, accounting for header
    stats.rows_processed++;

    let parseStatus: string = "parsed";
    let errorMessage: string | null = null;
    let linkedProductId: string | null = null;
    let linkedSupplierProductId: string | null = null;

    try {
      const fields = line.split(delimiter);
      const parsed = parseRow(fields, columns, headers);

      // Validation: must have supplier_sku
      if (!parsed.supplier_sku) {
        parseStatus = "skipped";
        errorMessage = "Manglende artikkelkode";
        stats.rows_skipped++;

        await supabaseAdmin.from("product_import_rows").insert({
          company_id: companyId, import_job_id: importJobId, row_number: rowNumber,
          row_type: fileType, raw_data: parsed.raw_fields, parse_status: parseStatus,
          error_message: errorMessage,
        });
        continue;
      }

      // Upsert supplier_product
      const { id: spId, isNew } = await upsertSupplierProduct(supabaseAdmin, companyId, supplierId, parsed);
      linkedSupplierProductId = spId;

      if (isNew) stats.rows_inserted++;
      else stats.rows_updated++;

      // Match to catalog product
      let catalogProductId = await matchCatalogProduct(supabaseAdmin, companyId, parsed);

      // Auto-create catalog product if good data
      if (!catalogProductId) {
        catalogProductId = await autoCreateCatalogProduct(supabaseAdmin, companyId, parsed);
      }

      // Link supplier_product to catalog product
      if (catalogProductId) {
        await supabaseAdmin.from("supplier_products").update({ product_id: catalogProductId }).eq("id", spId);
        linkedProductId = catalogProductId;
        stats.affected_product_ids.push(catalogProductId);
      } else {
        // No match → needs_review
        parseStatus = "needs_review";
        errorMessage = "Ingen match i produktkatalog";
        stats.rows_needs_review++;
      }

      // Upsert price (for price/discount files and catalog files with price data)
      await upsertSupplierPrice(supabaseAdmin, companyId, supplierId, spId, parsed, fileName);

    } catch (rowErr) {
      parseStatus = "failed";
      errorMessage = (rowErr as Error).message.substring(0, 500);
      stats.rows_failed++;
      stats.errors.push(`Rad ${rowNumber}: ${errorMessage}`);
    }

    // Save import row
    try {
      const fields = line.split(delimiter);
      const rawObj: Record<string, string> = {};
      headers.forEach((h, idx) => { rawObj[h] = fields[idx]?.trim() ?? ""; });

      await supabaseAdmin.from("product_import_rows").insert({
        company_id: companyId,
        import_job_id: importJobId,
        row_number: rowNumber,
        row_type: fileType,
        raw_data: rawObj,
        parse_status: parseStatus as any,
        error_message: errorMessage,
        linked_product_id: linkedProductId,
        linked_supplier_product_id: linkedSupplierProductId,
      });
    } catch (insertErr) {
      console.error(`[parser] Failed to save import row ${rowNumber}: ${(insertErr as Error).message}`);
    }
  }

  // Rebuild price cache for affected products
  try {
    await rebuildPriceCache(supabaseAdmin, companyId, stats.affected_product_ids);
  } catch (cacheErr) {
    console.error(`[parser] Price cache rebuild error: ${(cacheErr as Error).message}`);
    stats.errors.push(`Price cache rebuild feilet: ${(cacheErr as Error).message}`);
  }

  console.log(`[parser] ${fileName} complete: processed=${stats.rows_processed}, inserted=${stats.rows_inserted}, updated=${stats.rows_updated}, failed=${stats.rows_failed}, needs_review=${stats.rows_needs_review}`);
  return stats;
}

// ===== Run Sync Handler =====
async function handleRunSync(
  supabaseAdmin: ReturnType<typeof createClient>,
  companyId: string,
  supplierId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const syncType = (body.sync_type as string) || "full_sync";
  const userId = body.user_id as string;

  const validTypes = ["full_sync", "catalog_sync", "price_sync", "discount_sync"];
  if (!validTypes.includes(syncType)) {
    return jsonError(`Ugyldig sync_type: ${syncType}`, "invalid_sync_type");
  }

  let config: IntegrationConfig;
  try {
    config = await loadIntegrationConfig(supabaseAdmin, companyId, supplierId);
  } catch (e) {
    return jsonError((e as Error).message, "config_error");
  }

  const password = await loadPassword(supabaseAdmin, config.id);
  if (!password) {
    return jsonError("Passord ikke konfigurert", "no_password");
  }

  // Fetch supplier code for mapping profile
  let supplierCode: string | null = null;
  try {
    const { data: supplier } = await supabaseAdmin
      .from("suppliers")
      .select("code")
      .eq("id", supplierId)
      .maybeSingle();
    supplierCode = supplier?.code ?? null;
  } catch { /* ignore */ }

  let jobId: string;
  try {
    jobId = await createImportJob(supabaseAdmin, companyId, supplierId, syncType, userId || "admin");
  } catch (e) {
    return jsonError((e as Error).message, "job_create_error", 500);
  }

  await updateImportJob(supabaseAdmin, jobId, { status: "running", started_at: new Date().toISOString() });

  let adapter: ConnectionAdapter | null = null;
  const errorLog: string[] = [];
  const filesFound: string[] = [];
  const aggregated: ImportStats = {
    rows_processed: 0, rows_inserted: 0, rows_updated: 0, rows_failed: 0,
    rows_skipped: 0, rows_needs_review: 0, errors: [], affected_product_ids: [],
  };

  try {
    adapter = await createAdapter(config, password);
    await withTimeout(adapter.connect(), 20_000, "Tilkobling");

    const basePath = config.remote_base_path || "/";
    const allFiles = await withTimeout(adapter.list(basePath), 15_000, "Filoppslag");
    const categorized = categorizeFiles(allFiles, config);

    const typesToProcess: { type: string; files: RemoteFile[] }[] = [];
    if (syncType === "full_sync" || syncType === "catalog_sync") typesToProcess.push({ type: "catalog", files: categorized.matched.catalog });
    if (syncType === "full_sync" || syncType === "price_sync") typesToProcess.push({ type: "price", files: categorized.matched.price });
    if (syncType === "full_sync" || syncType === "discount_sync") typesToProcess.push({ type: "discount", files: categorized.matched.discount });

    for (const group of typesToProcess) {
      for (const f of group.files) filesFound.push(f.name);
    }

    await updateImportJob(supabaseAdmin, jobId, { files_found: filesFound });

    if (filesFound.length === 0) {
      await updateImportJob(supabaseAdmin, jobId, {
        status: "success",
        finished_at: new Date().toISOString(),
        error_log: ["Ingen matchende filer funnet på serveren"],
      });
      return jsonOk({ status: "success", message: "Synk fullført – ingen matchende filer", data: { job_id: jobId, files_found: 0 } });
    }

    for (const group of typesToProcess) {
      for (const file of group.files) {
        const filePath = `${basePath.replace(/\/$/, "")}/${file.name}`;
        try {
          console.log(`[run-sync] Downloading ${filePath} (${file.size} bytes)...`);
          const content = await withTimeout(adapter.download(filePath), 120_000, `Nedlasting av ${file.name}`);
          console.log(`[run-sync] Downloaded ${file.name}: ${content.length} chars`);

          const result = await parseFile({
            supabaseAdmin, supplierId, supplierCode, companyId,
            importJobId: jobId, fileType: group.type, fileName: file.name, fileContent: content,
          });

          aggregated.rows_processed += result.rows_processed;
          aggregated.rows_inserted += result.rows_inserted;
          aggregated.rows_updated += result.rows_updated;
          aggregated.rows_failed += result.rows_failed;
          aggregated.rows_skipped += result.rows_skipped;
          aggregated.rows_needs_review += result.rows_needs_review;
          aggregated.errors.push(...result.errors);
          aggregated.affected_product_ids.push(...result.affected_product_ids);

        } catch (fileErr) {
          const msg = `Fil "${file.name}": ${(fileErr as Error).message}`;
          console.error(`[run-sync] ${msg}`);
          errorLog.push(msg);
          aggregated.rows_failed++;
        }
      }
    }

    const allErrors = [...errorLog, ...aggregated.errors];
    const finalStatus =
      aggregated.rows_failed > 0 && aggregated.rows_inserted + aggregated.rows_updated > 0 ? "partial_success"
      : aggregated.rows_failed > 0 && aggregated.rows_inserted + aggregated.rows_updated === 0 ? "failed"
      : "success";

    await updateImportJob(supabaseAdmin, jobId, {
      status: finalStatus,
      finished_at: new Date().toISOString(),
      rows_processed: aggregated.rows_processed,
      rows_inserted: aggregated.rows_inserted,
      rows_updated: aggregated.rows_updated,
      rows_failed: aggregated.rows_failed,
      error_log: allErrors.length > 0 ? allErrors.slice(0, 100) : [],
    });

    if (finalStatus === "success" || finalStatus === "partial_success") {
      await supabaseAdmin.from("supplier_integrations").update({ last_sync_at: new Date().toISOString() }).eq("id", config.id);
    }

    const summary = [
      `${aggregated.rows_inserted} nye`,
      `${aggregated.rows_updated} oppdaterte`,
      aggregated.rows_failed > 0 ? `${aggregated.rows_failed} feilet` : null,
      aggregated.rows_needs_review > 0 ? `${aggregated.rows_needs_review} trenger gjennomgang` : null,
    ].filter(Boolean).join(", ");

    return jsonOk({
      status: finalStatus,
      message: `Synk ${finalStatus === "success" ? "fullført" : finalStatus === "partial_success" ? "delvis fullført" : "feilet"}. ${summary}.`,
      data: {
        job_id: jobId,
        files_found: filesFound.length,
        rows_processed: aggregated.rows_processed,
        rows_inserted: aggregated.rows_inserted,
        rows_updated: aggregated.rows_updated,
        rows_failed: aggregated.rows_failed,
        rows_needs_review: aggregated.rows_needs_review,
      },
    });
  } catch (err) {
    const errMsg = (err as Error).message;
    console.error("[run-sync] Fatal:", errMsg);
    let step = "connection";
    if (errMsg.includes("konfigurasjon")) step = "config";
    else if (errMsg.includes("Auth") || errMsg.includes("login")) step = "auth";

    await updateImportJob(supabaseAdmin, jobId, {
      status: "failed",
      finished_at: new Date().toISOString(),
      error_log: [`[${step}] ${errMsg}`, ...errorLog, ...aggregated.errors],
    });
    await updateConnectionStatus(supabaseAdmin, config.id, "error", `Synk feilet: ${errMsg.substring(0, 200)}`);

    return jsonOk({ status: "failed", message: `Synk feilet i steg "${step}": ${errMsg.substring(0, 200)}`, error_code: `sync_${step}_error`, data: { job_id: jobId } });
  } finally {
    try {
      if (adapter) await adapter.disconnect();
    } catch { /* ignore */ }
  }
}

// ===== Main Router =====
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Auth guard
    let userId: string;
    try {
      const auth = await authenticateAdmin(req, supabaseAdmin);
      userId = auth.userId;
    } catch (e) {
      if (e instanceof AuthError) {
        return jsonError(e.message, "auth_error", 401);
      }
      throw e;
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action as string;
    const supplierId = body.supplier_id as string;
    const companyId = body.company_id as string;

    if (!companyId) {
      return jsonError("company_id er påkrevd", "missing_company_id");
    }

    console.log(`[router] Action: ${action}, supplier: ${supplierId}, company: ${companyId}, user: ${userId}`);

    switch (action) {
      case "save-password":
        return await handleSavePassword(supabaseAdmin, companyId, body);
      case "test-connection":
        if (!supplierId) return jsonError("supplier_id er påkrevd", "missing_supplier_id");
        return await handleTestConnection(supabaseAdmin, companyId, supplierId);
      case "list-files":
        if (!supplierId) return jsonError("supplier_id er påkrevd", "missing_supplier_id");
        return await handleListFiles(supabaseAdmin, companyId, supplierId);
      case "run-sync":
        if (!supplierId) return jsonError("supplier_id er påkrevd", "missing_supplier_id");
        return await handleRunSync(supabaseAdmin, companyId, supplierId, { ...body, user_id: userId });
      default:
        return jsonError(`Ukjent action: ${action}`, "unknown_action");
    }
  } catch (err) {
    console.error("[router] Unhandled error:", (err as Error).message, (err as Error).stack);
    return jsonError("En uventet feil oppstod", "internal_error", 500);
  }
});
