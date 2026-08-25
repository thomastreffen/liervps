/**
 * Synk-status og feillogg for Google Kalender (kun admin/superadmin eller egne rader via RLS).
 */
import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface LogRow {
  id: string;
  action: string;
  status: string;
  google_event_id: string | null;
  error_code: string | null;
  error_detail: string | null;
  created_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  created: "Opprettet",
  updated: "Oppdatert",
  deleted: "Slettet",
  not_found: "Ingen kobling",
  error: "Feil",
};

export function CalendarSyncLogCard() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("google_calendar_sync_log")
      .select("id, action, status, google_event_id, error_code, error_detail, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    setRows((data as LogRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const lastError = rows.find((r) => r.status === "error");

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Kalender-synk · status og feillogg</CardTitle>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading} className="gap-1.5">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Oppdater
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {lastError && (
          <p className="text-xs text-destructive">
            Siste feil: {lastError.error_code} · {lastError.error_detail ?? "ukjent"}
          </p>
        )}
        {rows.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground">Ingen synkroniseringer registrert ennå.</p>
        )}
        <ul className="divide-y">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant={r.status === "error" ? "destructive" : "secondary"}>
                    {STATUS_LABEL[r.status] ?? r.status}
                  </Badge>
                  <span className="text-muted-foreground text-xs">{r.action}</span>
                </div>
                {r.error_detail && (
                  <p className="truncate text-xs text-muted-foreground">{r.error_detail}</p>
                )}
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {new Date(r.created_at).toLocaleString("nb-NO")}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
