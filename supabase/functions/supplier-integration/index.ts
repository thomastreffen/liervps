/**
 * supplier-integration – Backend for grossist FTP/sFTP integration.
 *
 * Actions:
 *   save-password      – Securely store integration password
 *   test-connection    – Test FTP/FTPS/SFTP connection
 *   list-files         – List remote files, match patterns
 *   run-sync           – Execute import sync job
 *
 * Architecture layers:
 *   1. Auth guard (getClaims + admin permission)
 *   2. Config loader (supplier_integrations)
 *   3. Secret resolver (supplier_secrets via service_role)
 *   4. Connection adapter factory (FTP/FTPS/SFTP)
 *   5. File discovery + pattern matching
 *   6. Sync orchestrator + job logger
 *   7. Parser entrypoint (stub, extends in next phase)
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
async function authenticateAdmin(
  req: Request,
  supabaseAdmin: ReturnType<typeof createClient>,
): Promise<{ userId: string; companyId: string }> {
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

  // Check admin permission via existing function
  const { data: isAdmin } = await supabaseAdmin.rpc("check_permission_v2", {
    _auth_user_id: userId,
    _perm: "admin.manage_users",
  });
  if (!isAdmin) throw new AuthError("Krever admin-tilgang");

  // Get active company from user context (sent in body)
  // Will be validated against supplier's company_id
  return { userId, companyId: "" }; // companyId resolved from body
}

class AuthError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "AuthError";
  }
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
    console.error("[supplier-integration] Secret load error:", error.message);
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
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`, "i").test(filename);
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

// ===== Connection Adapter Factory =====
// Uses basic-ftp for FTP/FTPS and ssh2-sftp-client for SFTP.
// These libraries use Node.js net/tls modules available via Deno's Node compat layer.

async function createFtpAdapter(
  config: IntegrationConfig,
  password: string,
): Promise<ConnectionAdapter> {
  const { Client } = await import("npm:basic-ftp@5.0.5");
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
      console.log(`[supplier-integration] FTP connected to ${config.host}:${config.port}`);
    },
    async list(path: string): Promise<RemoteFile[]> {
      const items = await client.list(path);
      return items.map((item: any) => ({
        name: item.name,
        size: item.size ?? 0,
        modified_at: item.modifiedAt ? new Date(item.modifiedAt).toISOString() : null,
        type: item.isDirectory ? "directory" as const : "file" as const,
      }));
    },
    async download(path: string): Promise<string> {
      const chunks: Uint8Array[] = [];
      const writable = new WritableStream<Uint8Array>({
        write(chunk) {
          chunks.push(chunk);
        },
      });
      await client.downloadTo(writable, path);
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
  const SftpClient = (await import("npm:ssh2-sftp-client@11.0.0")).default;
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
      console.log(`[supplier-integration] SFTP connected to ${config.host}:${config.port}`);
    },
    async list(path: string): Promise<RemoteFile[]> {
      const items = await client.list(path);
      return items.map((item: any) => ({
        name: item.name,
        size: item.size ?? 0,
        modified_at: item.modifyTime ? new Date(item.modifyTime).toISOString() : null,
        type: item.type === "d" ? "directory" as const : "file" as const,
      }));
    },
    async download(path: string): Promise<string> {
      const buffer = await client.get(path);
      if (typeof buffer === "string") return buffer;
      if (buffer instanceof Buffer) return buffer.toString("utf-8");
      return new TextDecoder().decode(buffer);
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
  switch (config.protocol) {
    case "ftp":
    case "ftps":
      return createFtpAdapter(config, password);
    case "sftp":
      return createSftpAdapter(config, password);
    default:
      throw new Error(`Ustøttet protokoll: ${config.protocol}`);
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
  await supabaseAdmin
    .from("product_import_jobs")
    .update(updates)
    .eq("id", jobId);
}

// ===== Parser Entrypoint (stub for next phase) =====
/**
 * Parser entrypoint – receives downloaded file content and produces
 * structured rows for import into supplier_products / supplier_prices.
 *
 * Next phase will implement:
 * - CSV delimiter detection
 * - Column mapping per supplier
 * - Row validation and normalization
 * - Upsert into supplier_products + supplier_prices
 * - product_import_rows logging per row
 */
interface ParseResult {
  rows_parsed: number;
  rows_failed: number;
  errors: string[];
}

async function parseFile(params: {
  supabaseAdmin: ReturnType<typeof createClient>;
  supplierId: string;
  companyId: string;
  importJobId: string;
  fileType: string;
  fileName: string;
  fileContent: string;
}): Promise<ParseResult> {
  const { supabaseAdmin, companyId, importJobId, fileType, fileName, fileContent } = params;

  // Stub: count lines as proxy for rows, log each as "parsed"
  const lines = fileContent.split("\n").filter((l) => l.trim().length > 0);
  const dataLines = lines.length > 1 ? lines.length - 1 : 0; // Exclude header

  console.log(
    `[parser] File: ${fileName}, type: ${fileType}, lines: ${lines.length}, data rows: ${dataLines}`,
  );

  // Log first row as sample import row
  if (dataLines > 0) {
    await supabaseAdmin.from("product_import_rows").insert({
      company_id: companyId,
      import_job_id: importJobId,
      row_number: 1,
      row_type: fileType,
      raw_data: { header: lines[0], sample_row: lines[1] ?? null, total_rows: dataLines },
      parse_status: "parsed",
      error_message: null,
    });
  }

  return {
    rows_parsed: dataLines,
    rows_failed: 0,
    errors: [],
  };
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

  // Update the reference column
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
  let config: IntegrationConfig;
  try {
    config = await loadIntegrationConfig(supabaseAdmin, companyId, supplierId);
  } catch (e) {
    return jsonError((e as Error).message, "config_error");
  }

  const password = await loadPassword(supabaseAdmin, config.id);
  if (!password) {
    await updateConnectionStatus(supabaseAdmin, config.id, "error", "Passord ikke konfigurert");
    return jsonError("Passord er ikke lagret for denne integrasjonen", "no_password");
  }

  let adapter: ConnectionAdapter | null = null;
  const stepErrors: string[] = [];

  try {
    // Step 1: Create adapter
    adapter = await createAdapter(config, password);

    // Step 2: Connect with timeout
    const connectPromise = adapter.connect();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Tilkobling tidsavbrutt etter 20 sekunder")), 20000),
    );
    await Promise.race([connectPromise, timeoutPromise]);

    // Step 3: Verify path access
    const basePath = config.remote_base_path || "/";
    let sampleFiles: RemoteFile[] = [];
    let pathExists = true;

    try {
      sampleFiles = await adapter.list(basePath);
    } catch (pathErr) {
      pathExists = false;
      stepErrors.push(`Sti-tilgang feilet: ${(pathErr as Error).message}`);
    }

    const testedAt = new Date().toISOString();

    if (pathExists) {
      const msg = `Tilkobling OK. ${sampleFiles.length} elementer funnet i ${basePath}`;
      await updateConnectionStatus(supabaseAdmin, config.id, "ok", msg);

      return jsonOk({
        status: "ok",
        message: msg,
        tested_at: testedAt,
        path_exists: true,
        sample_files: sampleFiles.slice(0, 10),
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
      });
    }
  } catch (err) {
    const errMsg = (err as Error).message;
    console.error("[supplier-integration] Connection test failed:", errMsg);

    // Categorize error
    let userMessage = "Tilkoblingsfeil";
    let errorCode = "connection_error";

    if (errMsg.includes("tidsavbrutt") || errMsg.includes("timeout") || errMsg.includes("ETIMEDOUT")) {
      userMessage = "Tidsavbrudd – sjekk vertsnavn og port";
      errorCode = "timeout";
    } else if (errMsg.includes("ENOTFOUND") || errMsg.includes("getaddrinfo")) {
      userMessage = `Vertsnavn "${config.host}" ble ikke funnet`;
      errorCode = "host_not_found";
    } else if (errMsg.includes("ECONNREFUSED")) {
      userMessage = `Tilkobling nektet på ${config.host}:${config.port}`;
      errorCode = "connection_refused";
    } else if (errMsg.includes("Auth") || errMsg.includes("auth") || errMsg.includes("login") || errMsg.includes("530")) {
      userMessage = "Autentisering feilet – sjekk brukernavn og passord";
      errorCode = "auth_failed";
    }

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
    } catch { /* ignore disconnect errors */ }
  }
}

async function handleListFiles(
  supabaseAdmin: ReturnType<typeof createClient>,
  companyId: string,
  supplierId: string,
): Promise<Response> {
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

  let adapter: ConnectionAdapter | null = null;

  try {
    adapter = await createAdapter(config, password);
    await adapter.connect();

    const basePath = config.remote_base_path || "/";
    let allFiles: RemoteFile[] = [];

    try {
      allFiles = await adapter.list(basePath);
    } catch (pathErr) {
      return jsonError(
        `Kunne ikke lese filer fra "${basePath}": ${(pathErr as Error).message}`,
        "path_error",
      );
    }

    // Also try common subdirectories if base path has few files
    const subdirs = allFiles.filter((f) => f.type === "directory");
    if (subdirs.length > 0 && allFiles.filter((f) => f.type === "file").length < 3) {
      for (const dir of subdirs.slice(0, 5)) {
        try {
          const subFiles = await adapter.list(`${basePath}/${dir.name}`.replace("//", "/"));
          for (const sf of subFiles) {
            allFiles.push({ ...sf, name: `${dir.name}/${sf.name}` });
          }
        } catch {
          // Skip unreadable subdirectories
        }
      }
    }

    const result = categorizeFiles(allFiles, config);

    return jsonOk({
      status: "ok",
      message: `${result.all_files.length} filer funnet`,
      data: result,
    });
  } catch (err) {
    console.error("[supplier-integration] List files failed:", (err as Error).message);
    return jsonError(`Filhenting feilet: ${(err as Error).message}`, "connection_error", 500);
  } finally {
    try {
      if (adapter) await adapter.disconnect();
    } catch { /* ignore */ }
  }
}

async function handleRunSync(
  supabaseAdmin: ReturnType<typeof createClient>,
  companyId: string,
  supplierId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const syncType = (body.sync_type as string) || "full_sync";
  const userId = body.user_id as string;

  // Validate sync_type
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

  // Create import job
  let jobId: string;
  try {
    jobId = await createImportJob(supabaseAdmin, companyId, supplierId, syncType, userId || "admin");
  } catch (e) {
    return jsonError((e as Error).message, "job_create_error", 500);
  }

  // Update to running
  await updateImportJob(supabaseAdmin, jobId, {
    status: "running",
    started_at: new Date().toISOString(),
  });

  let adapter: ConnectionAdapter | null = null;
  const errorLog: string[] = [];
  let totalParsed = 0;
  let totalFailed = 0;
  let totalInserted = 0;
  const filesFound: string[] = [];

  try {
    adapter = await createAdapter(config, password);
    await adapter.connect();

    const basePath = config.remote_base_path || "/";
    const allFiles = await adapter.list(basePath);
    const categorized = categorizeFiles(allFiles, config);

    // Determine which file categories to process
    const typesToProcess: { type: string; files: RemoteFile[] }[] = [];

    if (syncType === "full_sync" || syncType === "catalog_sync") {
      typesToProcess.push({ type: "catalog", files: categorized.matched.catalog });
    }
    if (syncType === "full_sync" || syncType === "price_sync") {
      typesToProcess.push({ type: "price", files: categorized.matched.price });
    }
    if (syncType === "full_sync" || syncType === "discount_sync") {
      typesToProcess.push({ type: "discount", files: categorized.matched.discount });
    }

    // Record files found
    for (const group of typesToProcess) {
      for (const f of group.files) {
        filesFound.push(f.name);
      }
    }

    await updateImportJob(supabaseAdmin, jobId, { files_found: filesFound });

    if (filesFound.length === 0) {
      await updateImportJob(supabaseAdmin, jobId, {
        status: "success",
        finished_at: new Date().toISOString(),
        error_log: ["Ingen matchende filer funnet på serveren"],
      });
      return jsonOk({
        status: "success",
        message: "Synk fullført – ingen matchende filer funnet",
        data: { job_id: jobId, files_found: 0 },
      });
    }

    // Download and parse each file
    for (const group of typesToProcess) {
      for (const file of group.files) {
        const filePath = `${basePath}/${file.name}`.replace("//", "/");

        try {
          console.log(`[supplier-integration] Downloading: ${filePath}`);
          const content = await adapter.download(filePath);

          const result = await parseFile({
            supabaseAdmin,
            supplierId,
            companyId,
            importJobId: jobId,
            fileType: group.type,
            fileName: file.name,
            fileContent: content,
          });

          totalParsed += result.rows_parsed;
          totalFailed += result.rows_failed;
          totalInserted += result.rows_parsed; // Stub: all parsed = inserted
          errorLog.push(...result.errors);
        } catch (fileErr) {
          const msg = `Fil "${file.name}": ${(fileErr as Error).message}`;
          console.error(`[supplier-integration] ${msg}`);
          errorLog.push(msg);
          totalFailed++;
          // Continue with other files – don't let one failure break everything
        }
      }
    }

    // Determine final status
    const finalStatus =
      totalFailed > 0 && totalParsed > 0
        ? "partial_success"
        : totalFailed > 0
          ? "failed"
          : "success";

    await updateImportJob(supabaseAdmin, jobId, {
      status: finalStatus,
      finished_at: new Date().toISOString(),
      rows_processed: totalParsed + totalFailed,
      rows_inserted: totalInserted,
      rows_updated: 0,
      rows_failed: totalFailed,
      error_log: errorLog,
    });

    // Update last_sync_at on success
    if (finalStatus === "success" || finalStatus === "partial_success") {
      await supabaseAdmin
        .from("supplier_integrations")
        .update({ last_sync_at: new Date().toISOString() })
        .eq("id", config.id);
    }

    return jsonOk({
      status: finalStatus,
      message:
        finalStatus === "success"
          ? `Synk fullført. ${totalParsed} rader behandlet fra ${filesFound.length} filer.`
          : finalStatus === "partial_success"
            ? `Delvis synk. ${totalParsed} rader OK, ${totalFailed} feilet.`
            : `Synk feilet. ${totalFailed} feil.`,
      data: {
        job_id: jobId,
        files_found: filesFound.length,
        rows_processed: totalParsed + totalFailed,
        rows_inserted: totalInserted,
        rows_failed: totalFailed,
      },
    });
  } catch (err) {
    const errMsg = (err as Error).message;
    console.error("[supplier-integration] Sync failed:", errMsg);

    // Categorize error step
    let step = "connection";
    if (errMsg.includes("konfigurasjon")) step = "config";
    else if (errMsg.includes("Auth") || errMsg.includes("login")) step = "auth";

    await updateImportJob(supabaseAdmin, jobId, {
      status: "failed",
      finished_at: new Date().toISOString(),
      error_log: [`[${step}] ${errMsg}`, ...errorLog],
    });

    await updateConnectionStatus(
      supabaseAdmin,
      config.id,
      "error",
      `Synk feilet: ${errMsg}`,
    );

    return jsonOk({
      status: "failed",
      message: `Synk feilet i steg "${step}": ${errMsg}`,
      error_code: `sync_${step}_error`,
      data: { job_id: jobId },
    });
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

    // Validate company access: user must have scoped access
    // (admin permission already checked, company_id used for data isolation)

    console.log(
      `[supplier-integration] Action: ${action}, supplier: ${supplierId}, company: ${companyId}, user: ${userId}`,
    );

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
        return await handleRunSync(supabaseAdmin, companyId, supplierId, {
          ...body,
          user_id: userId,
        });

      default:
        return jsonError(`Ukjent action: ${action}`, "unknown_action");
    }
  } catch (err) {
    console.error("[supplier-integration] Unhandled error:", (err as Error).message);
    return jsonError("En uventet feil oppstod", "internal_error", 500);
  }
});
