/**
 * useSupplierActions – Edge function calls for supplier integration actions.
 *
 * Provides: savePassword, testConnection, listFiles, runSync
 * All calls go through the supplier-integration edge function.
 */

import { useState, useCallback, useEffect, useRef } from "react";
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

interface SyncResultData {
  job_id: string;
  files_found: number;
  rows_processed: number;
  rows_inserted: number;
  rows_failed: number;
}

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

export function useSupplierActions(supplierId: string | undefined) {
  const { activeCompanyId } = useCompanyContext();
  const qc = useQueryClient();

  const [testingConnection, setTestingConnection] = useState(false);
  const [listingFiles, setListingFiles] = useState(false);
  const [runningSyncType, setRunningSyncType] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  const [fileListResult, setFileListResult] = useState<FileListData | null>(null);
  const [testResult, setTestResult] = useState<ActionResult | null>(null);

  const invalidateQueries = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["supplier-integration", activeCompanyId, supplierId] });
    qc.invalidateQueries({ queryKey: ["product-import-jobs", activeCompanyId, supplierId] });
  }, [qc, activeCompanyId, supplierId]);

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
      setRunningSyncType(syncType);
      try {
        const result = await invokeAction<SyncResultData>("run-sync", {
          company_id: activeCompanyId,
          supplier_id: supplierId,
          sync_type: syncType,
        });

        if (result.status === "accepted") {
          toast.success(result.message || "Synk startet i bakgrunnen");
          // Poll for completion
          const jobId = result.data?.job_id;
          if (jobId) {
            const pollInterval = setInterval(async () => {
              try {
                const { data: job } = await supabase
                  .from("product_import_jobs")
                  .select("status, rows_processed, rows_inserted, rows_failed")
                  .eq("id", jobId)
                  .maybeSingle();
                if (job && !["queued", "running"].includes(job.status)) {
                  clearInterval(pollInterval);
                  setRunningSyncType(null);
                  invalidateQueries();
                  if (job.status === "success") {
                    toast.success(`Synk fullført: ${job.rows_inserted} nye, ${job.rows_processed} behandlet`);
                  } else if (job.status === "partial_success") {
                    toast.warning(`Synk delvis: ${job.rows_inserted} nye, ${job.rows_failed} feilet`);
                  } else {
                    toast.error("Synk feilet – se importlogg for detaljer");
                  }
                }
              } catch { /* ignore poll errors */ }
            }, 5000);
            // Safety timeout: stop polling after 5 minutes
            setTimeout(() => { clearInterval(pollInterval); setRunningSyncType(null); }, 300_000);
          }
          return; // Don't clear runningSyncType yet – polling will do it
        }

        if (result.status === "success") {
          toast.success(result.message || "Synk fullført");
        } else if (result.status === "partial_success") {
          toast.warning(result.message || "Delvis synk");
        } else {
          toast.error(result.message || "Synk feilet");
        }

        invalidateQueries();
      } catch (err) {
        toast.error("Synk feilet", {
          description: (err as Error).message,
        });
      } finally {
        if (runningSyncType !== syncType) return; // polling handles cleanup for accepted
        setRunningSyncType(null);
      }
    },
    [activeCompanyId, supplierId, invalidateQueries, runningSyncType],
  );

  return {
    // Actions
    savePassword,
    testConnection,
    listFiles,
    runSync,

    // Loading states
    testingConnection,
    listingFiles,
    runningSyncType,
    savingPassword,

    // Results
    fileListResult,
    testResult,
    clearFileList: () => setFileListResult(null),
  };
}
