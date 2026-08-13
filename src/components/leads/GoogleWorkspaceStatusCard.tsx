import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, CircleSlash, ExternalLink, FolderPlus, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";

interface Props {
  leadId: string;
  publicLeadId?: string | null;
}

type State = "ok" | "missing" | "failed";

function Row({ label, state, note }: { label: string; state: State; note?: string }) {
  const Icon = state === "ok" ? CheckCircle2 : state === "failed" ? XCircle : CircleSlash;
  const color =
    state === "ok" ? "text-emerald-600" : state === "failed" ? "text-destructive" : "text-muted-foreground";
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className={`h-4 w-4 shrink-0 ${color}`} />
      <span className="text-foreground">{label}</span>
      {note && <span className="text-xs text-muted-foreground">· {note}</span>}
    </div>
  );
}

/** Kompakt status for Gmail-varsel, kalenderhendelse og Drive-mappe. */
export function GoogleWorkspaceStatusCard({ leadId, publicLeadId }: Props) {
  const [loading, setLoading] = useState(true);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [notify, setNotify] = useState<string | null>(null);
  const [calendar, setCalendar] = useState<string | null>(null);
  const [driveState, setDriveState] = useState<string | null>(null);
  const [driveUrl, setDriveUrl] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [leadRes, plRes, logRes] = await Promise.all([
      supabase.from("leads").select("drive_folder_url").eq("id", leadId).maybeSingle(),
      publicLeadId
        ? supabase.from("public_leads").select("internal_notify_status, internal_notified_at").eq("id", publicLeadId).maybeSingle()
        : Promise.resolve({ data: null } as any),
      supabase
        .from("activity_log")
        .select("metadata, created_at")
        .eq("entity_type", "lead")
        .eq("entity_id", leadId)
        .eq("action", "google_workspace_sync")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    setDriveUrl(((leadRes as any)?.data?.drive_folder_url as string | null) ?? null);
    setNotify(((plRes as any)?.data?.internal_notify_status as string | null) ?? null);
    const meta = ((logRes as any)?.data?.metadata ?? null) as any;
    setCalendar(meta?.calendar ?? null);
    setDriveState(meta?.drive ?? null);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId, publicLeadId]);

  const createFolder = async () => {
    setCreatingFolder(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-drive-folder", { body: { lead_id: leadId } });
      if (error || !data || data.status === "error") toast.error("Kunne ikke opprette Drive-mappe");
      else if (data.status === "no_token") toast.info("Google Drive ikke koblet til.");
      else {
        toast.success("Drive-mappe klar");
        setDriveUrl(data.folder_url ?? null);
      }
    } finally {
      setCreatingFolder(false);
    }
  };

  const notifyState: State = notify === "sent" ? "ok" : notify === "error" ? "failed" : "missing";
  const calState: State = calendar === "created" ? "ok" : calendar === "failed" ? "failed" : "missing";
  const drState: State = driveUrl ? "ok" : driveState === "failed" ? "failed" : "missing";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Google Workspace</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <>
            <Row
              label={notifyState === "ok" ? "Gmail-varsel sendt" : "Gmail-varsel ikke sendt"}
              state={notifyState}
              note={notify === "no_token" ? "Gmail ikke koblet til" : undefined}
            />
            <Row
              label={calState === "ok" ? "Kalenderhendelse opprettet" : "Kalenderhendelse ikke opprettet"}
              state={calState}
            />
            <Row label={drState === "ok" ? "Drive-mappe opprettet" : "Drive-mappe ikke opprettet"} state={drState} />

            <div className="flex flex-wrap gap-2 pt-1">
              {driveUrl ? (
                <Button asChild size="sm" variant="outline" className="gap-1.5">
                  <a href={driveUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" /> Åpne Drive-mappe
                  </a>
                </Button>
              ) : (
                <Button size="sm" variant="outline" className="gap-1.5" onClick={createFolder} disabled={creatingFolder}>
                  {creatingFolder ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderPlus className="h-3.5 w-3.5" />}
                  Opprett Drive-mappe
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
