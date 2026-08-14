import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wrench, Plus, ArrowRight } from "lucide-react";

interface JobRow {
  id: string;
  title: string;
  status: string;
  start_time: string;
  address: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  requested: "Utkast",
  approved: "Godkjent",
  scheduled: "Planlagt",
  in_progress: "Pågår",
  completed: "Utført",
  invoiced: "Fakturert",
};

export function LeadLinkedJobsCard({ leadId, refreshKey, onCreate }: { leadId: string; refreshKey?: number; onCreate: () => void }) {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<JobRow[]>([]);

  const fetchJobs = useCallback(async () => {
    const { data } = await supabase
      .from("events")
      .select("id, title, status, start_time, address")
      .eq("source_lead_id", leadId)
      .is("deleted_at", null)
      .order("start_time", { ascending: false });
    setJobs((data as any) || []);
  }, [leadId]);

  useEffect(() => { fetchJobs(); }, [fetchJobs, refreshKey]);

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Oppdrag fra henvendelsen</CardTitle>
          <Button size="sm" variant="ghost" className="gap-1 h-7 text-xs" onClick={onCreate}>
            <Plus className="h-3 w-3" /> Nytt oppdrag
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {jobs.length === 0 ? (
          <div className="text-center py-4">
            <Wrench className="h-6 w-6 mx-auto mb-1.5 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground/60">Ingen oppdrag ennå</p>
          </div>
        ) : (
          <div className="space-y-2">
            {jobs.map(job => (
              <div
                key={job.id}
                onClick={() => navigate(`/projects/${job.id}`)}
                className="flex items-center gap-3 py-2.5 px-2 border-b border-border/20 last:border-0 group rounded-lg hover:bg-secondary/40 cursor-pointer transition-colors"
              >
                <Wrench className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{job.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {format(new Date(job.start_time), "d. MMM yyyy 'kl.' HH:mm", { locale: nb })}
                    {job.address ? ` · ${job.address}` : ""}
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px]">{STATUS_LABEL[job.status] || job.status}</Badge>
                <ArrowRight className="h-3 w-3 text-muted-foreground/0 group-hover:text-primary/50 transition-all shrink-0" />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
