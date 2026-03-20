/**
 * useSupplierActions – Edge function calls for supplier integration actions.
 *
 * Provides: savePassword, testConnection, listFiles, runSync
 * All calls go through the supplier-integration edge function.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface ActionResult<T = unknown> {
  success: boolean;
  status?: string;
  message?: string;
  data?: T;
  error_code?: string;
}

interface PolledImportJob {
  status: string;
  rows_processed: number;
  rows_inserted: number;
  rows_updated: number;
  rows_failed: number;
  current_chunk: number;
  total_chunks: number;
  progress_percent: number;
  last_heartbeat_at: string | null;
  updated_at: string;
}

export interface FileListFile {
  name: string;
  size: number;
  modified_at: string | null;
  type: string;
  categories: string[];
}

export interface FileListData {
  all_files: FileListFile[];
  matched: {
    catalog: Array<{ name: string; size: number }>;
    price: Array<{ name: string; size: number }>;
    discount: Array<{ name: string; size: number }>;
    invoice: Array<{ name: string; size: number }>;
  };
  warnings: string[];
  debug?: {
    patterns: Record<string, string | null>;
    file_names: string[];
    match_log: Array<{ file: string; category: string; result: boolean; method: string }>;
  };
}

// Match server-side stale threshold (10 minutes)
const STALE_JOB_MS = 10 * 60 * 1000;

async function invokeAction<T = unknown>(
  action: string,
  body: Record<string, unknown>,
): Promise<ActionResult<T>> {
  const { data, error } = await supabase.functions.invoke("supplier-integration", {
    body: { action, ...body },
  });

  if (error) {
    console.error(`[useSupplierActions] ${action} error:`, error);
    throw new Error(error.message || "Feil ved kall til backend");
  }

  return data as ActionResult<T>;
}

function isJobStale(job: PolledImportJob) {
  const heartbeat = job.last_heartbeat_at ?? job.updated_at;
  return Date.now() - new Date(heartbeat).getTime() > STALE_JOB_MS;
}

export function useSupplierActions(supplierId: string | undefined) {
  const { activeCompanyId } = useCompanyContext();
  const qc = useQueryClient();

  const [testingConnection, setTestingConnection] = useState(false);
  const [listingFiles, setListingFiles] = useState(false);
  const [runningSyncType, setRunningSyncType] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  const [fileListResult, setFileListResult] = useState<FileListData | null>(null);
  const [testResult, setTestResult] = useState<ActionResult | null>(null);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    };
  }, []);

  const invalidateQueries = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["supplier-integration", activeCompanyId, supplierId] });
    qc.invalidateQueries({ queryKey: ["product-import-jobs", activeCompanyId, supplierId] });
  }, [qc, activeCompanyId, supplierId]);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
    if (pollTimeoutRef.current) { clearTimeout(pollTimeoutRef.current); pollTimeoutRef.current = null; }
  }, []);

  const savePassword = useCallback(
    async (integrationId: string, password: string) => {
      if (!activeCompanyId) return;
      setSavingPassword(true);
      try {
        await invokeAction("save-password", {
          company_id: activeCompanyId,
          integration_id: integrationId,
          password,
        });
        toast.success("Passord lagret sikkert");
      } catch (err) {
        toast.error("Feil ved lagring av passord", {
          description: (err as Error).message,
        });
      } finally {
        setSavingPassword(false);
      }
    },
    [activeCompanyId],
  );

  const testConnection = useCallback(async () => {
    if (!activeCompanyId || !supplierId) return;
    setTestingConnection(true);
    setTestResult(null);
    try {
      const result = await invokeAction("test-connection", {
        company_id: activeCompanyId,
        supplier_id: supplierId,
      });
      setTestResult(result);

      if (result.status === "ok") {
        toast.success(result.message || "Tilkobling OK");
      } else if (result.status === "warning") {
        toast.warning(result.message || "Tilkobling med advarsel");
      } else {
        toast.error(result.message || "Tilkobling feilet");
      }

      invalidateQueries();
    } catch (err) {
      toast.error("Tilkoblingstest feilet", {
        description: (err as Error).message,
      });
    } finally {
      setTestingConnection(false);
    }
  }, [activeCompanyId, supplierId, invalidateQueries]);

  const listFiles = useCallback(async () => {
    if (!activeCompanyId || !supplierId) return;
    setListingFiles(true);
    setFileListResult(null);
    try {
      const result = await invokeAction<FileListData>("list-files", {
        company_id: activeCompanyId,
        supplier_id: supplierId,
      });

      if (result.data) {
        setFileListResult(result.data);
        const total = result.data.all_files?.length ?? 0;
        toast.success(`${total} filer funnet`);
      } else {
        toast.warning(result.message || "Ingen data returnert");
      }

      invalidateQueries();
    } catch (err) {
      toast.error("Filhenting feilet", {
        description: (err as Error).message,
      });
    } finally {
      setListingFiles(false);
    }
  }, [activeCompanyId, supplierId, invalidateQueries]);

  const runSync = useCallback(
    async (syncType: string = "full_sync") => {
      if (!activeCompanyId || !supplierId) return;
      stopPolling();
      setRunningSyncType(syncType);
      try {
        const result = await invokeAction<{ job_id: string; job_status?: string; progress_percent?: number }>("run-sync", {
          company_id: activeCompanyId,
          supplier_id: supplierId,
          sync_type: syncType,
        });

        if (result.status === "already_running") {
          const pct = result.data?.progress_percent ?? 0;
          toast.warning(`Sync kjører allerede (${pct}% ferdig)`, {
            description: "Vent til pågående jobb er ferdig før du starter en ny.",
          });
          setRunningSyncType(null);
          invalidateQueries();
          return;
        }

        if (result.status !== "started" || !result.data?.job_id) {
          toast.error(result.message || "Kunne ikke starte synk");
          setRunningSyncType(null);
          return;
        }

        const jobId = result.data.job_id;
        toast.info("Synkronisering startet – følg fremdriften i importloggen");

        pollIntervalRef.current = setInterval(async () => {
          try {
            const { data: job } = await supabase
              .from("product_import_jobs")
              .select("status, rows_processed, rows_inserted, rows_updated, rows_failed, current_chunk, total_chunks, progress_percent, last_heartbeat_at, updated_at")
              .eq("id", jobId)
              .maybeSingle<PolledImportJob>();

            if (!job) return;

            if (job.status === "running" && isJobStale(job)) {
              await invokeAction("mark-stale-job", {
                company_id: activeCompanyId,
                supplier_id: supplierId,
                job_id: jobId,
              }).catch(() => undefined);

              stopPolling();
              setRunningSyncType(null);
              invalidateQueries();
              toast.error("Synk ser ut til å ha stoppet opp");
              return;
            }

            const done = ["success", "partial_success", "failed"].includes(job.status);
            if (done) {
              stopPolling();
              setRunningSyncType(null);
              invalidateQueries();

              if (job.status === "success") {
                toast.success(`Synk fullført: ${job.rows_inserted ?? 0} nye, ${job.rows_updated ?? 0} oppdatert`);
              } else if (job.status === "partial_success") {
                toast.warning(`Delvis synk: ${job.rows_inserted ?? 0} nye, ${job.rows_failed ?? 0} feilet`);
              } else {
                toast.error("Synk feilet – se importlogg for detaljer");
              }
            } else {
              invalidateQueries();
            }
          } catch {
            // Ignore polling errors
          }
        }, 5000);

        pollTimeoutRef.current = setTimeout(() => {
          stopPolling();
          setRunningSyncType(null);
          invalidateQueries();
          toast.warning("Synk tar lengre tid enn forventet – sjekk importloggen");
        }, 10 * 60 * 1000);
      } catch (err) {
        toast.error("Synk feilet", {
          description: (err as Error).message,
        });
        setRunningSyncType(null);
      }
    },
    [activeCompanyId, supplierId, invalidateQueries, stopPolling],
  );

  return {
    savePassword,
    testConnection,
    listFiles,
    runSync,
    testingConnection,
    listingFiles,
    runningSyncType,
    savingPassword,
    fileListResult,
    testResult,
    clearFileList: () => setFileListResult(null),
  };
}
