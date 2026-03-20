import type { ProductImportJob } from "@/types/product-module";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, CheckCircle2, AlertTriangle, XCircle, Clock, Play } from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";

interface Props {
  jobs: ProductImportJob[];
  loading: boolean;
}

// Match server-side stale threshold (10 minutes)
const STALE_JOB_MS = 10 * 60 * 1000;

const statusConfig: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
  queued: { icon: Clock, color: "text-muted-foreground", label: "I kø" },
  running: { icon: Play, color: "text-primary", label: "Kjører" },
  success: { icon: CheckCircle2, color: "text-green-600", label: "Fullført" },
  partial_success: { icon: AlertTriangle, color: "text-yellow-600", label: "Delvis" },
  failed: { icon: XCircle, color: "text-destructive", label: "Feilet" },
};

const jobTypeLabels: Record<string, string> = {
  connection_test: "Tilkoblingstest",
  catalog_sync: "Katalogsynk",
  price_sync: "Prissynk",
  discount_sync: "Rabattsynk",
  full_sync: "Full synk",
};

function getHeartbeat(job: ProductImportJob) {
  return job.last_heartbeat_at ?? job.updated_at ?? job.created_at;
}

function isJobStalled(job: ProductImportJob) {
  if (job.status !== "running") return false;
  return Date.now() - new Date(getHeartbeat(job)).getTime() > STALE_JOB_MS;
}

export function ImportJobHistory({ jobs, loading }: Props) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <FileText className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">Ingen importjobber ennå</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Kjør en synkronisering for å se resultater her</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {jobs.map((job) => {
        const stalled = isJobStalled(job);
        const cfg = stalled
          ? { icon: AlertTriangle, color: "text-destructive", label: "Stoppet opp" }
          : statusConfig[job.status] ?? statusConfig.queued;
        const Icon = cfg.icon;

        return (
          <Card key={job.id} className="hover:shadow-sm transition-shadow">
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-3">
                <Icon className={`h-4 w-4 ${cfg.color} shrink-0`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">
                      {jobTypeLabels[job.job_type] ?? job.job_type}
                    </span>
                    <Badge variant="outline" className={`text-[10px] ${cfg.color}`}>{cfg.label}</Badge>
                    {job.total_chunks > 0 && (
                      <Badge variant="secondary" className="text-[10px]">
                        Batch {Math.min(job.current_chunk, job.total_chunks)}/{job.total_chunks} · {job.progress_percent}%
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-4 mt-1 text-[10px] text-muted-foreground flex-wrap">
                    <span>{format(new Date(job.created_at), "d. MMM yyyy HH:mm", { locale: nb })}</span>
                    {job.rows_processed > 0 && (
                      <span>
                        {job.rows_processed} rader – {job.rows_inserted} nye, {job.rows_updated} oppdatert
                        {job.rows_failed > 0 && <span className="text-destructive"> , {job.rows_failed} feilet</span>}
                      </span>
                    )}
                    {job.started_at && job.finished_at && (
                      <span>
                        Varighet: {Math.round((new Date(job.finished_at).getTime() - new Date(job.started_at).getTime()) / 1000)}s
                      </span>
                    )}
                    {job.status === "running" && (
                      <span>
                        Sist livstegn: {format(new Date(getHeartbeat(job)), "HH:mm:ss", { locale: nb })}
                      </span>
                    )}
                  </div>
                  {stalled && (
                    <p className="mt-1 text-[10px] text-destructive">Ser ut til å ha stoppet opp.</p>
                  )}
                </div>
              </div>

              {(job.status === "failed" || stalled) && (job.failed_step || job.last_error_message || job.error_message || (Array.isArray(job.error_log) && job.error_log.length > 0)) && (
                <div className="mt-2 p-2 rounded bg-destructive/5 border border-destructive/10 space-y-1">
                  {job.failed_step && (
                    <p className="text-[10px] text-destructive font-mono">Steg: {job.failed_step}</p>
                  )}
                  {job.last_error_batch != null && (
                    <p className="text-[10px] text-destructive font-mono">
                      Feilet på batch {job.last_error_batch}/{job.total_chunks}
                      {job.last_successful_batch != null && job.last_successful_batch > 0 && (
                        <span className="text-muted-foreground"> (siste OK: batch {job.last_successful_batch})</span>
                      )}
                    </p>
                  )}
                  {(job.last_error_message || job.error_message) && (
                    <p className="text-[10px] text-destructive font-mono">
                      {job.last_error_message || job.error_message}
                    </p>
                  )}
                  {Array.isArray(job.error_log) && job.error_log.length > 0 && !job.last_error_message && (
                    <p className="text-[10px] text-destructive font-mono">
                      {typeof job.error_log[0] === "string" ? job.error_log[0] : JSON.stringify(job.error_log[0])}
                    </p>
                  )}
                </div>
              )}

              {Array.isArray(job.files_found) && job.files_found.length > 0 && (
                <div className="mt-2 flex gap-1 flex-wrap">
                  {(job.files_found as any[]).slice(0, 5).map((f, i) => (
                    <Badge key={i} variant="secondary" className="text-[9px] font-mono">
                      {typeof f === "string" ? f : (f as any)?.name ?? "fil"}
                    </Badge>
                  ))}
                  {job.files_found.length > 5 && (
                    <Badge variant="secondary" className="text-[9px]">
                      +{job.files_found.length - 5} til
                    </Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
